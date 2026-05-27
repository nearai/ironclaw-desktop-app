<script lang="ts">
  import '../app.css';
  import Sidebar from '$lib/components/Sidebar.svelte';

  let { children } = $props();
</script>

<div class="flex h-screen w-screen overflow-hidden">
  <Sidebar />
  <main class="flex-1 overflow-auto pt-8">
    {@render children()}
  </main>
</div>
