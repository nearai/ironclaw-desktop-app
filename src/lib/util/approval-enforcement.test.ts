import { describe, expect, it } from 'vitest';
import type { WorkItemApprovalBoundary } from '$lib/data/work-item';
import {
  APPROVAL_ENFORCEMENT_INVENTORY,
  APPROVAL_REQUIRED_KINDS,
  evaluateApprovalBoundary,
  inventoryByKind,
  inventoryNeedingApproval,
  requiresApproval
} from './approval-enforcement';

function boundary(
  kind: WorkItemApprovalBoundary['kind'],
  status: WorkItemApprovalBoundary['status'],
  id = `${kind}-${status}`
): WorkItemApprovalBoundary {
  return {
    id,
    kind,
    status,
    action: `${kind} action`,
    payload: `${kind} payload`,
    reason: `${kind} reason`
  };
}

describe('approval enforcement inventory', () => {
  it('covers every approval-required kind, including indirect push/trade paths', () => {
    for (const kind of APPROVAL_REQUIRED_KINDS) {
      expect(inventoryByKind(kind), `${kind} has inventory entries`).not.toHaveLength(0);
    }
  });

  it('keeps inventory ids unique and actionable', () => {
    const ids = new Set<string>();
    for (const entry of APPROVAL_ENFORCEMENT_INVENTORY) {
      expect(ids.has(entry.id), `duplicate inventory id ${entry.id}`).toBe(false);
      ids.add(entry.id);
      expect(entry.dispatch.file).toBeTruthy();
      expect(entry.dispatch.symbol).toBeTruthy();
      expect(entry.insertion.file).toBeTruthy();
      expect(entry.insertion.symbol).toBeTruthy();
      expect(entry.nextPatch.trim().length).toBeGreaterThan(20);
    }
  });

  it('marks the current high-risk desktop dispatch families as approval-relevant', () => {
    const ids = new Set(inventoryNeedingApproval().map((entry) => entry.id));
    expect(ids.size).toBeGreaterThan(0);
    for (const id of [
      'reborn-chat-message-send',
      'legacy-chat-message-send',
      'reply-thread-send',
      'memory-document-write',
      'memory-document-delete',
      'extension-install-activate-setup',
      'extension-remove',
      'routine-trigger-or-toggle',
      'skill-install',
      'admin-policy-or-system-prompt-write',
      'api-token-create-or-revoke',
      'thread-or-log-file-export',
      'memory-tree-or-notes-export',
      'no-direct-push-client-path',
      'no-direct-pr-client-path',
      'no-direct-trade-client-path'
    ]) {
      expect(ids.has(id), `${id} is approval-relevant`).toBe(true);
    }
  });

  it('keeps the legacy chat entry pointed at the live /chat route gate', () => {
    const legacy = APPROVAL_ENFORCEMENT_INVENTORY.find(
      (entry) => entry.id === 'legacy-chat-message-send'
    );
    expect(legacy?.callers).toContainEqual(
      expect.objectContaining({ file: 'src/routes/chat/+page.svelte', symbol: 'onSend' })
    );
    expect(legacy?.insertion).toEqual(
      expect.objectContaining({
        mode: 'route-before-call',
        file: 'src/routes/chat/+page.svelte',
        symbol: 'routeLegacyMessageThroughWork'
      })
    );
  });
});

describe('evaluateApprovalBoundary', () => {
  it('does not require approval for non-risky other actions by default', () => {
    expect(requiresApproval('other')).toBe(false);
    expect(evaluateApprovalBoundary({ kind: 'other' })).toEqual({
      allowed: false,
      reason: 'approval-not-required'
    });
  });

  it('blocks risky dispatch without a Work Item', () => {
    expect(evaluateApprovalBoundary({ kind: 'send', workItem: null })).toEqual({
      allowed: false,
      reason: 'missing-work-item'
    });
  });

  it('blocks risky dispatch without a matching boundary', () => {
    expect(
      evaluateApprovalBoundary({
        kind: 'delete',
        workItem: { id: 'w1', approvalBoundaries: [boundary('send', 'approved')] }
      })
    ).toEqual({ allowed: false, reason: 'missing-boundary' });
  });

  it('blocks pending and denied matching boundaries', () => {
    const pending = boundary('export', 'pending');
    const denied = boundary('export', 'denied');
    expect(
      evaluateApprovalBoundary({
        kind: 'export',
        workItem: { id: 'w1', approvalBoundaries: [pending] }
      })
    ).toEqual({ allowed: false, reason: 'pending', boundary: pending });
    expect(
      evaluateApprovalBoundary({
        kind: 'export',
        workItem: { id: 'w1', approvalBoundaries: [denied] }
      })
    ).toEqual({ allowed: false, reason: 'denied', boundary: denied });
  });

  it('allows only an approved matching boundary', () => {
    const approved = boundary('write', 'approved', 'write-ok');
    expect(
      evaluateApprovalBoundary({
        kind: 'write',
        workItem: { id: 'w1', approvalBoundaries: [approved] }
      })
    ).toEqual({ allowed: true, boundary: approved });
  });

  it('honors explicit boundary ids so the wrong approved kind cannot satisfy another action', () => {
    const approvedSend = boundary('send', 'approved', 'send-ok');
    const pendingDelete = boundary('delete', 'pending', 'delete-pending');
    expect(
      evaluateApprovalBoundary({
        kind: 'delete',
        boundaryId: 'delete-pending',
        workItem: { id: 'w1', approvalBoundaries: [approvedSend, pendingDelete] }
      })
    ).toEqual({ allowed: false, reason: 'pending', boundary: pendingDelete });
  });
});
