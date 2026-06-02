import { createSpeechRecognition } from './speechRecognition';
import { loadVoicePreferences } from './voicePreferences';

export interface DictationCallbacks {
	onInterim: (text: string) => void;
	onFinal: (text: string) => void;
	onError: (error: string) => void;
	onActiveChange: (active: boolean) => void;
	language?: string;
}

export interface DictationManager {
	start: () => void;
	stop: () => void;
	isSupported: () => boolean;
}

export function createDictationManager(callbacks: DictationCallbacks): DictationManager {
	const prefs = loadVoicePreferences();
	const lang = callbacks.language ?? prefs.language ?? 'en-US';

	let active = false;
	let recognition: ReturnType<typeof createSpeechRecognition> | null = null;
	let checkInterval: ReturnType<typeof setInterval> | null = null;
	let lastProcessedTranscript = '';

	function createRecognition() {
		const rec = createSpeechRecognition({
			language: lang,
			continuous: true,
			interimResults: true,
		});
		return rec;
	}

	function clearCheck() {
		if (checkInterval) {
			clearInterval(checkInterval);
			checkInterval = null;
		}
	}

	function startPolling() {
		clearCheck();
		checkInterval = setInterval(() => {
			if (!recognition || !active) {
				clearCheck();
				return;
			}

			const { transcript, interimTranscript, error, isListening } = recognition.state;

			if (error) {
				callbacks.onError(error);
				stop();
				return;
			}

			if (transcript && transcript !== lastProcessedTranscript) {
				lastProcessedTranscript = transcript;
				callbacks.onFinal(transcript);
			}

			if (interimTranscript) {
				callbacks.onInterim(interimTranscript);
			}

			// Auto-restart: browser may stop continuous recognition
			if (!isListening && active) {
				try {
					recognition.start();
				} catch {
					// May throw if already starting
				}
			}
		}, 100);
	}

	function start() {
		if (active) return;
		active = true;
		lastProcessedTranscript = '';
		recognition = createRecognition();
		if (!recognition.isSupported()) {
			callbacks.onError('Speech recognition not supported');
			active = false;
			return;
		}
		recognition.start();
		callbacks.onActiveChange(true);
		startPolling();
	}

	function stop() {
		if (!active) return;
		active = false;
		clearCheck();
		if (recognition) {
			recognition.stop();
			recognition = null;
		}
		callbacks.onActiveChange(false);
	}

	function isSupported() {
		const test = createSpeechRecognition();
		return test.isSupported();
	}

	return { start, stop, isSupported };
}
