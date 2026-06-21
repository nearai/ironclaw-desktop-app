import { expect, test } from '@playwright/test';
import {
  assertBannedWorkbenchCopyAbsent,
  cssRuleBody,
  installWorkbenchMocks,
  localDocumentFixtures,
  seedLocalDocumentWork,
  seedRecentWork,
  workbenchPersonaFixtures,
  workbenchStylesSource
} from './workbench-static-fixtures';

test('static workbench stylesheet: visual polish guards wrap detail text and dim disabled actions', () => {
  // Body uses the self-hosted "Inter Variable" face first (bare "Inter" never
  // shipped, so it silently fell back to system-ui and read tired).
  expect(workbenchStylesSource).toContain('--wb-font-body: "Inter Variable", Inter');
  // v13 fidelity: the display face is the editorial serif (Newsreader), now
  // self-hosted via @font-face so it no longer falls back to system Charter/Palatino.
  expect(workbenchStylesSource).toContain('--wb-font-display: Newsreader, "Newsreader Variable"');
  expect(workbenchStylesSource).toContain('[data-theme="dark"] .wb13');
  expect(workbenchStylesSource).toContain('resize: none;');
  expect(workbenchStylesSource).toContain(
    '.wb13-well textarea { min-height: 320px; padding-bottom: 178px; }'
  );
  expect(workbenchStylesSource).not.toContain('Georgia');
  expect(workbenchStylesSource).not.toContain('Times New Roman');

  const dockDetailRule = cssRuleBody(workbenchStylesSource, '.wb13-dock-detail');
  expect(dockDetailRule).toContain('overflow-wrap: anywhere;');
  expect(dockDetailRule).not.toContain('white-space: nowrap;');

  const sendDisabledRule = cssRuleBody(workbenchStylesSource, '.wb13-send:disabled,');
  expect(sendDisabledRule).toContain('background: var(--wb-line-2);');
  expect(sendDisabledRule).toContain('color: var(--wb-faint);');

  const primaryDisabledRule = cssRuleBody(
    workbenchStylesSource,
    '.wb13-button.is-primary:disabled,'
  );
  expect(primaryDisabledRule).toContain('background: var(--wb-line-2);');
  expect(primaryDisabledRule).toContain('color: var(--wb-faint);');
});

test('static workbench: direct route renders v13 replacement shell with real wiring targets', async ({
  page
}) => {
  const consoleIssues: string[] = [];
  page.on('console', (message) => {
    if (['error', 'warning'].includes(message.type())) {
      consoleIssues.push(`${message.type()}: ${message.text()}`);
    }
  });
  page.on('pageerror', (error) => {
    consoleIssues.push(`pageerror: ${error.message}`);
  });

  await installWorkbenchMocks(page);
  await seedRecentWork(page);
  await page.goto('/v2/?token=workbench-static-token');

  await expect(page).toHaveURL(/\/v2\/workbench$/);
  await expect(page.getByTestId('workbench-page')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'What do you want handled?' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'New' })).toHaveCount(0);
  await expect(page.getByRole('navigation', { name: 'Primary navigation' })).toHaveCount(0);

  await page.goto('/v2/workbench?token=workbench-static-token');

  await expect(page).toHaveURL(/\/v2\/workbench$/);
  await expect(page.getByTestId('workbench-page')).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Workbench primary' })).toBeVisible();
  // v13 fidelity: the Memory nav item is restored and routes to a real
  // destination (saved Work / Library), never a dead nav.
  const memoryNav = page
    .getByRole('navigation', { name: 'Workbench primary' })
    .getByRole('button', { name: 'Memory' });
  await expect(memoryNav).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Show allowed sources' })).toHaveCount(0);
  // v13 fidelity: an in-surface theme toggle is present and exposes its state.
  await expect(
    page.getByRole('navigation', { name: 'Workbench primary' }).getByRole('button', {
      name: /Switch to (light|dark) theme/
    })
  ).toHaveCount(1);
  const activeWork = page.getByRole('complementary', { name: 'Active work' });
  await expect(activeWork).toBeVisible();
  // v13 fidelity: the dock identity line reflects the signed-in NEAR AI Cloud account.
  await expect(activeWork).toContainText('NEAR AI Cloud');
  await expect(activeWork).not.toContainText('Private work, held for review');
  await expect(page.getByRole('heading', { name: 'What do you want handled?' })).toBeVisible();
  await expect(page.getByTestId('workbench-brief-input')).toHaveAttribute(
    'placeholder',
    'Describe the work in plain language. Paste a thread, drop a file, or give a multi-step instruction...'
  );
  const modelControl = page.getByRole('button', { name: 'Choose model and effort' });
  await expect(modelControl).toContainText('Auto');
  await expect(modelControl).not.toContainText('Deep work');
  await expect(page.getByLabel('Workbench model')).toHaveCount(0);
  await expect(page.getByLabel('Workbench source scope')).toHaveValue('auto');
  await expect(page.locator('.wb13-scope svg path')).toHaveCount(3);
  await expect(page.getByTestId('workbench-triage')).toContainText('Needs a decision');
  await expect(page.getByTestId('workbench-triage')).not.toContainText('Catalog unavailable');
  await expect(page.getByTestId('workbench-triage')).not.toContainText('Blocked sources');
  await expect(activeWork).not.toContainText('Catalog unavailable');
  await expect(activeWork).toContainText('Needs approval');
  await expect(activeWork).toContainText('Recent receipts');
  await expect(page.getByTestId('workbench-document-workspace')).toContainText(
    'Customer renewal review'
  );
  await expect(page.getByTestId('workbench-document-workspace')).toContainText(
    'Saved item with Chat handoff'
  );
  await expect(page.getByTestId('workbench-workspace-files')).toHaveCount(0);
  await expect(page.getByRole('tab', { name: 'Summary' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Reply' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Context' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'View Chat handoff' })).toBeVisible();
  await page.evaluate(() => {
    document.documentElement.setAttribute('data-theme', 'dark');
  });
  await expect(page.locator('.wb13-main')).toHaveCSS('background-color', 'rgb(11, 16, 22)');
  await expect(page.locator('.wb13-well textarea')).toHaveCSS(
    'background-color',
    'rgb(17, 24, 33)'
  );
  await expect(page.getByRole('link', { name: /Open in Work/ })).toHaveAttribute(
    'href',
    '/v2/work?item=work-friday-brief&artifact=artifact-friday-brief'
  );
  await page.getByRole('button', { name: "What's allowed" }).click();
  const inspector = page.getByRole('complementary', { name: 'Allowed sources and boundaries' });
  await expect(inspector).toBeVisible();
  await expect(inspector).toContainText('Sources for this task');
  await expect(inspector).toContainText('Live connector readiness for the current request');
  await expect(inspector).toContainText('Readable now or after setup');
  await expect(inspector).not.toContainText('Can do privately');
  await expect(inspector).not.toContainText('Needs your approval');
  await expect(inspector).not.toContainText('Summarize, compare, draft');
  await expect(inspector).not.toContainText('Prepare artifacts');
  await expect(inspector).not.toContainText('Save durable memory');
  await expect(inspector).not.toContainText('Manage connections');
  await expect(inspector).not.toContainText('Current connector state');

  // Workbench owns its replacement shell here; the legacy app sidebar is not mounted around it.
  await expect(page.getByRole('navigation').getByRole('link', { name: 'Workbench' })).toHaveCount(
    0
  );
  const visibleText = await page.getByTestId('workbench-page').innerText();
  assertBannedWorkbenchCopyAbsent(visibleText);
  expect(consoleIssues).toEqual([]);
});

test('static workbench: Memory nav opens the v13 preference-capture scene', async ({ page }) => {
  await installWorkbenchMocks(page);
  await page.goto('/v2/workbench?token=workbench-static-token');
  await page
    .getByRole('navigation', { name: 'Workbench primary' })
    .getByRole('button', { name: 'Memory' })
    .click();
  const memory = page.getByTestId('workbench-memory');
  await expect(memory).toBeVisible();
  await expect(memory.getByRole('heading', { name: 'Save a preference?' })).toBeVisible();
  await expect(memory.getByRole('radiogroup', { name: 'Memory scope' })).toBeVisible();
  await expect(memory.getByRole('radio', { name: 'Personal' })).toBeVisible();
  // Honest by construction: saving is disabled until a writable memory backend exists.
  await expect(memory.getByRole('button', { name: 'Save preference' })).toBeDisabled();
});

test('static workbench: first-screen suggestions are action language, not a function picker', async ({
  page
}) => {
  await installWorkbenchMocks(page);
  await page.goto('/v2/workbench?token=workbench-static-token');

  const suggestions = page.getByTestId('workbench-suggestions');
  await expect(suggestions).toBeVisible();
  await expect(suggestions.getByRole('button')).toHaveCount(7);

  const labels = (await suggestions.getByRole('button').allTextContents()).map((label) =>
    label.trim()
  );
  expect(labels.slice(0, 4)).toEqual([
    'What needs me today?',
    'Catch me up',
    'Find Slack blockers',
    'Research TEE vendors'
  ]);
  await suggestions.getByRole('button', { name: 'More' }).click();
  const expandedLabels = (await suggestions.getByRole('button').allTextContents()).map((label) =>
    label.trim()
  );
  expect(expandedLabels).toContain('Prepare interview brief');
  expect(expandedLabels).toContain('Watch this weekly');
  expect(expandedLabels).toContain('Grow a channel');

  for (const name of workbenchPersonaFixtures.functionPickerLabels) {
    await expect(page.locator('main').getByRole('button', { name, exact: true })).toHaveCount(0);
    await expect(page.locator('main').getByRole('link', { name, exact: true })).toHaveCount(0);
    await expect(page.locator('main').getByRole('tab', { name, exact: true })).toHaveCount(0);
  }

  assertBannedWorkbenchCopyAbsent(await page.getByTestId('workbench-page').innerText());

  const legalOnlyTerms = /\b(redline|MSA|matter|agreement|amendment|counter|contract|legal)\b/i;
  expect(labels.every((label) => legalOnlyTerms.test(label))).toBe(false);
  expect(labels.slice(0, 6).some((label) => legalOnlyTerms.test(label))).toBe(false);

  expect(labels.some((label) => /\.$/.test(label))).toBe(false);
  await expect(page.getByRole('button', { name: 'Ask', exact: true })).toBeVisible();
  await expect(page.getByTestId('workbench-document-workspace')).toHaveCount(0);
  await expect(page.getByTestId('workbench-workspace-files')).toHaveCount(0);

  await page.getByRole('button', { name: 'Research TEE vendors' }).click();
  await expect(page.getByTestId('workbench-brief-input')).toHaveValue(
    'Research privacy-preserving TEE vendors for business use and give me a shortlist with tradeoffs, source links, and open questions.'
  );
  await expect(page.getByRole('button', { name: 'Research', exact: true })).toBeVisible();
});

test('static workbench: primary command label follows the inferred work type', async ({ page }) => {
  await installWorkbenchMocks(page);
  await page.goto('/v2/workbench?token=workbench-static-token');

  const brief = page.getByTestId('workbench-brief-input');
  await expect(page.getByRole('button', { name: 'Ask', exact: true })).toBeVisible();

  await brief.fill('Prepare investor update for the board.');
  await expect(page.getByRole('button', { name: 'Prepare', exact: true })).toBeVisible();

  await brief.fill('Review the agreement counter before approval.');
  await expect(page.getByRole('button', { name: 'Review', exact: true })).toBeVisible();

  await brief.fill('Watch competitor launches weekly.');
  await expect(page.getByRole('button', { name: 'Watch', exact: true })).toBeVisible();

  await brief.fill('Help me think through this unusual thing.');
  await expect(page.getByRole('button', { name: 'Ask', exact: true })).toBeVisible();
});

test('static workbench: active rail renders real scheduled automation reads', async ({ page }) => {
  const requestLog: string[] = [];
  await installWorkbenchMocks(page, {
    requestLog,
    automations: [
      {
        automation_id: 'auto-weekly-digest',
        name: 'Weekly operator digest',
        state: 'active',
        source: {
          type: 'schedule',
          cron: '0 9 * * 5',
          timezone: 'America/Toronto'
        },
        next_run_at: '2026-06-26T13:00:00.000Z',
        recent_runs: [
          {
            run_id: 'run-ok',
            status: 'ok',
            completed_at: '2026-06-19T13:05:00.000Z',
            thread_id: 'thread-weekly-digest'
          }
        ]
      },
      {
        automation_id: 'auto-market-watch',
        name: 'Market watch',
        state: 'active',
        source: {
          type: 'schedule',
          cron: '0 8 * * *',
          timezone: 'America/Toronto'
        },
        next_run_at: '2026-06-21T12:00:00.000Z',
        recent_runs: [
          {
            run_id: 'run-live',
            status: 'running',
            fired_at: '2026-06-20T12:00:00.000Z',
            thread_id: 'thread-market-watch'
          }
        ]
      },
      {
        automation_id: 'auto-source-sync',
        name: 'Source sync',
        state: 'active',
        source: {
          type: 'schedule',
          cron: '0 * * * *',
          timezone: 'America/Toronto'
        },
        next_run_at: '2026-06-20T14:00:00.000Z',
        recent_runs: [
          {
            run_id: 'run-error',
            status: 'error',
            completed_at: '2026-06-20T13:01:00.000Z',
            thread_id: 'thread-source-sync'
          }
        ]
      }
    ]
  });
  await page.goto('/v2/workbench?token=workbench-static-token');

  await expect
    .poll(() => requestLog.includes('GET /api/webchat/v2/automations'), {
      message: 'Workbench rail should read the real automations route'
    })
    .toBe(true);

  const activeWork = page.getByRole('complementary', { name: 'Active work' });
  await expect(activeWork).toContainText('Weekly operator digest');
  await expect(activeWork).toContainText('Market watch');
  await expect(activeWork).toContainText('Current scheduled run started');
  await expect(activeWork).toContainText('Source sync');
  await expect(activeWork).toContainText('Run failed');

  const triage = page.getByTestId('workbench-triage');
  await expect(triage).toContainText('Weekly operator digest');
  await expect(triage).toContainText('Market watch');
  await expect(triage).toContainText('Source sync');
  await expect(triage).toContainText('Recent receipts');
  await expect(triage).not.toContainText('Create automation');
});

test('static workbench: an unavailable automation feed degrades to honest empty, not a rail error', async ({
  page
}) => {
  // v13 fidelity: the forward-looking home rail never shows a "Scheduled work
  // unavailable" error card. A transiently-failed or unwired automations feed is
  // honest empty — the Scheduled group simply does not appear.
  const requestLog: string[] = [];
  await installWorkbenchMocks(page, {
    requestLog,
    automationsError: 'scheduler offline'
  });
  await page.goto('/v2/workbench?token=workbench-static-token');

  await expect
    .poll(() => requestLog.includes('GET /api/webchat/v2/automations'), {
      message: 'Workbench rail should still attempt the automations read'
    })
    .toBe(true);

  const activeWork = page.getByRole('complementary', { name: 'Active work' });
  await expect(activeWork).not.toContainText('Scheduled work unavailable');
  await expect(activeWork).not.toContainText('Could not check');

  const triage = page.getByTestId('workbench-triage');
  await expect(triage).not.toContainText('Scheduled work unavailable');
  await expect(triage).not.toContainText('Create automation');
});

