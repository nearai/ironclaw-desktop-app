import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const COPY = {
  'skills.content': 'SKILL.md content',
  'skills.contentHint': 'Use the full SKILL.md frontmatter and prompt content.',
  'skills.contentPlaceholder': '---\nname: example\n---\n',
  'skills.httpsRequired': 'URL must use HTTPS.',
  'skills.import': 'Import skill',
  'skills.importDesc': 'Paste SKILL.md content or link to a skill bundle.',
  'skills.importSourceRequired': 'Provide an HTTPS URL or SKILL.md content.',
  'skills.install': 'Import',
  'skills.installFailed': 'Import failed.',
  'skills.installedSuccess': 'Added skill "{name}"',
  'skills.installing': 'Importing...',
  'skills.name': 'Skill name',
  'skills.namePlaceholder': 'skill-name',
  'skills.nameRequired': 'Skill name is required.',
  'skills.url': 'HTTPS URL',
  'skills.urlHint': 'Use a direct HTTPS link to SKILL.md or a supported skill bundle.',
  'skills.urlPlaceholder': 'https://example.com/SKILL.md'
};

function skillInstallPanelSourceForTest() {
  const source = readFileSync(new URL('./skill-install-panel.js', import.meta.url), 'utf8');
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
    lines.push(line.replace(/^export function /, 'function '));
  }
  return `${lines.join('\n')}\nglobalThis.__testExports = { SkillInstallPanel };`;
}

function html(strings, ...values) {
  return { strings: Array.from(strings), values };
}

function visit(node, fn) {
  if (Array.isArray(node)) {
    for (const item of node) visit(item, fn);
    return;
  }
  if (!node || typeof node !== 'object') return;
  fn(node);
  if (Array.isArray(node.values)) {
    for (const value of node.values) visit(value, fn);
  }
}

function collectScalars(root) {
  const scalars = [];
  visit(root, (node) => {
    if (!Array.isArray(node.values)) return;
    for (const value of node.values) {
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        scalars.push(value);
      }
    }
  });
  return scalars;
}

function componentProps(rendered, component, allComponents) {
  const props = [];
  for (let index = 0; index < rendered.values.length; index += 1) {
    if (rendered.values[index] !== component) continue;
    const current = {};
    for (let propIndex = index + 1; propIndex < rendered.values.length; propIndex += 1) {
      if (allComponents.has(rendered.values[propIndex])) break;
      const name = rendered.strings[propIndex]?.match(/([A-Za-z][A-Za-z0-9-]*)=\s*$/)?.[1];
      if (name) current[name] = rendered.values[propIndex];
    }
    props.push(current);
  }
  return props;
}

function createHarness({ onInstall = async () => ({ success: true }) } = {}) {
  const state = [];
  let cursor = 0;

  function Button() {}
  function Card() {}
  function FormField() {}
  function Icon() {}
  function Input() {}
  function Textarea() {}

  const React = {
    useCallback(fn) {
      return fn;
    },
    useState(initial) {
      const index = cursor;
      cursor += 1;
      if (!(index in state)) state[index] = initial;
      return [
        state[index],
        (next) => {
          state[index] = typeof next === 'function' ? next(state[index]) : next;
        }
      ];
    }
  };

  const installs = [];
  const context = {
    Boolean,
    Button,
    Card,
    FormField,
    Icon,
    Input,
    React,
    Textarea,
    globalThis: {},
    html,
    useT: () => (key, values = {}) => {
      let value = COPY[key] || key;
      for (const [name, replacement] of Object.entries(values)) {
        value = value.replace(`{${name}}`, replacement);
      }
      return value;
    }
  };
  vm.runInNewContext(skillInstallPanelSourceForTest(), context);
  const allComponents = new Set([Button, Card, FormField, Icon, Input, Textarea]);

  return {
    Button,
    FormField,
    Input,
    Textarea,
    installs,
    props(rendered, component) {
      return componentProps(rendered, component, allComponents);
    },
    render({ isInstalling = false } = {}) {
      cursor = 0;
      return context.globalThis.__testExports.SkillInstallPanel({
        isInstalling,
        onInstall: async (payload) => {
          installs.push(payload);
          return onInstall(payload);
        }
      });
    }
  };
}

