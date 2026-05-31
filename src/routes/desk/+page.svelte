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

<!-- Named region landmark: the Desk has no `<h1>` (its headings live inside
     RebornDeskPanel's card sections), so the surface root carries an
     accessible name for screen-reader navigation + the a11y sweep anchor. -->
<section class="h-full min-h-0" aria-label="The Desk">
  <RebornDeskPanel />
</section>
