import { readFileSync } from 'node:fs';
import { expect, type Page, type Route } from '@playwright/test';

type ChiefOfStaffPrompt = {
  id: string;
  domainLabel: string;
  prompt: string;
};

type WorkbenchPersonaFixtures = {
  chiefOfStaffPrompts: ChiefOfStaffPrompt[];
  functionPickerLabels: string[];
  bannedVisibleCopy: string[];
};

type LocalDocumentFixture = {
  id: string;
  title: string;
  artifactTitle: string;
  sourcePath: string;
  expectedText: string;
  content: string;
};

type WorkbenchMockOptions = {
  sentMessages?: Array<{ path: string; body: Record<string, unknown> }>;
  activeModelSelections?: Array<Record<string, unknown>>;
  activeModelError?: string;
  requestLog?: string[];
  threads?: Array<Record<string, unknown>>;
  threadsError?: string;
  automations?: Array<Record<string, unknown>>;
  automationsError?: string;
  timelineMessages?: Array<Record<string, unknown>>;
  extensions?: Array<Record<string, unknown>>;
  registryEntries?: Array<Record<string, unknown>>;
  workspaceFs?: {
    mounts?: Array<Record<string, unknown>>;
    entries?: Array<Record<string, unknown>>;
    files?: Record<string, { mime_type: string; size_bytes: number; content: string }>;
    listError?: string;
    contentErrors?: Record<string, string>;
  };
  connectorAccounts?: Array<Record<string, unknown>>;
  connectorAccountsError?: number;
  connectorReads?: Record<string, unknown>;
  connectorReadDelayMs?: number | Record<string, number>;
  connectorReadRequests?: Array<Record<string, unknown>>;
  connectorReadError?: number;
  connectorWrites?: Record<string, unknown>;
  connectorWriteRequests?: Array<Record<string, unknown>>;
  connectorWriteError?: number;
};

export const workbenchPersonaFixtures = JSON.parse(
  readFileSync(new URL('./workbench-persona-fixtures.json', import.meta.url), 'utf8')
) as WorkbenchPersonaFixtures;

const workbenchStylesUrl = new URL(
  '../../crates/ironclaw_webui_v2_static/static/js/pages/workbench/workbench-styles.js',
  import.meta.url
);
const workbenchStylesEntrySource = readFileSync(workbenchStylesUrl, 'utf8');
const workbenchImportedStyleSources = Array.from(
  workbenchStylesEntrySource.matchAll(/import\s+\{[^}]+\}\s+from\s+'([^']+)';/g)
).map((match) => readFileSync(new URL(match[1], workbenchStylesUrl), 'utf8'));

export const workbenchStylesSource = [
  workbenchStylesEntrySource,
  ...workbenchImportedStyleSources
].join('\n');

const localDocumentFixtureSources: Array<Omit<LocalDocumentFixture, 'content'>> = [
  {
    id: 'roadmap-extraction',
    title: 'NEAR AI roadmap extraction',
    artifactTitle: 'Roadmap phases and product themes',
    sourcePath: 'docs/design/near-ai-consolidated-roadmap-extraction-2026-06-18.md',
    expectedText: 'Self-learning loops'
  },
  {
    id: 'scenario-corpus',
    title: 'Practical work scenario corpus',
    artifactTitle: 'Scenario matrix and evidence standards',
    sourcePath: 'docs/reviews/practical-work-scenario-corpus.md',
    expectedText: 'Finance scenarios require holdings source'
  },
  {
    id: 'buildout-instructions',
    title: 'Workbench buildout instructions',
    artifactTitle: 'Generalizable workbench direction',
    sourcePath: 'docs/design/cursor-workbench-buildout-instructions-2026-06-19.md',
    expectedText: 'This is not a legal-only matter desk'
  }
];

export const localDocumentFixtures: LocalDocumentFixture[] = localDocumentFixtureSources.map(
  (fixture) => ({
    ...fixture,
    content: readFileSync(new URL(`../../${fixture.sourcePath}`, import.meta.url), 'utf8')
  })
);

const gatewayStatus = {
  engine_v2_enabled: true,
  restart_enabled: false,
  total_connections: 0,
  llm_backend: 'nearai',
  llm_model: 'auto',
  model_execution_verified: true,
  model_readiness: 'ready',
  model_execution_readiness: 'ready'
};

