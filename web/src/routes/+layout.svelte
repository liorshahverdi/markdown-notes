<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import '../app.css';
	import VoiceButton from '$lib/components/VoiceButton.svelte';
	import SettingsPanel from '$lib/components/SettingsPanel.svelte';
	import { ollamaStatus, ragConfig } from '$lib/stores/rag';
	import { chatOpen } from '$lib/stores/chat';
	import { currentUser, logout } from '$lib/stores/user';
	import { proxyCheckHealth } from '$lib/llm/ollamaProxy';
	import { createWakeWordDetector } from '$lib/voice/wakeWordDetector';
	import { loadVoicePreferences } from '$lib/voice/voicePreferences';
	import { experimentalNavItems, primaryNavItems } from '$lib/navigation/navItems';
	import { get } from 'svelte/store';
	import { page } from '$app/stores';

	let { children, data } = $props();
	let darkMode = $state(false);
	let settingsOpen = $state(false);
	let healthInterval: ReturnType<typeof setInterval> | undefined;
	let wakeWordDetector: ReturnType<typeof createWakeWordDetector> | null = null;

	// Initialize user store from server data
	$effect(() => {
		if (data?.user) {
			currentUser.set(data.user);
		}
	});

	async function checkHealth() {
		const config = get(ragConfig);
		ollamaStatus.set('checking');
		const ok = await proxyCheckHealth(config.ollamaUrl);
		ollamaStatus.set(ok ? 'connected' : 'disconnected');
	}

	/** Read persisted theme from localStorage and apply immediately. */
	function restoreTheme() {
		try {
			const saved = localStorage.getItem('app-settings');
			if (saved) {
				const s = JSON.parse(saved);
				const theme: string = s.theme ?? 'system';
				const root = document.documentElement;
				root.classList.remove('dark');
				if (theme === 'dark') {
					root.classList.add('dark');
					darkMode = true;
				} else if (theme === 'system') {
					if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
						root.classList.add('dark');
						darkMode = true;
					}
				}
				// Also restore font size
				if (s.fontSize) {
					root.style.setProperty('--app-font-size', `${s.fontSize}px`);
				}
			}
		} catch {
			// ignore parse errors
		}
	}

	onMount(() => {
		restoreTheme();

		if (!isLoginPage) {
			checkHealth();
			healthInterval = setInterval(checkHealth, 30_000);

			// Initialize wake word detector if enabled in voice settings
			try {
				const voicePrefs = loadVoicePreferences();
				if (voicePrefs.activationMode === 'always-listening') {
					wakeWordDetector = createWakeWordDetector({
						wakePhrase: voicePrefs.wakePhrase || 'Hey Notes',
						onWakeWord() {
							chatOpen.update((v) => !v || v); // open chat panel
							chatOpen.set(true);
						},
					});
					wakeWordDetector.start();
				}
			} catch {
				// Wake word not supported in this browser
			}
		}
	});

	onDestroy(() => {
		if (healthInterval) clearInterval(healthInterval);
		wakeWordDetector?.stop();
	});

	function toggleDarkMode() {
		darkMode = !darkMode;
		if (darkMode) {
			document.documentElement.classList.add('dark');
		} else {
			document.documentElement.classList.remove('dark');
		}
		// Persist theme choice to localStorage
		try {
			const saved = localStorage.getItem('app-settings');
			const settings = saved ? JSON.parse(saved) : {};
			settings.theme = darkMode ? 'dark' : 'light';
			localStorage.setItem('app-settings', JSON.stringify(settings));
		} catch {}
	}

	let ollamaStatusClass = $derived(
		$ollamaStatus === 'connected'
			? 'is-connected'
			: $ollamaStatus === 'checking'
				? 'is-checking'
				: 'is-disconnected'
	);

	let ollamaStatusLabel = $derived(
		$ollamaStatus === 'connected' ? 'online' : $ollamaStatus === 'checking' ? 'checking' : 'offline'
	);

	let isLoginPage = $derived($page.url.pathname === '/login');
	let currentPath = $derived($page.url.pathname);
	let isActive = $derived((href: string) => (href === '/' ? currentPath === '/' : currentPath.startsWith(href)));
