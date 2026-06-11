import { isDesktopRuntime, tauriInvoke } from '../../../lib/api.js';

// Client-side text extraction for binary documents.
//
// The bundled Reborn sidecar inlines TEXT attachments into the model's
// context but has no binary extractors — a raw PDF/DOCX/XLSX payload never
// reaches the model at all (it reports "no files attached"). Until the
// sidecar grows real extraction, the composer extracts text here and ships
// it as the attachment payload: original filename preserved for the thread,
// mime text/plain so the backend inlines the content.

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const DOCM_MIME = 'application/vnd.ms-word.document.macroEnabled.12';
const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const XLSM_MIME = 'application/vnd.ms-excel.sheet.macroEnabled.12';
const PPTX_MIME = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
const PPTM_MIME = 'application/vnd.ms-powerpoint.presentation.macroEnabled.12';
const MAX_EXTRACT_CHARS = 200_000;

function lowerName(info) {
  return String(info?.filename || '').toLowerCase();
}

export function isPdfAttachment(info) {
  return info?.mime_type === 'application/pdf' || lowerName(info).endsWith('.pdf');
}

// Macro variants (.docm/.xlsm/.pptm) are the same OOXML zip inside — they
// route to the same extractors.
export function isDocxAttachment(info) {
  const name = lowerName(info);
  return (
    info?.mime_type === DOCX_MIME ||
    info?.mime_type === DOCM_MIME ||
    name.endsWith('.docx') ||
    name.endsWith('.docm')
  );
}

export function isXlsxAttachment(info) {
  const name = lowerName(info);
  return (
    info?.mime_type === XLSX_MIME ||
    info?.mime_type === XLSM_MIME ||
    name.endsWith('.xlsx') ||
    name.endsWith('.xlsm')
  );
}

export function isPptxAttachment(info) {
  const name = lowerName(info);
  return (
    info?.mime_type === PPTX_MIME ||
    info?.mime_type === PPTM_MIME ||
    name.endsWith('.pptx') ||
    name.endsWith('.pptm')
  );
}

// Legacy binary Office formats (CFB containers, not zip): no dependency-free
// extractor exists at sane size, and raw-shipping them is dishonest (the
// model never sees attachment bytes). The composer rejects these with a
// convert-and-reattach notice. Extension is authoritative — some platforms
// report text formats (e.g. CSV) under legacy Office mimes.
const LEGACY_OFFICE = [
  { ext: '.xls', mime: 'application/vnd.ms-excel', upgrade: '.xlsx' },
  { ext: '.doc', mime: 'application/msword', upgrade: '.docx' },
  { ext: '.ppt', mime: 'application/vnd.ms-powerpoint', upgrade: '.pptx' }
];

export function legacyOfficeUpgrade(info) {
  const name = lowerName(info);
  for (const { ext, upgrade } of LEGACY_OFFICE) {
    if (name.endsWith(ext)) return upgrade;
  }
  const dot = name.lastIndexOf('.');
  const hasKnownExtension = dot !== -1 && name.length - dot <= 6;
  if (!hasKnownExtension) {
    for (const { mime, upgrade } of LEGACY_OFFICE) {
      if (info?.mime_type === mime) return upgrade;
    }
  }
  return null;
}

export function isExtractableBinary(info) {
  return (
    isPdfAttachment(info) ||
    isDocxAttachment(info) ||
    isXlsxAttachment(info) ||
    isPptxAttachment(info)
  );
}

// Root-absolute asset path (mirrors index.html's loader): the app document is
// served for every route, so relative vendor paths would 404 on deep links.
function vendorPath(file) {
  const hosted =
    typeof window !== 'undefined' &&
    (window.location.pathname === '/v2' || window.location.pathname.startsWith('/v2/'));
  return hosted ? `/v2/vendor/${file}` : `/vendor/${file}`;
}

