<script lang="ts">
  export let label = "Widget";

  function firstAction() {
    return `${label}:first`;
  }

  function secondAction() {
    return `${label}:second`;
  }

  class WidgetController {
    reset() {
      return firstAction();
    }

    hydrate() {
      return secondAction();
    }
  }

  const controller = new WidgetController();
</script>

{#if label}
  <button on:click={() => controller.reset()}>{label}</button>
{:else}
  <p>missing label</p>
{/if}
