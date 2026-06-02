<div class="empty-state">
	<div class="empty-state__mark" aria-hidden="true">
		<svg viewBox="0 0 64 64">
			<defs>
				<linearGradient id="emptyGradient" x1="0%" y1="0%" x2="100%" y2="100%">
					<stop offset="0%" stop-color="var(--brand-700)" />
					<stop offset="100%" stop-color="var(--brand-500)" />
				</linearGradient>
			</defs>
			<circle cx="32" cy="32" r="28" fill="none" stroke="var(--color-border)" stroke-dasharray="2 4" />
			<line x1="22" y1="22" x2="44" y2="22" stroke="url(#emptyGradient)" stroke-width="1.5" stroke-linecap="round" />
			<line x1="22" y1="22" x2="32" y2="46" stroke="url(#emptyGradient)" stroke-width="1.5" stroke-linecap="round" />
			<line x1="44" y1="22" x2="32" y2="46" stroke="url(#emptyGradient)" stroke-width="1.5" stroke-linecap="round" />
			<circle cx="22" cy="22" r="4.5" fill="url(#emptyGradient)" />
			<circle cx="44" cy="22" r="4.5" fill="#f2ba33" />
			<circle cx="32" cy="46" r="4.5" fill="#29c7a6" />
		</svg>
	</div>

	<div class="empty-state__copy">
		<h2 class="empty-state__title">A blank page awaits.</h2>
		<p class="empty-state__sub">
			Select a note from your library, or compose a new one.<br />
			Each note becomes a node in your knowledge graph.
		</p>
	</div>

	<div class="empty-state__hints">
		<div class="empty-state__hint">
			<span class="kbd">⌘</span><span class="kbd">N</span>
			<span class="empty-state__hint-label">New note</span>
		</div>
		<div class="empty-state__hint">
			<span class="kbd">⌘</span><span class="kbd">⇧</span><span class="kbd">D</span>
			<span class="empty-state__hint-label">Dictate</span>
		</div>
	</div>
</div>

<style>
	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 100%;
		gap: 28px;
		padding: 32px;
		color: var(--color-text-secondary);
	}

	.empty-state__mark {
		width: 88px;
		height: 88px;
		opacity: 0.95;
	}

	.empty-state__mark svg {
		width: 100%;
		height: 100%;
	}

	.empty-state__copy {
		text-align: center;
		max-width: 420px;
	}

	.empty-state__title {
		font-family: var(--font-display);
		font-size: 26px;
		font-weight: 500;
		letter-spacing: -0.02em;
		color: var(--color-text);
		margin: 0 0 8px;
	}

	.empty-state__sub {
		font-size: 14px;
		line-height: 1.55;
		color: var(--color-text-tertiary);
		margin: 0;
	}

	.empty-state__hints {
		display: flex;
		gap: 20px;
		padding-top: 4px;
	}

	.empty-state__hint {
		display: inline-flex;
		align-items: center;
		gap: 6px;
	}

	.empty-state__hint-label {
		font-family: var(--font-mono);
		font-size: 10.5px;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--color-text-tertiary);
		margin-left: 4px;
	}
</style>
