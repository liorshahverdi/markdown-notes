import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect, vi } from 'vitest';

// Mock dependencies
vi.mock('$lib/stores/rag', () => ({
	ragConfig: {
		subscribe: vi.fn((fn: any) => {
			fn({ ollamaUrl: 'http://localhost:11434', model: 'llama3.2:3b', topK: 5 });
			return () => {};
		}),
	},
}));

vi.mock('$lib/vector/ragPipeline', () => ({
	buildRAGPrompt: vi.fn((q: string) => q),
	extractRelevantExcerpt: vi.fn((content: string) => content),
	queryOllama: vi.fn(),
	checkOllamaHealth: vi.fn().mockResolvedValue(true),
}));

vi.mock('$lib/voice/speechRecognition', () => ({
	createSpeechRecognition: vi.fn(() => ({
		state: { isListening: false, transcript: '', interimTranscript: '', error: null, isSupported: true },
		start: vi.fn(),
		stop: vi.fn(),
		isSupported: () => true,
	})),
}));

describe('ChatPanel', () => {
	it('persists one global chat conversation regardless of selected note', () => {
		const source = readFileSync(resolve(process.cwd(), 'src/lib/components/ChatPanel.svelte'), 'utf-8');

		expect(source).toContain("const GLOBAL_CHAT_NOTE_ID = '__global__'");
		expect(source).not.toContain('$selectedNoteId');
		expect(source).not.toContain('currentChatNoteId');
		expect(source).toContain('.equals(GLOBAL_CHAT_NOTE_ID)');
	});

	it('does not reload or persist transient searching placeholders as chat history', () => {
		const source = readFileSync(resolve(process.cwd(), 'src/lib/components/ChatPanel.svelte'), 'utf-8');

		expect(source).toContain('isTransientAssistantText');
		expect(source).toContain('deleteTransientChatPlaceholders');
		expect(source).toContain('if (msg.role === \'assistant\' && isTransientAssistantText(msg.text)) return;');
		expect(source).toContain('updateAssistantMessage');
		expect(source).toContain('The chat request ended before the server returned any answer');
	});


	it('renders with empty state message', async () => {
		const { render } = await import('@testing-library/svelte');
		const { default: ChatPanel } = await import('./ChatPanel.svelte');

		const { container } = render(ChatPanel);

		const emptyState = container.querySelector('[data-testid="empty-state"]');
		expect(emptyState).toBeTruthy();
		expect(emptyState!.textContent).toContain('Ask a question about your notes');
	});

	it('shows input field and send button', async () => {
		const { render } = await import('@testing-library/svelte');
		const { default: ChatPanel } = await import('./ChatPanel.svelte');

		const { container } = render(ChatPanel);

		expect(container.querySelector('[data-testid="chat-input"]')).toBeTruthy();
		expect(container.querySelector('[data-testid="send-button"]')).toBeTruthy();
	});

	it('renders the chat panel container', async () => {
		const { render } = await import('@testing-library/svelte');
		const { default: ChatPanel } = await import('./ChatPanel.svelte');

		const { container } = render(ChatPanel);

		expect(container.querySelector('[data-testid="chat-panel"]')).toBeTruthy();
	});
});