test('static workbench: an unavailable thread feed degrades quietly without a rail error', async ({
  page
}) => {
  // v13 fidelity: a thread-list outage does not surface a "Conversation list
  // unavailable" error row on the home surface. Cached waiting decisions still
  // surface; a transient outage degrades silently.
  const requestLog: string[] = [];
  await installWorkbenchMocks(page, {
    requestLog,
    threadsError: 'thread list offline'
  });
  await page.goto('/v2/workbench?token=workbench-static-token');

  await expect
    .poll(() => requestLog.includes('GET /api/webchat/v2/threads'), {
      message: 'Workbench rail should still observe the shared threads read'
    })
    .toBe(true);

  const activeWork = page.getByRole('complementary', { name: 'Active work' });
  await expect(activeWork).not.toContainText('Conversation list unavailable');
  await expect(activeWork).not.toContainText('Could not check');

  const triage = page.getByTestId('workbench-triage');
  await expect(triage).not.toContainText('Conversation list unavailable');
});

test('static workbench: corrupt saved work storage is reported in Library, not as a home rail error', async ({
  page
}) => {
  // v13 fidelity: storage health belongs in Library. The home rail never shows a
  // "Saved Work unreadable" blocked card; Library still reports the recovery
  // state honestly.
  await page.addInitScript(() => {
    window.localStorage.setItem('ironclaw-work-items', '{');
  });
  await installWorkbenchMocks(page);
  await page.goto('/v2/workbench?token=workbench-static-token');

  const activeWork = page.getByRole('complementary', { name: 'Active work' });
  await expect(activeWork).not.toContainText('Saved Work unreadable');

  const triage = page.getByTestId('workbench-triage');
  await expect(triage).not.toContainText('Saved Work unreadable');

  await page.getByRole('button', { name: 'Library' }).click();
  await expect(page.getByTestId('workbench-library-source')).toContainText('Needs recovery');
  await expect(page.getByTestId('workbench-library-source')).toContainText(
    'Saved Work storage could not be read in this browser.'
  );
});

test('static workbench: pending thread gates show the specific waiting decision', async ({
  page
}) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      'ironclaw:v2-thread-attention-details',
      JSON.stringify([
        [
          'thread-gate',
          {
            kind: 'approval',
            title: 'Approve counter to Northwind',
            detail: 'External email with net 45 terms is waiting.',
            badge: 'Needs approval',
            icon: 'shield',
            timestamp: '2026-06-20T04:30:00.000Z'
          }
        ]
      ])
    );
  });
  await installWorkbenchMocks(page, {
    threads: [
      {
        thread_id: 'thread-gate',
        title: 'Customer renewal thread',
        state: 'needs_attention',
        turn_count: 5,
        updated_at: '2026-06-19T15:00:00.000Z'
      }
    ]
  });
  await page.goto('/v2/workbench?token=workbench-static-token');

  const activeWork = page.getByRole('complementary', { name: 'Active work' });
  await expect(activeWork).toContainText('Approve counter to Northwind');
  await expect(activeWork).toContainText('External email with net 45 terms is waiting.');
  await expect(activeWork).not.toContainText('An approval or auth gate is waiting in this thread.');

  const triage = page.getByTestId('workbench-triage');
  await expect(triage).toContainText('Needs a decision');
  await expect(triage).toContainText('Approve counter to Northwind');
  await expect(triage).toContainText('External email with net 45 terms is waiting.');
});

test('static workbench: backend thread pending gate detail feeds active work without state', async ({
  page
}) => {
  await installWorkbenchMocks(page, {
    threads: [
      {
        thread_id: 'thread-backend-gate',
        title: 'Generic waiting thread',
        turn_count: 3,
        updated_at: '2026-06-20T12:00:00.000Z',
        pending_gate: {
          kind: 'approval_required',
          headline: 'Approve Slack reply to finance',
          detail: 'Prepared Slack response is held until review.',
          tool_name: 'slack_reply',
          run_id: 'run-gate-1',
          gate_ref: 'gate-slack-1'
        }
      }
    ]
  });
  await page.goto('/v2/workbench?token=workbench-static-token');

  const activeWork = page.getByRole('complementary', { name: 'Active work' });
  await expect(activeWork).toContainText('Approve Slack reply to finance');
  await expect(activeWork).toContainText('Prepared Slack response is held until review.');
  await expect(activeWork).not.toContainText('Generic waiting thread');

  const triage = page.getByTestId('workbench-triage');
  await expect(triage).toContainText('Needs a decision');
  await expect(triage).toContainText('Approve Slack reply to finance');
});

test('static workbench: approvals feed stays quiet until the gateway advertises it', async ({
  page
}) => {
  const approvalsRequests: string[] = [];
  await installWorkbenchMocks(page, { approvalsRequests });
  await page.goto('/v2/workbench?token=workbench-static-token');

  await expect(page.getByRole('complementary', { name: 'Active work' })).toBeVisible();
  await page.waitForTimeout(100);
  expect(approvalsRequests).toEqual([]);
});

test('static workbench: approvals feed populates needs-decision rows when advertised', async ({
  page
}) => {
  const approvalsRequests: string[] = [];
  await installWorkbenchMocks(page, {
    approvalsReadEnabled: true,
    approvalsRequests,
    approvals: [
      {
        approval_id: 'approval-northwind',
        headline: 'Approve counter to Northwind',
        summary: 'External email with net 45 terms is waiting.',
        tool_name: 'GMAIL_CREATE_EMAIL_DRAFT',
        thread_id: 'thread-northwind',
        updated_at: '2026-06-21T06:45:00.000Z'
      }
    ]
  });
  await page.goto('/v2/workbench?token=workbench-static-token');

  const activeWork = page.getByRole('complementary', { name: 'Active work' });
  await expect(activeWork).toContainText('Approve counter to Northwind');
  await expect(activeWork).toContainText('External email with net 45 terms is waiting.');

  const triage = page.getByTestId('workbench-triage');
  await expect(triage).toContainText('Needs a decision');
  await expect(triage).toContainText('Approve counter to Northwind');
  await expect(triage).toContainText('External email with net 45 terms is waiting.');
  expect(approvalsRequests).toEqual(['GET /api/webchat/v2/approvals']);
});

test('static workbench: receipts feed stays quiet until the gateway advertises it', async ({
  page
}) => {
  const receiptsRequests: string[] = [];
  await installWorkbenchMocks(page, { receiptsRequests });
  await page.goto('/v2/workbench?token=workbench-static-token');

  await expect(page.getByRole('complementary', { name: 'Active work' })).toBeVisible();
  await page.waitForTimeout(100);
  expect(receiptsRequests).toEqual([]);
});

test('static workbench: receipts feed populates recent receipts when advertised', async ({
  page
}) => {
  const receiptsRequests: string[] = [];
  await installWorkbenchMocks(page, {
    receiptsReadEnabled: true,
    receiptsRequests,
    receipts: [
      {
        receipt_id: 'receipt-northwind-draft',
        headline: 'Draft saved for Northwind',
        summary: 'Gmail draft created; nothing was sent.',
        status_label: 'Completed',
        tool_name: 'GMAIL_CREATE_EMAIL_DRAFT',
        thread_id: 'thread-northwind',
        completed_at: '2026-06-21T07:45:00.000Z'
      }
    ]
  });
  await page.goto('/v2/workbench?token=workbench-static-token');

  const activeWork = page.getByRole('complementary', { name: 'Active work' });
  await expect(activeWork).toContainText('Recent receipts');
  await expect(activeWork).toContainText('Draft saved for Northwind');
  await expect(activeWork).toContainText('Gmail draft created; nothing was sent.');

  const triage = page.getByTestId('workbench-triage');
  await expect(triage).toContainText('Recent receipts');
  await expect(triage).toContainText('Draft saved for Northwind');
  await expect(triage).toContainText('Gmail draft created; nothing was sent.');
  expect(receiptsRequests).toEqual(['GET /api/webchat/v2/receipts']);
});

test('static workbench: global feed stays quiet until the gateway advertises it', async ({
  page
}) => {
  const workbenchFeedRequests: string[] = [];
  await installWorkbenchMocks(page, { workbenchFeedRequests });
  await page.goto('/v2/workbench?token=workbench-static-token');

  await expect(page.getByRole('complementary', { name: 'Active work' })).toBeVisible();
  await page.waitForTimeout(100);
  expect(workbenchFeedRequests).toEqual([]);
});

test('static workbench: global feed populates general ready-to-review work when advertised', async ({
  page
}) => {
  const workbenchFeedRequests: string[] = [];
  await installWorkbenchMocks(page, {
    workbenchFeedReadEnabled: true,
    workbenchFeedRequests,
    workbenchFeedItems: [
      {
        feed_id: 'feed-vendor-onboarding',
        group_id: 'needs_review',
        headline: 'Vendor onboarding packet changed',
        summary: 'Two new security exhibits were added overnight.',
        source: 'notion',
        thread_id: 'thread-vendor',
        updated_at: '2026-06-21T08:15:00.000Z'
      }
    ]
  });
  await page.goto('/v2/workbench?token=workbench-static-token');

  const activeWork = page.getByRole('complementary', { name: 'Active work' });
  await expect(activeWork).toContainText('Ready to review');
  await expect(activeWork).toContainText('Vendor onboarding packet changed');
  await expect(activeWork).toContainText('Two new security exhibits were added overnight.');

  const triage = page.getByTestId('workbench-triage');
  await expect(triage).toContainText('Ready to review');
  await expect(triage).toContainText('Vendor onboarding packet changed');
  await expect(triage).toContainText('Two new security exhibits were added overnight.');
  expect(workbenchFeedRequests).toEqual(['GET /api/webchat/v2/workbench/feed']);
});

test('static workbench: source choices show honest readiness from current connectors', async ({
  page
}) => {
  await installWorkbenchMocks(page, {
    extensions: [
      {
        id: 'slack-installed',
        kind: 'wasm_channel',
        display_name: 'Slack',
        package_ref: { id: 'channels/slack' },
        onboarding_state: 'auth_required'
      },
      {
        id: 'gmail-installed',
        kind: 'wasm_tool',
        display_name: 'Gmail',
        package_ref: { id: 'tools/gmail' },
        onboarding_state: 'active'
      }
    ],
    registryEntries: [
      {
        kind: 'wasm_tool',
        display_name: 'Google Drive',
        package_ref: { id: 'tools/google_drive' },
        connect_phase: { phase: 'needs-token', message: 'Google setup needed.' }
      },
      {
        kind: 'mcp_server',
        display_name: 'Notion',
        package_ref: { id: 'mcp-servers/notion' },
        connect_phase: { phase: 'needs-token', message: 'Notion setup needed.' }
      }
    ]
  });
  await page.goto('/v2/workbench?token=workbench-static-token');

  const activeWork = page.getByRole('complementary', { name: 'Active work' });
  await expect(activeWork).toContainText('Slack');
  await expect(activeWork).not.toContainText('Drive');
  await expect(page.getByTestId('workbench-triage')).toContainText('Slack');
  await expect(page.getByTestId('workbench-triage')).not.toContainText('Google setup needed');

  await page.getByRole('button', { name: "What's allowed" }).click();
  const inspector = page.getByRole('complementary', { name: 'Allowed sources and boundaries' });
  await expect(inspector.locator('.wb13-source-pill', { hasText: 'Gmail' })).toContainText('Ready');
  await expect(inspector.locator('.wb13-source-pill', { hasText: 'Slack' })).toContainText(
    'Needs reconnect'
  );
  await expect(inspector.locator('.wb13-source-pill', { hasText: 'Drive' })).toContainText(
    'Blocked by setup'
  );
  await expect(inspector.locator('.wb13-source-pill', { hasText: 'Web & HTTP' })).toContainText(
    'Available'
  );
  await expect(
    inspector.locator('.wb13-source-pill', { hasText: 'Local workspace' })
  ).toContainText('Readable');
});

test('static workbench: source setup actions route to real setup surfaces', async ({ page }) => {
  await installWorkbenchMocks(page, {
    extensions: [
      {
        kind: 'mcp_server',
        display_name: 'Composio',
        package_ref: { id: 'custom-mcp' },
        active: true,
        onboarding_state: 'active'
      },
      {
        kind: 'first_party',
        display_name: 'Gmail',
        package_ref: { id: 'gmail' },
        onboarding_state: 'auth_required',
        needs_setup: true,
        has_auth: true,
        authenticated: false
      },
      {
        kind: 'mcp_server',
        display_name: 'Notion',
        package_ref: { id: 'notion' },
        onboarding_state: 'auth_required',
        needs_setup: true,
        has_auth: true,
        authenticated: false
      },
      {
        kind: 'wasm_tool',
        display_name: 'GitHub',
        package_ref: { id: 'github' },
        onboarding_state: 'setup_required',
        needs_setup: true,
        has_auth: true,
        authenticated: false
      }
    ],
    registryEntries: [
      { kind: 'first_party', display_name: 'Gmail', package_ref: { id: 'gmail' }, installed: true },
      {
        kind: 'mcp_server',
        display_name: 'Notion',
        package_ref: { id: 'notion' },
        installed: true
      },
      { kind: 'wasm_tool', display_name: 'GitHub', package_ref: { id: 'github' }, installed: true }
    ]
  });
  await page.goto('/v2/workbench?token=workbench-static-token');

  await page.getByRole('button', { name: "What's allowed" }).click();
  const inspector = page.getByRole('complementary', { name: 'Allowed sources and boundaries' });
  await expect(inspector.locator('.wb13-source-pill', { hasText: 'Composio' })).toContainText(
    'Ready'
  );
  await expect(
    inspector.locator('.wb13-source-pill', { hasText: 'Gmail' }).getByRole('link', {
      name: 'Open Google setup'
    })
  ).toHaveAttribute('href', '/v2/settings/inference#google-oauth');

  await inspector
    .locator('.wb13-source-pill', { hasText: 'Notion' })
    .getByRole('button', { name: 'Open Notion setup' })
    .click();
  await expect(page).toHaveURL(/\/v2\/extensions\/registry\?setup=1&focus=notion$/);
});

test('static workbench: source inspector honors live Composio connector accounts', async ({
  page
}) => {
  await installWorkbenchMocks(page, {
    extensions: [
      {
        kind: 'first_party',
        display_name: 'Gmail',
        package_ref: { id: 'gmail' },
        onboarding_state: 'auth_required',
        needs_setup: true,
        has_auth: true,
        authenticated: false
      },
      {
        kind: 'first_party',
        display_name: 'Drive',
        package_ref: { id: 'google-drive' },
        onboarding_state: 'auth_required',
        needs_setup: true,
        has_auth: true,
        authenticated: false
      }
    ],
    connectorAccounts: [
      { toolkit: 'gmail', status: 'ACTIVE' },
      { toolkit: 'googledrive', status: 'ACTIVE' },
      { toolkit: 'notion', status: 'INITIATED' }
    ]
  });
  await page.goto('/v2/workbench?token=workbench-static-token');

  await page.getByRole('button', { name: "What's allowed" }).click();
  const inspector = page.getByRole('complementary', { name: 'Allowed sources and boundaries' });
  const gmail = inspector.locator('.wb13-source-pill', { hasText: 'Gmail' });
  const drive = inspector.locator('.wb13-source-pill', { hasText: 'Drive' });
  const notion = inspector.locator('.wb13-source-pill', { hasText: 'Notion' });

  await expect(gmail).toHaveCount(1);
  await expect(gmail).toContainText('Ready');
  await expect(gmail).toContainText('via Composio');
  await expect(gmail.getByRole('link', { name: 'Open Google setup' })).toHaveCount(0);
  await expect(drive).toContainText('Ready');
  await expect(drive).toContainText('via Composio');
  await expect(notion).not.toContainText('Ready');
});