function base64ToBytes(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function textToBase64(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

/**
 * Extract readable text from a composer attachment. Returns
 * `{ extracted: true, text }` on success or `{ extracted: false }` when the
 * format is unsupported or yields nothing (scanned/image-only PDFs, etc.).
 * Never throws — a failed extraction falls back to the original payload.
 *
 * Accepts raw `bytes` (preferred — no base64 detour, so multi-hundred-MB
 * documents extract without materializing a base64 string) or `base64`.
 *
 * @param {{ bytes?: Uint8Array, base64?: string, mime_type?: string, filename?: string }} info
 */
export async function extractAttachmentText(info, options = {}) {
  const onProgress = typeof options.onProgress === 'function' ? options.onProgress : null;
  try {
    const bytes = info.bytes instanceof Uint8Array ? info.bytes : base64ToBytes(info.base64);
    let text = '';
    let method = 'text';
    let partial = false;
    if (isPdfAttachment(info)) {
      // pdf.js TRANSFERS the buffer to its worker (detaching it) — hand the
      // text pass a copy so the original survives for the OCR fallback.
      text = await extractPdfText(bytes.slice());
      if (!(text || '').trim()) {
        // No text layer — a scanned/image-only PDF. OCR the rendered pages
        // locally (tesseract.js, fully offline). Slow but honest: progress
        // is reported per page so the chip never looks stuck.
        text = await ocrPdf(bytes, onProgress);
        method = 'ocr';
      }
    } else if (isDocxAttachment(info) || isXlsxAttachment(info) || isPptxAttachment(info)) {
      // OOXML documents are ZIP packages. A non-zip container means the file
      // is either encrypted/password-protected (a CFB/OLE compound file) or
      // corrupt — distinguish them so the user gets an action, not a shrug.
      if (looksLikeCfb(bytes)) {
        return { extracted: false, reason: 'encrypted' };
      }
      // No locatable central directory means a truncated/corrupt package —
      // report it as such rather than "no readable text". This check is
      // prefix-aware (SFX/BOM/polyglot stubs shift the headers), so it is the
      // authority rather than a first-bytes `PK` sniff.
      if (!zipHasCentralDirectory(bytes)) {
        return { extracted: false, reason: 'corrupt' };
      }
      let extracted;
      if (isDocxAttachment(info)) extracted = await extractDocxText(bytes);
      else if (isXlsxAttachment(info)) extracted = await extractXlsxText(bytes);
      else extracted = await extractPptxText(bytes);
      text = extracted.text;
      // Nothing recovered AND a wanted part failed to inflate → the package is
      // damaged, not legitimately empty. Some recovered + a failure → PARTIAL:
      // surface it so a dropped sheet/part isn't a silent success.
      if (!isMeaningfulText(text) && extracted.degraded) {
        return { extracted: false, reason: 'corrupt' };
      }
      partial = Boolean(extracted.degraded);
    } else {
      return { extracted: false, reason: 'unsupported' };
    }
    if (!isMeaningfulText(text)) return { extracted: false, reason: 'empty' };
    return { extracted: true, text: text.trim().slice(0, MAX_EXTRACT_CHARS), method, partial };
  } catch (_) {
    return { extracted: false, reason: 'error' };
  }
}

// Emptiness test only: a string that is whitespace, NUL or zero-width
// formatting code points (ZWSP/ZWNJ/ZWJ/word-joiner/BOM) carries no readable
// content even though `.trim()` alone keeps the zero-width characters.
const ZERO_WIDTH = /[\u0000\u200B\u200C\u200D\u2060\uFEFF]/g;
function isMeaningfulText(text) {
  return (
    String(text || '')
      .replace(ZERO_WIDTH, '')
      .trim() !== ''
  );
}

// CFB/OLE compound-file magic (D0 CF 11 E0 A1 B1 1A E1): encrypted or legacy
// binary Office saved under an OOXML extension.
function looksLikeCfb(bytes) {
  return (
    bytes.length >= 8 &&
    bytes[0] === 0xd0 &&
    bytes[1] === 0xcf &&
    bytes[2] === 0x11 &&
    bytes[3] === 0xe0 &&
    bytes[4] === 0xa1 &&
    bytes[5] === 0xb1 &&
    bytes[6] === 0x1a &&
    bytes[7] === 0xe1
  );
}

// ── PDF (pdf.js, vendored) ─────────────────────────────────────────────

let pdfjsPromise = null;

// Exported for the attachment preview: shares the cached module promise and
// the desktop fake-worker setup instead of duplicating either.
export function loadPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = import(/* @vite-ignore */ vendorPath('pdf.min.mjs')).then(async (pdfjs) => {
      if (isDesktopRuntime()) {
        // WKWebView constructs Workers from custom-scheme URLs unreliably:
        // the script load can neither error nor complete, and pdf.js then
        // waits on its handshake forever (intermittent multi-minute hang in
        // the packaged smoke). Importing the worker module on the MAIN
        // thread — page-level dynamic import through the scheme handler is
        // reliable — and publishing it as `globalThis.pdfjsWorker` makes
        // pdf.js take its fake-worker path deterministically: PDFWorker
        // sees `WorkerMessageHandler` and never constructs a real Worker.
        globalThis.pdfjsWorker = await import(/* @vite-ignore */ vendorPath('pdf.worker.min.mjs'));
      }
      pdfjs.GlobalWorkerOptions.workerSrc = vendorPath('pdf.worker.min.mjs');
      return pdfjs;
    });
  }
  return pdfjsPromise;
}

async function extractPdfText(bytes) {
  const pdfjs = await loadPdfjs();
  const doc = await pdfjs.getDocument({ data: bytes }).promise;
  const parts = [];
  for (let pageNo = 1; pageNo <= doc.numPages; pageNo += 1) {
    const page = await doc.getPage(pageNo);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => (typeof item.str === 'string' ? item.str : ''))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (pageText) parts.push(pageText);
    if (parts.join('\n').length > MAX_EXTRACT_CHARS) break;
  }
  await doc.destroy().catch(() => {});
  return parts.join('\n\n');
}

// ── OCR for scanned PDFs (tesseract.js, fully local) ───────────────────
//
// The OCR stack (worker + SIMD wasm core + eng traineddata, ~11 MB) ships in
// static/ocr and loads lazily on the first scanned document. Pages render
// through pdf.js to a canvas, capped for time: OCR costs seconds per page.

const OCR_MAX_PAGES = 8;
const OCR_TARGET_WIDTH = 1600;
// Below this mean recognition confidence the "text" is noise (photographs,
// artwork, handwriting tesseract can't read) — shipping it to the model is
// worse than the honest no-readable-text notice.
const OCR_MIN_CONFIDENCE = 45;

function ocrPath(file) {
  const hosted =
    typeof window !== 'undefined' &&
    (window.location.pathname === '/v2' || window.location.pathname.startsWith('/v2/'));
  return hosted ? `/v2/ocr/${file}` : `/ocr/${file}`;
}

let ocrWorkerPromise = null;
let ocrAssetBasePromise = null;

// Where the OCR WORKER loads its assets from. In the packaged desktop the
// worker cannot fetch tauri:// URLs (WKWebView custom-scheme handlers do not
// apply inside Web Workers), so the Rust side serves the asset pack over
// loopback HTTP. Hosted/dev builds use the plain static paths.
function ocrAssetBase() {
  if (!ocrAssetBasePromise) {
    ocrAssetBasePromise = (async () => {
      if (isDesktopRuntime()) {
        try {
          const port = await tauriInvoke('ocr_assets_port');
          if (port) return `http://127.0.0.1:${port}`;
        } catch (_) {
          // Fall through to static paths (dev server).
        }
      }
      const hosted =
        typeof window !== 'undefined' &&
        (window.location.pathname === '/v2' || window.location.pathname.startsWith('/v2/'));
      return hosted ? '/v2/ocr' : '/ocr';
    })();
  }
  return ocrAssetBasePromise;
}

function loadOcrWorker() {
  if (!ocrWorkerPromise) {
    // The page-side ESM import stays on the app origin ('self' per CSP);
    // only the worker-fetched assets ride the loopback base.
    ocrWorkerPromise = Promise.all([
      import(/* @vite-ignore */ ocrPath('tesseract.esm.min.js')),
      ocrAssetBase()
    ]).then(([module, base]) =>
      // The ESM bundle exposes the API on its default export.
      (module.createWorker || module.default.createWorker)('eng', 1, {
        workerPath: `${base}/worker.min.js`,
        corePath: `${base}/tesseract-core-simd-lstm.wasm.js`,
        langPath: base,
        gzip: false
      })
    );
    // A failed boot must not poison every later attempt.
    ocrWorkerPromise.catch(() => {
      ocrWorkerPromise = null;
    });
  }
  return ocrWorkerPromise;
}

