<script lang="ts">
  import { currentUser } from '$lib/stores/user';

  let mode = $state<'login' | 'signup'>('login');
  let username = $state('');
  let password = $state('');
  let error = $state('');
  let loading = $state(false);

  async function handleSubmit() {
    error = '';
    loading = true;
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: mode, username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        error = data.error || 'Something went wrong';
        return;
      }
      currentUser.set(data.user);
      window.location.href = '/';
    } catch {
      error = 'Network error';
    } finally {
      loading = false;
    }
  }
</script>

<div class="login-shell">
  <div class="login-card">
    <div class="login-brand">
      <svg class="login-brand__mark" viewBox="0 0 32 32" aria-hidden="true">
        <defs>
          <linearGradient id="loginBrand" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="var(--brand-700)" />
            <stop offset="100%" stop-color="var(--brand-500)" />
          </linearGradient>
        </defs>
        <rect x="1" y="1" width="30" height="30" rx="8" fill="url(#loginBrand)" />
        <line x1="11" y1="11" x2="21" y2="11" stroke="rgba(255,255,255,0.55)" stroke-width="1.4" />
        <line x1="11" y1="11" x2="16" y2="22" stroke="rgba(255,255,255,0.55)" stroke-width="1.4" />
        <line x1="21" y1="11" x2="16" y2="22" stroke="rgba(255,255,255,0.55)" stroke-width="1.4" />
        <circle cx="11" cy="11" r="2.4" fill="#ffffff" />
        <circle cx="21" cy="11" r="2.4" fill="#f2ba33" />
        <circle cx="16" cy="22" r="2.4" fill="#29c7a6" />
      </svg>
      <h1 class="brand-wordmark login-brand__wordmark">
        markdown<span class="accent">notes</span>
      </h1>
      <p class="login-brand__tagline">A private, local-first notebook with a knowledge graph mind.</p>
    </div>

    <div class="login-tabs" role="tablist">
      <button
        type="button"
        class="login-tab"
        class:is-active={mode === 'login'}
        role="tab"
        aria-selected={mode === 'login'}
        onclick={() => { mode = 'login'; error = ''; }}
      >
        Sign in
      </button>
      <button
        type="button"
        class="login-tab"
        class:is-active={mode === 'signup'}
        role="tab"
        aria-selected={mode === 'signup'}
        onclick={() => { mode = 'signup'; error = ''; }}
      >
        Create account
      </button>
    </div>

    <form class="login-form" onsubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
      <label for="login-username" class="login-label">Username</label>
      <input
        id="login-username"
        type="text"
        class="login-input"
        bind:value={username}
        required
        autocomplete="username"
      />

      <label for="login-password" class="login-label">Password</label>
      <input
        id="login-password"
        type="password"
        class="login-input"
        bind:value={password}
        required
        autocomplete={mode === 'signup' ? 'new-password' : 'current-password'}
      />

      {#if error}
        <p class="login-error">{error}</p>
      {/if}

      <button type="submit" class="login-submit" disabled={loading}>
        {loading ? 'Working…' : mode === 'login' ? 'Sign in' : 'Create account'}
      </button>
    </form>

    <p class="login-foot">
      <span class="label-meta">runs locally · your notes stay yours</span>
    </p>
  </div>
</div>

<style>
  .login-shell {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    padding: 24px;
    background:
      radial-gradient(circle at 20% 10%, var(--brand-tint) 0%, transparent 45%),
      radial-gradient(circle at 80% 90%, var(--brand-tint) 0%, transparent 50%),
      var(--color-bg);
  }

  .login-card {
    width: 100%;
    max-width: 380px;
    padding: 32px;
    background: var(--color-surface-raised);
    border: 1px solid var(--color-border-subtle);
    border-radius: 12px;
    box-shadow: var(--shadow-3);
  }

  :global(.dark) .login-card {
    background: var(--color-surface);
  }

  .login-brand {
    text-align: center;
    margin-bottom: 24px;
  }

  .login-brand__mark {
    width: 44px;
    height: 44px;
    margin: 0 auto 14px;
    display: block;
  }

  .login-brand__wordmark {
    font-size: 24px;
    margin: 0;
  }

  .login-brand__tagline {
    margin: 8px 0 0;
    font-size: 13px;
    color: var(--color-text-tertiary);
    line-height: 1.5;
    max-width: 280px;
    margin-left: auto;
    margin-right: auto;
  }

  .login-tabs {
    display: flex;
    padding: 3px;
    margin-bottom: 20px;
    background: var(--color-surface);
    border: 1px solid var(--color-border-subtle);
    border-radius: 8px;
  }

  :global(.dark) .login-tabs {
    background: var(--color-surface-sunken);
  }

  .login-tab {
    flex: 1;
    padding: 7px 0;
    font-size: 12.5px;
    font-weight: 500;
    color: var(--color-text-secondary);
    background: transparent;
    border: 0;
    border-radius: 6px;
    cursor: pointer;
    transition: background-color 120ms ease, color 120ms ease, box-shadow 120ms ease;
  }

  .login-tab.is-active {
    background: var(--color-surface-raised);
    color: var(--color-text);
    box-shadow: var(--shadow-1);
  }

  :global(.dark) .login-tab.is-active {
    background: var(--color-surface-raised);
  }

  .login-form {
    display: flex;
    flex-direction: column;
  }

  .login-label {
    font-family: var(--font-mono);
    font-size: 10px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--color-text-tertiary);
    margin: 8px 0 6px;
  }

  .login-input {
    padding: 10px 12px;
    font-size: 14px;
    color: var(--color-text);
    background: var(--color-bg-grain);
    border: 1px solid var(--color-border-subtle);
    border-radius: 7px;
    transition: border-color 120ms ease, box-shadow 120ms ease;
  }

  :global(.dark) .login-input {
    background: var(--color-surface-sunken);
  }

  .login-input:focus {
    outline: none;
    border-color: var(--brand-500);
    box-shadow: 0 0 0 3px var(--brand-tint);
  }

  .login-error {
    margin: 10px 0 0;
    padding: 8px 10px;
    font-size: 12.5px;
    color: var(--color-danger);
    background: rgba(184, 54, 43, 0.08);
    border: 1px solid rgba(184, 54, 43, 0.2);
    border-radius: 6px;
  }

  .login-submit {
    margin-top: 18px;
    padding: 11px 16px;
    font-size: 13.5px;
    font-weight: 600;
    color: white;
    background: var(--brand-600);
    border: 1px solid var(--brand-700);
    border-radius: 8px;
    cursor: pointer;
    box-shadow: 0 1px 0 rgba(255, 255, 255, 0.18) inset, var(--shadow-1);
    transition: background-color 120ms ease, transform 80ms ease;
  }

  .login-submit:hover:not(:disabled) {
    background: var(--brand-700);
  }

  .login-submit:active:not(:disabled) {
    transform: translateY(1px);
  }

  .login-submit:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .login-foot {
    text-align: center;
    margin: 18px 0 0;
  }
</style>