test('static workbench: cadence control opens timing inspector, not source boundaries', async ({
  page
}) => {
  await installWorkbenchMocks(page);
  await page.goto('/v2/workbench?token=workbench-static-token');

  await page.getByRole('button', { name: 'Set a due date or cadence' }).click();
  const cadence = page.getByRole('complementary', { name: 'Due date or cadence' });
  await expect(cadence).toBeVisible();
  await expect(cadence).toContainText('Recurring work always asks first');
  await cadence.getByRole('button', { name: 'Friday morning' }).click();
  await expect(cadence.getByLabel('Cadence inspector timing')).toHaveValue('Friday morning');
  await expect(cadence).not.toContainText('Manage connections');
});

test('static workbench: Escape closes the source, cadence, and work-mode inspectors', async ({
  page
}) => {
  await installWorkbenchMocks(page);
  await page.goto('/v2/workbench?token=workbench-static-token');

  await page.getByRole('button', { name: "What's allowed" }).click();
  const sources = page.getByRole('complementary', { name: 'Allowed sources and boundaries' });
  await expect(sources).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(sources).toHaveCount(0);

  await page.getByRole('button', { name: 'Set a due date or cadence' }).click();
  const cadence = page.getByRole('complementary', { name: 'Due date or cadence' });
  await expect(cadence).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(cadence).toHaveCount(0);

  await page.getByRole('button', { name: 'Choose model and effort' }).click();
  const workMode = page.getByRole('complementary', { name: 'Work mode' });
  await expect(workMode).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(workMode).toHaveCount(0);
});

test('static workbench: inspectors move focus in on open and restore it to the opener on close', async ({
  page
}) => {
  await installWorkbenchMocks(page);
  await page.goto('/v2/workbench?token=workbench-static-token');

  const opener = page.getByRole('button', { name: "What's allowed" });
  await opener.focus();
  await opener.click();
  const sources = page.getByRole('complementary', { name: 'Allowed sources and boundaries' });
  await expect(sources).toBeVisible();

  // Focus moved into the inspector on open (not stranded on the obscured opener).
  await expect
    .poll(() =>
      page.evaluate(() => {
        const aside = document.querySelector('aside.wb13-inspector');
        return !!aside && aside.contains(document.activeElement);
      })
    )
    .toBe(true);

  // Escape closes and focus returns to the opener, not <body>.
  await page.keyboard.press('Escape');
  await expect(sources).toHaveCount(0);
  await expect(opener).toBeFocused();
});

test('static workbench: approval modal traps focus and returns it to the handoff opener', async ({
  page
}) => {
  await installWorkbenchMocks(page);
  await seedRecentWork(page);
  await page.goto('/v2/workbench?token=workbench-static-token');

  const opener = page.getByRole('button', { name: 'View Chat handoff' });
  await opener.focus();
  await opener.click();
  const modal = page.getByRole('dialog', { name: 'Linked Chat action details' });
  await expect(modal).toBeVisible();

  // Focus moved into the dialog on open.
  await expect
    .poll(() =>
      page.evaluate(() => {
        const d = document.querySelector('[role="dialog"][aria-modal="true"]');
        return !!d && d.contains(document.activeElement);
      })
    )
    .toBe(true);

  // Tab/Shift+Tab stay trapped inside the modal.
  for (let i = 0; i < 8; i += 1) {
    await page.keyboard.press('Tab');
    const inside = await page.evaluate(() => {
      const d = document.querySelector('[role="dialog"][aria-modal="true"]');
      return !!d && d.contains(document.activeElement);
    });
    expect(inside, `focus stays inside the approval modal after ${i + 1} tab(s)`).toBe(true);
  }

  // Escape closes and focus returns to the opener.
  await page.keyboard.press('Escape');
  await expect(modal).toHaveCount(0);
  await expect(opener).toBeFocused();
});

