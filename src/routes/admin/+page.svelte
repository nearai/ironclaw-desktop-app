<script lang="ts">
  // /admin — admin-only surface for the active IronClaw profile.
  //
  // Two tabs: Tool Policy (per-tool 3-way allow/prompt/deny editor) and
  // System Prompt (admin-scoped SYSTEM.md). Both require the active
  // profile's bearer to carry the admin role; the gateway returns 401/403
  // otherwise and we surface a clear message instead of a stack trace.
  //
  // Visibility: this route is mounted unconditionally, but the sidebar
  // entry + Cmd+7 shortcut + a redirect-out guard in `+layout.svelte`
  // collectively gate it behind `settings.adminMode`. Reaching the URL
  // directly with adminMode off still bounces to /settings on next tick.

  import { connection } from '$lib/stores/connection.svelte';
  import ToolPolicyEditor from './ToolPolicyEditor.svelte';
  import SystemPromptEditor from './SystemPromptEditor.svelte';

  type Tab = 'tool-policy' | 'system-prompt';
  let activeTab = $state<Tab>('tool-policy');

  // The profile-name header mirrors what Settings shows so the admin
  // surface obviously inherits "whatever profile is active right now".
  // It's not a chooser — switching profiles still lives in the sidebar.
  const profileName = $derived(connection.activeProfile?.name ?? '—');
</script>

<section class="p-8 h-full flex flex-col overflow-hidden">
  <header class="mb-5 flex items-baseline justify-between gap-4">
    <div>
      <h1 class="text-2xl font-semibold text-text-primary">Admin</h1>
      <p class="text-text-muted text-sm mt-1">
        Multi-tenant gateway controls. Active profile:
        <span class="text-text-primary font-mono">{profileName}</span>.
      </p>
    </div>
  </header>

  <!-- Tabs. Matches the Extensions surface visual treatment so the user
       picks up the pattern across admin-flavored surfaces. -->
  <div class="mb-5 flex items-center gap-1 border-b border-border-subtle">
    <button
      type="button"
      onclick={() => (activeTab = 'tool-policy')}
      class="px-4 py-2 text-sm font-medium border-b-2 -mb-px transition"
      class:border-accent-cyan={activeTab === 'tool-policy'}
      class:text-accent-cyan={activeTab === 'tool-policy'}
      class:border-transparent={activeTab !== 'tool-policy'}
      class:text-text-muted={activeTab !== 'tool-policy'}
      class:hover:text-text-primary={activeTab !== 'tool-policy'}
    >
      Tool policy
    </button>
    <button
      type="button"
      onclick={() => (activeTab = 'system-prompt')}
      class="px-4 py-2 text-sm font-medium border-b-2 -mb-px transition"
      class:border-accent-cyan={activeTab === 'system-prompt'}
      class:text-accent-cyan={activeTab === 'system-prompt'}
      class:border-transparent={activeTab !== 'system-prompt'}
      class:text-text-muted={activeTab !== 'system-prompt'}
      class:hover:text-text-primary={activeTab !== 'system-prompt'}
    >
      System prompt
    </button>
  </div>

  <!-- Body. Both editors render full-height inside the flex container.
       Mounted via #if rather than just toggling visibility so each
       editor re-runs its load when the user re-enters the tab — that
       picks up server-side edits between visits without a manual refresh. -->
  {#if activeTab === 'tool-policy'}
    <ToolPolicyEditor />
  {:else}
    <SystemPromptEditor />
  {/if}
</section>