test('SkillInstallPanel clears required-field errors when URL import becomes valid', async () => {
  const harness = createHarness();
  let rendered = harness.render();

  await harness.props(rendered, harness.Button)[0].onClick();
  assert.deepEqual(harness.installs, []);

  rendered = harness.render();
  let fields = harness.props(rendered, harness.FormField);
  let inputs = harness.props(rendered, harness.Input);
  let textareas = harness.props(rendered, harness.Textarea);
  assert.equal(fields[0].error, 'Skill name is required.');
  assert.equal(fields[2].error, 'Provide an HTTPS URL or SKILL.md content.');
  assert.equal(inputs[0].error, true);
  assert.equal(inputs[0]['aria-invalid'], 'true');
  assert.equal(textareas[0].error, true);
  assert.equal(textareas[0]['aria-invalid'], 'true');

  inputs[0].onInput({ currentTarget: { value: 'summarizer' } });
  rendered = harness.render();
  inputs = harness.props(rendered, harness.Input);
  inputs[1].onInput({ currentTarget: { value: 'https://example.com/SKILL.md' } });

  rendered = harness.render();
  fields = harness.props(rendered, harness.FormField);
  inputs = harness.props(rendered, harness.Input);
  textareas = harness.props(rendered, harness.Textarea);
  assert.equal(fields[0].error, '');
  assert.equal(fields[1].error, '');
  assert.equal(fields[2].error, '');
  assert.equal(inputs[0].error, false);
  assert.equal(inputs[1].error, false);
  assert.equal(textareas[0].error, false);

  await harness.props(rendered, harness.Button)[0].onClick();
  assert.deepEqual(JSON.parse(JSON.stringify(harness.installs)), [
    {
      name: 'summarizer',
      url: 'https://example.com/SKILL.md'
    }
  ]);

  rendered = harness.render();
  assert.equal(harness.props(rendered, harness.Input)[0].value, '');
  assert.equal(harness.props(rendered, harness.Input)[1].value, '');
  assert.equal(harness.props(rendered, harness.Textarea)[0].value, '');
  assert.ok(collectScalars(rendered).includes('Added skill "summarizer"'));
});

test('SkillInstallPanel clears URL validation when a URL is fixed', async () => {
  const harness = createHarness();
  let rendered = harness.render();
  let inputs = harness.props(rendered, harness.Input);
  inputs[0].onInput({ currentTarget: { value: 'summarizer' } });

  rendered = harness.render();
  inputs = harness.props(rendered, harness.Input);
  inputs[1].onInput({ currentTarget: { value: 'http://example.com/SKILL.md' } });
  rendered = harness.render();

  await harness.props(rendered, harness.Button)[0].onClick();

  rendered = harness.render();
  let fields = harness.props(rendered, harness.FormField);
  inputs = harness.props(rendered, harness.Input);
  assert.equal(fields[1].error, 'URL must use HTTPS.');
  assert.equal(inputs[1].error, true);
  assert.equal(inputs[1]['aria-invalid'], 'true');

  inputs[1].onInput({ currentTarget: { value: 'https://example.com/SKILL.md' } });

  rendered = harness.render();
  fields = harness.props(rendered, harness.FormField);
  inputs = harness.props(rendered, harness.Input);
  assert.equal(fields[1].error, '');
  assert.equal(inputs[1].error, false);
  assert.equal(inputs[1]['aria-invalid'], undefined);
});

test('SkillInstallPanel displays install failures without resetting entered values', async () => {
  const harness = createHarness({
    onInstall: async () => ({ success: false, message: 'Skill already exists.' })
  });
  let rendered = harness.render();

  harness.props(rendered, harness.Input)[0].onInput({ currentTarget: { value: 'summarizer' } });
  rendered = harness.render();
  harness.props(rendered, harness.Textarea)[0].onInput({
    currentTarget: { value: '---\nname: summarizer\n---\nSummarize documents.' }
  });
  rendered = harness.render();

  await harness.props(rendered, harness.Button)[0].onClick();

  rendered = harness.render();
  assert.deepEqual(JSON.parse(JSON.stringify(harness.installs)), [
    {
      name: 'summarizer',
      content: '---\nname: summarizer\n---\nSummarize documents.'
    }
  ]);
  assert.equal(harness.props(rendered, harness.Input)[0].value, 'summarizer');
  assert.equal(harness.props(rendered, harness.Textarea)[0].value, '---\nname: summarizer\n---\nSummarize documents.');
  assert.ok(collectScalars(rendered).includes('Skill already exists.'));
});

test('SkillInstallPanel disables submit and changes label while installing', () => {
  const harness = createHarness();
  const rendered = harness.render({ isInstalling: true });
  const button = harness.props(rendered, harness.Button)[0];

  assert.equal(button.disabled, true);
  assert.ok(collectScalars(rendered).includes('Importing...'));
});