async function ocrPdf(bytes, onProgress) {
  if (typeof document === 'undefined') return '';
  const pdfjs = await loadPdfjs();
  // pdf.js transfers the buffer to its worker — give it a copy so the
  // caller's bytes stay usable.
  const doc = await pdfjs.getDocument({ data: bytes.slice() }).promise;
  const pageCount = Math.min(doc.numPages, OCR_MAX_PAGES);
  const worker = await loadOcrWorker();
  const parts = [];
  const confidences = [];
  try {
    for (let pageNo = 1; pageNo <= pageCount; pageNo += 1) {
      if (onProgress) onProgress({ kind: 'ocr', page: pageNo, pages: pageCount });
      const page = await doc.getPage(pageNo);
      const baseViewport = page.getViewport({ scale: 1 });
      const scale = Math.min(2.5, Math.max(1, OCR_TARGET_WIDTH / baseViewport.width));
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const context = canvas.getContext('2d', { willReadFrequently: true });
      await page.render({ canvasContext: context, viewport }).promise;
      const result = await worker.recognize(canvas);
      const pageText = (result?.data?.text || '').replace(/\s+\n/g, '\n').trim();
      const pageConfidence = Number(result?.data?.confidence);
      if (Number.isFinite(pageConfidence)) confidences.push(pageConfidence);
      if (pageText) parts.push(pageText);
      canvas.width = 0;
      canvas.height = 0;
      if (parts.join('\n').length > MAX_EXTRACT_CHARS) break;
    }
  } finally {
    await doc.destroy().catch(() => {});
  }
  const meanConfidence =
    confidences.length > 0
      ? confidences.reduce((sum, value) => sum + value, 0) / confidences.length
      : 0;
  if (meanConfidence < OCR_MIN_CONFIDENCE) return '';
  let text = parts.join('\n\n');
  if (doc.numPages > pageCount && text) {
    text += `\n\n[OCR truncated: first ${pageCount} of ${doc.numPages} pages]`;
  }
  return text;
}

// ── Minimal ZIP reader (DOCX/XLSX are zip packages) ────────────────────
//
// Reads the central directory and inflates entries with the platform's
// DecompressionStream — no vendored zip library needed.

// Read a 64-bit little-endian value as a JS number (safe: ZIP fields we read
// are well under 2^53 for any real Office document).
function readUint64(view, pos) {
  const lo = view.getUint32(pos, true);
  const hi = view.getUint32(pos + 4, true);
  return hi * 0x100000000 + lo;
}

// Locate the central directory: total entry count + byte offset. Handles the
// ZIP64 case (real Excel/Sheets exports can emit it) where the classic EOCD
// stores 0xFFFF / 0xFFFFFFFF placeholders and the real values live in the
// ZIP64 EOCD record pointed to by the ZIP64 EOCD locator. Returns null when
// no valid central directory can be found (not a zip — e.g. an encrypted
// CFB/OLE workbook, or a truncated file).
function locateCentralDirectory(view, length) {
  let eocd = -1;
  const minTail = Math.max(0, length - 65557);
  for (let i = length - 22; i >= minTail; i -= 1) {
    if (view.getUint32(i, true) !== 0x06054b50) continue;
    // Reject a stray PK\x05\x06 inside an archive comment: a genuine EOCD's
    // recorded comment length lands exactly on the end of the file.
    const commentLen = view.getUint16(i + 20, true);
    if (i + 22 + commentLen === length) {
      eocd = i;
      break;
    }
    if (eocd === -1) eocd = i; // remember the first as a fallback
  }
  if (eocd === -1) return null;

  let entryCount = view.getUint16(eocd + 10, true);
  let storedOffset = view.getUint32(eocd + 16, true);
  let cdSize = view.getUint32(eocd + 12, true);
  let cdEnd = eocd; // the central directory ends where the (classic) EOCD begins

  // ZIP64 path: placeholders in the classic EOCD point at the ZIP64 records,
  // which sit between the central directory and the classic EOCD.
  if (entryCount === 0xffff || storedOffset === 0xffffffff || cdSize === 0xffffffff) {
    const locatorPos = eocd - 20;
    if (locatorPos >= 0 && view.getUint32(locatorPos, true) === 0x07064b50) {
      let z64 = readUint64(view, locatorPos + 8);
      // The stored ZIP64-EOCD offset is archive-relative; for a prefixed file
      // it is wrong, so verify the signature and otherwise scan back for it.
      if (!(z64 >= 0 && z64 + 56 <= length && view.getUint32(z64, true) === 0x06064b50)) {
        z64 = -1;
        for (let i = locatorPos - 56; i >= 0; i -= 1) {
          if (view.getUint32(i, true) === 0x06064b50) {
            z64 = i;
            break;
          }
        }
      }
      if (z64 >= 0 && z64 + 56 <= length && view.getUint32(z64, true) === 0x06064b50) {
        entryCount = readUint64(view, z64 + 32);
        storedOffset = readUint64(view, z64 + 48);
        cdSize = readUint64(view, z64 + 40);
        cdEnd = z64; // the directory ends just before the ZIP64 EOCD record
      }
    }
  }

  // Prefix-delta rebasing: SFX stubs, BOM/polyglot prefixes and mail-transfer
  // artifacts shift every absolute offset by a constant. Recover it from where
  // the central directory ACTUALLY ends (cdEnd) versus where the EOCD claims it
  // starts — then verify against the central-header signature before trusting
  // the rebase, falling back to the stored offset if the rebase misses.
  let offset = storedOffset;
  if (cdSize > 0 && cdSize <= cdEnd) {
    const actualStart = cdEnd - cdSize;
    if (
      actualStart >= 0 &&
      actualStart + 4 <= length &&
      view.getUint32(actualStart, true) === 0x02014b50
    ) {
      offset = actualStart;
    }
  }
  if (offset < 0 || offset + 4 > length || view.getUint32(offset, true) !== 0x02014b50) {
    if (
      storedOffset < 0 ||
      storedOffset + 4 > length ||
      view.getUint32(storedOffset, true) !== 0x02014b50
    ) {
      return null;
    }
    offset = storedOffset;
  }
  return { entryCount, offset, delta: offset - storedOffset };
}

// True when a valid central directory header is reachable — distinguishes a
// truncated/corrupt package from a merely empty one.
function zipHasCentralDirectory(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const cd = locateCentralDirectory(view, bytes.length);
  return Boolean(
    cd && cd.offset + 4 <= bytes.length && view.getUint32(cd.offset, true) === 0x02014b50
  );
}

