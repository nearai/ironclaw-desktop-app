import type { WorkItem, WorkItemApprovalBoundary } from '$lib/data/work-item';

export type ApprovalActionKind = WorkItemApprovalBoundary['kind'];

export type DispatchFamily =
  | 'send'
  | 'agent-dispatch'
  | 'workspace-write'
  | 'filesystem-export'
  | 'secret'
  | 'automation'
  | 'connector-lifecycle'
  | 'admin-policy'
  | 'job-control'
  | 'local-execution'
  | 'market-action';

export type DispatchInsertionMode =
  | 'wrap-store-method'
  | 'wrap-client-method'
  | 'wrap-ipc-helper'
  | 'route-before-call'
  | 'backend-gate'
  | 'no-direct-client-path';

export type DispatchInventoryEntry = {
  id: string;
  family: DispatchFamily;
  actionKind: ApprovalActionKind;
  dispatch: {
    file: string;
    symbol: string;
    lineHint: number;
  };
  callers: Array<{
    file: string;
    symbol: string;
    lineHint: number;
  }>;
  insertion: {
    mode: DispatchInsertionMode;
    file: string;
    symbol: string;
    lineHint: number;
  };
  currentProtection: string[];
  nextPatch: string;
};

export type ApprovalCheckInput = {
  kind: ApprovalActionKind;
  workItem?: Pick<WorkItem, 'id' | 'approvalBoundaries'> | null;
  boundaryId?: string;
};

export type ApprovalCheckResult =
  | {
      allowed: true;
      boundary: WorkItemApprovalBoundary;
    }
  | {
      allowed: false;
      reason:
        | 'approval-not-required'
        | 'missing-work-item'
        | 'missing-boundary'
        | 'pending'
        | 'denied';
      boundary?: WorkItemApprovalBoundary;
    };

export const APPROVAL_REQUIRED_KINDS = [
  'send',
  'trade',
  'push',
  'pr',
  'export',
  'delete',
  'write'
] as const satisfies readonly ApprovalActionKind[];

const APPROVAL_REQUIRED_KIND_SET = new Set<ApprovalActionKind>(APPROVAL_REQUIRED_KINDS);

