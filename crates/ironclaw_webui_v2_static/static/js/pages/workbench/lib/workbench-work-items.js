function textValue(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function firstText(...values) {
  return values.map(textValue).find(Boolean) || '';
}

// Only inline-render content we know is human-readable text. Anything else
// (base64, binary, pdf, unknown future formats) must fall through to the
// file/empty state instead of dumping raw bytes into the document body.
const READABLE_ARTIFACT_FORMATS = new Set(['', 'markdown', 'md', 'text', 'plain', 'txt']);

export function savedArtifactText(artifact) {
  const format = textValue(artifact?.content_format).toLowerCase();
  if (!READABLE_ARTIFACT_FORMATS.has(format)) return '';
  return textValue(artifact?.content);
}

export function savedArtifactPreview(artifact) {
  const text = savedArtifactText(artifact);
  const filename = firstText(artifact?.filename, artifact?.name);
  const title = firstText(artifact?.title, filename, 'Saved artifact');
  const mime = firstText(artifact?.mime_type, artifact?.content_type, artifact?.content_format);
  const hasFilePayload = Boolean(
    filename ||
    textValue(artifact?.data_base64) ||
    textValue(artifact?.url) ||
    textValue(artifact?.download_url)
  );

  if (text) {
    return {
      kind: 'text',
      title,
      text,
      label: mime || 'markdown/text'
    };
  }

  if (artifact?.id && hasFilePayload) {
    return {
      kind: 'file',
      title,
      filename,
      label: mime || 'file',
      sizeLabel: textValue(artifact?.size_label),
      hasBytes: Boolean(textValue(artifact?.data_base64)),
      hasRemoteReference: Boolean(textValue(artifact?.url) || textValue(artifact?.download_url))
    };
  }

  return {
    kind: 'empty',
    title: firstText(artifact?.title, 'No saved artifact selected'),
    label: '',
    text: ''
  };
}

export function isReviewableArtifact(artifact) {
  if (!artifact?.id) return false;
  return savedArtifactPreview(artifact).kind !== 'empty';
}

export function firstArtifact(item) {
  return Array.isArray(item?.artifacts) ? item.artifacts.find(isReviewableArtifact) || null : null;
}

export function savedWorkHref(item) {
  const artifact = firstArtifact(item);
  if (!artifact) return '/work';
  const params = new URLSearchParams({
    item: String(item.id || ''),
    artifact: String(artifact.id || '')
  });
  return `/work?${params.toString()}`;
}