// Inflated-size caps. The composer only bounds the COMPRESSED upload (256 MB),
// but DEFLATE ratios reach ~1000x, so a few-KB entry can inflate to multi-GB
// and OOM-crash the WebView (zip bomb). Cap each entry and the cumulative
// total; entries past the cap are recorded in `failed`, not inflated.
const MAX_ENTRY_INFLATED_BYTES = 32 * 1024 * 1024;
const MAX_TOTAL_INFLATED_BYTES = 64 * 1024 * 1024;

// Inflate a deflate-raw stream incrementally, aborting once it exceeds `cap`
// bytes. Returns the inflated bytes, or throws past the cap so the caller skips
// the entry. Streaming (not Response.arrayBuffer) is what makes the cap real —
// it stops reading instead of materializing the whole bomb first.
async function inflateCapped(data, cap) {
  const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  const reader = stream.getReader();
  const parts = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > cap) {
        await reader.cancel();
        throw new Error('inflated entry exceeds cap');
      }
      parts.push(value);
    }
  } finally {
    reader.releaseLock?.();
  }
  const out = new Uint8Array(total);
  let pos = 0;
  for (const part of parts) {
    out.set(part, pos);
    pos += part.length;
  }
  return out;
}

// `failed`, when provided, collects the names of WANTED entries that were
// present in the directory but could not be inflated (truncated/garbage
// deflate, unsupported method, or over the inflated-size cap). Callers use it
// to tell "damaged" from "empty".
async function readZipEntries(bytes, wantedNames, failed = null) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const cd = locateCentralDirectory(view, bytes.length);
  if (!cd) return new Map();

  let offset = cd.offset;
  let totalInflated = 0;
  const out = new Map();
  // Walk by the central-header signature, not the EOCD entry count: a writer
  // that understates the count (0/1) would otherwise leave real entries unread.
  // The signature check terminates the walk; the cap is a runaway backstop.
  const MAX_ENTRIES = 1 << 20;
  for (let n = 0; n < MAX_ENTRIES; n += 1) {
    // Bounds-guard every read: a malformed/truncated central directory must
    // never throw a RangeError — it should stop the walk cleanly.
    if (offset + 46 > bytes.length || view.getUint32(offset, true) !== 0x02014b50) break;
    const method = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    // Rebase the local-header pointer by the same prefix delta as the directory.
    const localOffset = view.getUint32(offset + 42, true) + cd.delta;
    if (offset + 46 + nameLength > bytes.length) break;
    const name = new TextDecoder().decode(bytes.subarray(offset + 46, offset + 46 + nameLength));
    offset += 46 + nameLength + extraLength + commentLength;
    if (!wantedNames.some((want) => (want.test ? want.test(name) : want === name))) continue;

    // Per-entry isolation: one corrupt/truncated entry (bad deflate stream,
    // out-of-range local offset) must not zero the whole document — skip it
    // and keep extracting the others.
    try {
      if (localOffset + 30 > bytes.length) {
        if (failed) failed.add(name);
        continue;
      }
      // Local header: sizes of name/extra can differ from the central record.
      const localNameLength = view.getUint16(localOffset + 26, true);
      const localExtraLength = view.getUint16(localOffset + 28, true);
      const dataStart = localOffset + 30 + localNameLength + localExtraLength;
      if (dataStart > bytes.length) {
        if (failed) failed.add(name);
        continue;
      }
      const data = bytes.subarray(dataStart, dataStart + compressedSize);
      const remainingBudget = MAX_TOTAL_INFLATED_BYTES - totalInflated;
      if (remainingBudget <= 0) {
        // Cumulative inflated-bytes budget spent — treat the rest as
        // undecodable rather than risk OOM on a pathological package.
        if (failed) failed.add(name);
        continue;
      }
      const entryCap = Math.min(MAX_ENTRY_INFLATED_BYTES, remainingBudget);

      if (method === 0) {
        // Stored (uncompressed): a `subarray` view, but still count it toward
        // the budget and skip if a single entry blows the per-entry cap.
        if (data.length > entryCap) {
          if (failed) failed.add(name);
          continue;
        }
        out.set(name, data);
        totalInflated += data.length;
      } else if (method === 8 && typeof DecompressionStream === 'function') {
        const inflated = await inflateCapped(data, entryCap);
        out.set(name, inflated);
        totalInflated += inflated.length;
      } else if (failed) {
        failed.add(name); // unsupported compression method
      }
    } catch (_) {
      // Inflate failed (truncated/garbage deflate). Record it so the caller can
      // distinguish a damaged package from an empty one, and keep going.
      if (failed) failed.add(name);
    }
  }
  return out;
}

function decodeXmlEntities(text) {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&amp;/g, '&');
}

// Decode an XML package part, honouring its encoding. OOXML parts are usually
// UTF-8, but some tools emit UTF-16 (with or without a BOM); decoding those as
// UTF-8 either yields zero regex matches (BOM-less, NUL-interleaved) or leaks
// U+FFFD replacement chars. Sniff the BOM, then fall back to a NUL-interleave
// heuristic, then UTF-8.
function decodeXmlPart(bytes) {
  if (!bytes || bytes.length === 0) return '';
  let label = 'utf-8';
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    label = 'utf-16le';
  } else if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    label = 'utf-16be';
  } else {
    const sample = Math.min(bytes.length, 128);
    let odd = 0;
    let even = 0;
    for (let i = 0; i < sample; i += 1) {
      if (bytes[i] === 0) {
        if (i % 2) odd += 1;
        else even += 1;
      }
    }
    if (odd > sample / 4 && even === 0) label = 'utf-16le';
    else if (even > sample / 4 && odd === 0) label = 'utf-16be';
  }
  let text;
  try {
    text = new TextDecoder(label).decode(bytes);
  } catch (_) {
    text = new TextDecoder('utf-8').decode(bytes);
  }
  text = text.replace(/^﻿/, '');
  // Order matters: drop comments (their inner `>` would otherwise truncate the
  // generic tag-strip), then convert CDATA to escaped entities, then escape any
  // remaining RAW `<` that does not start a well-formed tag. The last step is
  // the load-bearing one: a stray `<` in cell/run text (bad exporters emit it
  // unescaped) makes `/<[^>]+>/` eat everything through the next real `>`,
  // silently truncating the value. After escaping, the tag-strip is a no-op on
  // it and `decodeXmlEntities` restores the literal `<`.
  text = text.replace(/<!--[\s\S]*?-->/g, ' ');
  text = neutralizeCdata(text);
  // Escape any `<` that does not begin a well-formed tag. A real tag opener is
  // a name-start char (letter, `/`, `!`, `?`) FOLLOWED by a clean `[^<>]*>`.
  // This catches every raw-`<` form a bad exporter emits in text: `< 5`
  // (space after `<`), `x<y` (no reachable `>`), and `5 < 10 > 3` (a `>` is
  // reachable but `<` is followed by a space, so it is not a tag) — while
  // real start/end tags, comments and PIs pass through untouched.
  text = text.replace(/<(?![a-zA-Z!?/][^<>]*>)/g, '&lt;');
  return text;
}