test('static workbench: saved work viewer handoff requires output and reply review', async ({
  page
}) => {
  await installWorkbenchMocks(page);
  await seedRecentWork(page);
  await page.goto('/v2/workbench?token=workbench-static-token');

  await page.getByRole('button', { name: 'View Chat handoff' }).click();
  const modal = page.getByRole('dialog', { name: 'Linked Chat action details' });
  await expect(modal).toBeVisible();
  await expect(modal).toContainText('Open required items first');
  await expect(modal).toContainText('No external action runs from this modal.');
  await modal.getByRole('button', { name: 'Review summary' }).click();

  await expect(page.getByRole('tab', { name: 'Summary' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByTestId('workbench-document-workspace')).toContainText(
    'Support response stays under 2 hours'
  );
  await page.getByRole('tab', { name: 'Reply' }).click();
  await expect(page.getByLabel('Reply text')).toBeVisible();
  await page.getByRole('button', { name: 'View Chat handoff' }).click();
  await expect(modal).toContainText('Ready to continue');
  await expect(modal.getByRole('link', { name: 'Open linked Chat' })).toHaveAttribute(
    'href',
    '/v2/chat/thread-workbench-runtime'
  );
});

test('static workbench: document workspace renders real local Work artifacts', async ({ page }) => {
  await installWorkbenchMocks(page);
  await seedLocalDocumentWork(page);
  await page.goto('/v2/workbench?token=workbench-static-token');

  const workspace = page.getByTestId('workbench-document-workspace');
  await expect(page.getByRole('complementary', { name: 'Active work' })).toContainText(
    'NEAR AI roadmap extraction'
  );
  await workspace.scrollIntoViewIfNeeded();
  await expect(workspace).toContainText('NEAR AI roadmap extraction');
  await page.getByRole('tab', { name: 'Research' }).click();
  await expect(workspace).toContainText(localDocumentFixtures[0].artifactTitle);
  await expect(workspace).toContainText(localDocumentFixtures[0].expectedText);

  await page.getByRole('button', { name: 'Library' }).click();
  const library = page.getByTestId('workbench-library');
  await expect(page.getByTestId('workbench-library-source')).toContainText('Local profile');
  await expect(page.getByTestId('workbench-library-source')).toContainText(
    'Server-backed Work history is not wired yet'
  );
  await expect(library).toContainText('Workbench buildout instructions');
  await page.getByLabel('Search library').fill('scenario');
  await expect(library).toContainText('Practical work scenario corpus');
  await expect(library).not.toContainText('NEAR AI roadmap extraction');

  assertBannedWorkbenchCopyAbsent(await page.getByTestId('workbench-page').innerText());
});

test('static workbench: server-backed Work can populate the document workspace when advertised', async ({
  page
}) => {
  const savedWorkRequests: string[] = [];
  await installWorkbenchMocks(page, {
    savedWorkReadEnabled: true,
    savedWorkRequests,
    savedWorkItems: [
      {
        id: 'server-work-board',
        title: 'Server board packet',
        status: 'active',
        updated_at: '2026-06-21T05:20:00.000Z',
        links: [{ kind: 'thread', ref: 'thread-board', label: 'Board Chat' }],
        artifacts: [
          {
            id: 'server-artifact-board',
            type: 'brief',
            title: 'Board update draft',
            status: 'ready',
            content: '# Board update draft\n\nRunway, hiring plan, and launch risks are ready.',
            content_format: 'markdown'
          }
        ]
      }
    ]
  });
  await page.goto('/v2/workbench?token=workbench-static-token');

  const workspace = page.getByTestId('workbench-document-workspace');
  await expect(workspace).toContainText('Server board packet');
  await page.getByRole('tab', { name: 'Brief' }).click();
  await expect(workspace).toContainText('Board update draft');
  await expect(workspace).toContainText('Runway, hiring plan, and launch risks are ready');

  await page.getByRole('button', { name: 'Library' }).click();
  await expect(page.getByTestId('workbench-library-source')).toContainText('Server-backed');
  await expect(page.getByTestId('workbench-library')).toContainText('Server board packet');
  expect(savedWorkRequests).toEqual(['GET /api/webchat/v2/work']);
});

test('static workbench: accepts broad chief-of-staff prompts into Chat runtime starts', async ({
  page
}) => {
  const sentMessages: Array<{ path: string; body: Record<string, unknown> }> = [];
  await installWorkbenchMocks(page, { sentMessages });

  for (const [index, scenario] of workbenchPersonaFixtures.chiefOfStaffPrompts.entries()) {
    await page.goto('/v2/workbench?token=workbench-static-token');

    await page.getByTestId('workbench-brief-input').fill(scenario.prompt);
    await page.getByTestId('workbench-send-button').click();

    await expect
      .poll(() => sentMessages.length, {
        message: `${scenario.domainLabel} prompt should start through Chat runtime`
      })
      .toBe(index + 1);
    await expect(page).toHaveURL(/\/v2\/workbench$/);
    await expect(page.getByTestId('workbench-scene-workspace')).toContainText(
      /workspace started|session started|monitor started/i
    );
    await expect(page.getByRole('link', { name: 'Open live thread' })).toHaveAttribute(
      'href',
      '/v2/chat/thread-workbench-runtime'
    );

    const content = String(sentMessages[index].body.content);
    expect(content).toContain('Workbench request');
    expect(content).toContain(scenario.prompt);
    expect(content).toContain('Auto sources: use available connected tools');
    expect(content).toContain('wait for approval');
  }
});

test('static workbench: command starts stay in first-class Workbench scenes', async ({ page }) => {
  const sentMessages: Array<{ path: string; body: Record<string, unknown> }> = [];
  await installWorkbenchMocks(page, { sentMessages });

  const scenes = [
    {
      prompt: 'Research TEE vendors and compare deployment risk.',
      title: 'Research workspace started'
    },
    {
      prompt: 'Grow an X account around NEAR AI with 1000 target users.',
      title: 'Growth workspace started'
    },
    {
      prompt: 'Watch competitor launches and brief me every Friday.',
      title: 'Monitor started'
    },
    {
      prompt: 'Prepare the June investor update from metrics and Slack wins.',
      title: 'Briefing workspace started'
    }
  ];

  for (const [index, scene] of scenes.entries()) {
    await page.goto('/v2/workbench?token=workbench-static-token');
    await page.getByTestId('workbench-brief-input').fill(scene.prompt);
    await page.getByTestId('workbench-send-button').click();
    await expect.poll(() => sentMessages.length).toBe(index + 1);
    const workspace = page.getByTestId('workbench-scene-workspace');
    await expect(workspace).toContainText(scene.title);
    await expect(workspace).toContainText('Waiting on the live thread.');
    await expect(workspace).toContainText('Preferences sent');
    await expect(workspace).not.toContainText('Fortanix');
    await expect(workspace).not.toContainText('Cash runway source is stale.');
    await expect(page).toHaveURL(/\/v2\/workbench$/);
    await expect(page.getByRole('link', { name: 'Open live thread' })).toHaveAttribute(
      'href',
      '/v2/chat/thread-workbench-runtime'
    );
  }
});

test('static workbench: command starts a Chat runtime thread with model, effort, sources, timing, and boundaries', async ({
  page
}) => {
  const sentMessages: Array<{ path: string; body: Record<string, unknown> }> = [];
  const activeModelSelections: Array<Record<string, unknown>> = [];
  const requestLog: string[] = [];
  await installWorkbenchMocks(page, {
    sentMessages,
    activeModelSelections,
    requestLog,
    timelineMessages: [
      {
        message_id: 'message-user-1',
        kind: 'user',
        status: 'finalized',
        content: 'Workbench request: stakeholder brief',
        created_at: '2026-06-19T16:00:00.000Z',
        sequence: 1
      },
      {
        message_id: 'message-assistant-1',
        kind: 'assistant',
        status: 'finalized',
        content:
          'Draft brief ready: two approvals are waiting, one Slack blocker needs review, and no external action has been sent.',
        created_at: '2026-06-19T16:01:00.000Z',
        sequence: 2,
        turn_run_id: 'run-workbench-runtime'
      }
    ],
    extensions: [
      {
        display_name: 'Slack',
        package_ref: { kind: 'extension', id: 'channels/slack' },
        kind: 'wasm_channel',
        active: true
      }
    ]
  });
  await page.goto('/v2/workbench?token=workbench-static-token');

  await page
    .getByTestId('workbench-brief-input')
    .fill(
      'Prepare the Friday stakeholder brief from messages and docs. Show blockers before anything is sent.'
    );
  await page.getByRole('button', { name: 'Choose model and effort' }).click();
  const workMode = page.getByRole('complementary', { name: 'Work mode' });
  await expect(workMode.getByLabel('Workbench model')).toContainText('GLM 4.5');
  await expect(workMode.getByLabel('Workbench model')).toContainText('GPT OSS 120B');
  await expect(workMode.getByLabel('Workbench model')).toContainText('Gemini 2.5 Pro');
  await workMode.getByLabel('Workbench model').selectOption('z-ai/glm-4.5');
  await workMode.getByRole('button', { name: 'Careful' }).click();
  await workMode.getByRole('button', { name: 'Close' }).click();
  const modelControl = page.getByRole('button', { name: 'Choose model and effort' });
  await expect(modelControl).toContainText('GLM 4.5 - Careful');
  await expect(modelControl).not.toContainText('Deep work');
  await page.getByRole('button', { name: 'Set a due date or cadence' }).click();
  const cadence = page.getByRole('complementary', { name: 'Due date or cadence' });
  await cadence.getByLabel('Cadence inspector timing').fill('Friday morning');
  await cadence.getByRole('button', { name: 'Close' }).click();
  await page.getByLabel('Workbench source scope').selectOption('slack');
  await page.getByTestId('workbench-send-button').click();

  await expect
    .poll(() => sentMessages.length, {
      message: 'Workbench Ask should POST directly to the Chat runtime'
    })
    .toBe(1);
  await expect(page).toHaveURL(/\/v2\/workbench$/);
  await expect(page.getByTestId('workbench-scene-workspace')).toContainText(
    'Briefing workspace started'
  );
  await expect(page.getByTestId('workbench-scene-workspace')).toContainText(
    'GLM 4.5 (z-ai/glm-4.5)'
  );
  // The run renders inline on the Workbench (prompt → output), not just a
  // "latest reply" punt to Chat.
  await expect(page.getByTestId('workbench-run-timeline')).toBeVisible();
  await expect(page.getByTestId('workbench-scene-workspace')).toContainText('Live run');
  await expect(page.getByTestId('workbench-scene-workspace')).toContainText('You asked');
  await expect(page.getByTestId('workbench-scene-workspace')).toContainText('Draft brief ready');
  await expect(page.getByTestId('workbench-scene-workspace')).not.toContainText(
    'No runtime artifact yet'
  );
  expect(activeModelSelections).toEqual([{ provider_id: 'nearai', model: 'z-ai/glm-4.5' }]);
  expect(sentMessages[0].path).toBe('/api/webchat/v2/threads/thread-workbench-runtime/messages');
  const activeModelRequestIndex = requestLog.indexOf('POST /api/webchat/v2/llm/active');
  const sendMessageRequestIndex = requestLog.indexOf(
    'POST /api/webchat/v2/threads/thread-workbench-runtime/messages'
  );
  expect(activeModelRequestIndex).toBeGreaterThanOrEqual(0);
  expect(sendMessageRequestIndex).toBeGreaterThan(activeModelRequestIndex);
  const content = String(sentMessages[0].body.content);
  expect(content).toContain('Workbench request');
  expect(content).toContain('Prepare the Friday stakeholder brief');
  expect(content).toContain('GLM 4.5 (z-ai/glm-4.5)');
  expect(content).toContain('Careful effort');
  expect(content).toContain('Slack, if connected');
  expect(content).toContain('Timing: Friday morning');
  expect(content).toContain('wait for approval');
  expect(content).not.toContain('Auto sources:');
});

test('static workbench: the run timeline renders prompt, tool steps, and output inline', async ({
  page
}) => {
  const sentMessages: Array<{ path: string; body: Record<string, unknown> }> = [];
  await installWorkbenchMocks(page, {
    sentMessages,
    timelineMessages: [
      {
        message_id: 'run-user',
        kind: 'user',
        status: 'finalized',
        content: 'Workbench request: research TEE vendors',
        created_at: '2026-06-19T16:00:00.000Z',
        sequence: 1
      },
      {
        message_id: 'run-tool',
        kind: 'capability_display_preview',
        status: 'finalized',
        content: JSON.stringify({
          invocation_id: 'inv-1',
          status: 'completed',
          title: 'gmail.GMAIL_FETCH_EMAILS',
          capability_id: 'gmail.GMAIL_FETCH_EMAILS',
          subtitle: 'Reading the inbox',
          input_summary: 'query: in:inbox',
          output_summary: 'Found 3 messages'
        }),
        created_at: '2026-06-19T16:00:30.000Z',
        sequence: 2,
        turn_run_id: 'run-x'
      },
      {
        message_id: 'run-assistant',
        kind: 'assistant',
        status: 'finalized',
        content: 'Compared three TEE vendors; the draft is ready for review.',
        created_at: '2026-06-19T16:01:00.000Z',
        sequence: 3,
        turn_run_id: 'run-x'
      }
    ]
  });
  await page.goto('/v2/workbench?token=workbench-static-token');

  await page
    .getByTestId('workbench-brief-input')
    .fill('Research TEE vendors and compare deployment risk.');
  await page.getByTestId('workbench-send-button').click();
  await expect.poll(() => sentMessages.length).toBe(1);

  const runTimeline = page.getByTestId('workbench-run-timeline');
  await expect(runTimeline).toBeVisible();
  await expect(runTimeline).toContainText('You asked');
  // The tool step renders with its real name, status, and result — the run
  // unfolds on the Workbench instead of being a "open in Chat" link.
  await expect(runTimeline).toContainText('GMAIL_FETCH_EMAILS');
  await expect(runTimeline).toContainText('Done');
  await expect(runTimeline).toContainText('Reading the inbox');
  await expect(runTimeline).toContainText('Compared three TEE vendors');
});

test('static workbench: a failed tool with no reply surfaces a needs-attention run state', async ({
  page
}) => {
  const sentMessages: Array<{ path: string; body: Record<string, unknown> }> = [];
  await installWorkbenchMocks(page, {
    sentMessages,
    timelineMessages: [
      {
        message_id: 'fail-user',
        kind: 'user',
        status: 'finalized',
        content: 'Workbench request: find Slack blockers',
        created_at: '2026-06-19T16:00:00.000Z',
        sequence: 1
      },
      {
        message_id: 'fail-tool',
        kind: 'capability_display_preview',
        status: 'finalized',
        content: JSON.stringify({
          invocation_id: 'inv-2',
          status: 'failed',
          title: 'slack.SLACK_SEARCH_MESSAGES',
          capability_id: 'slack.SLACK_SEARCH_MESSAGES',
          subtitle: 'Searching Slack',
          output_summary: 'Slack token expired'
        }),
        created_at: '2026-06-19T16:00:30.000Z',
        sequence: 2,
        turn_run_id: 'run-y'
      }
    ]
  });
  await page.goto('/v2/workbench?token=workbench-static-token');

  await page.getByTestId('workbench-brief-input').fill('Find Slack blockers from this week.');
  await page.getByTestId('workbench-send-button').click();
  await expect.poll(() => sentMessages.length).toBe(1);

  // A failed tool with no assistant reply is the honest blocked/needs-attention
  // state — not "Working…" forever and not a fabricated completion.
  await expect(page.getByTestId('workbench-run-attention')).toBeVisible();
  await expect(page.getByTestId('workbench-run-live')).toHaveCount(0);
  const runTimeline = page.getByTestId('workbench-run-timeline');
  await expect(runTimeline).toContainText('SLACK_SEARCH_MESSAGES');
  await expect(runTimeline).toContainText('Failed');
});

test('static workbench: pending approval gates surface read-only on the run card', async ({
  page
}) => {
  const sentMessages: Array<{ path: string; body: Record<string, unknown> }> = [];
  const approvalsRequests: string[] = [];
  await installWorkbenchMocks(page, {
    sentMessages,
    approvalsRequests,
    approvals: [
      {
        id: 'gate-1',
        thread_id: 'thread-workbench-runtime',
        title: 'Send the vendor email',
        detail: 'Prepared email to ops@acme.com is held for your review.',
        destination: 'ops@acme.com'
      }
    ]
  });
  await page.goto('/v2/workbench?token=workbench-static-token');

  await page
    .getByTestId('workbench-brief-input')
    .fill('Draft and send the vendor onboarding email.');
  await page.getByTestId('workbench-send-button').click();
  await expect.poll(() => sentMessages.length).toBe(1);

  // The run card scopes the per-thread approvals read to its own thread and
  // surfaces the pending gate read-only — no approve/deny here (resolving is a
  // real Phase-4 action), just what is waiting + a link into the live thread.
  const gates = page.getByTestId('workbench-run-approvals');
  await expect(gates).toBeVisible();
  await expect(gates).toContainText('Waiting on your approval');
  await expect(gates).toContainText('Send the vendor email');
  await expect(gates.getByRole('link', { name: 'Review' })).toBeVisible();
  // The read was scoped to the run's thread, not a global probe.
  await expect.poll(() => approvalsRequests.length).toBeGreaterThan(0);
});

test('static workbench: manual source choice blocks when the connector is not ready', async ({
  page
}) => {
  const sentMessages: Array<{ path: string; body: Record<string, unknown> }> = [];
  await installWorkbenchMocks(page, { sentMessages });
  await page.goto('/v2/workbench?token=workbench-static-token');

  await page
    .getByTestId('workbench-brief-input')
    .fill('Summarize the Slack launch thread and draft replies.');
  await page.getByLabel('Workbench source scope').selectOption('slack');

  const ask = page.getByTestId('workbench-send-button');
  await expect(ask).toBeDisabled();
  await expect(page.getByRole('status')).toContainText(
    "Slack is not connected yet. Open What's allowed to connect it, or switch to Auto sources."
  );
  expect(sentMessages).toEqual([]);
});

test('static workbench: active connector readiness unblocks manual source choices', async ({
  page
}) => {
  const sentMessages: Array<{ path: string; body: Record<string, unknown> }> = [];
  await installWorkbenchMocks(page, {
    sentMessages,
    connectorAccounts: [
      { toolkit: 'gmail', status: 'ACTIVE', user_id: 'pg-test' },
      { toolkit: 'slack', status: 'ACTIVE', user_id: 'pg-test' },
      { toolkit: 'googledrive', status: 'ACTIVE', user_id: 'pg-test' }
    ],
    connectorReads: { gmail: { successful: true, data: { messages: [] } } }
  });
  await page.goto('/v2/workbench?token=workbench-static-token');

  const sourcesReady = page.getByTestId('workbench-sources-ready');
  await expect(sourcesReady).toContainText('Gmail');
  await expect(sourcesReady).toContainText('Drive');
  await expect(sourcesReady).toContainText('Slack');

  await page
    .getByTestId('workbench-brief-input')
    .fill('Summarize the Slack launch thread and draft replies.');
  await page.getByLabel('Workbench source scope').selectOption('slack');

  const ask = page.getByTestId('workbench-send-button');
  await expect(ask).toBeEnabled();
  await expect(page.getByText('Slack is not connected yet')).toHaveCount(0);
  await ask.click();

  await expect
    .poll(() => sentMessages.length, {
      message: 'Manual Slack source should reach /threads/:id/messages when active via Composio'
    })
    .toBe(1);
  expect(sentMessages[0].path).toBe('/api/webchat/v2/threads/thread-workbench-runtime/messages');
  expect(String(sentMessages[0].body.content)).toContain(
    'Summarize the Slack launch thread and draft replies.'
  );
  expect(String(sentMessages[0].body.content)).toContain('Slack, if connected');
});

test('static workbench: command posts a general research request to the existing runtime API', async ({
  page
}) => {
  const sentMessages: Array<{ path: string; body: Record<string, unknown> }> = [];
  const activeModelSelections: Array<Record<string, unknown>> = [];
  await installWorkbenchMocks(page, { sentMessages, activeModelSelections });
  await page.goto('/v2/workbench?token=workbench-static-token');

  await page
    .getByTestId('workbench-brief-input')
    .fill('Research the top 20 accounts discussing NEAR AI and draft a launch plan.');
  await page.getByRole('button', { name: 'Choose model and effort' }).click();
  const workMode = page.getByRole('complementary', { name: 'Work mode' });
  await workMode.getByLabel('Workbench model').selectOption('gpt-oss-120b');
  await workMode.getByRole('button', { name: 'Background' }).click();
  await workMode.getByRole('button', { name: 'Close' }).click();
  await page.getByTestId('workbench-send-button').click();

  await expect
    .poll(() => sentMessages.length, {
      message: 'Workbench start should reach /threads/:id/messages'
    })
    .toBe(1);
  await expect(page).toHaveURL(/\/v2\/workbench$/);
  await expect(page.getByTestId('workbench-scene-workspace')).toContainText(
    'Growth workspace started'
  );
  expect(sentMessages[0].path).toBe('/api/webchat/v2/threads/thread-workbench-runtime/messages');
  expect(String(sentMessages[0].body.content)).toContain('Workbench request');
  expect(String(sentMessages[0].body.content)).toContain('Research the top 20 accounts');
  expect(String(sentMessages[0].body.content)).toContain('GPT OSS 120B (gpt-oss-120b)');
  expect(String(sentMessages[0].body.content)).toContain('Background effort');
  expect(activeModelSelections).toEqual([{ provider_id: 'nearai', model: 'gpt-oss-120b' }]);
  expect(String(sentMessages[0].body.content)).toContain(
    'Auto sources: use available connected tools'
  );
  expect(String(sentMessages[0].body.content)).toContain('wait for approval');
});

test('static workbench: failed model switch does not start Chat or claim work started', async ({
  page
}) => {
  const sentMessages: Array<{ path: string; body: Record<string, unknown> }> = [];
  const activeModelSelections: Array<Record<string, unknown>> = [];
  const requestLog: string[] = [];
  await installWorkbenchMocks(page, {
    sentMessages,
    activeModelSelections,
    requestLog,
    activeModelError: 'selected model unavailable'
  });
  await page.goto('/v2/workbench?token=workbench-static-token');

  await page.getByTestId('workbench-brief-input').fill('Research the launch plan.');
  await page.getByRole('button', { name: 'Choose model and effort' }).click();
  const workMode = page.getByRole('complementary', { name: 'Work mode' });
  await expect(workMode.getByLabel('Workbench model')).toContainText('GPT OSS 120B');
  await workMode.getByLabel('Workbench model').selectOption('gpt-oss-120b');
  await workMode.getByRole('button', { name: 'Close' }).click();
  await page.getByTestId('workbench-send-button').click();

  await expect(page.getByRole('alert')).toContainText(
    'Could not switch to GPT OSS 120B (gpt-oss-120b). Chat was not started.'
  );
  expect(activeModelSelections).toEqual([{ provider_id: 'nearai', model: 'gpt-oss-120b' }]);
  expect(requestLog).toContain('POST /api/webchat/v2/llm/active');
  expect(requestLog).not.toContain(
    'POST /api/webchat/v2/threads/thread-workbench-runtime/messages'
  );
  expect(sentMessages).toEqual([]);
  await expect(page.getByTestId('workbench-scene-workspace')).toHaveCount(0);
});

test('static workbench: attached files ride with the Chat runtime request', async ({ page }) => {
  const sentMessages: Array<{ path: string; body: Record<string, unknown> }> = [];
  await installWorkbenchMocks(page, { sentMessages });
  await page.goto('/v2/workbench?token=workbench-static-token');

  await page.getByTestId('workbench-attachment-input').setInputFiles({
    name: 'customer-renewal-notes.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('Renewal response notes: cap support scope, net 45, ask for audit trail.')
  });

  const attachments = page.getByTestId('workbench-attachments');
  await expect(attachments).toContainText('customer-renewal-notes.txt');
  await expect(attachments).toContainText('Ready to send');

  await page
    .getByTestId('workbench-brief-input')
    .fill('Draft the response using the attached notes and show the key terms first.');
  await page.getByTestId('workbench-send-button').click();

  await expect
    .poll(() => sentMessages.length, {
      message: 'Workbench Ask should POST attachment payloads through Chat runtime'
    })
    .toBe(1);

  const body = sentMessages[0].body;
  expect(Array.isArray(body.attachments)).toBe(true);
  const wireAttachments = body.attachments as Array<Record<string, unknown>>;
  expect(wireAttachments).toHaveLength(1);
  expect(wireAttachments[0].filename).toBe('customer-renewal-notes.txt');
  expect(wireAttachments[0].mime_type).toBe('text/plain');
  expect(String(wireAttachments[0].base64)).toBeTruthy();
  expect(String(body.content)).toContain('Draft the response using the attached notes');
  expect(String(body.content)).toContain('<attachments ic="1">');
  await expect(page).toHaveURL(/\/v2\/workbench$/);
  await expect(page.getByTestId('workbench-scene-workspace')).toContainText(
    'Review workspace started'
  );
});

test('static workbench: live workspace files render from fs API and attach into Ask', async ({
  page
}) => {
  const sentMessages: Array<{ path: string; body: Record<string, unknown> }> = [];
  await installWorkbenchMocks(page, {
    sentMessages,
    workspaceFs: {
      mounts: [{ mount: 'workspace', label: 'Workspace' }],
      entries: [
        {
          name: 'renewal-notes.md',
          path: 'renewal-notes.md',
          kind: 'file'
        }
      ],
      files: {
        'workspace/renewal-notes.md': {
          mime_type: 'text/markdown',
          size_bytes: 77,
          content: '# Renewal notes\n\nHold support scope. Payment can move to net 45.'
        }
      }
    }
  });
  await page.goto('/v2/workbench?token=workbench-static-token');
  await page.getByLabel('Workbench source scope').selectOption('local-files');

  const files = page.getByTestId('workbench-workspace-files');
  await files.scrollIntoViewIfNeeded();
  await expect(files).toContainText('Local files');
  await expect(files).not.toContainText('renewal-notes.md');
  await files.getByRole('button').click();
  await expect(files).toContainText('renewal-notes.md');
  await expect(files).toContainText('Hold support scope');
  await files.getByRole('button', { name: 'Attach to Ask' }).click();
  await expect(page.getByTestId('workbench-attachments')).toContainText('renewal-notes.md');

  await page
    .getByTestId('workbench-brief-input')
    .fill('Use the workspace notes to draft a short renewal summary.');
  await page.getByTestId('workbench-send-button').click();
  await expect.poll(() => sentMessages.length).toBe(1);
  const body = sentMessages[0].body;
  const wireAttachments = body.attachments as Array<Record<string, unknown>>;
  expect(wireAttachments[0].filename).toBe('renewal-notes.md');
  expect(wireAttachments[0].mime_type).toBe('text/markdown');
  expect(String(body.content)).toContain('Use the workspace notes');
});

test('static workbench: workspace files show list errors without pretending the folder is empty', async ({
  page
}) => {
  await installWorkbenchMocks(page, {
    workspaceFs: {
      mounts: [{ mount: 'workspace', label: 'Workspace' }],
      listError: 'workspace list denied'
    }
  });
  await page.goto('/v2/workbench?token=workbench-static-token');
  await page.getByLabel('Workbench source scope').selectOption('local-files');

  const files = page.getByTestId('workbench-workspace-files');
  await files.scrollIntoViewIfNeeded();
  await files.getByRole('button').click();

  await expect(files).toContainText('Could not load workspace files.');
  await expect(files).toContainText('workspace list denied');
  await expect(files).not.toContainText('This workspace mount has no visible files.');
  await expect(files.getByRole('button', { name: 'Attach to Ask' })).toHaveCount(0);
});

test('static workbench: workspace files show content errors without exposing attach', async ({
  page
}) => {
  await installWorkbenchMocks(page, {
    workspaceFs: {
      mounts: [{ mount: 'workspace', label: 'Workspace' }],
      entries: [
        {
          name: 'restricted-notes.txt',
          path: 'restricted-notes.txt',
          kind: 'file'
        }
      ],
      files: {
        'workspace/restricted-notes.txt': {
          mime_type: 'text/plain',
          size_bytes: 42,
          content: 'Hidden notes should not attach after a failed read.'
        }
      },
      contentErrors: {
        'workspace/restricted-notes.txt': 'read permission denied'
      }
    }
  });
  await page.goto('/v2/workbench?token=workbench-static-token');
  await page.getByLabel('Workbench source scope').selectOption('local-files');

  const files = page.getByTestId('workbench-workspace-files');
  await files.scrollIntoViewIfNeeded();
  await files.getByRole('button').click();

  await expect(files).toContainText('restricted-notes.txt');
  await expect(files).toContainText('Could not read this file.');
  await expect(files).toContainText('read permission denied');
  await expect(files).not.toContainText('Select a workspace file to preview it.');
  await expect(files.getByRole('button', { name: 'Attach to Ask' })).toHaveCount(0);
});

test('static workbench: workspace binary files are unavailable for attach but can download', async ({
  page
}) => {
  await installWorkbenchMocks(page, {
    workspaceFs: {
      mounts: [{ mount: 'workspace', label: 'Workspace' }],
      entries: [
        {
          name: 'board-snapshot.pdf',
          path: 'board-snapshot.pdf',
          kind: 'file'
        }
      ],
      files: {
        'workspace/board-snapshot.pdf': {
          mime_type: 'application/pdf',
          size_bytes: 4096,
          content: '%PDF unavailable in inline preview'
        }
      }
    }
  });
  await page.goto('/v2/workbench?token=workbench-static-token');
  await page.getByLabel('Workbench source scope').selectOption('local-files');

  const files = page.getByTestId('workbench-workspace-files');
  await files.scrollIntoViewIfNeeded();
  await files.getByRole('button').click();

  await expect(files).toContainText('board-snapshot.pdf');
  await expect(files).toContainText('not previewable or attachable from here');
  await expect(files.getByRole('button', { name: 'Download' })).toBeVisible();
  await expect(files.getByRole('button', { name: 'Attach to Ask' })).toHaveCount(0);
});

test('static workbench: empty ask does not navigate to a hollow chat draft', async ({ page }) => {
  await installWorkbenchMocks(page);
  await page.goto('/v2/workbench?token=workbench-static-token');

  await page.getByTestId('workbench-send-button').click();

  await expect(page).toHaveURL(/\/v2\/workbench$/);
  await expect(page.getByRole('alert')).toHaveText('Add the work you want IronClaw to handle.');
});

test('static workbench on mobile: no overflow and primary controls clear 44px', async ({
  page
}) => {
  await installWorkbenchMocks(page);

  for (const viewport of [
    { width: 390, height: 844 },
    { width: 320, height: 720 }
  ]) {
    await page.setViewportSize(viewport);
    await page.goto('/v2/workbench?token=workbench-static-token');

    await expect(page.getByTestId('workbench-page')).toBeVisible();

    const docOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(
      docOverflow,
      `no document horizontal overflow at ${viewport.width}px`
    ).toBeLessThanOrEqual(1);

    const scrollerOverflow = await page
      .locator('.wb13-main')
      .evaluate((el) => el.scrollWidth - el.clientWidth);
    expect(
      scrollerOverflow,
      `no inner-scroller horizontal overflow at ${viewport.width}px`
    ).toBeLessThanOrEqual(1);

    const controls = [
      page.getByRole('button', { name: 'Show active work' }),
      page.getByLabel('Workbench source scope'),
      page.getByRole('button', { name: 'Choose model and effort' }),
      page.getByRole('button', { name: 'Attach a file' }),
      page.getByRole('button', { name: 'Set a due date or cadence' }),
      page.getByTestId('workbench-send-button'),
      page.getByRole('button', { name: 'What needs me today?' }),
      page.getByRole('button', { name: "What's allowed" })
    ];

    for (const control of controls) {
      await expect(control).toBeVisible();
      const box = await control.boundingBox();
      expect(box, 'control should have a measurable box').not.toBeNull();
      expect(
        Math.round(box!.height),
        `control height >=44px at ${viewport.width}px`
      ).toBeGreaterThanOrEqual(44);
    }

    await page.getByRole('button', { name: 'Choose model and effort' }).click();
    const workMode = page.getByRole('complementary', { name: 'Work mode' });
    await expect(workMode.getByLabel('Workbench model')).toBeVisible();
    await expect(workMode.getByRole('button', { name: 'Careful' })).toBeVisible();
    await workMode.getByRole('button', { name: 'Close' }).click();

    const dock = page.locator('#workbench-active-work-dock');
    await expect(dock).not.toHaveClass(/is-open/);
    await page.getByRole('button', { name: 'Show active work' }).click();
    await expect(dock).toHaveClass(/is-open/);
    // No seeded work on this profile: v13 fidelity shows ONE graceful all-clear
    // line instead of stacked empty placeholder groups.
    await expect(dock).toContainText('Nothing needs you right now');
    await dock.getByRole('button', { name: 'Close active work' }).click();
    await expect(dock).not.toHaveClass(/is-open/);
  }
});

test('static workbench: connector inbox renders real sender + subject from Composio reads', async ({
  page
}) => {
  const consoleIssues: string[] = [];
  page.on('console', (message) => {
    if (['error', 'warning'].includes(message.type())) {
      consoleIssues.push(`${message.type()}: ${message.text()}`);
    }
  });
  page.on('pageerror', (error) => {
    consoleIssues.push(`pageerror: ${error.message}`);
  });

  await installWorkbenchMocks(page, {
    connectorAccounts: [
      { toolkit: 'gmail', status: 'ACTIVE', user_id: 'pg-test' },
      { toolkit: 'googlecalendar', status: 'ACTIVE', user_id: 'pg-test' },
      { toolkit: 'slack', status: 'ACTIVE', user_id: 'pg-test' },
      { toolkit: 'notion', status: 'INITIATED', user_id: 'pg-test' }
    ],
    connectorReads: {
      gmail: {
        successful: true,
        data: {
          messages: [
            {
              messageId: 'm1',
              threadId: 'thread-renewal',
              sender: 'Dana Lee <dana@customer.example>',
              subject: 'Renewal terms for Q3',
              messageText: 'We would like net 60 and a 12 percent cap on the renewal.',
              labelIds: ['UNREAD', 'INBOX'],
              messageTimestamp: '1718900000'
            },
            {
              messageId: 'm2',
              sender: 'GitHub <notifications@github.com>',
              subject: 'PR #482 was merged',
              snippet: 'Your pull request was merged into main.',
              labelIds: ['INBOX']
            }
          ]
        }
      },
      GMAIL_FETCH_MESSAGE_BY_MESSAGE_ID: {
        successful: true,
        data: {
          messageId: 'm1',
          threadId: 'thread-renewal',
          sender: 'Dana Lee <dana@customer.example>',
          subject: 'Renewal terms for Q3',
          messageText: 'We would like net 60 and a 12 percent cap on the renewal.'
        }
      }
    }
  });
  await page.goto('/v2/workbench?token=workbench-static-token');

  // Source readiness chips reflect only ACTIVE accounts (Notion was INITIATED).
  const sourcesReady = page.getByTestId('workbench-sources-ready');
  await expect(sourcesReady).toContainText('Gmail');
  await expect(sourcesReady).toContainText('Calendar');
  await expect(sourcesReady).toContainText('Slack');
  await expect(sourcesReady).toContainText('via Composio');
  await expect(sourcesReady).not.toContainText('Notion');

  // The Arrived surface renders the real inbox sender + subject lines.
  const arrived = page.getByTestId('workbench-arrived');
  await expect(arrived).toBeVisible();
  await expect(arrived).toContainText('Dana Lee');
  await expect(arrived).toContainText('Renewal terms for Q3');
  await expect(arrived).toContainText('GitHub');
  await expect(arrived).toContainText('PR #482 was merged');
  await expect(arrived).toContainText('Unread');
  await expect(arrived).toContainText('1 unread · 2 recent');

  // Clicking an inbox row opens the reading panel with the real full message.
  await arrived.getByTestId('workbench-arrived-open').first().click();
  const panel = page.getByTestId('workbench-reading-panel');
  await expect(panel).toBeVisible();
  await expect(panel.getByTestId('workbench-reading-panel-subject')).toContainText(
    'Renewal terms for Q3'
  );
  await expect(panel.getByTestId('workbench-reading-panel-body')).toContainText(
    'net 60 and a 12 percent cap'
  );

  expect(consoleIssues).toEqual([]);
});

test('static workbench: catch-up briefing spans GitHub Drive and Notion from read-only connector reads', async ({
  page
}) => {
  const sentMessages: Array<{ path: string; body: Record<string, unknown> }> = [];
  const connectorReadRequests: Array<Record<string, unknown>> = [];
  const consoleIssues: string[] = [];
  page.on('console', (message) => {
    if (['error', 'warning'].includes(message.type())) {
      consoleIssues.push(`${message.type()}: ${message.text()}`);
    }
  });
  page.on('pageerror', (error) => {
    consoleIssues.push(`pageerror: ${error.message}`);
  });

  await installWorkbenchMocks(page, {
    sentMessages,
    connectorReadRequests,
    connectorAccounts: [
      { toolkit: 'github', status: 'ACTIVE', user_id: 'pg-test' },
      { toolkit: 'googledrive', status: 'ACTIVE', user_id: 'pg-test' },
      { toolkit: 'notion', status: 'ACTIVE', user_id: 'pg-test' }
    ],
    connectorReads: {
      GITHUB_LIST_NOTIFICATIONS_FOR_THE_AUTHENTICATED_USER: {
        successful: true,
        data: {
          details: [
            {
              id: 'gh-1',
              reason: 'mention',
              unread: true,
              updated_at: '2026-06-20T10:00:00.000Z',
              repository: {
                full_name: 'nearai/ironclaw',
                html_url: 'https://github.com/nearai/ironclaw'
              },
              subject: { title: 'Bug Bash blocker', type: 'Issue' }
            }
          ]
        }
      },
      GOOGLEDRIVE_LIST_FILES: {
        successful: true,
        data: {
          files: [
            {
              id: 'drive-1',
              name: 'JASON Levels',
              mimeType: 'application/vnd.google-apps.spreadsheet',
              modifiedTime: '2026-06-20T20:11:59.338Z',
              webViewLink: 'https://docs.google.com/spreadsheets/d/1dtp/edit'
            }
          ]
        }
      },
      NOTION_SEARCH_NOTION_PAGE: {
        successful: true,
        data: {
          response_data: {
            results: [
              {
                object: 'page',
                id: 'notion-1',
                url: 'https://notion.so/q2-management-meeting',
                last_edited_time: '2026-06-20T11:41:00.000Z',
                archived: false,
                in_trash: false,
                properties: {
                  Name: {
                    type: 'title',
                    title: [{ plain_text: 'Q2 2026 Management Meeting' }]
                  }
                }
              }
            ]
          }
        }
      }
    }
  });
  await page.goto('/v2/workbench?token=workbench-static-token');

  const sourcesReady = page.getByTestId('workbench-sources-ready');
  await expect(sourcesReady).toContainText('GitHub');
  await expect(sourcesReady).toContainText('Drive');
  await expect(sourcesReady).toContainText('Notion');
  await expect(sourcesReady).toContainText('via Composio');

  await expect
    .poll(
      () =>
        connectorReadRequests.filter((request) =>
          [
            'GITHUB_LIST_NOTIFICATIONS_FOR_THE_AUTHENTICATED_USER',
            'GOOGLEDRIVE_LIST_FILES',
            'NOTION_SEARCH_NOTION_PAGE'
          ].includes(String(request.tool))
        ).length,
      { message: 'Workbench should read GitHub, Drive, and Notion before briefing' }
    )
    .toBe(3);
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));

  await page.getByTestId('workbench-brief-input').fill('What needs me today?');
  await page.getByTestId('workbench-send-button').click();

  const briefing = page.getByTestId('workbench-briefing');
  await expect(briefing).toBeVisible();
  await expect(briefing).toContainText('GitHub');
  await expect(briefing).toContainText('Drive');
  await expect(briefing).toContainText('Notion');
  await expect(briefing).toContainText('Read-only · nothing sent');
  await expect(briefing).toContainText('Bug Bash blocker');
  await expect(briefing).toContainText('mention · nearai/ironclaw');
  await expect(briefing).toContainText('JASON Levels');
  await expect(briefing).toContainText('Sheet');
  await expect(briefing).toContainText('Q2 2026 Management Meeting');
  await expect(briefing.getByTestId('workbench-briefing-github')).toHaveAttribute(
    'href',
    'https://github.com/nearai/ironclaw'
  );
  await expect(briefing.getByTestId('workbench-briefing-drive')).toHaveAttribute(
    'href',
    'https://docs.google.com/spreadsheets/d/1dtp/edit'
  );
  await expect(briefing.getByTestId('workbench-briefing-notion')).toHaveAttribute(
    'href',
    'https://notion.so/q2-management-meeting'
  );

  const requestsByTool = Object.fromEntries(
    connectorReadRequests.map((request) => [String(request.tool), request])
  );
  expect(requestsByTool.GITHUB_LIST_NOTIFICATIONS_FOR_THE_AUTHENTICATED_USER).toMatchObject({
    toolkit: 'github',
    arguments: { per_page: 6, all: false }
  });
  expect(requestsByTool.GOOGLEDRIVE_LIST_FILES).toMatchObject({
    toolkit: 'googledrive',
    arguments: {
      page_size: 6,
      order_by: 'modifiedTime desc',
      fields: 'files(id,name,mimeType,modifiedTime,webViewLink,iconLink)'
    }
  });
  expect(requestsByTool.NOTION_SEARCH_NOTION_PAGE).toMatchObject({
    toolkit: 'notion',
    arguments: { query: '', page_size: 6 }
  });
  expect(sentMessages).toEqual([]);
  expect(consoleIssues).toEqual([]);
});

