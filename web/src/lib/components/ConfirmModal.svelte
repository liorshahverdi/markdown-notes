<script lang="ts">
  interface Props {
    open: boolean;
    title?: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    destructive?: boolean;
    onConfirm: () => void;
    onCancel: () => void;
    onUndo?: () => void;
  }

  let {
    open,
    title = 'Confirm',
    message,
    confirmLabel = 'Delete',
    cancelLabel = 'Cancel',
    destructive = true,
    onConfirm,
    onCancel,
    onUndo,
  }: Props = $props();

  let showUndoBanner = $state(false);
  let undoTimer: ReturnType<typeof setTimeout> | null = null;

  function handleConfirm() {
    onConfirm();
    if (onUndo) {
      showUndoBanner = true;
      undoTimer = setTimeout(() => {
        showUndoBanner = false;
      }, 5000);
    }
  }

  function handleUndo() {
    if (undoTimer) clearTimeout(undoTimer);
    showUndoBanner = false;
    onUndo?.();
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') onCancel();
  }
</script>

{#if open}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="fixed inset-0 z-50 flex items-center justify-center" onkeydown={handleKeydown}>
    <!-- Backdrop -->
    <button
      type="button"
      class="absolute inset-0 bg-black/40"
      onclick={onCancel}
      aria-label="Cancel confirmation"
    ></button>

    <!-- Modal -->
    <div
      class="relative z-10 w-full max-w-sm mx-4 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 p-6"
      role="dialog"
      aria-labelledby="confirm-title"
    >
      <h3 id="confirm-title" class="text-base font-semibold text-gray-900 dark:text-white mb-2">{title}</h3>
      <p class="text-sm text-gray-600 dark:text-gray-400 mb-5">{message}</p>
      <div class="flex justify-end gap-3">
        <button
          type="button"
          class="px-4 py-2 text-sm font-medium rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
          onclick={onCancel}
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          class="px-4 py-2 text-sm font-medium rounded-md text-white transition-colors {destructive
            ? 'bg-red-600 hover:bg-red-700'
            : 'bg-blue-600 hover:bg-blue-700'}"
          onclick={handleConfirm}
        >
          {confirmLabel}
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- Undo banner (shown after delete) -->
{#if showUndoBanner}
  <div class="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-lg bg-gray-900 dark:bg-gray-100 px-4 py-3 shadow-lg">
    <span class="text-sm text-white dark:text-gray-900">Item deleted</span>
    <button
      type="button"
      class="text-sm font-semibold text-blue-400 dark:text-blue-600 hover:text-blue-300 dark:hover:text-blue-700 transition-colors"
      onclick={handleUndo}
    >
      Undo
    </button>
  </div>
{/if}
