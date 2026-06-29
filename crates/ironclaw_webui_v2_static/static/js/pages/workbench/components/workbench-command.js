import { Icon } from '../../../design-system/icons.js';
import { React, html } from '../../../lib/html.js';
import { cn } from '../../../utils/cn.js';
import { formatSize } from '../../chat/hooks/useComposerAttachments.js';
import {
  WORKBENCH_AUTO_SOURCE_SCOPE,
  WORKBENCH_SOURCE_OPTIONS,
  WORKBENCH_VISIBLE_SUGGESTIONS,
  workbenchSuggestionFill
} from '../lib/workbench-plan.js';
import { commandActionLabel } from '../lib/workbench-scenes-registry.js';
import { workModeLabel } from '../hooks/useWorkbenchStart.js';

function SourceScopePicker({ sourceMode, sourceIds, onAutoSource, onSelectSource }) {
  const value =
    sourceMode === WORKBENCH_AUTO_SOURCE_SCOPE.id
      ? WORKBENCH_AUTO_SOURCE_SCOPE.id
      : sourceIds[0] || 'web';
  return html`
    <span className="wb13-scope">
      <${Icon} name="link" />
      <select
        aria-label="Workbench source scope"
        value=${value}
        onChange=${(event) => {
          const next = event.currentTarget.value;
          if (next === WORKBENCH_AUTO_SOURCE_SCOPE.id) onAutoSource();
          else onSelectSource(next);
        }}
      >
        <option value=${WORKBENCH_AUTO_SOURCE_SCOPE.id}>
          ${WORKBENCH_AUTO_SOURCE_SCOPE.label}
        </option>
        ${WORKBENCH_SOURCE_OPTIONS.map(
          (source) => html`<option key=${source.id} value=${source.id}>${source.label}</option>`
        )}
      </select>
    </span>
  `;
}

function workbenchAttachmentStatus(attachment) {
  if (attachment?.extraction === 'extracting') return attachment.progressLabel || 'Reading file...';
  if (attachment?.extraction === 'extracted') {
    return attachment.partial ? 'Readable text extracted partially' : 'Readable text extracted';
  }
  if (attachment?.extraction === 'raw' && attachment.modelReadable === false) {
    return 'Attached; model-readable text not available';
  }
  if (attachment?.extraction === 'raw') return 'Ready to send';
  return attachment?.base64 ? 'Ready to send' : 'Preparing attachment';
}

function WorkbenchAttachments({ attachmentsState }) {
  const { images, attachments, rejections, removeImage, removeAttachment, dismissRejections } =
    attachmentsState;

  if (!images.length && !attachments.length && !rejections.length) return null;

  return html`
    <div className="wb13-attachments" data-testid="workbench-attachments">
      ${images.map(
        (image, index) => html`
          <div key=${`${image.filename}-${index}`} className="wb13-attachment-chip">
            <span className="wb13-attachment-thumb">
              <img src=${image.dataUrl} alt="" />
            </span>
            <span className="wb13-attachment-copy">
              <strong>${image.filename || 'image'}</strong>
              <span>${image.size ? formatSize(image.size) : 'Ready to send'}</span>
            </span>
            <button
              type="button"
              aria-label=${`Remove ${image.filename || 'image'}`}
              onClick=${() => removeImage(index)}
            >
              <${Icon} name="close" />
            </button>
          </div>
        `
      )}
      ${attachments.map((attachment, index) => {
        const status = workbenchAttachmentStatus(attachment);
        const warning = attachment.extraction === 'raw' && attachment.modelReadable === false;
        return html`
          <div
            key=${`${attachment.filename}-${index}`}
            className=${cn('wb13-attachment-chip', warning && 'is-warning')}
          >
            <span className="wb13-attachment-icon"><${Icon} name="file" /></span>
            <span className="wb13-attachment-copy">
              <strong>${attachment.filename || 'attachment'}</strong>
              <span>${status}${attachment.size ? ` - ${formatSize(attachment.size)}` : ''}</span>
            </span>
            <button
              type="button"
              aria-label=${`Remove ${attachment.filename || 'attachment'}`}
              onClick=${() => removeAttachment(index)}
            >
              <${Icon} name="close" />
            </button>
          </div>
        `;
      })}
      ${rejections.length
        ? html`
            <div className="wb13-attachment-rejections" role="status">
              <span>${rejections.join(' ')}</span>
              <button type="button" onClick=${dismissRejections}>Dismiss</button>
            </div>
          `
        : null}
    </div>
  `;
}

