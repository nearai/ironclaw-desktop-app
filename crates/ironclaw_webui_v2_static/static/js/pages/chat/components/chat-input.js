import { Icon } from '../../../design-system/icons.js';
import { Button } from '../../../design-system/button.js';
import { React, html } from '../../../lib/html.js';
import { useT } from '../../../lib/i18n.js';
import {
  DEFAULT_CHAT_MODEL,
  readChatModelSelection,
  saveChatModelSelection
} from '../../../lib/api.js';
import { formatSize, useComposerAttachments } from '../hooks/useComposerAttachments.js';

const DEFAULT_CHAT_MODEL_LABEL = 'IronClaw default (auto)';
const MODEL_PRESETS = [
  {
    providerId: 'nearai',
    providerLabel: 'NEAR.AI',
    modelId: DEFAULT_CHAT_MODEL,
    label: DEFAULT_CHAT_MODEL_LABEL,
    description: 'Use the NEAR.AI Cloud model selected by IronClaw/Reborn.'
  }
];

export function ChatInput({
  onSend,
  disabled,
  initialText = '',
  resetKey = '',
  variant = 'dock',
  context = {},
  statusText = ''
}) {
  const t = useT();
  const isHero = variant === 'hero';
  const [text, setText] = React.useState('');
  const [isSending, setIsSending] = React.useState(false);
  const [isDraggingFiles, setIsDraggingFiles] = React.useState(false);
  const textareaRef = React.useRef(null);
  const { images, attachments, addFiles, removeImage, removeAttachment, clearAttachments } =
    useComposerAttachments();
  const readiness = context.modelReadiness || {
    verified: false,
    sendBlocked: false,
    label: 'Configured, unverified',
    buttonPrefix: 'Configured (unverified)',
    description:
      'This model has not completed a live run yet. Send a message to verify execution; any provider failure will appear in the thread.',
    sendBlockReason: ''
  };

  const autoResize = React.useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, []);

  React.useEffect(() => {
    autoResize();
  }, [text, autoResize]);

  React.useEffect(() => {
    if (!initialText) return;
    setText(initialText);
    window.requestAnimationFrame(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(initialText.length, initialText.length);
      }
    });
  }, [initialText, resetKey]);

  const handleSend = React.useCallback(async () => {
    if (
      (!text.trim() && images.length === 0 && attachments.length === 0) ||
      disabled ||
      readiness.sendBlocked ||
      isSending
    )
      return;
    setIsSending(true);
    try {
      await onSend(messageText(text, images, attachments), { images, attachments });
      setText('');
      clearAttachments();
      if (textareaRef.current) textareaRef.current.style.height = 'auto';
    } catch {
      // The failed optimistic message renders retry details in the thread.
    } finally {
      setIsSending(false);
    }
  }, [
    text,
    images,
    attachments,
    disabled,
    readiness.sendBlocked,
    isSending,
    onSend,
    clearAttachments
  ]);

  const onKeyDown = React.useCallback(
    (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  const onPaste = React.useCallback(
    (e) => {
      const files = Array.from(e.clipboardData.files);
      if (files.length > 0) {
        e.preventDefault();
        addFiles(files);
      }
    },
    [addFiles]
  );

  const onDrop = React.useCallback(
    (e) => {
      e.preventDefault();
      setIsDraggingFiles(false);
      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) addFiles(files);
    },
    [addFiles]
  );

  const onDragEnter = React.useCallback((e) => {
    e.preventDefault();
    setIsDraggingFiles(true);
  }, []);

  const onDragLeave = React.useCallback((e) => {
    if (e.currentTarget.contains(e.relatedTarget)) return;
    setIsDraggingFiles(false);
  }, []);

  const onDragOver = React.useCallback((e) => e.preventDefault(), []);

  const onFileInputChange = React.useCallback(
    (e) => {
      const files = Array.from(e.target.files || []);
      if (files.length > 0) addFiles(files);
      e.target.value = '';
    },
    [addFiles]
  );

  const hasPayload = text.trim() || images.length > 0 || attachments.length > 0;
  const placeholder = isHero ? t('chat.heroPlaceholder') : t('chat.followUpPlaceholder');
  const shellClass = isHero ? 'w-full' : 'px-4 py-4 sm:px-5 lg:px-8';
  const composerClass = [
    'mx-auto w-full max-w-5xl rounded-[22px] border border-[var(--v2-panel-border)] bg-[var(--v2-card-bg)] shadow-[var(--v2-card-shadow)] p-3',
    isHero ? 'min-h-[190px]' : 'min-h-[154px]',
    disabled ? 'opacity-70' : '',
    isDraggingFiles ? 'ring-2 ring-[color-mix(in_srgb,var(--v2-accent)_42%,transparent)]' : ''
  ].join(' ');
  const textClass = [
    'w-full flex-1 resize-none border-0 !border-transparent !bg-transparent px-2 text-[0.9375rem] leading-6',
    'text-white outline-none placeholder:text-iron-700 focus:!border-transparent focus:!bg-transparent focus:!outline-none focus:!shadow-none disabled:opacity-50',
    isHero ? 'min-h-[96px]' : 'min-h-[72px]'
  ].join(' ');

  return html`
    <div className=${shellClass}>
      <div
        className=${composerClass}
        role="group"
        aria-label="Message composer"
        onDragEnter=${onDragEnter}
        onDragLeave=${onDragLeave}
        onDrop=${onDrop}
        onDragOver=${onDragOver}
      >
        ${isDraggingFiles &&
        html`
          <div
            className="mb-3 rounded-[14px] border border-dashed border-[color-mix(in_srgb,var(--v2-accent)_55%,var(--v2-panel-border))] bg-[var(--v2-accent-soft)] px-4 py-3 text-sm font-semibold text-[var(--v2-accent-text)]"
          >
            Drop files here
          </div>
        `}
        ${(images.length > 0 || attachments.length > 0) &&
        html`
          <div className="mb-3 flex flex-wrap gap-2">
            ${images.map(
              (img, i) => html`
                <div key=${i} className="group relative">
                  <img
                    src=${img.dataUrl}
                    className="h-16 w-16 rounded-lg border border-iron-700 object-cover"
                    alt=""
                  />
                  <button
                    onClick=${() => removeImage(i)}
                    className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full border border-red-300/30 bg-red-500 text-white opacity-0 group-hover:opacity-100"
                    aria-label=${t('chat.removeImage')}
                  >
                    <${Icon} name="close" className="h-3 w-3" />
                  </button>
                </div>
              `
            )}
            ${attachments.map(
              (att, i) => html`
                <div
                  key=${i}
                  className="flex max-w-full items-center gap-2 rounded-md border border-iron-700 bg-iron-900 px-2 py-1 text-xs"
                >
                  <${Icon} name="file" className="h-3.5 w-3.5 shrink-0 text-signal" />
                  <span className="truncate">${att.filename}</span>
                  <span className="shrink-0 text-iron-200">${formatSize(att.size)}</span>
                  <button
                    onClick=${() => removeAttachment(i)}
                    className="ml-1 text-iron-200 hover:text-white"
                    aria-label=${t('chat.removeAttachment')}
                  >
                    <${Icon} name="close" className="h-3.5 w-3.5" />
                  </button>
                </div>
              `
            )}
          </div>
        `}
        ${readiness.sendBlocked &&
        html`
          <div
            className="mb-3 rounded-[14px] border border-[color-mix(in_srgb,var(--v2-warning-text)_35%,var(--v2-panel-border))] bg-[var(--v2-warning-soft)] px-4 py-3 text-sm font-semibold leading-5 text-[var(--v2-warning-text)]"
            role="status"
          >
            ${readiness.sendBlockReason}
          </div>
        `}

        <textarea
          ref=${textareaRef}
          value=${text}
          onChange=${(e) => setText(e.target.value)}
          onKeyDown=${onKeyDown}
          onPaste=${onPaste}
          placeholder=${placeholder}
          rows=${1}
          disabled=${disabled}
          className=${textClass}
        />

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <label
            role="button"
            aria-label=${t('chat.attachFiles')}
            className="flex h-11 shrink-0 cursor-pointer items-center gap-2 rounded-full border border-[var(--v2-panel-border)] bg-[var(--v2-surface-soft)] px-3 text-[var(--v2-text-muted)] hover:border-[color-mix(in_srgb,var(--v2-accent)_40%,var(--v2-panel-border))] hover:text-[var(--v2-accent-text)]"
            title=${t('chat.attachFiles')}
          >
            <input type="file" multiple className="hidden" onChange=${onFileInputChange} />
            <${Icon} name="attach" className="h-5 w-5" />
            <span className="hidden text-sm font-semibold sm:inline">Attach</span>
          </label>

          <span className="min-w-0 flex-1 text-xs text-[var(--v2-text-faint)]">
            Paste or drop files
          </span>

          <div className="ml-auto flex min-w-0 items-center gap-2">
            ${disabled &&
            html`
              <span
                className="hidden items-center gap-2 text-xs text-[var(--v2-text-muted)] sm:inline-flex"
              >
                <span className="h-2 w-2 rounded-full bg-[var(--v2-accent)]" />
                ${statusText || t('chat.statusWorking')}
              </span>
            `}
            <${ChatModelControl} context=${context} />
            <${Button}
              type="button"
              variant="primary"
              size="icon-sm"
              onClick=${handleSend}
              disabled=${disabled || readiness.sendBlocked || isSending || !hasPayload}
              aria-label=${t('chat.send')}
              className="rounded-full"
            >
              <${Icon} name="send" className="h-5 w-5" />
            <//>
          </div>
        </div>
      </div>

      <${ComposerContextRow} context=${context} />
    </div>
  `;
}

