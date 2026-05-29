<script lang="ts">
  // "The Desk" route — the proactive chief-of-staff home. Mounts the
  // self-contained RebornDeskPanel (the "Needs you" approval-gate inbox today;
  // the "while you were away" feed, open-loop commitments, and standing
  // routines land in following increments). The panel binds to the app-wide
  // RebornDesk singleton, so this route is a thin full-height wrapper.
  import RebornDeskPanel from '$lib/components/RebornDeskPanel.svelte';
</script>

<svelte:head>
  <title>The Desk · IronClaw</title>
</svelte:head>

<div class="h-full min-h-0">
  <RebornDeskPanel />
</div>
