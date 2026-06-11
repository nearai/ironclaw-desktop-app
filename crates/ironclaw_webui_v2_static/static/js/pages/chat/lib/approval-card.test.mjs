import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

function approvalCardSourceForTest() {
  const source = readFileSync(new URL('../components/approval-card.js', import.meta.url), 'utf8');
  const lines = [];
  let skippingImport = false;
  for (const line of source.split('\n')) {
    if (!skippingImport && line.startsWith('import ')) {
      skippingImport = !line.trimEnd().endsWith(';');
      continue;
    }
    if (skippingImport) {
      skippingImport = !line.trimEnd().endsWith(';');
      continue;
    }
    lines.push(line.replace('export function ApprovalCard', 'function ApprovalCard'));
  }
  return `${lines.join('\n')}\nglobalThis.__testExports = { ApprovalCard };`;
}

function textContent(node) {
  if (node == null) return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textContent).join(' ');
  if (typeof node !== 'object' || !Array.isArray(node.values)) return '';
  return node.values.map(textContent).join(' ');
}

function renderApprovalCard({ alwaysState = false, onApprove, onDeny, onAlways } = {}) {
  const listeners = new Map();
  const cleanups = [];
  const components = {
    Badge() {},
    Button() {},
    Icon() {}
  };
  const translations = {
    'approval.title': 'Approval required',
    'approval.approve': 'Approve',
    'approval.deny': 'Deny',
    'approval.approveAndAlways': 'Approve & always allow',
    'approval.alwaysAllowToolLabel': 'Always allow {tool} without asking',
    'approval.thisTool': 'this tool',
    'approval.nothingSentYet': 'Nothing has been sent yet.',
    'approval.touchesLabel': 'Touches',
    'approval.whatLeavesMachineLabel': 'What leaves the machine',
    'approval.notSpecified': 'Not specified by the tool.',
    'approval.parametersLabel': 'Parameters',
    'approval.shortcutHint': 'Cmd/Ctrl+Enter approve / Esc deny',
    'tool.riskWrite': 'writes files'
  };
  const context = {
    ...components,
    React: {
      useCallback: (fn) => fn,
      useEffect: (fn) => {
        const cleanup = fn();
        if (cleanup) cleanups.push(cleanup);
      },
      useMemo: (fn) => fn(),
      useState: () => [alwaysState, () => {}]
    },
    classifyRisk: () => ({ tone: 'danger', key: 'tool.riskWrite' }),
    globalThis: {},
    html: (strings, ...values) => ({ strings: Array.from(strings), values }),
    useT:
      () =>
      (key, params = {}) =>
        (translations[key] || key).replace(/\{(\w+)\}/g, (_match, name) => params[name] || '')
  };
  context.window = {
    addEventListener: (type, listener) => listeners.set(type, listener),
    removeEventListener: (type, listener) => {
      if (listeners.get(type) === listener) listeners.delete(type);
    }
  };

  vm.runInNewContext(approvalCardSourceForTest(), context);
  const tree = context.globalThis.__testExports.ApprovalCard({
    gate: {
      toolName: 'send_email',
      description: 'Send the generated services agreement to legal review.',
      parameters: '{\n  "recipient": "legal-review@example.com"\n}',
      allowAlways: true
    },
    onApprove,
    onDeny,
    onAlways
  });
  return { tree, components, listeners, cleanups };
}

test('ApprovalCard names the pending action, pending state, outgoing data, and shortcuts', () => {
  const { tree, cleanups } = renderApprovalCard();

  const visible = textContent(tree);
  assert.match(visible, /Nothing has been sent yet\./);
  assert.match(visible, /Touches/);
  assert.match(visible, /send_email/);
  assert.match(visible, /What leaves the machine/);
  assert.match(visible, /Send the generated services agreement to legal review\./);
  assert.match(visible, /Parameters/);
  assert.match(visible, /legal-review@example\.com/);
  assert.match(visible, /Cmd\/Ctrl\+Enter approve \/ Esc deny/);
  assert.match(visible, /Approve/);
  assert.match(visible, /Deny/);
  cleanups.forEach((cleanup) => cleanup());
});

test('ApprovalCard keyboard shortcuts approve and deny while ignoring editable text fields', () => {
  const calls = [];
  const { listeners, cleanups } = renderApprovalCard({
    onApprove: () => calls.push('approve'),
    onDeny: () => calls.push('deny')
  });
  const onKeyDown = listeners.get('keydown');
  assert.equal(typeof onKeyDown, 'function');

  onKeyDown({
    key: 'Enter',
    metaKey: true,
    target: { tagName: 'TEXTAREA' },
    preventDefault: () => calls.push('prevented-textarea')
  });
  onKeyDown({
    key: 'Enter',
    metaKey: true,
    target: { tagName: 'DIV' },
    preventDefault: () => calls.push('prevented-approve')
  });
  onKeyDown({
    key: 'Escape',
    target: { tagName: 'DIV' },
    preventDefault: () => calls.push('prevented-deny')
  });

  assert.deepEqual(calls, ['prevented-approve', 'approve', 'prevented-deny', 'deny']);
  cleanups.forEach((cleanup) => cleanup());
});

test('ApprovalCard Cmd/Ctrl+Enter uses always-allow when checked', () => {
  const calls = [];
  const { listeners, cleanups } = renderApprovalCard({
    alwaysState: true,
    onApprove: () => calls.push('approve'),
    onAlways: () => calls.push('always')
  });

  listeners.get('keydown')({
    key: 'Enter',
    ctrlKey: true,
    target: { tagName: 'DIV' },
    preventDefault: () => calls.push('prevented')
  });

  assert.deepEqual(calls, ['prevented', 'always']);
  cleanups.forEach((cleanup) => cleanup());
});