function ComposerPill({ icon, label, tone = 'muted', strong = false, className = '' }) {
  const toneClass =
    tone === 'signal'
      ? 'border-signal/35 bg-signal/10 text-signal'
      : 'border-white/10 bg-white/[0.035] text-iron-300';
  return html`
    <span
      className=${[
        'inline-flex h-9 max-w-[220px] items-center gap-2 rounded-full border px-3 text-sm',
        toneClass,
        strong ? 'font-semibold text-white' : 'font-medium',
        className
      ].join(' ')}
      title=${label}
    >
      <${Icon} name=${icon} className="h-4 w-4 shrink-0" />
      <span className="truncate">${label}</span>
    </span>
  `;
}

function ChatModelControl({ context }) {
  const initial = React.useMemo(() => readChatModelSelection(), []);
  const [isOpen, setIsOpen] = React.useState(false);
  const [providerId, setProviderId] = React.useState(initial.providerId);
  const [providerLabel, setProviderLabel] = React.useState(initial.providerLabel);
  const [modelId, setModelId] = React.useState(initial.modelId || DEFAULT_CHAT_MODEL);
  const [savedSelection, setSavedSelection] = React.useState(initial);
  const [isSaving, setIsSaving] = React.useState(false);
  const [message, setMessage] = React.useState('');

  const runningProvider = providerLabelFor(context.backend || providerLabel);
  const runningModel = context.model || modelId || DEFAULT_CHAT_MODEL;
  const runningModelLabel = modelLabelFor(runningModel);
  const readiness = context.modelReadiness || {
    verified: false,
    sendBlocked: false,
    label: 'Configured, unverified',
    buttonPrefix: 'Configured (unverified)',
    description:
      'This model has not completed a live run yet. Send a message to verify execution; any provider failure will appear in the thread.',
    sendBlockReason: ''
  };
  const buttonLabel = `${readiness.buttonPrefix}: ${runningProvider} / ${runningModelLabel}`;
  const dirtySelection =
    providerId !== savedSelection.providerId ||
    providerLabel !== savedSelection.providerLabel ||
    modelId !== savedSelection.modelId;

  const apply = React.useCallback(async () => {
    const cleanModel = (modelId || DEFAULT_CHAT_MODEL).trim();
    if (!cleanModel) return;
    setIsSaving(true);
    setMessage('');
    try {
      const next = await saveChatModelSelection({
        providerId,
        providerLabel,
        modelId: cleanModel
      });
      setProviderId(next.providerId);
      setProviderLabel(next.providerLabel);
      setModelId(next.modelId);
      setSavedSelection(next);
      setMessage('Model saved.');
      setIsOpen(false);
    } catch (err) {
      setMessage(err?.message || 'Could not apply model.');
    } finally {
      setIsSaving(false);
    }
  }, [providerId, providerLabel, modelId]);

  const selectPreset = React.useCallback((preset) => {
    setProviderId(preset.providerId);
    setProviderLabel(preset.providerLabel);
    setModelId(preset.modelId);
  }, []);

  return html`
    <div className="relative" aria-label="Chat model controls">
      <button
        type="button"
        onClick=${() => setIsOpen((value) => !value)}
        className="inline-flex h-11 max-w-[280px] items-center gap-2 rounded-full border border-[var(--v2-panel-border)] bg-[var(--v2-surface-soft)] px-3 text-left text-sm font-semibold text-[var(--v2-text-strong)] hover:border-[color-mix(in_srgb,var(--v2-accent)_45%,var(--v2-panel-border))]"
        aria-expanded=${isOpen}
        title=${buttonLabel}
      >
        <${Icon} name="bolt" className="h-4 w-4 shrink-0" />
        <span className="truncate">${buttonLabel}</span>
      </button>
      ${isOpen &&
      html`
        <div
          className="absolute bottom-12 right-0 z-30 w-[min(390px,calc(100vw-2rem))] rounded-[16px] border border-[var(--v2-panel-border)] bg-[var(--v2-surface)] p-3 shadow-[var(--v2-card-shadow)]"
        >
          <div className="mb-3 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-[var(--v2-text-strong)]">Chat model</div>
              <div className="mt-0.5 truncate text-xs text-[var(--v2-text-muted)]">
                ${runningProvider} / ${runningModelLabel}
              </div>
              <div
                className=${[
                  'mt-1 text-xs',
                  readiness.verified
                    ? 'text-[var(--v2-positive-text)]'
                    : 'text-[var(--v2-warning-text)]'
                ].join(' ')}
              >
                ${readiness.label}
              </div>
            </div>
            ${dirtySelection &&
            html`
              <span
                className="rounded-full bg-[var(--v2-warning-soft)] px-2 py-1 text-[11px] font-semibold text-[var(--v2-warning-text)]"
              >
                Unsaved
              </span>
            `}
          </div>
          <label className="block text-[11px] font-semibold uppercase text-[var(--v2-text-faint)]">
            Provider
            <div
              className="mt-1 flex h-10 w-full items-center rounded-[10px] border border-[var(--v2-panel-border)] bg-[var(--v2-surface-soft)] px-3 text-sm normal-case text-[var(--v2-text-strong)]"
            >
              NEAR.AI Cloud
            </div>
          </label>
          <label
            className="mt-3 block text-[11px] font-semibold uppercase text-[var(--v2-text-faint)]"
          >
            Model override
            <input
              aria-label="Chat model"
              value=${modelId}
              onChange=${(e) => setModelId(e.target.value)}
              placeholder=${DEFAULT_CHAT_MODEL}
              className="mt-1 h-10 w-full rounded-[10px] border border-[var(--v2-panel-border)] bg-[var(--v2-surface-soft)] px-3 font-mono text-sm normal-case text-[var(--v2-text-strong)] outline-none"
            />
          </label>
          <div className="mt-1 text-xs leading-5 text-[var(--v2-text-muted)]">
            Leave <span className="font-mono">auto</span> to use IronClaw's NEAR.AI default. Type a
            specific NEAR.AI model id only when you want an override.
          </div>
          <div
            className="mt-2 rounded-[10px] border border-[var(--v2-panel-border)] bg-[var(--v2-surface-soft)] px-3 py-2 text-xs text-[var(--v2-text-muted)]"
          >
            ${readiness.description}
          </div>
          <div className="mt-3 grid gap-2">
            ${MODEL_PRESETS.map(
              (preset) => html`
                <button
                  key=${`${preset.providerId}-${preset.modelId}`}
                  type="button"
                  onClick=${() => selectPreset(preset)}
                  className="flex min-w-0 items-center justify-between gap-3 rounded-[10px] border border-[var(--v2-panel-border)] bg-[var(--v2-surface-soft)] px-3 py-2 text-left hover:border-[color-mix(in_srgb,var(--v2-accent)_42%,var(--v2-panel-border))]"
                >
                  <span className="min-w-0">
                    <span className="block text-xs font-semibold text-[var(--v2-text-muted)]">
                      ${preset.providerLabel}
                    </span>
                    <span className="block truncate font-mono text-xs text-[var(--v2-text-strong)]">
                      ${preset.label || modelLabelFor(preset.modelId)}
                    </span>
                    <span className="block truncate text-[11px] text-[var(--v2-text-muted)]">
                      ${preset.description || preset.modelId}
                    </span>
                  </span>
                  ${providerId === preset.providerId && modelId === preset.modelId
                    ? html`<${Icon}
                        name="check"
                        className="h-4 w-4 shrink-0 text-[var(--v2-accent-text)]"
                      />`
                    : null}
                </button>
              `
            )}
          </div>
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick=${apply}
              disabled=${isSaving}
              className="rounded-[10px] bg-[var(--v2-accent)] px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              ${isSaving ? 'Applying...' : 'Apply'}
            </button>
            <button
              type="button"
              onClick=${() => setIsOpen(false)}
              className="rounded-[10px] border border-[var(--v2-panel-border)] px-3 py-2 text-sm text-[var(--v2-text-muted)] hover:text-[var(--v2-text-strong)]"
            >
              Close
            </button>
          </div>
          ${message &&
          html`<div className="mt-2 text-xs text-[var(--v2-text-muted)]">${message}</div>`}
        </div>
      `}
    </div>
  `;
}