const llmProviders = {
  providers: [
    {
      id: 'nearai',
      name: 'NEAR AI Cloud',
      description: 'Model access through NEAR AI Cloud.',
      adapter: 'nearai',
      default_model: 'auto',
      builtin: true,
      api_key_required: false,
      accepts_api_key: true,
      base_url_required: false,
      api_key_set: true
    }
  ],
  active: {
    provider_id: 'nearai',
    model: 'auto'
  }
};

export async function seedRecentWork(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      'ironclaw-work-items',
      JSON.stringify([
        {
          id: 'work-friday-brief',
          title: 'Customer renewal response',
          objective: 'Customer-ready renewal package held for approval.',
          status: 'active',
          created_at: '2026-06-19T14:00:00.000Z',
          updated_at: '2026-06-19T14:00:00.000Z',
          links: [
            {
              kind: 'thread',
              ref: 'thread-workbench-runtime',
              label: 'Chat runtime'
            }
          ],
          openApprovals: [
            {
              id: 'send-renewal-response',
              title: 'Send the renewal response',
              destination: 'dana@customer.example',
              actionLabel: 'Send renewal response with attachment',
              outbound: 'Response body plus Renewal-terms-summary.md',
              attachment: 'Renewal-terms-summary.md',
              reversible: 'Recall only within the email provider window',
              barTitle: 'Linked Chat send draft',
              barDetail: 'Prepared customer response with 1 attachment. Nothing has been sent yet.',
              bodyPreview:
                'Thanks for the renewal notes. We can move to net 45 and keep the support response target at 2 hours.'
            }
          ],
          packet: {
            title: 'Customer renewal review',
            subtitle: 'Artifact + response draft',
            stateLabel: 'Saved artifact with response draft',
            version: 6,
            contexts: ['Email thread', 'Renewal notes', 'Slack: #accounts', 'Due today'],
            read: 'You want a customer-ready renewal response. The artifact and response draft are saved for review; any send continues in Chat.',
            decisions: [
              {
                label: 'Support response target',
                value: 'Keep 2-hour target - they asked same-day',
                source: 'Customer success notes plus owner confirmation'
              },
              {
                label: 'Payment terms',
                value: 'Concede net 45',
                source: 'Within approved concession range'
              }
            ],
            documentClauses: [
              {
                label: 'SLA',
                title: 'Support response',
                status: 'Reviewed',
                tone: 'held',
                text: 'Support response stays under 2 hours for priority escalations.'
              },
              {
                label: 'Terms',
                title: 'Payment',
                status: 'Changed',
                tone: 'changed',
                text: 'Payment moves to net 45. The customer asked for net 60.'
              }
            ],
            email: {
              to: 'dana@customer.example',
              subject: 'Re: Renewal terms',
              attachment: 'Renewal-terms-summary.md',
              body: 'Hi,\\n\\nThanks for the renewal notes. We can move to net 45 on payment and keep the priority support response target at 2 hours. The renewal summary is attached for your review.'
            },
            evidence: [
              {
                title: 'Customer asks for revised renewal terms',
                detail: 'The request this response draft addresses.',
                source: 'email',
                when: 'today'
              },
              {
                title: 'Customer success note',
                detail: '2-hour priority response is supported; net 45 is inside range.',
                source: 'docs',
                when: 'Drive'
              }
            ],
            activity: [
              {
                label: 'Read renewal email and current account notes',
                when: '8:05 AM'
              },
              {
                label: 'Drafted renewal artifact v6 and response draft',
                when: '8:40 AM'
              }
            ]
          },
          artifacts: [
            {
              id: 'artifact-friday-brief',
              type: 'review-artifact',
              title: 'Renewal-terms-summary.md',
              status: 'ready',
              provenance: ['Gmail thread', 'Renewal notes', 'Slack #accounts'],
              content:
                '# Customer renewal\\n\\nSupport response stays under 2 hours. Payment moves to net 45.',
              content_format: 'markdown'
            }
          ],
          receipts: [
            {
              id: 'drafted',
              title: 'Renewal artifact prepared',
              status: 'Prepared',
              detail: 'No external send completed.'
            }
          ]
        }
      ])
    );
  });
}

export async function seedLocalDocumentWork(page: Page) {
  const workItems = localDocumentFixtures.map((fixture, index) => ({
    id: `work-local-${fixture.id}`,
    title: fixture.title,
    status: 'active',
    created_at: `2026-06-19T14:0${index}:00.000Z`,
    updated_at: `2026-06-19T14:0${index}:00.000Z`,
    links: [
      {
        label: fixture.sourcePath,
        href: fixture.sourcePath
      }
    ],
    artifacts: [
      {
        id: `artifact-local-${fixture.id}`,
        type: 'brief',
        title: fixture.artifactTitle,
        status: 'ready',
        provenance: [fixture.sourcePath],
        content: fixture.content,
        content_format: 'markdown'
      }
    ]
  }));

  await page.addInitScript((items) => {
    window.localStorage.setItem('ironclaw-work-items', JSON.stringify(items));
  }, workItems);
}