test('static workbench: catch-up briefing includes Slack blocker context from a read-only search', async ({
  page
}) => {
  const sentMessages: Array<{ path: string; body: Record<string, unknown> }> = [];
  const connectorReadRequests: Array<Record<string, unknown>> = [];
  const consoleIssues: string[] = [];
  page.on('console', (message) => {
    if (['error', 'warning'].includes(message.type())) {
      consoleIssues.push(`${message.type()}: ${message.text()}`);
    }
  });
  page.on('pageerror', (error) => {
    consoleIssues.push(`pageerror: ${error.message}`);
  });

  await installWorkbenchMocks(page, {
    sentMessages,
    connectorReadRequests,
    connectorAccounts: [{ toolkit: 'slack', status: 'ACTIVE', user_id: 'pg-test' }],
    connectorReadDelayMs: { SLACK_SEARCH_MESSAGES: 500 },
    connectorReads: {
      SLACK_SEARCH_MESSAGES: {
        successful: true,
        data: {
          messages: {
            matches: [
              {
                iid: 'slack-catchup-1',
                username: 'cameron',
                channel: { id: 'C1', name: 'gtm' },
                ts: '1781276971.079319',
                text: 'Launch copy is blocked on pricing approval',
                permalink: 'https://near-foundation.slack.com/archives/C1/p1781276971079319'
              }
            ]
          }
        }
      }
    }
  });
  await page.goto('/v2/workbench?token=workbench-static-token');

  await expect(page.getByTestId('workbench-sources-ready')).toContainText('Slack');
  await expect(connectorReadRequests).toEqual([]);

  await page.getByTestId('workbench-brief-input').fill('What needs me today?');
  await page.getByTestId('workbench-send-button').click();

  const briefing = page.getByTestId('workbench-briefing');
  await expect(briefing).toBeVisible();
  await expect(briefing).toContainText('Checking your connected tools before summarizing');
  await expect(briefing).toContainText('Reading Slack. Nothing is being sent.');
  await expect(briefing).not.toContainText("You're all clear");

  await expect(briefing).toContainText('1 Slack item', { timeout: 3000 });
  await expect(briefing).toContainText('Slack to check');
  await expect(briefing).toContainText('Launch copy is blocked on pricing approval');
  await expect(briefing).toContainText('cameron · #gtm');
  await expect(briefing).toContainText('Read-only · nothing sent');
  await expect(briefing.getByTestId('workbench-briefing-slack')).toHaveAttribute(
    'href',
    'https://near-foundation.slack.com/archives/C1/p1781276971079319'
  );
  await expect(page.getByTestId('workbench-slack-blockers')).toHaveCount(0);

  expect(sentMessages).toEqual([]);
  expect(connectorReadRequests).toEqual([
    {
      toolkit: 'slack',
      tool: 'SLACK_SEARCH_MESSAGES',
      arguments: {
        query: 'blocked OR blocker OR stuck OR waiting OR unblock',
        count: 8,
        sort: 'timestamp'
      }
    }
  ]);
  expect(consoleIssues).toEqual([]);
});