// Convert CDATA payloads to escaped entities so the downstream tag-strip and
// entity-decode treat their `<`, `>`, `&` as literal text instead of markup.
// Google Sheets and several exporters wrap values containing those characters
// in `<![CDATA[…]]>`; without this the generic `<[^>]+>` strip eats the whole
// section and ships a `]]>` artifact.
function neutralizeCdata(xml) {
  if (xml.indexOf('<![CDATA[') === -1) return xml;
  return xml.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, (_, inner) =>
    inner.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  );
}

// mc:AlternateContent wraps a modern mc:Choice and a legacy mc:Fallback. A
// compliant reader takes exactly ONE: Choice when it carries text (the common
// case — keeping both would duplicate and fuse every run), but Fallback when
// Choice is image-only and the readable text lives only in the fallback.
function resolveAlternateContent(xml) {
  if (xml.indexOf('<mc:AlternateContent') === -1) return xml;
  const hasText = (s) => /<(?:w|a):t[\s>]/.test(s);
  return xml.replace(
    /<mc:AlternateContent\b[^>]*>([\s\S]*?)<\/mc:AlternateContent>/g,
    (_, inner) => {
      const choice = inner.match(/<mc:Choice\b[^>]*>([\s\S]*?)<\/mc:Choice>/);
      const fallback = inner.match(/<mc:Fallback\b[^>]*>([\s\S]*?)<\/mc:Fallback>/);
      const choiceText = choice ? choice[1] : '';
      const fallbackText = fallback ? fallback[1] : '';
      if (choice && hasText(choiceText)) return choiceText;
      if (fallback && hasText(fallbackText)) return fallbackText;
      return choiceText || fallbackText || '';
    }
  );
}