export function WorkbenchCommandSurface({
  brief,
  setBrief,
  modelId,
  effort,
  sourceMode,
  sourceIds,
  onAutoSource,
  onSelectSource,
  onAsk,
  onOpenSources,
  onOpenCadence,
  onOpenWorkMode,
  isStarting,
  startBlocked,
  startBlockReason,
  startSoftNotice,
  error,
  attachmentsState
}) {
  const [showMore, setShowMore] = React.useState(false);
  const [dragOver, setDragOver] = React.useState(false);
  const fileInputRef = React.useRef(null);
  const primarySuggestions = WORKBENCH_VISIBLE_SUGGESTIONS.slice(0, 6);
  const moreSuggestions = WORKBENCH_VISIBLE_SUGGESTIONS.slice(6);
  const action = isStarting ? 'Starting' : commandActionLabel(brief);
  const modeLabel = workModeLabel(modelId, effort);
  const extracting = attachmentsState.attachments.some(
    (attachment) => attachment.extraction === 'extracting'
  );

  const fill = (value) => {
    setBrief(value);
  };

  const addFiles = React.useCallback(
    (files) => {
      const selected = Array.from(files || []);
      if (selected.length > 0) attachmentsState.addFiles(selected);
    },
    [attachmentsState]
  );

  const onFileInputChange = React.useCallback(
    (event) => {
      addFiles(event.currentTarget.files);
      event.currentTarget.value = '';
    },
    [addFiles]
  );

  const onPaste = React.useCallback(
    (event) => {
      const files = Array.from(event.clipboardData?.files || []);
      if (!files.length) return;
      event.preventDefault();
      addFiles(files);
    },
    [addFiles]
  );

  const onDrop = React.useCallback(
    (event) => {
      event.preventDefault();
      setDragOver(false);
      addFiles(event.dataTransfer?.files);
    },
    [addFiles]
  );

  return html`
    <div className="wb13-command">
      <div className="wb13-command-head">
        <h1>What do you want handled?</h1>
      </div>
      <div
        className=${cn('wb13-well', dragOver && 'is-dragover')}
        onDrop=${onDrop}
        onDragOver=${(event) => {
          event.preventDefault();
          setDragOver(true);
        }}
        onDragLeave=${(event) => {
          if (event.currentTarget.contains(event.relatedTarget)) return;
          setDragOver(false);
        }}
      >
        ${dragOver
          ? html`<div className="wb13-drop-overlay">Drop files to attach them to this request</div>`
          : null}
        <div className="wb13-compose-box">
          <textarea
            id="workbench-brief"
            data-testid="workbench-brief-input"
            rows="3"
            aria-label="Describe the work"
            value=${brief}
            onInput=${(event) => setBrief(event.currentTarget.value)}
            onKeyDown=${(event) => {
              if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
                event.preventDefault();
                onAsk();
              }
            }}
            onPaste=${onPaste}
            placeholder="Ask IronClaw across your tools, or describe a multi-step task…"
          />
          <div className="wb13-wbar">
            <${SourceScopePicker}
              sourceMode=${sourceMode}
              sourceIds=${sourceIds}
              onAutoSource=${onAutoSource}
              onSelectSource=${onSelectSource}
            />
            <button
              type="button"
              className="wb13-mode-btn"
              aria-label="Choose model and effort"
              title="Choose model and effort"
              onClick=${onOpenWorkMode}
            >
              <${Icon} name="spark" />
              <span>${modeLabel}</span>
            </button>
            <button
              type="button"
              className="wb13-wbtn"
              aria-label="Attach a file"
              title="Attach a file"
              onClick=${() => fileInputRef.current?.click()}
            >
              <${Icon} name="attach" />
            </button>
            <input
              ref=${fileInputRef}
              data-testid="workbench-attachment-input"
              type="file"
              multiple
              className="wb13-file-input"
              aria-label="Attach files to Workbench request"
              onChange=${onFileInputChange}
            />
            <button
              type="button"
              className="wb13-wbtn"
              aria-label="Set a due date or cadence"
              title="Set a due date or cadence"
              onClick=${onOpenCadence}
            >
              <${Icon} name="clock" />
            </button>
            <button
              type="button"
              className="wb13-send"
              data-testid="workbench-send-button"
              disabled=${isStarting || startBlocked || extracting}
              onClick=${onAsk}
            >
              ${action}
              <${Icon} name=${isStarting ? 'pulse' : 'send'} />
            </button>
          </div>
        </div>
        <${WorkbenchAttachments} attachmentsState=${attachmentsState} />
      </div>
      <div className="wb13-boundary">
        <${Icon} name="shield" />
        <span>Reads and drafts stay private. External actions need your approval.</span>
        <button type="button" onClick=${onOpenSources}>What's allowed</button>
      </div>
      ${error
        ? html`<div className="wb13-alert" role="alert">
            <${Icon} name="flag" />
            <span>${error}</span>
          </div>`
        : null}
      ${!error && startBlocked && startBlockReason
        ? html`<div className="wb13-alert" role="status">
            <${Icon} name="shield" />
            <span>${startBlockReason}</span>
          </div>`
        : null}
      ${!error && !startBlocked && startSoftNotice
        ? html`<div className="wb13-hint" role="status">
            <${Icon} name="pulse" />
            <span>${startSoftNotice}</span>
          </div>`
        : null}
      <div className="wb13-chips" data-testid="workbench-suggestions">
        ${primarySuggestions.map(
          (suggestion) => html`
            <button
              key=${suggestion.id}
              type="button"
              className="wb13-chip"
              onClick=${() => fill(workbenchSuggestionFill(suggestion))}
            >
              ${suggestion.label}
            </button>
          `
        )}
        <button
          type="button"
          className="wb13-chip is-muted"
          aria-expanded=${showMore}
          onClick=${() => setShowMore((open) => !open)}
        >
          More
        </button>
        ${showMore
          ? moreSuggestions.map(
              (suggestion) => html`
                <button
                  key=${suggestion.id}
                  type="button"
                  className="wb13-chip"
                  onClick=${() => fill(workbenchSuggestionFill(suggestion))}
                >
                  ${suggestion.label}
                </button>
              `
            )
          : null}
      </div>
    </div>
  `;
}