test('static workbench: catch-up briefing waits for in-flight connector reads before summarizing', async ({
  page
}) => {
  const sentMessages: Array<{ path: string; body: Record<string, unknown> }> = [];
  const connectorReadRequests: Array<Record<string, unknown>> = [];
  const consoleIssues: string[] = [];
  page.on('console', (message) => {
    if (['error', 'warning'].includes(message.type())) {
      consoleIssues.push(`${message.type()}: ${message.text()}`);
    }
  });
  page.on('pageerror', (error) => {
    consoleIssues.push(`pageerror: ${error.message}`);
  });

  await installWorkbenchMocks(page, {
    sentMessages,
    connectorReadRequests,
    connectorAccounts: [{ toolkit: 'github', status: 'ACTIVE', user_id: 'pg-test' }],
    connectorReadDelayMs: {
      GITHUB_LIST_NOTIFICATIONS_FOR_THE_AUTHENTICATED_USER: 1200
    },
    connectorReads: {
      GITHUB_LIST_NOTIFICATIONS_FOR_THE_AUTHENTICATED_USER: {
        successful: true,
        data: {
          details: [
            {
              id: 'gh-slow',
              reason: 'review_requested',
              unread: true,
              updated_at: '2026-06-20T10:00:00.000Z',
              repository: {
                full_name: 'nearai/ironclaw',
                html_url: 'https://github.com/nearai/ironclaw'
              },
              subject: { title: 'Slow review request', type: 'PullRequest' }
            }
          ]
        }
      }
    }
  });
  await page.goto('/v2/workbench?token=workbench-static-token');

  await expect(page.getByTestId('workbench-sources-ready')).toContainText('GitHub');
  await expect
    .poll(
      () =>
        connectorReadRequests.some(
          (request) => request.tool === 'GITHUB_LIST_NOTIFICATIONS_FOR_THE_AUTHENTICATED_USER'
        ),
      { message: 'GitHub read should be in flight before the briefing click' }
    )
    .toBe(true);

  await page.getByTestId('workbench-brief-input').fill('What needs me today?');
  await page.getByTestId('workbench-send-button').click();

  const briefing = page.getByTestId('workbench-briefing');
  await expect(briefing).toBeVisible();
  await expect(briefing).toContainText('Checking your connected tools before summarizing');
  await expect(briefing).toContainText('Reading GitHub. Nothing is being sent.');
  await expect(briefing).not.toContainText("You're all clear");

  await expect(briefing).toContainText('Slow review request', { timeout: 3000 });
  await expect(briefing).toContainText('review_requested · nearai/ironclaw');
  await expect(briefing).toContainText('Read-only · nothing sent');
  await expect(briefing).not.toContainText('Checking your connected tools before summarizing');
  expect(sentMessages).toEqual([]);
  expect(consoleIssues).toEqual([]);
});

test('static workbench: catch-up briefing reports source read failures without a false all-clear', async ({
  page
}) => {
  const sentMessages: Array<{ path: string; body: Record<string, unknown> }> = [];
  const connectorReadRequests: Array<Record<string, unknown>> = [];
  const consoleIssues: string[] = [];
  page.on('console', (message) => {
    if (['error', 'warning'].includes(message.type())) {
      const text = message.text();
      if (/Failed to load resource/.test(text)) return;
      consoleIssues.push(`${message.type()}: ${text}`);
    }
  });
  page.on('pageerror', (error) => {
    consoleIssues.push(`pageerror: ${error.message}`);
  });

  await installWorkbenchMocks(page, {
    sentMessages,
    connectorReadRequests,
    connectorReadError: 502,
    connectorAccounts: [
      { toolkit: 'github', status: 'ACTIVE', user_id: 'pg-test' },
      { toolkit: 'googledrive', status: 'ACTIVE', user_id: 'pg-test' },
      { toolkit: 'notion', status: 'ACTIVE', user_id: 'pg-test' }
    ]
  });
  await page.goto('/v2/workbench?token=workbench-static-token');

  const sourcesReady = page.getByTestId('workbench-sources-ready');
  await expect(sourcesReady).toContainText('GitHub');
  await expect(sourcesReady).toContainText('Drive');
  await expect(sourcesReady).toContainText('Notion');

  await expect
    .poll(
      () =>
        connectorReadRequests.filter((request) =>
          [
            'GITHUB_LIST_NOTIFICATIONS_FOR_THE_AUTHENTICATED_USER',
            'GOOGLEDRIVE_LIST_FILES',
            'NOTION_SEARCH_NOTION_PAGE'
          ].includes(String(request.tool))
        ).length,
      { message: 'Workbench should retry failed GitHub, Drive, and Notion reads' }
    )
    .toBeGreaterThanOrEqual(6);

  await page.getByTestId('workbench-brief-input').fill('What needs me today?');
  await page.getByTestId('workbench-send-button').click();

  const briefing = page.getByTestId('workbench-briefing');
  await expect(briefing).toBeVisible();
  await expect(briefing).toContainText('3 sources could not be read');
  await expect(briefing).toContainText('Could not read');
  await expect(briefing.getByTestId('workbench-briefing-source-problem')).toHaveCount(3);
  await expect(briefing).toContainText('Could not read GitHub right now');
  await expect(briefing).toContainText('Could not read Drive right now');
  await expect(briefing).toContainText('Could not read Notion right now');
  await expect(briefing).toContainText('Read-only · nothing sent');
  await expect(briefing).not.toContainText("You're all clear");
  await expect(briefing).not.toContainText('Inbox is clear');

  expect(sentMessages).toEqual([]);
  expect(consoleIssues).toEqual([]);
});

test('static workbench: Slack blocker chip runs a read-only Slack search without starting Chat', async ({
  page
}) => {
  const sentMessages: Array<{ path: string; body: Record<string, unknown> }> = [];
  const connectorReadRequests: Array<Record<string, unknown>> = [];
  const consoleIssues: string[] = [];
  page.on('console', (message) => {
    if (['error', 'warning'].includes(message.type())) {
      consoleIssues.push(`${message.type()}: ${message.text()}`);
    }
  });
  page.on('pageerror', (error) => {
    consoleIssues.push(`pageerror: ${error.message}`);
  });

  await installWorkbenchMocks(page, {
    sentMessages,
    connectorReadRequests,
    connectorAccounts: [{ toolkit: 'slack', status: 'ACTIVE', user_id: 'pg-test' }],
    connectorReads: {
      SLACK_SEARCH_MESSAGES: {
        successful: true,
        data: {
          messages: {
            matches: [
              {
                iid: 'slack-match-1',
                username: 'cameron',
                channel: { id: 'C1', name: 'gtm' },
                ts: '1781276971.079319',
                text: 'Launch copy is blocked on pricing approval',
                permalink: 'https://near-foundation.slack.com/archives/C1/p1781276971079319'
              },
              {
                iid: 'slack-match-2',
                username: 'dana',
                channel: { id: 'C2', name: 'legal' },
                ts: '1781276000.000000',
                text: 'Still waiting on the vendor signature before we can unblock rollout',
                permalink: 'https://near-foundation.slack.com/archives/C2/p1781276000000000'
              }
            ]
          }
        }
      }
    }
  });
  await page.goto('/v2/workbench?token=workbench-static-token');

  await expect(page.getByTestId('workbench-sources-ready')).toContainText('Slack');
  await page.getByRole('button', { name: 'Find Slack blockers' }).click();
  await page.getByTestId('workbench-send-button').click();

  const blockers = page.getByTestId('workbench-slack-blockers');
  await expect(blockers).toBeVisible();
  await expect(blockers).toContainText('2 possible blockers in Slack');
  await expect(blockers).toContainText('Launch copy is blocked on pricing approval');
  await expect(blockers).toContainText('waiting on the vendor signature');
  await expect(blockers).toContainText('Read-only · nothing posted');
  const blockerRows = blockers.getByTestId('workbench-blocker-row');
  await expect(blockerRows).toHaveCount(2);
  await expect(blockerRows.first()).toHaveAttribute(
    'href',
    'https://near-foundation.slack.com/archives/C1/p1781276971079319'
  );

  expect(sentMessages).toEqual([]);
  expect(connectorReadRequests).toEqual([
    {
      toolkit: 'slack',
      tool: 'SLACK_SEARCH_MESSAGES',
      arguments: {
        query: 'blocked OR blocker OR stuck OR waiting OR unblock',
        count: 8,
        sort: 'timestamp'
      }
    }
  ]);
  expect(consoleIssues).toEqual([]);
});

test('static workbench: catch-up replaces the standalone Slack blocker panel with the briefing', async ({
  page
}) => {
  const sentMessages: Array<{ path: string; body: Record<string, unknown> }> = [];
  const connectorReadRequests: Array<Record<string, unknown>> = [];
  const consoleIssues: string[] = [];
  page.on('console', (message) => {
    if (['error', 'warning'].includes(message.type())) {
      consoleIssues.push(`${message.type()}: ${message.text()}`);
    }
  });
  page.on('pageerror', (error) => {
    consoleIssues.push(`pageerror: ${error.message}`);
  });

  await installWorkbenchMocks(page, {
    sentMessages,
    connectorReadRequests,
    connectorAccounts: [{ toolkit: 'slack', status: 'ACTIVE', user_id: 'pg-test' }],
    connectorReads: {
      SLACK_SEARCH_MESSAGES: {
        successful: true,
        data: {
          messages: {
            matches: [
              {
                iid: 'slack-transition-1',
                username: 'cameron',
                channel: { id: 'C1', name: 'gtm' },
                ts: '1781276971.079319',
                text: 'Launch copy is blocked on pricing approval',
                permalink: 'https://near-foundation.slack.com/archives/C1/p1781276971079319'
              }
            ]
          }
        }
      }
    }
  });
  await page.goto('/v2/workbench?token=workbench-static-token');

  await page.getByRole('button', { name: 'Find Slack blockers' }).click();
  await page.getByTestId('workbench-send-button').click();

  const blockers = page.getByTestId('workbench-slack-blockers');
  await expect(blockers).toBeVisible();
  await expect(blockers).toContainText('1 possible blocker in Slack');
  await expect(blockers).toContainText('Launch copy is blocked on pricing approval');

  await page.getByTestId('workbench-brief-input').fill('What needs me today?');
  await page.getByTestId('workbench-send-button').click();

  const briefing = page.getByTestId('workbench-briefing');
  await expect(briefing).toBeVisible();
  await expect(briefing).toContainText('1 Slack item');
  await expect(briefing).toContainText('Slack to check');
  await expect(briefing).toContainText('Launch copy is blocked on pricing approval');
  await expect(page.getByTestId('workbench-slack-blockers')).toHaveCount(0);

  expect(sentMessages).toEqual([]);
  expect(connectorReadRequests).toEqual([
    {
      toolkit: 'slack',
      tool: 'SLACK_SEARCH_MESSAGES',
      arguments: {
        query: 'blocked OR blocker OR stuck OR waiting OR unblock',
        count: 8,
        sort: 'timestamp'
      }
    }
  ]);
  expect(consoleIssues).toEqual([]);
});