export async function installWorkbenchMocks(page: Page, options: WorkbenchMockOptions = {}) {
  let activeLlm = { ...llmProviders.active };
  await page.route(/\/(api|auth)\//, async (route: Route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    const method = route.request().method();
    options.requestLog?.push(`${method} ${path}`);

    if (path === '/api/gateway/status') {
      return json(route, gatewayStatus);
    }
    if (path === '/api/webchat/v2/llm/providers') {
      return json(route, { ...llmProviders, active: activeLlm });
    }
    if (path === '/api/webchat/v2/llm/list-models' && method === 'POST') {
      return json(route, {
        ok: true,
        models: ['auto', 'z-ai/glm-4.5', 'gpt-oss-120b', 'google/gemini-2.5-pro']
      });
    }
    if (path === '/api/webchat/v2/llm/active' && method === 'POST') {
      const raw = route.request().postData() || '{}';
      let body: Record<string, unknown> = {};
      try {
        body = JSON.parse(raw);
      } catch {
        body = {};
      }
      options.activeModelSelections?.push(body);
      if (options.activeModelError) {
        return text(route, 500, options.activeModelError);
      }
      activeLlm = {
        provider_id: String(body.provider_id || 'nearai'),
        model: String(body.model || 'auto')
      };
      return json(route, { active: body });
    }
    if (path === '/api/webchat/v2/threads' && method === 'GET') {
      if (options.threadsError) {
        return text(route, 500, options.threadsError);
      }
      return json(route, { threads: options.threads || [], next_cursor: null });
    }
    if (path === '/api/webchat/v2/automations' && method === 'GET') {
      if (options.automationsError) {
        return text(route, 500, options.automationsError);
      }
      return json(route, { automations: options.automations || [], next_cursor: null });
    }
    if (path === '/api/webchat/v2/threads' && method === 'POST') {
      return json(route, {
        thread: {
          id: 'thread-workbench-runtime',
          thread_id: 'thread-workbench-runtime',
          title: 'Workbench request',
          updated_at: '2026-06-19T16:00:00.000Z'
        }
      });
    }
    if (path === '/api/webchat/v2/threads/thread-workbench-runtime/messages' && method === 'POST') {
      const raw = route.request().postData() || '{}';
      let body: Record<string, unknown> = {};
      try {
        body = JSON.parse(raw);
      } catch {
        body = {};
      }
      options.sentMessages?.push({ path, body });
      return json(route, {
        thread_id: 'thread-workbench-runtime',
        run_id: 'run-workbench-runtime',
        status: 'queued',
        accepted_message_ref: 'msg-workbench-runtime'
      });
    }
    if (path === '/api/webchat/v2/threads/thread-workbench-runtime/timeline') {
      return json(route, {
        messages: options.timelineMessages || [],
        summary_artifacts: [],
        next_cursor: null
      });
    }
    if (path === '/api/webchat/v2/threads/thread-workbench-runtime/events') {
      return route.fulfill({
        status: 200,
        contentType: 'text/event-stream; charset=utf-8',
        body: ': connected\n\n'
      });
    }
    if (path === '/api/webchat/v2/extensions/registry') {
      return json(route, { entries: options.registryEntries || [] });
    }
    if (path === '/api/webchat/v2/extensions') {
      return json(route, { extensions: options.extensions || [] });
    }
    if (path === '/api/webchat/v2/channels/connectable') {
      return json(route, { channels: [] });
    }
    if (path === '/api/webchat/v2/fs/mounts') {
      return json(route, { mounts: options.workspaceFs?.mounts || [] });
    }
    if (path === '/api/webchat/v2/fs/list') {
      if (options.workspaceFs?.listError) {
        return text(route, 500, options.workspaceFs.listError);
      }
      return json(route, { entries: options.workspaceFs?.entries || [] });
    }
    if (path === '/api/webchat/v2/fs/stat') {
      const key = `${url.searchParams.get('mount') || ''}/${url.searchParams.get('path') || ''}`;
      const file = options.workspaceFs?.files?.[key];
      return json(route, {
        stat: file
          ? {
              kind: 'file',
              mime_type: file.mime_type,
              size_bytes: file.size_bytes
            }
          : { kind: 'directory', mime_type: 'inode/directory', size_bytes: 0 }
      });
    }
    if (path === '/api/webchat/v2/fs/content') {
      const key = `${url.searchParams.get('mount') || ''}/${url.searchParams.get('path') || ''}`;
      const contentError = options.workspaceFs?.contentErrors?.[key];
      if (contentError) {
        return text(route, 500, contentError);
      }
      const file = options.workspaceFs?.files?.[key];
      return route.fulfill({
        status: file ? 200 : 404,
        contentType: file?.mime_type || 'text/plain; charset=utf-8',
        body: file?.content || 'not found'
      });
    }
    if (path === '/api/webchat/v2/connectors/connected') {
      if (options.connectorAccountsError) {
        return text(route, options.connectorAccountsError, 'connectors unavailable');
      }
      return json(route, { accounts: options.connectorAccounts || [] });
    }
    if (path === '/api/webchat/v2/connectors/read' && method === 'POST') {
      const raw = route.request().postData() || '{}';
      let body: { toolkit?: string; tool?: string } = {};
      try {
        body = JSON.parse(raw);
      } catch {
        body = {};
      }
      options.connectorReadRequests?.push(body);
      if (options.connectorReadError) {
        return text(route, options.connectorReadError, 'connector read failed');
      }
      const toolkit = String(body.toolkit || '');
      const tool = String(body.tool || '');
      const delayMs = connectorReadDelayMs(options.connectorReadDelayMs, tool, toolkit);
      if (delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
      // Prefer a tool-keyed mock (e.g. GOOGLECALENDAR_EVENTS_LIST) when present so
      // a single toolkit can mock distinct reads; fall back to the toolkit key.
      const payload = (tool && options.connectorReads?.[tool]) ?? options.connectorReads?.[toolkit];
      return json(route, payload ?? { successful: true, data: { messages: [] } });
    }
    if (path === '/api/webchat/v2/connectors/write' && method === 'POST') {
      const raw = route.request().postData() || '{}';
      let body: { toolkit?: string; tool?: string } = {};
      try {
        body = JSON.parse(raw);
      } catch {
        body = {};
      }
      options.connectorWriteRequests?.push(body);
      if (options.connectorWriteError) {
        return text(route, options.connectorWriteError, 'connector write failed');
      }
      const toolkit = String(body.toolkit || '');
      const tool = String(body.tool || '');
      const payload =
        (tool && options.connectorWrites?.[tool]) ?? options.connectorWrites?.[toolkit];
      return json(
        route,
        payload ?? { successful: true, data: { response_data: { id: 'draft-static' } } }
      );
    }
    if (path === '/auth/providers') {
      return json(route, { providers: [] });
    }

    return json(route, { error: `Unexpected mocked route: ${method} ${path}` }, 501);
  });
}