export const APPROVAL_ENFORCEMENT_INVENTORY = [
  {
    id: 'reborn-chat-message-send',
    family: 'send',
    actionKind: 'send',
    dispatch: {
      file: 'src/lib/api/ironclaw.ts',
      symbol: 'IronClawClient.sendMessageV2',
      lineHint: 3486
    },
    callers: [
      {
        file: 'src/lib/stores/reborn-chat.svelte.ts',
        symbol: 'RebornChatController.send',
        lineHint: 184
      }
    ],
    insertion: {
      mode: 'wrap-store-method',
      file: 'src/lib/stores/reborn-chat.svelte.ts',
      symbol: 'RebornChatController.send',
      lineHint: 150
    },
    currentProtection: ['Gateway may emit a Reborn gate after dispatch.'],
    nextPatch:
      'Before optimistic append and sendMessageV2, require a routed Work Item or explicit chat_allowed decision; risky sends must create a pending send boundary and not dispatch.'
  },
  {
    id: 'legacy-chat-message-send',
    family: 'send',
    actionKind: 'send',
    dispatch: {
      file: 'src/lib/api/ironclaw.ts',
      symbol: 'IronClawClient.sendMessage',
      lineHint: 428
    },
    callers: [
      {
        file: 'src/routes/chat/+page.svelte',
        symbol: 'onSend',
        lineHint: 1597
      },
      {
        file: 'src/lib/components/QuickCapture.svelte',
        symbol: 'send',
        lineHint: 134
      },
      {
        file: 'src/lib/stores/council.svelte.ts',
        symbol: 'promoteToThread',
        lineHint: 372
      }
    ],
    insertion: {
      mode: 'route-before-call',
      file: 'src/routes/chat/+page.svelte',
      symbol: 'routeLegacyMessageThroughWork',
      lineHint: 1638
    },
    currentProtection: [
      'The legacy /chat composer routes risky asks through Work before optimistic append or /api/chat/send.'
    ],
    nextPatch:
      'Move Quick Capture and Council promotion onto the same approval-aware send facade so remaining sendMessage callers cannot drift separately.'
  },
  {
    id: 'reply-thread-send',
    family: 'send',
    actionKind: 'send',
    dispatch: {
      file: 'src/lib/api/ironclaw.ts',
      symbol: 'IronClawClient.postReplyThread',
      lineHint: 476
    },
    callers: [
      {
        file: 'src/lib/stores/reply-threads.svelte.ts',
        symbol: 'ReplyThreadsStore.send',
        lineHint: 43
      }
    ],
    insertion: {
      mode: 'wrap-store-method',
      file: 'src/lib/stores/reply-threads.svelte.ts',
      symbol: 'ReplyThreadsStore.send',
      lineHint: 35
    },
    currentProtection: ['Optimistic local reply is appended before the gateway call.'],
    nextPatch:
      'Move approval check ahead of optimistic append; blocked replies should create or reference a Work Item receipt instead of drawing as sent.'
  },
  {
    id: 'sub-agent-task-dispatch',
    family: 'agent-dispatch',
    actionKind: 'other',
    dispatch: {
      file: 'src/lib/api/ironclaw.ts',
      symbol: 'IronClawClient.dispatchSubAgent',
      lineHint: 4102
    },
    callers: [
      {
        file: 'src/lib/stores/sub-agents.svelte.ts',
        symbol: 'SubAgentsStore.dispatch',
        lineHint: 38
      },
      {
        file: 'src/routes/canvas/+page.svelte',
        symbol: 'runAsk',
        lineHint: 115
      }
    ],
    insertion: {
      mode: 'wrap-store-method',
      file: 'src/lib/stores/sub-agents.svelte.ts',
      symbol: 'SubAgentsStore.dispatch',
      lineHint: 34
    },
    currentProtection: ['Gateway 404/405 disables unsupported sub-agents.'],
    nextPatch:
      'Require the prompt to route through Work first; if the planned work contains send/write/export/push/trade/delete boundaries, block dispatch until those boundaries are approved.'
  },
  {
    id: 'memory-document-write',
    family: 'workspace-write',
    actionKind: 'write',
    dispatch: {
      file: 'src/lib/api/ironclaw.ts',
      symbol: 'IronClawClient.writeMemory',
      lineHint: 1120
    },
    callers: [
      { file: 'src/routes/memory/+page.svelte', symbol: 'saveEdit', lineHint: 260 },
      { file: 'src/routes/memory/+page.svelte', symbol: 'createMemory', lineHint: 324 },
      { file: 'src/routes/knowledge/+page.svelte', symbol: 'saveSelectedDoc', lineHint: 604 },
      { file: 'src/routes/knowledge/+page.svelte', symbol: 'createDoc', lineHint: 656 },
      { file: 'src/routes/knowledge/+page.svelte', symbol: 'bulkImport', lineHint: 844 }
    ],
    insertion: {
      mode: 'wrap-client-method',
      file: 'src/lib/api/ironclaw.ts',
      symbol: 'IronClawClient.writeMemory',
      lineHint: 1120
    },
    currentProtection: ['Path validation exists in the calling routes.'],
    nextPatch:
      'Gate writes that originate from agentic work; keep manual user-authored saves allowed only when the caller marks them as direct-user edits.'
  },
  {
    id: 'memory-document-delete',
    family: 'workspace-write',
    actionKind: 'delete',
    dispatch: {
      file: 'src/lib/api/ironclaw.ts',
      symbol: 'IronClawClient.deleteMemory',
      lineHint: 1146
    },
    callers: [{ file: 'src/routes/memory/+page.svelte', symbol: 'confirmDelete', lineHint: 300 }],
    insertion: {
      mode: 'wrap-client-method',
      file: 'src/lib/api/ironclaw.ts',
      symbol: 'IronClawClient.deleteMemory',
      lineHint: 1146
    },
    currentProtection: ['Two-click confirmation in the Memory route; gateway currently 404s.'],
    nextPatch:
      'When the gateway supports delete, require an approved delete boundary for agent-origin deletes and preserve two-click confirmation for manual deletes.'
  },
  {
    id: 'extension-install-activate-setup',
    family: 'connector-lifecycle',
    actionKind: 'write',
    dispatch: {
      file: 'src/lib/api/ironclaw.ts',
      symbol: 'installExtension/activateExtension/submitExtensionSetup/startExtensionLogin',
      lineHint: 2060
    },
    callers: [
      { file: 'src/routes/extensions/+page.svelte', symbol: 'handleInstall', lineHint: 529 },
      { file: 'src/routes/extensions/+page.svelte', symbol: 'handleToggleActivate', lineHint: 565 },
      { file: 'src/routes/extensions/SetupDrawer.svelte', symbol: 'handleSubmit', lineHint: 186 },
      { file: 'src/routes/extensions/SetupDrawer.svelte', symbol: 'beginLogin', lineHint: 250 }
    ],
    insertion: {
      mode: 'route-before-call',
      file: 'src/routes/extensions/+page.svelte',
      symbol: 'handleInstall/handleToggleActivate',
      lineHint: 523
    },
    currentProtection: ['Visible user clicks and setup form submission.'],
    nextPatch:
      'Leave direct user connector setup manual, but require approval when an agent/workflow attempts connector lifecycle changes.'
  },
  {
    id: 'extension-remove',
    family: 'connector-lifecycle',
    actionKind: 'delete',
    dispatch: {
      file: 'src/lib/api/ironclaw.ts',
      symbol: 'IronClawClient.removeExtension',
      lineHint: 2081
    },
    callers: [
      { file: 'src/routes/extensions/+page.svelte', symbol: 'handleRemove', lineHint: 601 }
    ],
    insertion: {
      mode: 'route-before-call',
      file: 'src/routes/extensions/+page.svelte',
      symbol: 'handleRemove',
      lineHint: 585
    },
    currentProtection: ['ConfirmDialog.ask requires a second explicit user confirmation.'],
    nextPatch:
      'Keep manual remove confirmation; require an approved delete boundary for any non-manual extension removal path.'
  },
  {
    id: 'routine-trigger-or-toggle',
    family: 'automation',
    actionKind: 'write',
    dispatch: {
      file: 'src/lib/api/ironclaw.ts',
      symbol: 'triggerRoutine/toggleRoutine/createRoutine',
      lineHint: 1343
    },
    callers: [
      { file: 'src/routes/routines/+page.svelte', symbol: 'onToggleEnabled', lineHint: 520 },
      { file: 'src/routes/routines/+page.svelte', symbol: 'onTrigger', lineHint: 543 }
    ],
    insertion: {
      mode: 'wrap-client-method',
      file: 'src/lib/api/ironclaw.ts',
      symbol: 'triggerRoutine/toggleRoutine/createRoutine',
      lineHint: 1343
    },
    currentProtection: ['Manual clicks only; no Work Item boundary checked.'],
    nextPatch:
      'Gate workflow-created or workflow-triggered routines; direct manual toggles can carry an explicit direct-user bypass marker.'
  },
  {
    id: 'job-cancel-or-restart',
    family: 'job-control',
    actionKind: 'write',
    dispatch: {
      file: 'src/lib/api/ironclaw.ts',
      symbol: 'cancelJob/restartJob',
      lineHint: 1565
    },
    callers: [
      { file: 'src/routes/jobs/+page.svelte', symbol: 'onCancel/onRestart', lineHint: 306 },
      { file: 'src/routes/jobs/JobDetailPanel.svelte', symbol: 'onCancel/onRestart', lineHint: 176 }
    ],
    insertion: {
      mode: 'wrap-client-method',
      file: 'src/lib/api/ironclaw.ts',
      symbol: 'cancelJob/restartJob',
      lineHint: 1565
    },
    currentProtection: ['Manual buttons only.'],
    nextPatch:
      'Treat scheduler or agent-origin job restarts as write boundaries; direct user cancel/restart can remain a manual action with confirmation if destructive.'
  },
  {
    id: 'skill-install',
    family: 'workspace-write',
    actionKind: 'write',
    dispatch: {
      file: 'src/lib/api/ironclaw.ts',
      symbol: 'IronClawClient.installSkill',
      lineHint: 1265
    },
    callers: [
      { file: 'src/routes/skills/ironhub/+page.svelte', symbol: 'installGateway', lineHint: 187 }
    ],
    insertion: {
      mode: 'wrap-client-method',
      file: 'src/lib/api/ironclaw.ts',
      symbol: 'IronClawClient.installSkill',
      lineHint: 1265
    },
    currentProtection: ['Gateway requires X-Confirm-Action header.'],
    nextPatch:
      'Only emit X-Confirm-Action after a direct click or an approved Work Item write boundary.'
  },
  {
    id: 'admin-policy-or-system-prompt-write',
    family: 'admin-policy',
    actionKind: 'write',
    dispatch: {
      file: 'src/lib/api/ironclaw.ts',
      symbol: 'setToolPolicy/setSystemPrompt/setToolPermission',
      lineHint: 2317
    },
    callers: [
      { file: 'src/routes/admin/ToolPolicyEditor.svelte', symbol: 'save', lineHint: 392 },
      { file: 'src/routes/admin/SystemPromptEditor.svelte', symbol: 'save', lineHint: 209 }
    ],
    insertion: {
      mode: 'wrap-client-method',
      file: 'src/lib/api/ironclaw.ts',
      symbol: 'setToolPolicy/setSystemPrompt/setToolPermission',
      lineHint: 2317
    },
    currentProtection: ['Admin surface access depends on gateway auth.'],
    nextPatch:
      'Require an approved write boundary for agent-origin admin changes; preserve normal admin editor saves as direct-user edits.'
  },
  {
    id: 'api-token-create-or-revoke',
    family: 'secret',
    actionKind: 'write',
    dispatch: {
      file: 'src/lib/api/ironclaw.ts',
      symbol: 'createUserToken/revokeUserToken',
      lineHint: 3413
    },
    callers: [
      { file: 'src/routes/settings/+page.svelte', symbol: 'onCreateToken', lineHint: 1560 },
      { file: 'src/routes/settings/+page.svelte', symbol: 'onConfirmRevoke', lineHint: 1622 }
    ],
    insertion: {
      mode: 'route-before-call',
      file: 'src/routes/settings/+page.svelte',
      symbol: 'onCreateToken/onConfirmRevoke',
      lineHint: 1552
    },
    currentProtection: ['Create/revoke are modal user actions; created token is displayed once.'],
    nextPatch:
      'Do not allow autonomous token creation; token revoke is a delete boundary when agent-origin.'
  },
  {
    id: 'secret-storage-write-or-delete',
    family: 'secret',
    actionKind: 'write',
    dispatch: {
      file: 'src/lib/stores/settings.svelte.ts',
      symbol: 'setToken/deleteToken/setLlmProviderCredential/deleteLlmProviderCredential',
      lineHint: 808
    },
    callers: [{ file: 'src/routes/settings/+page.svelte', symbol: 'settings forms', lineHint: 1 }],
    insertion: {
      mode: 'wrap-ipc-helper',
      file: 'src/lib/stores/settings.svelte.ts',
      symbol: 'credential IPC helpers',
      lineHint: 808
    },
    currentProtection: [
      'Settings forms are manual; native side stores credentials in Keychain/file fallback.'
    ],
    nextPatch:
      'Keep credentials as manual-only; block any agent-origin write/delete unless the user is inside the settings form flow.'
  },
  {
    id: 'thread-or-log-file-export',
    family: 'filesystem-export',
    actionKind: 'export',
    dispatch: {
      file: 'src/lib/api/files.ts',
      symbol: 'saveTextDialog',
      lineHint: 38
    },
    callers: [
      { file: 'src/routes/+page.svelte', symbol: 'exportCurrentThread', lineHint: 2250 },
      {
        file: 'src/routes/settings/+page.svelte',
        symbol: 'exportAllConversations',
        lineHint: 1114
      },
      { file: 'src/routes/logs/+page.svelte', symbol: 'downloadLog', lineHint: 588 }
    ],
    insertion: {
      mode: 'wrap-ipc-helper',
      file: 'src/lib/api/files.ts',
      symbol: 'saveTextDialog',
      lineHint: 38
    },
    currentProtection: ['Native save sheet gives the user final path control.'],
    nextPatch:
      'Require approval for workflow-origin exports before opening the save sheet; manual export buttons can mark direct-user intent.'
  },
  {
    id: 'settings-export-or-import',
    family: 'filesystem-export',
    actionKind: 'export',
    dispatch: {
      file: 'src/lib/api/files.ts',
      symbol: 'exportSettings/importSettings',
      lineHint: 63
    },
    callers: [
      { file: 'src/routes/settings/+page.svelte', symbol: 'onExportSettings', lineHint: 810 },
      { file: 'src/routes/settings/+page.svelte', symbol: 'onImportSettings', lineHint: 834 }
    ],
    insertion: {
      mode: 'wrap-ipc-helper',
      file: 'src/lib/api/files.ts',
      symbol: 'exportSettings/importSettings',
      lineHint: 63
    },
    currentProtection: ['Native open/save sheets; import validation lives in settings store.'],
    nextPatch:
      'Treat import as write and export as export for workflow-origin calls; direct settings UI remains manual.'
  },
  {
    id: 'memory-tree-or-notes-export',
    family: 'filesystem-export',
    actionKind: 'export',
    dispatch: {
      file: 'src/lib/api/files.ts',
      symbol: 'exportMemoryTree/exportToNotes',
      lineHint: 271
    },
    callers: [
      { file: 'src/routes/memory/+page.svelte', symbol: 'onExportToFinder', lineHint: 372 }
    ],
    insertion: {
      mode: 'wrap-ipc-helper',
      file: 'src/lib/api/files.ts',
      symbol: 'exportMemoryTree/exportToNotes',
      lineHint: 271
    },
    currentProtection: ['Manual export button; desktop-only IPC.'],
    nextPatch:
      'Require an approved export boundary when a Work Item asks to export memory or write to Apple Notes.'
  },
  {
    id: 'python-snippet-local-exec',
    family: 'local-execution',
    actionKind: 'other',
    dispatch: {
      file: 'src/lib/components/markdown-renderers/PythonBlock.svelte',
      symbol: 'invoke(run_python_snippet)',
      lineHint: 41
    },
    callers: [
      {
        file: 'src/lib/components/markdown-renderers/PythonBlock.svelte',
        symbol: 'run',
        lineHint: 35
      }
    ],
    insertion: {
      mode: 'route-before-call',
      file: 'src/lib/components/markdown-renderers/PythonBlock.svelte',
      symbol: 'run',
      lineHint: 35
    },
    currentProtection: ['Rust command enforces timeout/output caps.'],
    nextPatch:
      'Local execution is not send/write/export by itself, but workflow-origin code execution should require a user click and never run automatically.'
  },
  {
    id: 'no-direct-push-client-path',
    family: 'market-action',
    actionKind: 'push',
    dispatch: {
      file: 'src/lib/api/ironclaw.ts',
      symbol: 'none',
      lineHint: 0
    },
    callers: [],
    insertion: {
      mode: 'no-direct-client-path',
      file: 'src/lib/util/workflow-orchestrator.ts',
      symbol: 'RISK_PATTERNS(push)',
      lineHint: 137
    },
    currentProtection: ['No desktop API method directly pushes branches or opens PRs.'],
    nextPatch:
      'Push/PR risk must be blocked at chat, sub-agent, routine, and tool-gate boundaries because it can only happen through the agent gateway.'
  },
  {
    id: 'no-direct-pr-client-path',
    family: 'market-action',
    actionKind: 'pr',
    dispatch: {
      file: 'src/lib/api/ironclaw.ts',
      symbol: 'none',
      lineHint: 0
    },
    callers: [],
    insertion: {
      mode: 'no-direct-client-path',
      file: 'src/lib/util/workflow-orchestrator.ts',
      symbol: 'RISK_PATTERNS(push/open PR)',
      lineHint: 137
    },
    currentProtection: ['No desktop API method directly opens pull requests.'],
    nextPatch:
      'PR risk must be blocked at the same gateway-agent boundaries as branch pushes because both happen through connected tools, not a desktop PR API.'
  },
  {
    id: 'no-direct-trade-client-path',
    family: 'market-action',
    actionKind: 'trade',
    dispatch: {
      file: 'src/lib/api/ironclaw.ts',
      symbol: 'none',
      lineHint: 0
    },
    callers: [],
    insertion: {
      mode: 'no-direct-client-path',
      file: 'src/lib/util/workflow-orchestrator.ts',
      symbol: 'RISK_PATTERNS(trade)',
      lineHint: 143
    },
    currentProtection: ['No desktop API method directly places trades or moves funds.'],
    nextPatch:
      'Trade risk must be blocked before agent dispatch; absence of a desktop trade API is not proof that a connected tool cannot trade.'
  }
] as const satisfies readonly DispatchInventoryEntry[];