test('static workbench: Slack blocker search failure degrades without fabricating all-clear', async ({
  page
}) => {
  const sentMessages: Array<{ path: string; body: Record<string, unknown> }> = [];
  const connectorReadRequests: Array<Record<string, unknown>> = [];
  const appConsoleIssues: string[] = [];
  page.on('console', (message) => {
    if (!['error', 'warning'].includes(message.type())) return;
    const text = message.text();
    if (/Failed to load resource/.test(text)) return;
    appConsoleIssues.push(`${message.type()}: ${text}`);
  });
  page.on('pageerror', (error) => {
    appConsoleIssues.push(`pageerror: ${error.message}`);
  });

  await installWorkbenchMocks(page, {
    sentMessages,
    connectorReadRequests,
    connectorAccounts: [{ toolkit: 'slack', status: 'ACTIVE', user_id: 'pg-test' }],
    connectorReadError: 502
  });
  await page.goto('/v2/workbench?token=workbench-static-token');

  await page.getByRole('button', { name: 'Find Slack blockers' }).click();
  await page.getByTestId('workbench-send-button').click();

  const blockers = page.getByTestId('workbench-slack-blockers');
  await expect(blockers).toBeVisible();
  await expect(blockers).toContainText('Could not search Slack right now');
  await expect(blockers).not.toContainText('Nothing looks stuck right now');

  expect(sentMessages).toEqual([]);
  expect(connectorReadRequests.length).toBeGreaterThanOrEqual(1);
  expect(connectorReadRequests[0]).toMatchObject({
    toolkit: 'slack',
    tool: 'SLACK_SEARCH_MESSAGES'
  });
  expect(appConsoleIssues).toEqual([]);
});

test('static workbench: real unread mail renders as v13 Needs a decision cards', async ({
  page
}) => {
  // v13 fidelity: unread inbox mail is the primary "what needs me" surface and
  // renders as decision cards (subject as the decision, sender + date as the
  // meta line, a filled-blue action that opens a held in-app draft). Read mail
  // does not become a decision card.
  const consoleIssues: string[] = [];
  page.on('console', (message) => {
    if (['error', 'warning'].includes(message.type())) {
      consoleIssues.push(`${message.type()}: ${message.text()}`);
    }
  });
  page.on('pageerror', (error) => {
    consoleIssues.push(`pageerror: ${error.message}`);
  });

  await installWorkbenchMocks(page, {
    connectorAccounts: [{ toolkit: 'gmail', status: 'ACTIVE', user_id: 'pg-test' }],
    connectorReads: {
      gmail: {
        successful: true,
        data: {
          messages: [
            {
              messageId: 'm1',
              threadId: 'thread-renewal',
              sender: 'Dana Lee <dana@customer.example>',
              subject: 'Renewal terms for Q3',
              snippet: 'We would like net 60 and a 12 percent cap.',
              labelIds: ['UNREAD', 'INBOX'],
              messageTimestamp: '2026-06-20T16:31:36Z'
            },
            {
              messageId: 'm2',
              sender: 'GitHub <notifications@github.com>',
              subject: 'PR #482 was merged',
              snippet: 'Your pull request was merged into main.',
              labelIds: ['INBOX']
            }
          ]
        }
      },
      GMAIL_FETCH_MESSAGE_BY_MESSAGE_ID: {
        successful: true,
        data: {
          messageId: 'm1',
          threadId: 'thread-renewal',
          sender: 'Dana Lee <dana@customer.example>',
          subject: 'Renewal terms for Q3',
          messageText: 'We would like net 60 and a 12 percent cap on the renewal.'
        }
      }
    }
  });
  await page.goto('/v2/workbench?token=workbench-static-token');

  const decisions = page.getByTestId('workbench-decisions');
  await expect(decisions).toBeVisible();
  await expect(decisions).toContainText('Needs a decision');
  await expect(decisions).toContainText('· 1');
  await expect(decisions).toContainText('Renewal terms for Q3');
  await expect(decisions).toContainText('Dana Lee');
  // The read GitHub mail is NOT a decision card.
  await expect(decisions).not.toContainText('PR #482 was merged');

  // The card-level draft action now opens the same gated in-app draft review
  // modal as the reading panel. It is not an external Gmail compose link.
  const draftAction = decisions.getByTestId('workbench-decision-draft');
  await expect(draftAction).toHaveText('Draft reply');
  await expect(draftAction).not.toHaveAttribute('href', /.+/);
  await draftAction.click();
  const approve = page.getByTestId('workbench-approve');
  await expect(approve).toBeVisible();
  await expect(approve).toContainText('Gmail · create draft (no send)');
  await expect(approve.getByTestId('workbench-approve-recipient')).toHaveValue(
    'dana@customer.example'
  );
  await expect(approve.getByTestId('workbench-approve-subject')).toHaveValue(
    'Re: Renewal terms for Q3'
  );
  await expect(approve.getByTestId('workbench-approve-create')).toBeDisabled();
  await approve.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByTestId('workbench-approve')).toHaveCount(0);

  // Clicking the decision card body opens the reading panel with the full mail.
  await decisions.getByTestId('workbench-decision-open').first().click();
  const panel = page.getByTestId('workbench-reading-panel');
  await expect(panel).toBeVisible();
  await expect(panel.getByTestId('workbench-reading-panel-body')).toContainText(
    'net 60 and a 12 percent cap'
  );
  await panel.getByRole('button', { name: 'Close' }).click();

  // The unread mail also appears as a compact "Needs a reply" row in the rail.
  const activeWork = page.getByRole('complementary', { name: 'Active work' });
  await expect(activeWork).toContainText('Needs a reply');
  await expect(activeWork).toContainText('Renewal terms for Q3');

  expect(consoleIssues).toEqual([]);
});

test('static workbench: no unread mail hides the Needs a decision cards', async ({ page }) => {
  await installWorkbenchMocks(page, {
    connectorAccounts: [{ toolkit: 'gmail', status: 'ACTIVE', user_id: 'pg-test' }],
    connectorReads: {
      gmail: {
        successful: true,
        data: {
          messages: [
            {
              messageId: 'm-read',
              sender: 'GitHub <notifications@github.com>',
              subject: 'PR #482 was merged',
              labelIds: ['INBOX']
            }
          ]
        }
      }
    }
  });
  await page.goto('/v2/workbench?token=workbench-static-token');

  await expect(page.getByTestId('workbench-arrived')).toBeVisible();
  await expect(page.getByTestId('workbench-decisions')).toHaveCount(0);
});

test('static workbench: Upcoming card renders real calendar events from Composio reads', async ({
  page
}) => {
  const consoleIssues: string[] = [];
  page.on('console', (message) => {
    if (['error', 'warning'].includes(message.type())) {
      consoleIssues.push(`${message.type()}: ${message.text()}`);
    }
  });
  page.on('pageerror', (error) => {
    consoleIssues.push(`pageerror: ${error.message}`);
  });

  await installWorkbenchMocks(page, {
    connectorAccounts: [
      { toolkit: 'gmail', status: 'ACTIVE', user_id: 'pg-test' },
      { toolkit: 'googlecalendar', status: 'ACTIVE', user_id: 'pg-test' }
    ],
    connectorReads: {
      gmail: { successful: true, data: { messages: [] } },
      GOOGLECALENDAR_EVENTS_LIST: {
        successful: true,
        data: {
          items: [
            {
              id: 'evt-ooo',
              summary: '[ooo] USA & Abhi',
              start: { date: '2026-06-22' },
              end: { date: '2026-06-23' },
              htmlLink: 'https://www.google.com/calendar/event?eid=ooo'
            },
            {
              id: 'evt-legal',
              summary: 'Legal Weekly',
              start: { dateTime: '2026-06-22T10:00:00-04:00', timeZone: 'Europe/London' },
              location: 'Zoom',
              htmlLink: 'https://www.google.com/calendar/event?eid=legal'
            }
          ]
        }
      }
    }
  });
  await page.goto('/v2/workbench?token=workbench-static-token');

  const upcoming = page.getByTestId('workbench-upcoming');
  await expect(upcoming).toBeVisible();
  await expect(upcoming).toContainText('Upcoming');
  await expect(upcoming).toContainText('[ooo] USA & Abhi');
  await expect(upcoming).toContainText('Legal Weekly');
  await expect(upcoming).toContainText('Zoom');

  // The event row with an htmlLink renders as a real external link.
  const oooLink = upcoming.getByRole('link', { name: /\[ooo\] USA & Abhi/ });
  await expect(oooLink).toHaveAttribute('href', 'https://www.google.com/calendar/event?eid=ooo');

  expect(consoleIssues).toEqual([]);
});

test('static workbench: no calendar account hides Upcoming with no console errors', async ({
  page
}) => {
  const consoleIssues: string[] = [];
  page.on('console', (message) => {
    if (['error', 'warning'].includes(message.type())) {
      consoleIssues.push(`${message.type()}: ${message.text()}`);
    }
  });
  page.on('pageerror', (error) => {
    consoleIssues.push(`pageerror: ${error.message}`);
  });

  await installWorkbenchMocks(page, {
    connectorAccounts: [{ toolkit: 'gmail', status: 'ACTIVE', user_id: 'pg-test' }],
    connectorReads: { gmail: { successful: true, data: { messages: [] } } }
  });
  await page.goto('/v2/workbench?token=workbench-static-token');

  await expect(page.getByTestId('workbench-arrived')).toBeVisible();
  await expect(page.getByTestId('workbench-upcoming')).toHaveCount(0);
  // A live connector means the cold-open must yield to the real surface.
  await expect(page.getByTestId('workbench-coldstart')).toHaveCount(0);
  expect(consoleIssues).toEqual([]);
});

test('static workbench: no Gmail account hides Arrived with no console errors', async ({
  page
}) => {
  const consoleIssues: string[] = [];
  page.on('console', (message) => {
    if (['error', 'warning'].includes(message.type())) {
      consoleIssues.push(`${message.type()}: ${message.text()}`);
    }
  });
  page.on('pageerror', (error) => {
    consoleIssues.push(`pageerror: ${error.message}`);
  });

  await installWorkbenchMocks(page, { connectorAccounts: [] });
  await page.goto('/v2/workbench?token=workbench-static-token');

  await expect(page.getByTestId('workbench-page')).toBeVisible();
  await expect(page.getByTestId('workbench-arrived')).toHaveCount(0);
  await expect(page.getByTestId('workbench-sources-ready')).toHaveCount(0);
  // With no connector live the Workbench would be an empty column; the cold-open
  // takes its place with an anticipatory connect prompt (DESIGN.md Law 1).
  await expect(page.getByTestId('workbench-coldstart')).toBeVisible();
  await expect(page.getByTestId('workbench-coldstart-connect')).toBeVisible();
  expect(consoleIssues).toEqual([]);
});

test('static workbench: connector read failure degrades honestly without fabricating mail', async ({
  page
}) => {
  // App-level console issues only. The browser itself logs a native "Failed to
  // load resource" line for the mocked 502 response; that is not application
  // code and is excluded. The happy-path tests above assert ZERO console issues
  // when the connector read succeeds.
  const appConsoleIssues: string[] = [];
  page.on('console', (message) => {
    if (!['error', 'warning'].includes(message.type())) return;
    const text = message.text();
    if (/Failed to load resource/.test(text)) return;
    appConsoleIssues.push(`${message.type()}: ${text}`);
  });
  page.on('pageerror', (error) => {
    appConsoleIssues.push(`pageerror: ${error.message}`);
  });

  await installWorkbenchMocks(page, {
    connectorAccounts: [{ toolkit: 'gmail', status: 'ACTIVE', user_id: 'pg-test' }],
    connectorReadError: 502
  });
  await page.goto('/v2/workbench?token=workbench-static-token');

  const arrived = page.getByTestId('workbench-arrived');
  await expect(arrived).toBeVisible();
  await expect(arrived).toContainText('Could not read the inbox right now');
  await expect(page.getByTestId('workbench-arrived-list')).toHaveCount(0);
  expect(appConsoleIssues).toEqual([]);
});

test('static workbench: clicking a decision card opens the reading panel with the real body', async ({
  page
}) => {
  const consoleIssues: string[] = [];
  page.on('console', (message) => {
    if (['error', 'warning'].includes(message.type())) {
      consoleIssues.push(`${message.type()}: ${message.text()}`);
    }
  });
  page.on('pageerror', (error) => {
    consoleIssues.push(`pageerror: ${error.message}`);
  });

  await installWorkbenchMocks(page, {
    connectorAccounts: [{ toolkit: 'gmail', status: 'ACTIVE', user_id: 'pg-test' }],
    connectorReads: {
      GMAIL_FETCH_EMAILS: {
        successful: true,
        data: {
          messages: [
            {
              messageId: '19ee5df98f8d839e',
              threadId: 'thread-spacex',
              sender: 'The Information <hello@theinformation.com>',
              subject: 'What the SpaceX offering could signal',
              snippet: 'Subscribe now for $749.',
              labelIds: ['UNREAD', 'INBOX'],
              messageTimestamp: '2026-06-20T16:31:36Z'
            }
          ]
        }
      },
      GMAIL_FETCH_MESSAGE_BY_MESSAGE_ID: {
        successful: true,
        data: {
          messageId: '19ee5df98f8d839e',
          threadId: 'thread-spacex',
          sender: 'The Information <hello@theinformation.com>',
          to: 'abhishek@near.foundation',
          subject: 'What the SpaceX offering could signal',
          messageTimestamp: '2026-06-20T16:31:36Z',
          messageText:
            'Subscribe now for $749 and save 25% on the first year.\r\n\r\nThe SpaceX secondary could reset how investors price the next wave of AI IPOs.\r\n\r\nThe Information'
        }
      }
    }
  });
  await page.goto('/v2/workbench?token=workbench-static-token');

  // The decision card body is clickable (not the action button).
  const decisions = page.getByTestId('workbench-decisions');
  await expect(decisions).toBeVisible();
  await decisions.getByTestId('workbench-decision-open').first().click();

  // The reading panel opens and renders the real subject + body from the
  // GMAIL_FETCH_MESSAGE_BY_MESSAGE_ID read.
  const panel = page.getByTestId('workbench-reading-panel');
  await expect(panel).toBeVisible();
  await expect(panel.getByTestId('workbench-reading-panel-subject')).toContainText(
    'What the SpaceX offering could signal'
  );
  await expect(panel).toContainText('The Information');
  await expect(panel.getByTestId('workbench-reading-panel-body')).toContainText(
    'Subscribe now for $749'
  );
  await expect(panel.getByTestId('workbench-reading-panel-body')).toContainText(
    'reset how investors price the next wave of AI IPOs'
  );

  // The panel "Open in Gmail" link is a real Gmail deep link to the thread.
  await expect(panel.getByTestId('workbench-reading-panel-open-gmail')).toHaveAttribute(
    'href',
    'https://mail.google.com/mail/u/0/#all/thread-spacex'
  );

  // Close button dismisses the panel.
  await panel.getByRole('button', { name: 'Close' }).click();
  await expect(page.getByTestId('workbench-reading-panel')).toHaveCount(0);

  expect(consoleIssues).toEqual([]);
});

