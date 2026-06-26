import { firstArtifact, savedArtifactPreview, savedWorkHref } from './workbench-work-items.js';

export function listValue(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

export function objectValue(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

export function cleanText(value, fallback = '') {
  const text = String(value || '').trim();
  return text || fallback;
}

function threadHref(item) {
  const thread = listValue(item?.links).find((link) => link?.kind === 'thread' && link.ref);
  return thread ? `/chat/${encodeURIComponent(thread.ref)}` : '';
}

function packetMetadata(item, artifact) {
  return {
    ...objectValue(item?.packet),
    ...objectValue(item?.workbenchPacket),
    ...objectValue(artifact?.packet)
  };
}

function inferPacketOutputLabel({ item, artifact, artifactPreview, meta }) {
  const explicit = cleanText(meta.outputLabel || meta.artifactLabel || meta.surfaceLabel);
  if (explicit) return explicit;
  if (artifactPreview.kind === 'file') return 'File';

  const haystack = [
    meta.title,
    meta.subtitle,
    item?.title,
    item?.objective,
    artifact?.title,
    artifactPreview.title,
    artifactPreview.text
  ]
    .map((value) => String(value || '').toLowerCase())
    .join(' ');

  if (/\b(research|roadmap|extraction|analysis|compare|shortlist|vendor|market)\b/.test(haystack)) {
    return 'Research';
  }
  if (/\b(brief|update|board|investor|stakeholder|report)\b/.test(haystack)) {
    return 'Brief';
  }
  if (/\bsummary\b/.test(haystack)) {
    return 'Summary';
  }
  if (/\bmemo\b/.test(haystack)) {
    return 'Memo';
  }
  if (/\b(note|notes)\b/.test(haystack)) return 'Notes';
  if (/\b(deck|slides|presentation)\b/.test(haystack)) {
    return 'Deck';
  }

  return 'Output';
}

function inferPacketDraftLabel({ meta, email, approval }) {
  const explicit = cleanText(meta.draftLabel || meta.responseLabel);
  if (explicit) return explicit;

  const haystack = [
    email.to,
    email.subject,
    email.body,
    approval.title,
    approval.destination,
    approval.actionLabel,
    approval.outbound
  ]
    .map((value) => String(value || '').toLowerCase())
    .join(' ');

  if (/\b(reply|response|email|send|sent|customer|recipient)\b/.test(haystack)) return 'Reply';
  return 'Draft';
}

export function buildPacketModel(savedItems = []) {
  const item = listValue(savedItems).find(firstArtifact) || null;
  const artifact = firstArtifact(item);
  const artifactPreview = savedArtifactPreview(artifact);
  const meta = packetMetadata(item, artifact);
  const approvals = [...listValue(meta.openApprovals), ...listValue(item?.openApprovals)];
  const approval = objectValue(meta.approval || approvals[0]);
  const receipts = [...listValue(meta.receipts), ...listValue(item?.receipts)];
  const artifactText = artifactPreview.kind === 'text' ? artifactPreview.text : '';
  const title = cleanText(
    meta.title,
    cleanText(item?.title, cleanText(artifactPreview.title, 'Workspace viewer'))
  );
  const hasApproval = Boolean(approval.title || approval.destination || approval.actionLabel);
  const hasArtifact = Boolean(item && artifact && artifactPreview.kind !== 'empty');
  const email = objectValue(meta.email);
  const labels = {
    output: inferPacketOutputLabel({ item, artifact, artifactPreview, meta }),
    draft: inferPacketDraftLabel({ meta, email, approval }),
    context: cleanText(meta.contextLabel, 'Context'),
    activity: cleanText(meta.activityLabel, 'Activity')
  };
  const hasDraft = Boolean(
    cleanText(email.body) ||
    cleanText(email.subject) ||
    cleanText(email.to) ||
    cleanText(email.attachment) ||
    hasApproval
  );
  const linkedThreadHref = cleanText(meta.threadHref, threadHref(item));
  const contexts = listValue(meta.contexts);
  const fallbackContexts = [
    ...listValue(item?.links)
      .map((link) => cleanText(link.label || link.ref))
      .filter(Boolean),
    ...listValue(artifact?.provenance)
      .map((entry) => cleanText(entry))
      .filter(Boolean)
  ];

  return {
    item,
    artifact,
    meta,
    hasArtifact,
    title,
    subtitle: cleanText(meta.subtitle, cleanText(item?.objective, cleanText(artifact?.title))),
    stateLabel: hasApproval
      ? 'Saved item with Chat handoff'
      : receipts.length
        ? cleanText(meta.stateLabel, 'Receipt saved')
        : hasArtifact
          ? cleanText(meta.stateLabel, 'Ready to review')
          : 'No saved artifact yet',
    stateTone: hasApproval ? 'hold' : receipts.length ? 'run' : hasArtifact ? 'draft' : 'quiet',
    contexts: contexts.length ? contexts : fallbackContexts.slice(0, 4),
    version: Number(meta.version || artifact?.version || 1),
    decisions: listValue(meta.decisions),
    summaryCards: listValue(meta.summaryCards),
    documentClauses: listValue(meta.documentClauses),
    evidence: listValue(meta.evidence),
    activity: listValue(meta.activity),
    receipts,
    approval: hasApproval ? approval : null,
    email,
    labels,
    hasDraft,
    artifactPreview,
    artifactText,
    href: item ? savedWorkHref(item) : '/work',
    threadHref: linkedThreadHref
  };
}
