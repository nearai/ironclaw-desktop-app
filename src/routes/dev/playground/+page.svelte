<script lang="ts">
  // Component playground (dev-only). Storybook-lite: each component in
  // src/lib/components/ has a sibling .story.svelte that owns its own
  // preview + controls + code snippet. The shell renders the sidebar
  // list and mounts whichever story is active.
  //
  // Gating:
  //   - `import.meta.env.DEV` is true under `vite dev` and false in
  //     production builds. On mount we check the flag; non-DEV visitors
  //     are redirected to / with a toast. The Command Palette gates its
  //     own action on the same flag so the entry point isn't even
  //     surfaced in production.
  //   - The static adapter still ships the route in `build/dev/...` but
  //     the runtime redirect means nobody can land on it. We accept the
  //     ~few-KB cost in exchange for keeping the build pipeline
  //     unchanged (no dynamic include/exclude in svelte.config.js).
  //
  // The active story is keyed by URL hash so a bookmark like
  // `/dev/playground#sparkline` lands on the right story. Bidirectional:
  // selecting a story in the sidebar updates the hash.

  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { toasts } from '$lib/stores/toasts.svelte';

  import PlaygroundShell, { type StoryEntry } from './PlaygroundShell.svelte';

  // Story imports. Each .story.svelte module exports `meta` and the
  // default Svelte component. We collate them into a single registry
  // here so the shell stays component-agnostic.
  import IconStory, { meta as iconMeta } from './stories/Icon.story.svelte';
  import MaskedValueStory, { meta as maskedValueMeta } from './stories/MaskedValue.story.svelte';
  import SparklineStory, { meta as sparklineMeta } from './stories/Sparkline.story.svelte';
  import ToastsStory, { meta as toastsMeta } from './stories/Toasts.story.svelte';
  import MarkdownViewStory, { meta as markdownViewMeta } from './stories/MarkdownView.story.svelte';
  import CronPreviewStory, { meta as cronPreviewMeta } from './stories/CronPreview.story.svelte';
  import NewProfileModalStory, {
    meta as newProfileModalMeta
  } from './stories/NewProfileModal.story.svelte';
  import LightboxModalStory, {
    meta as lightboxModalMeta
  } from './stories/LightboxModal.story.svelte';
  import AboutDialogStory, { meta as aboutDialogMeta } from './stories/AboutDialog.story.svelte';
  import PresetsModalStory, { meta as presetsModalMeta } from './stories/PresetsModal.story.svelte';
  import TokenSourceBadgeStory, {
    meta as tokenSourceBadgeMeta
  } from './stories/TokenSourceBadge.story.svelte';

  // Registry. Order here is the order in the sidebar. Ids are stable
  // slugs used in the URL hash.
  const STORIES: StoryEntry[] = [
    { id: 'icon', title: iconMeta.title, description: iconMeta.description, Story: IconStory },
    {
      id: 'masked-value',
      title: maskedValueMeta.title,
      description: maskedValueMeta.description,
      Story: MaskedValueStory
    },
    {
      id: 'sparkline',
      title: sparklineMeta.title,
      description: sparklineMeta.description,
      Story: SparklineStory
    },
    {
      id: 'toasts',
      title: toastsMeta.title,
      description: toastsMeta.description,
      Story: ToastsStory
    },
    {
      id: 'markdown-view',
      title: markdownViewMeta.title,
      description: markdownViewMeta.description,
      Story: MarkdownViewStory
    },
    {
      id: 'cron-preview',
      title: cronPreviewMeta.title,
      description: cronPreviewMeta.description,
      Story: CronPreviewStory
    },
    {
      id: 'new-profile-modal',
      title: newProfileModalMeta.title,
      description: newProfileModalMeta.description,
      Story: NewProfileModalStory
    },
    {
      id: 'lightbox-modal',
      title: lightboxModalMeta.title,
      description: lightboxModalMeta.description,
      Story: LightboxModalStory
    },
    {
      id: 'about-dialog',
      title: aboutDialogMeta.title,
      description: aboutDialogMeta.description,
      Story: AboutDialogStory
    },
    {
      id: 'presets-modal',
      title: presetsModalMeta.title,
      description: presetsModalMeta.description,
      Story: PresetsModalStory
    },
    {
      id: 'token-source-badge',
      title: tokenSourceBadgeMeta.title,
      description: tokenSourceBadgeMeta.description,
      Story: TokenSourceBadgeStory
    }
  ];

  // Active id lives in state and is synced bidirectionally with the URL
  // hash. The default falls through to the first story when the hash is
  // empty or matches no registered id.
  let activeId = $state<string>(STORIES[0].id);
  let allowed = $state<boolean>(false);

  function readHash(): string {
    if (typeof window === 'undefined') return '';
    return window.location.hash.replace(/^#/, '') || '';
  }

  function pickInitialId(): string {
    const hash = readHash();
    if (hash && STORIES.some((s) => s.id === hash)) return hash;
    return STORIES[0].id;
  }

  function onSelect(id: string): void {
    activeId = id;
    if (typeof window !== 'undefined') {
      // history.replaceState avoids polluting the back stack while
      // navigating between stories. The hash is the source of truth for
      // deep links.
      try {
        history.replaceState(null, '', `#${id}`);
      } catch {
        // ignore — replaceState can throw in sandboxed contexts.
      }
    }
  }

  // Listen for back/forward navigation so the sidebar selection follows
  // the URL hash.
  function onHashChange() {
    const next = readHash();
    if (next && STORIES.some((s) => s.id === next)) activeId = next;
  }

  onMount(() => {
    // Dev-mode guard. Vite's `import.meta.env.DEV` is true under `vite
    // dev` and false in production builds. A redirect + toast is the
    // simplest contract: non-DEV visitors land on / with a visible hint
    // rather than an unexplained empty screen.
    if (!import.meta.env.DEV) {
      toasts.show('Playground is dev-only.', 'info');
      void goto('/');
      return;
    }
    allowed = true;
    activeId = pickInitialId();
    window.addEventListener('hashchange', onHashChange);
    return () => {
      window.removeEventListener('hashchange', onHashChange);
    };
  });
</script>

<svelte:head>
  <title>Component playground — IronClaw Desktop (dev)</title>
</svelte:head>

{#if allowed}
  <PlaygroundShell stories={STORIES} {activeId} {onSelect} />
{:else}
  <!-- Brief blank state while the dev-mode check runs. The redirect path
       fires synchronously inside onMount so this rarely paints. -->
  <div
    class="h-screen w-screen flex items-center justify-center bg-bg-base text-text-muted text-sm"
  >
    Checking dev mode…
  </div>
{/if}
