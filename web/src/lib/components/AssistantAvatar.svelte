<script lang="ts">
	type AvatarState = 'idle' | 'listening' | 'thinking' | 'speaking';

	let { state = 'idle' }: { state: AvatarState } = $props();
</script>

<div class="assistant-avatar" data-state={state} aria-label="Assistant {state}">
	<svg viewBox="0 0 48 48" width="48" height="48" xmlns="http://www.w3.org/2000/svg">
		<!-- Outer ring -->
		<circle
			class="ring ring-outer"
			cx="24"
			cy="24"
			r="22"
			fill="none"
			stroke="currentColor"
			stroke-width="1"
			opacity="0.2"
		/>
		<!-- Middle ring -->
		<circle
			class="ring ring-middle"
			cx="24"
			cy="24"
			r="17"
			fill="none"
			stroke="currentColor"
			stroke-width="1.5"
			opacity="0.4"
		/>
		<!-- Inner ring -->
		<circle
			class="ring ring-inner"
			cx="24"
			cy="24"
			r="12"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			opacity="0.6"
		/>
		<!-- Core orb -->
		<circle class="orb" cx="24" cy="24" r="7" fill="currentColor" opacity="0.9" />
	</svg>
</div>

<style>
	.assistant-avatar {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		color: #6366f1;
		flex-shrink: 0;
	}

	/* Idle: slow gentle pulse */
	.assistant-avatar[data-state='idle'] .orb {
		animation: idle-pulse 3s ease-in-out infinite;
	}
	.assistant-avatar[data-state='idle'] .ring-outer {
		animation: idle-ring 4s ease-in-out infinite;
	}

	@keyframes idle-pulse {
		0%,
		100% {
			opacity: 0.7;
		}
		50% {
			opacity: 0.9;
		}
	}
	@keyframes idle-ring {
		0%,
		100% {
			opacity: 0.15;
		}
		50% {
			opacity: 0.25;
		}
	}

	/* Listening: rings expand */
	.assistant-avatar[data-state='listening'] .ring-outer {
		animation: listening-expand 1.2s ease-out infinite;
	}
	.assistant-avatar[data-state='listening'] .ring-middle {
		animation: listening-expand 1.2s ease-out infinite 0.2s;
	}
	.assistant-avatar[data-state='listening'] .ring-inner {
		animation: listening-expand 1.2s ease-out infinite 0.4s;
	}
	.assistant-avatar[data-state='listening'] .orb {
		animation: listening-orb 0.8s ease-in-out infinite;
	}

	@keyframes listening-expand {
		0% {
			transform-origin: center;
			transform: scale(1);
			opacity: 0.6;
		}
		100% {
			transform-origin: center;
			transform: scale(1.15);
			opacity: 0.1;
		}
	}
	@keyframes listening-orb {
		0%,
		100% {
			opacity: 0.9;
		}
		50% {
			opacity: 1;
		}
	}

	/* Thinking: rhythmic pulse */
	.assistant-avatar[data-state='thinking'] .orb {
		animation: thinking-pulse 0.8s ease-in-out infinite;
	}
	.assistant-avatar[data-state='thinking'] .ring-inner {
		animation: thinking-ring 0.8s ease-in-out infinite;
	}
	.assistant-avatar[data-state='thinking'] .ring-middle {
		animation: thinking-ring 0.8s ease-in-out infinite 0.15s;
	}
	.assistant-avatar[data-state='thinking'] .ring-outer {
		animation: thinking-ring 0.8s ease-in-out infinite 0.3s;
	}

	@keyframes thinking-pulse {
		0%,
		100% {
			opacity: 0.6;
			r: 7;
		}
		50% {
			opacity: 1;
			r: 8;
		}
	}
	@keyframes thinking-ring {
		0%,
		100% {
			opacity: 0.2;
		}
		50% {
			opacity: 0.5;
		}
	}

	/* Speaking: rings react / ripple */
	.assistant-avatar[data-state='speaking'] .orb {
		animation: speaking-orb 0.5s ease-in-out infinite alternate;
	}
	.assistant-avatar[data-state='speaking'] .ring-inner {
		animation: speaking-ring 0.6s ease-in-out infinite alternate;
	}
	.assistant-avatar[data-state='speaking'] .ring-middle {
		animation: speaking-ring 0.6s ease-in-out infinite alternate 0.1s;
	}
	.assistant-avatar[data-state='speaking'] .ring-outer {
		animation: speaking-ring 0.6s ease-in-out infinite alternate 0.2s;
	}

	@keyframes speaking-orb {
		0% {
			opacity: 0.8;
		}
		100% {
			opacity: 1;
		}
	}
	@keyframes speaking-ring {
		0% {
			opacity: 0.15;
			transform-origin: center;
			transform: scale(1);
		}
		100% {
			opacity: 0.5;
			transform-origin: center;
			transform: scale(1.08);
		}
	}

	@media (prefers-color-scheme: dark) {
		.assistant-avatar {
			color: #818cf8;
		}
	}
</style>