function stripWordXml(rawXml) {
  return (
    resolveAlternateContent(rawXml)
      // Tracked CHANGES that remove text from the rendered ("all changes
      // accepted") view: w:del deletions and w:moveFrom move-sources. Each is
      // handled in TWO steps, both QUOTE-AWARE so an attribute value containing
      // `/>` (e.g. w:author="x/>y") can't be mistaken for a self-closing tag:
      //   1. Drop self-closing markers (<w:del .../>) FIRST — Word emits these
      //      for a deleted/moved paragraph mark in <w:pPr><w:rPr> on every
      //      tracked paragraph-merge.
      //   2. Drop the paired <w:del>…</w:del> blocks.
      // Step 1 must precede step 2: a self-closing marker that survived into
      // step 2 would open the lazy span and swallow every body line through to
      // the NEXT real </w:del> (an unrelated deletion many paragraphs later),
      // silently dropping all legitimate text in between. This is the general
      // rule for ANY `<tag …>[\s\S]*?</tag>` span-strip below — a self-closing
      // `<tag/>` of the same name must be removed before the span rule runs.
      // (w:ins / w:moveTo are KEPT — inserted and move-destination text is part
      // of the accepted document — so they get no span rule and their
      // self-closing paragraph-mark markers fall through to the generic strip.)
      .replace(/<w:del\b(?:[^>"']|"[^"]*"|'[^']*')*\/>/g, ' ')
      .replace(/<w:del\b(?:[^>"']|"[^"]*"|'[^']*')*>[\s\S]*?<\/w:del>/g, ' ')
      .replace(/<w:delText\b(?:[^>"']|"[^"]*"|'[^']*')*\/>/g, ' ')
      .replace(/<w:delText\b(?:[^>"']|"[^"]*"|'[^']*')*>[\s\S]*?<\/w:delText>/g, ' ')
      .replace(/<w:moveFrom\b(?:[^>"']|"[^"]*"|'[^']*')*\/>/g, ' ')
      .replace(/<w:moveFrom\b(?:[^>"']|"[^"]*"|'[^']*')*>[\s\S]*?<\/w:moveFrom>/g, ' ')
      // Field INSTRUCTION codes (TOC/PAGE/HYPERLINK directives) are machinery,
      // never rendered text — and the HYPERLINK target URL is an injection
      // vector if leaked into the model. The cached visible result is real w:t
      // and survives. Self-closing <w:instrText/> dropped first (same rule as
      // above) so it can't open a span that eats the visible field result.
      .replace(/<w:instrText\b(?:[^>"']|"[^"]*"|'[^']*')*\/>/g, ' ')
      .replace(/<w:instrText\b(?:[^>"']|"[^"]*"|'[^']*')*>[\s\S]*?<\/w:instrText>/g, ' ')
      .replace(/<w:p[ >]/g, '\n<')
      .replace(/<w:(?:br|cr)[^>]*\/?>/g, '\n')
      .replace(/<w:tab[^>]*\/>/g, '\t')
      .replace(/<[^>]+>/g, '')
      .replace(/[ \t]+\n/g, '\n')
  );
}

async function extractDocxText(bytes) {
  const failed = new Set();
  const entries = await readZipEntries(
    bytes,
    [
      'word/document.xml',
      'word/_rels/document.xml.rels',
      'word/footnotes.xml',
      'word/endnotes.xml',
      'word/comments.xml',
      /^word\/diagrams\/data\d+\.xml$/,
      /^word\/(?:header|footer)\d*\.xml$/
    ],
    failed
  );
  const xmlBytes = entries.get('word/document.xml');
  // A package with no document.xml is malformed, but a sibling part (e.g.
  // footnotes) may still carry readable text — keep going and report degraded
  // so an empty result becomes 'corrupt', never a silent 'empty'.
  const missingBody = !xmlBytes;
  const docXml = xmlBytes ? decodeXmlPart(xmlBytes) : '';
  let text = docXml ? stripWordXml(docXml) : '';

  // w:altChunk embeds a sub-document (pasted Word/HTML/RTF, imported email).
  // Its text lives in a sibling part referenced by relationship id, never in
  // document.xml — resolve and read it so the embedded body isn't lost.
  const altIds = [...docXml.matchAll(/<w:altChunk\b[^>]*\br:id="([^"]+)"/g)].map((m) => m[1]);
  if (altIds.length > 0) {
    const docRels = parseRels(
      entries.get('word/_rels/document.xml.rels') &&
        decodeXmlPart(entries.get('word/_rels/document.xml.rels')),
      'word/'
    );
    const targets = altIds.map((id) => docRels.get(id)).filter(Boolean);
    if (targets.length > 0) {
      const chunkEntries = await readZipEntries(bytes, targets);
      const chunks = [];
      for (const tgt of targets) {
        const part = chunkEntries.get(tgt);
        if (!part) continue;
        // Embedded part may be HTML/XML/text — strip tags generically.
        const t = decodeXmlEntities(
          decodeXmlPart(part)
            .replace(/<[^>]+>/g, ' ')
            .replace(/[ \t]+/g, ' ')
        ).trim();
        if (t) chunks.push(t);
      }
      if (chunks.length > 0) text += `\n\nEmbedded:\n${chunks.join('\n')}`;
    }
  }

  // Footnotes/endnotes carry the substance of legal and academic documents;
  // comments are content a user may explicitly want summarized; SmartArt node
  // text lives in word/diagrams. All in sibling parts the body never inlines.
  const notes = [];
  for (const name of ['word/footnotes.xml', 'word/endnotes.xml']) {
    const part = entries.get(name);
    if (!part) continue;
    const extra = stripWordXml(decodeXmlPart(part)).trim();
    if (extra) notes.push(extra);
  }
  if (notes.length > 0) text += `\n\nFootnotes/Endnotes:\n${notes.join('\n')}`;

  const commentsPart = entries.get('word/comments.xml');
  if (commentsPart) {
    const extra = stripWordXml(decodeXmlPart(commentsPart)).trim();
    if (extra) text += `\n\nComments:\n${extra}`;
  }

  const diagrams = [];
  for (const [name, part] of entries) {
    if (!/^word\/diagrams\/data\d+\.xml$/.test(name)) continue;
    const extra = drawingMlText(decodeXmlPart(part)).trim();
    if (extra) diagrams.push(extra);
  }
  if (diagrams.length > 0) text += `\n\nDiagrams:\n${diagrams.join('\n')}`;

  // Headers/footers carry titles, confidentiality marks, page-context lines.
  const extras = [];
  for (const [name, entryBytes] of entries) {
    if (!/^word\/(?:header|footer)\d*\.xml$/.test(name)) continue;
    const extra = stripWordXml(decodeXmlPart(entryBytes)).trim();
    if (extra) extras.push(extra);
  }
  if (extras.length > 0) text += `\n\nHeaders/Footers:\n${extras.join('\n')}`;

  return {
    text: decodeXmlEntities(text),
    degraded: missingBody || failed.has('word/document.xml')
  };
}

// Resolve a relationship Target against a package base dir (e.g. "xl/").
function resolveZipTarget(base, target) {
  let t = String(target || '').replace(/^\.\//, '');
  if (t.startsWith('/')) return t.slice(1);
  // Targets are relative to the .rels file's parent; collapse any leading
  // duplication so "xl/" + "worksheets/sheet1.xml" => "xl/worksheets/sheet1.xml".
  return (base + t).replace(/\/{2,}/g, '/');
}

// Parse a *.rels part into a Map<rId, target-path-resolved-against-base>.
function parseRels(xml, base) {
  const map = new Map();
  if (!xml) return map;
  for (const m of xml.matchAll(/<Relationship\b[^>]*>/g)) {
    const id = m[0].match(/\bId="([^"]+)"/);
    const target = m[0].match(/\bTarget="([^"]+)"/);
    if (id && target) map.set(id[1], resolveZipTarget(base, target[1]));
  }
  return map;
}

// Flatten an OOXML <si>/<is> rich string, dropping phonetic guides (<rPh>,
// furigana) so Japanese workbooks don't inline ruby text into the value.
// Drop self-closing <rPh .../> first (same self-closing-feeds-span rule as
// stripWordXml): an empty <rPh/> left in place would open the lazy span and
// swallow the real <t> value through to the next </rPh>.
function flattenRichString(inner) {
  return decodeXmlEntities(
    inner
      .replace(/<(?:\w+:)?rPh\b[^>]*\/>/g, '')
      .replace(/<(?:\w+:)?rPh\b[^>]*?>[\s\S]*?<\/(?:\w+:)?rPh>/g, '')
      .replace(/<[^>]+>/g, '')
  );
}

async function extractXlsxText(bytes) {
  const failed = new Set();
  const entries = await readZipEntries(
    bytes,
    [
      'xl/sharedStrings.xml',
      'xl/workbook.xml',
      'xl/_rels/workbook.xml.rels',
      /^xl\/worksheets\/sheet\d+\.xml$/,
      /^xl\/pivotCache\/pivotCacheDefinition\d+\.xml$/,
      /^xl\/comments(?:\d+|\/comment\d+)\.xml$/,
      /^xl\/threadedComments\/threadedComment\d+\.xml$/,
      /^xl\/drawings\/drawing\d+\.xml$/,
      /^xl\/charts\/chart\d+\.xml$/
    ],
    failed
  );
  const degraded = () => failed.size > 0;

  const shared = [];
  const sharedXml = entries.get('xl/sharedStrings.xml');
  if (sharedXml) {
    const xml = decodeXmlPart(sharedXml);
    // `<si>` may carry attributes (xml:space) and a namespace prefix (Apache
    // POI / .NET OpenXML emit `<x:si>`) — match both liberally so an entry is
    // never skipped and can't shift every subsequent shared-string index.
    for (const match of xml.matchAll(/<(?:\w+:)?si\b[^>]*>([\s\S]*?)<\/(?:\w+:)?si>/g)) {
      shared.push(flattenRichString(match[1]));
    }
  }

  // Bind sheet DISPLAY names to worksheet FILES through the relationship graph.
  // Renaming/reordering tabs (normal Excel/Sheets behaviour) makes the naive
  // "sheetN.xml is the Nth tab" assumption mislabel every sheet.
  const rels = parseRels(
    entries.get('xl/_rels/workbook.xml.rels') &&
      decodeXmlPart(entries.get('xl/_rels/workbook.xml.rels')),
    'xl/'
  );
  const ordered = [];
  const workbookXml = entries.get('xl/workbook.xml');
  if (workbookXml) {
    for (const m of decodeXmlPart(workbookXml).matchAll(/<(?:\w+:)?sheet\b[^>]*>/g)) {
      const name = m[0].match(/\bname="([^"]*)"/);
      const rid = m[0].match(/r:id="([^"]+)"/);
      const file = rid && rels.has(rid[1]) ? rels.get(rid[1]) : null;
      ordered.push({ name: name ? decodeXmlEntities(name[1]) : null, file });
    }
  }

  const sheetFiles = [...entries.keys()].filter((n) => /^xl\/worksheets\/sheet\d+\.xml$/.test(n));
  // Use the relationship-resolved plan only when it maps every sheet to a real
  // part; otherwise fall back to numeric order (still better than nothing).
  const plan =
    ordered.length > 0 && ordered.every((o) => o.file && entries.has(o.file))
      ? ordered
      : sheetFiles
          .sort(
            (a, b) =>
              Number(a.match(/sheet(\d+)\.xml$/)[1]) - Number(b.match(/sheet(\d+)\.xml$/)[1])
          )
          .map((file, i) => ({ name: ordered[i] ? ordered[i].name : null, file }));

  const extractRows = (xml) => {
    const lines = [];
    // All element regexes allow an optional namespace prefix (`x:row`, `x:c`,
    // `x:v`, `x:is`) — Apache POI / .NET OpenXML SDK / Aspose emit prefixed
    // SpreadsheetML, and a bare-tag match would silently drop every cell.
    for (const row of xml.matchAll(/<(?:\w+:)?row[^>]*>([\s\S]*?)<\/(?:\w+:)?row>/g)) {
      const cells = [];
      // Cells come in two shapes: self-closing `<c r="A1" s="1"/>` (styled
      // empty — real Excel output) and paired `<c …>…</c>`. The self-closing
      // form gets its own alternative with an empty body so it can't swallow
      // the next cell.
      for (const cell of row[1].matchAll(/<(?:\w+:)?c([^>]*?)(?:\/>|>([\s\S]*?)<\/(?:\w+:)?c>)/g)) {
        const attrs = cell[1];
        const body = cell[2] || '';
        const valueMatch = body.match(/<(?:\w+:)?v>([\s\S]*?)<\/(?:\w+:)?v>/);
        let value = valueMatch ? decodeXmlEntities(valueMatch[1]) : '';
        if (!valueMatch) {
          // openpyxl/pandas write strings as inline `<is …><t>…</t></is>` with
          // no sharedStrings table — without this every label disappears. The
          // `<is>` open tag may carry attributes and a namespace prefix.
          const inline = body.match(/<(?:\w+:)?is\b[^>]*>([\s\S]*?)<\/(?:\w+:)?is>/);
          if (inline) value = flattenRichString(inline[1]);
        }
        if (/t="s"/.test(attrs)) {
          const index = Number(value);
          if (Number.isInteger(index) && shared[index] !== undefined) {
            value = shared[index];
          } else {
            // The shared string is missing (table absent/broken or index out
            // of range). Emitting the raw integer index as the cell value
            // would ship confident garbage — drop it instead.
            value = '';
          }
        }
        cells.push(value);
      }
      if (cells.some((cell) => cell !== '')) lines.push(cells.join('\t'));
    }
    return lines;
  };

  const sections = [];
  const multi = plan.length > 1;
  plan.forEach((entry, index) => {
    const part = entry.file ? entries.get(entry.file) : null;
    if (!part) return;
    const lines = extractRows(decodeXmlPart(part));
    if (lines.length === 0) return;
    const label = entry.name || `Sheet ${index + 1}`;
    sections.push(multi ? `--- ${label} ---\n${lines.join('\n')}` : lines.join('\n'));
  });

  // Pivot VIEW sheets store no cell values — the source data lives in the
  // pivot cache. Append it ALWAYS (not gated on the workbook being otherwise
  // empty): a pivot sheet usually carries a "Grand Total" label and sibling
  // cover sheets carry text, either of which would otherwise suppress every
  // pivot cache for the whole workbook.
  const pivot = [];
  for (const [name, part] of entries) {
    if (!/^xl\/pivotCache\/pivotCacheDefinition\d+\.xml$/.test(name)) continue;
    for (const m of decodeXmlPart(part).matchAll(/<s\b[^>]*\bv="([^"]*)"/g)) {
      pivot.push(decodeXmlEntities(m[1]));
    }
  }
  if (pivot.length > 0) sections.push(`--- Pivot data ---\n${pivot.join('\t')}`);

  // Drawing/shape text (chart or text-box tabs) in xl/drawings — also appended
  // unconditionally for the same reason.
  const shapes = [];
  for (const [name, part] of entries) {
    if (!/^xl\/drawings\/drawing\d+\.xml$/.test(name)) continue;
    const t = drawingMlText(decodeXmlPart(part)).trim();
    if (t) shapes.push(t);
  }
  if (shapes.length > 0) sections.push(`--- Shapes ---\n${shapes.join('\n')}`);

  // Cell comments — classic Excel (`xl/comments1.xml`), openpyxl's subfolder
  // (`xl/comments/comment1.xml`), and threaded comments — are real annotations.
  const comments = [];
  for (const [name, part] of entries) {
    if (
      !/^xl\/comments(?:\d+|\/comment\d+)\.xml$/.test(name) &&
      !/^xl\/threadedComments\/threadedComment\d+\.xml$/.test(name)
    ) {
      continue;
    }
    for (const m of decodeXmlPart(part).matchAll(/<text\b[^>]*>([\s\S]*?)<\/text>/g)) {
      const t = decodeXmlEntities(m[1].replace(/<[^>]+>/g, '')).trim();
      if (t) comments.push(t);
    }
  }
  if (comments.length > 0) sections.push(`--- Comments ---\n${comments.join('\n')}`);

  // Embedded charts — titles/axis labels (<a:t>) and cached series/category
  // values (<c:v>). The PPTX path already reads these; XLSX must too, or a
  // chart-only sheet reports empty.
  const charts = [];
  for (const [name, part] of entries) {
    if (!/^xl\/charts\/chart\d+\.xml$/.test(name)) continue;
    const xml = decodeXmlPart(part);
    const titles = drawingMlText(xml);
    const values = [...xml.matchAll(/<c:v>([\s\S]*?)<\/c:v>/g)]
      .map((m) => decodeXmlEntities(m[1]))
      .filter((v) => v.trim());
    const combined = [titles, values.join('\t')].filter(Boolean).join('\n');
    if (combined.trim()) charts.push(combined);
  }
  if (charts.length > 0) sections.push(`--- Charts ---\n${charts.join('\n')}`);

  return { text: sections.join('\n\n'), degraded: degraded() };
}

// DrawingML text: runs (<a:t>) inside one paragraph (<a:p>) concatenate with
// NO separator (a word can be split across runs); paragraphs and <a:br> break
// lines. The run tag carries attributes (xml:space="preserve") in real decks,
// so the open tag must allow them.
function drawingMlText(rawXml) {
  // Resolve mc:AlternateContent to a single branch so shapes/text boxes don't
  // emit their text twice (Choice) yet don't lose fallback-only text.
  const xml = resolveAlternateContent(rawXml);
  // VML WordArt stores its text in the `string` attribute of <v:textpath>,
  // never as <a:t> runs — harvest it so legacy WordArt isn't lost.
  const vml = [...xml.matchAll(/<v:textpath\b[^>]*\bstring="([^"]*)"/g)]
    .map((m) => decodeXmlEntities(m[1]))
    .filter((t) => t.trim());
  const paras = [];
  for (const pm of xml.matchAll(/<a:p\b[^>]*>([\s\S]*?)<\/a:p>/g)) {
    const lines = pm[1]
      .split(/<a:br\b[^>]*\/?>/)
      .map((seg) =>
        [...seg.matchAll(/<a:t(?:\s[^>]*)?>([\s\S]*?)<\/a:t>/g)]
          .map((m) => decodeXmlEntities(m[1]))
          .join('')
      );
    const text = lines.join('\n');
    if (text.trim()) paras.push(text);
  }
  const drawing =
    paras.length > 0
      ? paras.join('\n')
      : // Parts without <a:p> wrappers (some chart/diagram fragments) — global pass.
        [...xml.matchAll(/<a:t(?:\s[^>]*)?>([\s\S]*?)<\/a:t>/g)]
          .map((m) => decodeXmlEntities(m[1]))
          .join('\n')
          .trim();
  return [drawing, vml.join('\n')].filter((s) => s.trim()).join('\n');
}

async function extractPptxText(bytes) {
  const failed = new Set();
  const entries = await readZipEntries(
    bytes,
    [
      'ppt/presentation.xml',
      'ppt/_rels/presentation.xml.rels',
      /^ppt\/slides\/slide\d+\.xml$/,
      /^ppt\/notesSlides\/notesSlide\d+\.xml$/,
      /^ppt\/diagrams\/data\d+\.xml$/,
      /^ppt\/charts\/chart\d+\.xml$/,
      /^ppt\/slideLayouts\/slideLayout\d+\.xml$/,
      /^ppt\/slideMasters\/slideMaster\d+\.xml$/
    ],
    failed
  );

  // Authored slide order comes from presentation.xml's sldIdLst via rels — not
  // the worksheet-file numbering, which reorder-after-create scrambles.
  const rels = parseRels(
    entries.get('ppt/_rels/presentation.xml.rels') &&
      decodeXmlPart(entries.get('ppt/_rels/presentation.xml.rels')),
    'ppt/'
  );
  let slideFiles = [];
  const presXml = entries.get('ppt/presentation.xml');
  if (presXml) {
    for (const m of decodeXmlPart(presXml).matchAll(/<p:sldId\b[^>]*>/g)) {
      const rid = m[0].match(/r:id="([^"]+)"/);
      if (rid && rels.has(rid[1])) slideFiles.push(rels.get(rid[1]));
    }
  }
  const numericSlides = [...entries.keys()]
    .filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
    .sort(
      (a, b) => Number(a.match(/slide(\d+)\.xml$/)[1]) - Number(b.match(/slide(\d+)\.xml$/)[1])
    );
  if (slideFiles.length === 0 || !slideFiles.every((f) => entries.has(f))) {
    slideFiles = numericSlides;
  }

  const sections = [];
  slideFiles.forEach((file, index) => {
    const part = entries.get(file);
    if (!part) return;
    const text = drawingMlText(decodeXmlPart(part)).trim();
    if (text) sections.push(`--- Slide ${index + 1} ---\n${text}`);
  });

  const collect = (pattern, heading, fn) => {
    const out = [];
    for (const [name, part] of entries) {
      if (!pattern.test(name)) continue;
      const t = fn(decodeXmlPart(part)).trim();
      if (t) out.push(t);
    }
    if (out.length > 0) sections.push(`--- ${heading} ---\n${out.join('\n')}`);
  };

  // Speaker notes, SmartArt node text, embedded-chart text — all real content
  // in sibling parts the slide never inlines.
  collect(/^ppt\/notesSlides\/notesSlide\d+\.xml$/, 'Notes', drawingMlText);
  collect(/^ppt\/diagrams\/data\d+\.xml$/, 'Diagrams', drawingMlText);
  collect(/^ppt\/charts\/chart\d+\.xml$/, 'Charts', (xml) => {
    const titles = drawingMlText(xml);
    const values = [...xml.matchAll(/<c:v>([\s\S]*?)<\/c:v>/g)]
      .map((m) => decodeXmlEntities(m[1]))
      .filter((v) => v.trim());
    return [titles, values.join('\t')].filter(Boolean).join('\n');
  });

  // Slide masters/layouts carry standing footers, company names and recurring
  // labels — real content — but also placeholder PROMPT text ("Click to edit
  // …") that is never shown. Keep the former, drop the latter.
  const PROMPT = /click to edit|edit master|master (?:title|text|subtitle) style/i;
  const layoutText = (xml) =>
    drawingMlText(xml)
      .split('\n')
      .filter((line) => line.trim() && !PROMPT.test(line))
      .join('\n');
  collect(/^ppt\/slideLayouts\/slideLayout\d+\.xml$/, 'Layouts', layoutText);
  collect(/^ppt\/slideMasters\/slideMaster\d+\.xml$/, 'Master', layoutText);

  return { text: sections.join('\n\n'), degraded: failed.size > 0 };
}
