import { expect, test, type Page, type Route } from '@playwright/test';

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

test('static work product: saved chat artifact reloads in Work route', async ({ page }) => {
  await installWorkProductMocks(page);
  await page.addInitScript(() => {
    window.localStorage.setItem(
      'ironclaw-work-items',
      JSON.stringify([
        {
          id: 'work-static-1',
          title: 'Services agreement draft',
          objective: 'Saved work product from chat.',
          domain: 'general',
          runbookIds: ['general'],
          status: 'active',
          created_at: '2026-06-13T15:00:00.000Z',
          updated_at: '2026-06-13T15:00:00.000Z',
          links: [{ kind: 'thread', ref: 'thread-services', label: 'Services thread' }],
          dossier: [],
          approvalBoundaries: [],
          artifacts: [
            {
              id: 'artifact-static-1',
              type: 'document',
              title: 'Services agreement draft',
              status: 'ready',
              provenance: ['thread:thread-services'],
              content:
                '# Services agreement draft\n\nAcme Labs hires Northstar Ops for implementation work.\n\n- Fee: $42,000\n- Payment: Net 30\n- Term: 90 days',
              content_format: 'markdown'
            }
          ],
          watches: [],
          receipts: [],
          openApprovals: [],
          followUps: [],
          nextAction: 'Review saved work product.'
        }
      ])
    );
  });

  await page.goto('/v2/work?item=work-static-1&artifact=artifact-static-1&token=static-work-token');

  await expect(page.locator('article h1').first()).toHaveText('Services agreement draft');
  await expect(page.getByTestId('saved-work-artifact')).toContainText(
    'Acme Labs hires Northstar Ops'
  );
  await expect(page.getByRole('button', { name: 'Copy' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'DOCX', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'PDF', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Open thread' })).toHaveAttribute(
    'href',
    '/v2/chat/thread-services'
  );
});

test('static work product: assistant generated DOCX chip saves to Work and reloads as a file', async ({
  page
}) => {
  await installWorkProductMocks(page);

  await page.goto('/v2/chat/thread-generated-file?token=static-work-token');

  await expect(page.getByTestId('generated-file-artifact-chip')).toContainText(
    'services-agreement.docx'
  );
  await expect(page.getByTestId('generated-file-artifact-chip')).toContainText('Generated file');
  await expect(page.getByRole('button', { name: 'Preview services-agreement.docx' })).toBeVisible();
  await page.getByRole('button', { name: 'Save services-agreement.docx to Work' }).click();

  await expect(page).toHaveURL(/\/v2\/work\?item=work-/);
  await expect(page.getByTestId('saved-work-file-artifact')).toContainText('DOCX file artifact');
  await expect(page.getByTestId('saved-work-file-artifact')).toContainText(
    'services-agreement.docx'
  );
  await expect(page.getByRole('button', { name: 'Save original' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Open thread' })).toHaveAttribute(
    'href',
    '/v2/chat/thread-generated-file'
  );
});

async function installWorkProductMocks(page: Page) {
  await page.route(/\/(api|auth)\//, async (route: Route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    const method = route.request().method();

    if (path === '/api/gateway/status') {
      return json(route, gatewayStatus);
    }
    if (path === '/api/webchat/v2/llm/providers') {
      return json(route, llmProviders);
    }
    if (path === '/api/webchat/v2/threads' && method === 'GET') {
      return json(route, {
        threads: [
          {
            id: 'thread-services',
            thread_id: 'thread-services',
            title: 'Services thread',
            updated_at: '2026-06-13T15:00:00.000Z'
          },
          {
            id: 'thread-generated-file',
            thread_id: 'thread-generated-file',
            title: 'Generated DOCX thread',
            updated_at: '2026-06-13T16:00:00.000Z'
          }
        ],
        next_cursor: null
      });
    }
    if (path === '/api/webchat/v2/threads/thread-generated-file/timeline') {
      return json(route, {
        messages: [
          {
            kind: 'assistant',
            message_id: 'msg-generated-docx',
            content: 'Draft complete. Review the generated Word file.',
            sequence: 1,
            turn_run_id: 'run-generated-docx',
            created_at: '2026-06-13T16:00:00.000Z',
            artifacts: [
              {
                title: 'Services agreement',
                filename: 'services-agreement.docx',
                mime_type:
                  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                data_base64: 'UEsDBGRvY3g=',
                size: 8
              }
            ]
          }
        ],
        summary_artifacts: [],
        next_cursor: null
      });
    }
    if (path === '/api/webchat/v2/threads/thread-generated-file/events') {
      return route.fulfill({
        status: 200,
        contentType: 'text/event-stream; charset=utf-8',
        body: ': connected\n\n'
      });
    }
    if (path === '/auth/providers') {
      return json(route, { providers: [] });
    }

    return json(route, { ok: true });
  });
}

async function json(route: Route, body: unknown) {
  await route.fulfill({
    status: 200,
    contentType: 'application/json; charset=utf-8',
    body: JSON.stringify(body)
  });
}