function ComposerContextRow({ context }) {
  const items = [
    context.threadLabel,
    context.turnCountLabel,
    context.engineLabel,
    context.connectionLabel
  ].filter(Boolean);

  if (items.length === 0) return null;

  return html`
    <div
      className="mx-auto mt-3 flex w-full max-w-5xl flex-wrap items-center gap-x-4 gap-y-2 px-2 text-sm text-iron-300"
    >
      ${items.map(
        (item, index) => html`
          <span key=${`${item}-${index}`} className="inline-flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-iron-700" />
            <span className="truncate">${item}</span>
          </span>
        `
      )}
    </div>
  `;
}

function providerLabelFor(raw) {
  const value = String(raw || '').trim();
  if (!value) return 'NEAR.AI';
  if (value.toLowerCase() === 'nearai') return 'NEAR.AI';
  return value;
}

function modelLabelFor(raw) {
  const value = String(raw || '').trim();
  if (!value || value === DEFAULT_CHAT_MODEL) return DEFAULT_CHAT_MODEL_LABEL;
  return value;
}

function messageText(text, images, attachments) {
  const trimmed = text.trim();
  if (trimmed) return trimmed;
  const names = [...images, ...attachments].map((item) => item.filename).filter(Boolean);
  if (names.length === 0) return '';
  return `Attached ${names.join(', ')}`;
}