function connectorReadDelayMs(
  delay: WorkbenchMockOptions['connectorReadDelayMs'],
  tool: string,
  toolkit: string
) {
  if (typeof delay === 'number') return delay;
  if (!delay || typeof delay !== 'object') return 0;
  const value = delay[tool] ?? delay[toolkit];
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

async function text(route: Route, status: number, body: string) {
  await route.fulfill({
    status,
    contentType: 'text/plain; charset=utf-8',
    body
  });
}

async function json(route: Route, body: unknown, status = 200) {
  await route.fulfill({
    status,
    contentType: 'application/json; charset=utf-8',
    body: JSON.stringify(body)
  });
}

export function assertBannedWorkbenchCopyAbsent(text: string) {
  const normalizedText = text.toLowerCase();
  for (const phrase of workbenchPersonaFixtures.bannedVisibleCopy) {
    expect(normalizedText).not.toContain(phrase.toLowerCase());
  }
}

export function cssRuleBody(source: string, selectorStart: string) {
  const start = source.indexOf(selectorStart);
  expect(start, `CSS rule should exist for ${selectorStart}`).toBeGreaterThanOrEqual(0);
  const bodyStart = source.indexOf('{', start);
  const bodyEnd = source.indexOf('}', bodyStart);
  expect(bodyStart, `CSS rule body should start for ${selectorStart}`).toBeGreaterThanOrEqual(0);
  expect(bodyEnd, `CSS rule body should end for ${selectorStart}`).toBeGreaterThan(bodyStart);
  return source.slice(bodyStart + 1, bodyEnd);
}