test('static workbench: reading panel creates a reviewable Gmail draft through the gated write route', async ({
  page
}) => {
  const sentMessages: Array<{ path: string; body: Record<string, unknown> }> = [];
  const connectorReadRequests: Array<Record<string, unknown>> = [];
  const connectorWriteRequests: Array<Record<string, unknown>> = [];
  const consoleIssues: string[] = [];
  page.on('console', (message) => {
    if (['error', 'warning'].includes(message.type())) {
      consoleIssues.push(`${message.type()}: ${message.text()}`);
    }
  });
  page.on('pageerror', (error) => {
    consoleIssues.push(`pageerror: ${error.message}`);
  });

  await installWorkbenchMocks(page, {
    sentMessages,
    connectorReadRequests,
    connectorWriteRequests,
    connectorAccounts: [{ toolkit: 'gmail', status: 'ACTIVE', user_id: 'pg-test' }],
    connectorReads: {
      GMAIL_FETCH_EMAILS: {
        successful: true,
        data: {
          messages: [
            {
              messageId: 'm-renewal',
              threadId: 'thread-renewal',
              sender: 'Dana Lee <dana@customer.example>',
              subject: 'Renewal terms for Q3',
              snippet: 'Can we do net 45 with an 8% cap?',
              labelIds: ['UNREAD', 'INBOX'],
              messageTimestamp: '2026-06-20T16:31:36Z'
            }
          ]
        }
      },
      GMAIL_FETCH_MESSAGE_BY_MESSAGE_ID: {
        successful: true,
        data: {
          messageId: 'm-renewal',
          threadId: 'thread-renewal',
          sender: 'Dana Lee <dana@customer.example>',
          to: 'abhishek@near.foundation',
          subject: 'Renewal terms for Q3',
          messageTimestamp: '2026-06-20T16:31:36Z',
          messageText:
            'Hi Abhishek,\r\n\r\nCan we do net 45 with an 8% cap on liability?\r\n\r\nDana'
        }
      }
    },
    connectorWrites: {
      GMAIL_CREATE_EMAIL_DRAFT: {
        successful: true,
        data: { response_data: { id: 'draft-renewal-1' } }
      }
    }
  });
  await page.goto('/v2/workbench?token=workbench-static-token');

  await page.getByTestId('workbench-decisions').getByTestId('workbench-decision-open').click();
  const panel = page.getByTestId('workbench-reading-panel');
  await expect(panel).toBeVisible();
  await expect(panel.getByTestId('workbench-reading-panel-body')).toContainText(
    'net 45 with an 8% cap'
  );
  await panel.getByTestId('workbench-reading-panel-draft').click();

  const approve = page.getByTestId('workbench-approve');
  await expect(approve).toBeVisible();
  await expect(approve).toContainText('Gated write · draft');
  await expect(approve).toContainText('Gmail · create draft (no send)');
  await expect(approve).toContainText('Sending from the Workbench is turned off');
  await expect(approve.getByTestId('workbench-approve-recipient')).toHaveValue(
    'dana@customer.example'
  );
  await expect(approve.getByTestId('workbench-approve-subject')).toHaveValue(
    'Re: Renewal terms for Q3'
  );
  await expect(approve.getByTestId('workbench-approve-create')).toBeDisabled();

  await approve
    .getByTestId('workbench-approve-body')
    .fill('Thanks Dana. Net 45 and an 8% cap are acceptable for the renewal draft.');
  await approve.getByTestId('workbench-approve-create').click();

  await expect
    .poll(() => connectorWriteRequests.length, {
      message: 'Workbench draft approval should POST through /connectors/write'
    })
    .toBe(1);
  expect(connectorWriteRequests[0]).toEqual({
    toolkit: 'gmail',
    tool: 'GMAIL_CREATE_EMAIL_DRAFT',
    arguments: {
      recipient_email: 'dana@customer.example',
      subject: 'Re: Renewal terms for Q3',
      body: 'Thanks Dana. Net 45 and an 8% cap are acceptable for the renewal draft.',
      thread_id: 'thread-renewal'
    }
  });
  expect(connectorReadRequests.some((request) => request.tool === 'GMAIL_CREATE_EMAIL_DRAFT')).toBe(
    false
  );
  expect(sentMessages).toEqual([]);

  await expect(approve).toContainText('Draft created');
  await expect(approve).toContainText('id draft-renewal-1');
  await expect(approve).toContainText('Nothing was sent');
  expect(consoleIssues).toEqual([]);
});

test('static workbench: Gmail draft write failure stays in the review modal without sending', async ({
  page
}) => {
  const sentMessages: Array<{ path: string; body: Record<string, unknown> }> = [];
  const connectorWriteRequests: Array<Record<string, unknown>> = [];
  const consoleIssues: string[] = [];
  page.on('console', (message) => {
    if (['error', 'warning'].includes(message.type())) {
      consoleIssues.push(`${message.type()}: ${message.text()}`);
    }
  });
  page.on('pageerror', (error) => {
    consoleIssues.push(`pageerror: ${error.message}`);
  });

  await installWorkbenchMocks(page, {
    sentMessages,
    connectorWriteRequests,
    connectorWriteError: 502,
    connectorAccounts: [{ toolkit: 'gmail', status: 'ACTIVE', user_id: 'pg-test' }],
    connectorReads: {
      GMAIL_FETCH_EMAILS: {
        successful: true,
        data: {
          messages: [
            {
              messageId: 'm-fail-draft',
              threadId: 'thread-fail-draft',
              sender: 'Dana Lee <dana@customer.example>',
              subject: 'Renewal terms for Q3',
              snippet: 'Can we do net 45 with an 8% cap?',
              labelIds: ['UNREAD', 'INBOX'],
              messageTimestamp: '2026-06-20T16:31:36Z'
            }
          ]
        }
      },
      GMAIL_FETCH_MESSAGE_BY_MESSAGE_ID: {
        successful: true,
        data: {
          messageId: 'm-fail-draft',
          threadId: 'thread-fail-draft',
          sender: 'Dana Lee <dana@customer.example>',
          fromEmail: 'dana@customer.example',
          to: 'abhishek@near.foundation',
          subject: 'Renewal terms for Q3',
          messageTimestamp: '2026-06-20T16:31:36Z',
          messageText:
            'Hi Abhishek,\r\n\r\nCan we do net 45 with an 8% cap on liability?\r\n\r\nDana'
        }
      }
    }
  });
  await page.goto('/v2/workbench?token=workbench-static-token');

  await page.getByTestId('workbench-decisions').getByTestId('workbench-decision-open').click();
  await page
    .getByTestId('workbench-reading-panel')
    .getByTestId('workbench-reading-panel-draft')
    .click();

  const approve = page.getByTestId('workbench-approve');
  await expect(approve.getByTestId('workbench-approve-recipient')).toHaveValue(
    'dana@customer.example'
  );
  await expect(approve.getByTestId('workbench-approve-subject')).toHaveValue(
    'Re: Renewal terms for Q3'
  );
  const draftBody = approve.getByRole('textbox', { name: 'Draft message' });
  await draftBody.fill('Thanks Dana. Net 45 and an 8% cap are acceptable for the renewal draft.');
  await expect(draftBody).toHaveValue(
    'Thanks Dana. Net 45 and an 8% cap are acceptable for the renewal draft.'
  );
  await expect(approve.getByTestId('workbench-approve-create')).toBeEnabled();
  await approve.getByTestId('workbench-approve-create').click();

  await expect
    .poll(() => connectorWriteRequests.length, {
      message: 'failed draft creation should still call only the gated write route'
    })
    .toBe(1);
  expect(connectorWriteRequests[0]).toEqual({
    toolkit: 'gmail',
    tool: 'GMAIL_CREATE_EMAIL_DRAFT',
    arguments: {
      recipient_email: 'dana@customer.example',
      subject: 'Re: Renewal terms for Q3',
      body: 'Thanks Dana. Net 45 and an 8% cap are acceptable for the renewal draft.',
      thread_id: 'thread-fail-draft'
    }
  });
  expect(sentMessages).toEqual([]);

  await expect(approve).toContainText('connector write failed');
  await expect(approve).toContainText('Gmail · create draft (no send)');
  await expect(approve).toContainText('Nothing is sent');
  await expect(approve).not.toContainText('Draft created');
  await expect(approve.getByTestId('workbench-approve-body')).toHaveValue(
    'Thanks Dana. Net 45 and an 8% cap are acceptable for the renewal draft.'
  );
  await expect(approve.getByTestId('workbench-approve-create')).toBeEnabled();
  expect(
    consoleIssues.filter(
      (issue) => !issue.includes('Failed to load resource') || !issue.includes('502')
    )
  ).toEqual([]);
});

test('static workbench: email rows expose Gmail links and decision drafts stay in-app', async ({
  page
}) => {
  await installWorkbenchMocks(page, {
    connectorAccounts: [{ toolkit: 'gmail', status: 'ACTIVE', user_id: 'pg-test' }],
    connectorReads: {
      GMAIL_FETCH_EMAILS: {
        successful: true,
        data: {
          messages: [
            {
              messageId: 'm-unread',
              threadId: 'thread-unread',
              sender: 'Dana Lee <dana@customer.example>',
              subject: 'Renewal terms for Q3',
              snippet: 'We would like net 60.',
              labelIds: ['UNREAD', 'INBOX'],
              messageTimestamp: '2026-06-20T16:31:36Z'
            }
          ]
        }
      }
    }
  });
  await page.goto('/v2/workbench?token=workbench-static-token');

  // The Arrived inbox row exposes an "Open in Gmail" external link.
  const arrived = page.getByTestId('workbench-arrived');
  await expect(arrived.getByTestId('workbench-arrived-gmail').first()).toHaveAttribute(
    'href',
    'https://mail.google.com/mail/u/0/#all/thread-unread'
  );

  // The decision card draft action opens the gated in-app draft modal, not an
  // external Gmail compose URL.
  const draft = page.getByTestId('workbench-decisions').getByTestId('workbench-decision-draft');
  await expect(draft).toHaveText('Draft reply');
  await expect(draft).not.toHaveAttribute('href', /.+/);
  await draft.click();
  const approve = page.getByTestId('workbench-approve');
  await expect(approve).toContainText('Gmail · create draft (no send)');
  await expect(approve.getByTestId('workbench-approve-recipient')).toHaveValue(
    'dana@customer.example'
  );
  await expect(approve.getByTestId('workbench-approve-subject')).toHaveValue(
    'Re: Renewal terms for Q3'
  );
  await approve.getByRole('button', { name: 'Cancel' }).click();

  // The rail "Needs a reply" row opens the in-app reading panel (no dead route).
  const reply = page.getByTestId('workbench-rail-reply').first();
  await expect(reply).toBeVisible();
  await reply.click();
  await expect(page.getByTestId('workbench-reading-panel')).toBeVisible();
});

test('static workbench: rail Upcoming items link out to the real calendar htmlLink', async ({
  page
}) => {
  await installWorkbenchMocks(page, {
    connectorAccounts: [
      { toolkit: 'gmail', status: 'ACTIVE', user_id: 'pg-test' },
      { toolkit: 'googlecalendar', status: 'ACTIVE', user_id: 'pg-test' }
    ],
    connectorReads: {
      GMAIL_FETCH_EMAILS: { successful: true, data: { messages: [] } },
      GOOGLECALENDAR_EVENTS_LIST: {
        successful: true,
        data: {
          items: [
            {
              id: 'evt-legal',
              summary: 'Legal Weekly',
              start: { dateTime: '2026-06-22T10:00:00-04:00' },
              location: 'Zoom',
              htmlLink: 'https://www.google.com/calendar/event?eid=legal'
            }
          ]
        }
      }
    }
  });
  await page.goto('/v2/workbench?token=workbench-static-token');

  // The active-work rail is present; its Upcoming row carries the real htmlLink
  // and opens in a new tab (no dead /v2/workbench route).
  const activeWork = page.getByRole('complementary', { name: 'Active work' });
  await expect(activeWork).toContainText('Legal Weekly');
  const upcomingRail = activeWork.getByTestId('workbench-rail-upcoming').first();
  await expect(upcomingRail).toHaveAttribute(
    'href',
    'https://www.google.com/calendar/event?eid=legal'
  );
  await expect(upcomingRail).toHaveAttribute('target', '_blank');
});

test('static workbench: a failed full-message read shows an honest panel error', async ({
  page
}) => {
  const connectorWriteRequests: Array<Record<string, unknown>> = [];
  await installWorkbenchMocks(page, {
    connectorWriteRequests,
    connectorAccounts: [{ toolkit: 'gmail', status: 'ACTIVE', user_id: 'pg-test' }],
    connectorReads: {
      GMAIL_FETCH_EMAILS: {
        successful: true,
        data: {
          messages: [
            {
              messageId: 'm-bad',
              threadId: 'thread-bad',
              sender: 'Ops <ops@example.com>',
              subject: 'Quarterly numbers',
              labelIds: ['UNREAD', 'INBOX']
            }
          ]
        }
      },
      GMAIL_FETCH_MESSAGE_BY_MESSAGE_ID: { successful: false, error: 'rate limited' }
    }
  });
  await page.goto('/v2/workbench?token=workbench-static-token');

  await page.getByTestId('workbench-decision-open').first().click();
  const panel = page.getByTestId('workbench-reading-panel');
  await expect(panel).toBeVisible();
  await expect(panel.getByTestId('workbench-reading-panel-body')).toContainText(
    'Could not load this message right now'
  );
  // The header still shows the row's known subject; no body is fabricated.
  await expect(panel.getByTestId('workbench-reading-panel-subject')).toContainText(
    'Quarterly numbers'
  );
  await panel.getByTestId('workbench-reading-panel-draft').click();

  const approve = page.getByTestId('workbench-approve');
  await expect(approve).toBeVisible();
  await expect(approve.getByTestId('workbench-approve-recipient')).toHaveValue('ops@example.com');
  await expect(approve.getByTestId('workbench-approve-subject')).toHaveValue(
    'Re: Quarterly numbers'
  );
  await approve.getByTestId('workbench-approve-body').fill('Thanks, I will review the numbers.');
  await approve.getByTestId('workbench-approve-create').click();
  await expect.poll(() => connectorWriteRequests.length).toBe(1);
  expect(connectorWriteRequests[0]).toEqual({
    toolkit: 'gmail',
    tool: 'GMAIL_CREATE_EMAIL_DRAFT',
    arguments: {
      recipient_email: 'ops@example.com',
      subject: 'Re: Quarterly numbers',
      body: 'Thanks, I will review the numbers.',
      thread_id: 'thread-bad'
    }
  });
});

test('static auth: protected Workbench route redirects to welcome without token', async ({
  page
}) => {
  await installWorkbenchMocks(page);
  await page.goto('/v2/workbench');

  await expect(page).toHaveURL(/\/v2\/welcome$/);
  await expect(page.getByRole('heading', { name: 'IronClaw Desktop' })).toBeVisible();
});