export function requiresApproval(kind: ApprovalActionKind): boolean {
  return APPROVAL_REQUIRED_KIND_SET.has(kind);
}

export function inventoryByKind(kind: ApprovalActionKind): DispatchInventoryEntry[] {
  return APPROVAL_ENFORCEMENT_INVENTORY.filter((entry) => entry.actionKind === kind);
}

export function inventoryNeedingApproval(): DispatchInventoryEntry[] {
  return APPROVAL_ENFORCEMENT_INVENTORY.filter((entry) => requiresApproval(entry.actionKind));
}

export function evaluateApprovalBoundary(input: ApprovalCheckInput): ApprovalCheckResult {
  if (!requiresApproval(input.kind)) {
    return { allowed: false, reason: 'approval-not-required' };
  }

  const workItem = input.workItem ?? null;
  if (!workItem) {
    return { allowed: false, reason: 'missing-work-item' };
  }

  const boundary = workItem.approvalBoundaries.find((candidate) => {
    if (input.boundaryId) return candidate.id === input.boundaryId;
    return candidate.kind === input.kind;
  });

  if (!boundary) {
    return { allowed: false, reason: 'missing-boundary' };
  }

  if (boundary.status === 'approved') {
    return { allowed: true, boundary };
  }

  return {
    allowed: false,
    reason: boundary.status,
    boundary
  };
}