</script>

{#if isLoginPage}
	<div class="flex h-screen flex-col">
		{@render children()}
	</div>
{:else}
	<div class="app-shell flex h-screen flex-col">
		<nav class="app-nav">
			<div class="app-nav__left">
				<a href="/" class="brand" aria-label="MarkdownNotes — Home">
					<svg class="brand__mark" viewBox="0 0 32 32" aria-hidden="true">
						<defs>
							<linearGradient id="brandGradient" x1="0%" y1="0%" x2="100%" y2="100%">
								<stop offset="0%" stop-color="var(--brand-700)" />
								<stop offset="100%" stop-color="var(--brand-500)" />
							</linearGradient>
						</defs>
						<rect x="1" y="1" width="30" height="30" rx="8" fill="url(#brandGradient)" />
						<!-- knowledge graph nodes + edges -->
						<line x1="11" y1="11" x2="21" y2="11" stroke="rgba(255,255,255,0.55)" stroke-width="1.4" />
						<line x1="11" y1="11" x2="16" y2="22" stroke="rgba(255,255,255,0.55)" stroke-width="1.4" />
						<line x1="21" y1="11" x2="16" y2="22" stroke="rgba(255,255,255,0.55)" stroke-width="1.4" />
						<circle cx="11" cy="11" r="2.4" fill="#ffffff" />
						<circle cx="21" cy="11" r="2.4" fill="#f2ba33" />
						<circle cx="16" cy="22" r="2.4" fill="#29c7a6" />
					</svg>
					<span class="brand-wordmark">
						markdown<span class="accent">notes</span>
					</span>
				</a>

				<span class="hairline-v hidden md:block" style="height:18px"></span>

				<div class="app-nav__links" role="navigation">
					{#each primaryNavItems as item}
						<a href={item.href} class="navlink" class:is-active={isActive(item.href)}>{item.label}</a>
					{/each}
				</div>
			</div>

			<div class="app-nav__right">
				<div class="experimental-menu">
					<span class="experimental-menu__label">Experimental</span>
					{#each experimentalNavItems as item}
						<a href={item.href} class="experimental-menu__link" class:is-active={isActive(item.href)}>{item.label}</a>
					{/each}
				</div>

				<!-- Ollama status pill -->
				<div class="status-pill" title="Ollama: {$ollamaStatus}">
					<span class="status-dot {ollamaStatusClass}"></span>
					<span class="label-meta">ollama · {ollamaStatusLabel}</span>
				</div>

				{#if $currentUser}
					<span class="hairline-v" style="height:18px"></span>
					<span class="user-chip">
						<span class="user-chip__avatar" aria-hidden="true">
							{($currentUser.username || '?').slice(0, 1).toUpperCase()}
						</span>
						<span class="user-chip__name">{$currentUser.username}</span>
					</span>
					<button
						type="button"
						class="text-button"
						onclick={logout}
					>
						Sign out
					</button>
				{/if}

				<span class="hairline-v" style="height:18px"></span>

				<!-- Chat toggle -->
				<button
					type="button"
					class="icon-btn"
					class:is-active={$chatOpen}
					onclick={() => chatOpen.update((v) => !v)}
					aria-pressed={$chatOpen}
					aria-label="Toggle chat panel"
					title="Chat"
				>
					<svg xmlns="http://www.w3.org/2000/svg" class="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.6">
						<path stroke-linecap="round" stroke-linejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
					</svg>
				</button>

				<VoiceButton />

				<button
					type="button"
					class="icon-btn"
					onclick={() => (settingsOpen = true)}
					aria-label="Open settings"
					title="Settings"
				>
					<svg xmlns="http://www.w3.org/2000/svg" class="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.6">
						<path stroke-linecap="round" stroke-linejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
						<path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
					</svg>
				</button>

				<button
					type="button"
					class="icon-btn"
					onclick={toggleDarkMode}
					aria-label="Toggle dark mode"
					title={darkMode ? 'Light mode' : 'Dark mode'}
				>
					{#if darkMode}
						<svg xmlns="http://www.w3.org/2000/svg" class="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.6">
							<path stroke-linecap="round" stroke-linejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
						</svg>
					{:else}
						<svg xmlns="http://www.w3.org/2000/svg" class="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.6">
							<path stroke-linecap="round" stroke-linejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
						</svg>
					{/if}
				</button>
			</div>
		</nav>
		<div class="flex-1 overflow-hidden">
			{@render children()}
		</div>
	</div>

	<SettingsPanel open={settingsOpen} onClose={() => (settingsOpen = false)} />
{/if}

<style>
	.app-nav {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 10px 16px;
		background: color-mix(in oklab, var(--color-bg) 85%, transparent);
		border-bottom: 1px solid var(--color-border-subtle);
		backdrop-filter: saturate(140%) blur(8px);
		-webkit-backdrop-filter: saturate(140%) blur(8px);
	}

	.app-nav__left,
	.app-nav__right {
		display: flex;
		align-items: center;
		gap: 14px;
	}

	.app-nav__right {
		gap: 6px;
	}

	.brand {
		display: inline-flex;
		align-items: center;
		gap: 10px;
		text-decoration: none;
	}

	.brand__mark {
		width: 24px;
		height: 24px;
		flex-shrink: 0;
	}

	:global(.brand-wordmark) {
		font-size: 16px;
	}

	.app-nav__links {
		display: inline-flex;
		align-items: center;
		gap: 4px;
	}

	.navlink {
		position: relative;
		display: inline-flex;
		align-items: center;
		padding: 6px 10px;
		font-size: 13px;
		font-weight: 500;
		color: var(--color-text-secondary);
		text-decoration: none;
		border-radius: 6px;
		transition: color 120ms ease, background-color 120ms ease;
	}

	.navlink:hover {
		color: var(--color-text);
		background: var(--color-surface);
	}

	.navlink.is-active {
		color: var(--color-text);
	}

	.navlink.is-active::after {
		content: '';
		position: absolute;
		left: 10px;
		right: 10px;
		bottom: -11px;
		height: 2px;
		background: var(--brand-600);
		border-radius: 2px 2px 0 0;
	}

	:global(.dark) .navlink.is-active::after {
		background: var(--brand-500);
	}

	.experimental-menu {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 3px 6px;
		border-radius: 999px;
		background: var(--color-surface);
		border: 1px dashed var(--color-border-subtle);
	}

	.experimental-menu__label {
		font-size: 11px;
		font-weight: 600;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--color-text-tertiary);
	}

	.experimental-menu__link {
		padding: 3px 7px;
		border-radius: 999px;
		font-size: 12px;
		font-weight: 500;
		color: var(--color-text-secondary);
		text-decoration: none;
	}

	.experimental-menu__link:hover,
	.experimental-menu__link.is-active {
		color: var(--color-text);
		background: var(--color-bg);
	}

	.status-pill {
		display: inline-flex;
		align-items: center;
		gap: 7px;
		padding: 4px 9px;
		border-radius: 999px;
		background: var(--color-surface);
		border: 1px solid var(--color-border-subtle);
	}

	.user-chip {
		display: inline-flex;
		align-items: center;
		gap: 7px;
		padding: 2px 4px 2px 2px;
	}

	.user-chip__avatar {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 22px;
		height: 22px;
		border-radius: 6px;
		background: var(--brand-tint-strong);
		color: var(--brand-700);
		font-size: 11px;
		font-weight: 600;
		font-family: var(--font-mono);
	}

	:global(.dark) .user-chip__avatar {
		color: var(--brand-500);
	}

	.user-chip__name {
		font-size: 13px;
		color: var(--color-text);
		font-weight: 500;
	}

	.text-button {
		padding: 4px 8px;
		font-size: 12px;
		color: var(--color-text-secondary);
		background: transparent;
		border: 1px solid transparent;
		border-radius: 6px;
		transition: background-color 120ms ease, color 120ms ease, border-color 120ms ease;
	}

	.text-button:hover {
		color: var(--color-text);
		background: var(--color-surface);
		border-color: var(--color-border-subtle);
	}
</style>
