// Web Speech API type (not available in all TS lib targets)
type SpeechRecognitionInstance = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onstart: (() => void) | null;
  onresult: ((event: any) => void) | null;
  onerror: ((event: any) => void) | null;
  onend: (() => void) | null;
};

export interface SpeechRecognitionOptions {
  language?: string;
  continuous?: boolean;
  interimResults?: boolean;
}

export interface SpeechRecognitionState {
  isListening: boolean;
  transcript: string;
  interimTranscript: string;
  error: string | null;
  isSupported: boolean;
}

function getSpeechRecognitionClass(): (new () => SpeechRecognitionInstance) | null {
  if (typeof globalThis !== 'undefined') {
    return (
      (globalThis as any).SpeechRecognition ||
      (globalThis as any).webkitSpeechRecognition ||
      null
    );
  }
  return null;
}

export function createSpeechRecognition(options?: SpeechRecognitionOptions) {
  const SRClass = getSpeechRecognitionClass();
  const supported = SRClass !== null;

  const state: SpeechRecognitionState = {
    isListening: false,
    transcript: '',
    interimTranscript: '',
    error: null,
    isSupported: supported,
  };

  let recognition: SpeechRecognitionInstance | null = null;

  if (SRClass) {
    recognition = new SRClass();
    recognition.lang = options?.language ?? 'en-US';
    recognition.continuous = options?.continuous ?? false;
    recognition.interimResults = options?.interimResults ?? true;

    recognition.onstart = () => {
      state.isListening = true;
    };

    recognition.onresult = (event: any) => {
      let finalTranscript = '';
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0].transcript;
        if (result.isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      if (finalTranscript) {
        state.transcript = finalTranscript;
        state.interimTranscript = '';
      } else {
        state.interimTranscript = interimTranscript;
      }
    };

    recognition.onerror = (event: any) => {
      state.error = event.error;
      state.isListening = false;
    };

    recognition.onend = () => {
      state.isListening = false;
    };
  }

  return {
    state,
    start() {
      if (!recognition) return;
      state.error = null;
      recognition.start();
    },
    stop() {
      if (!recognition) return;
      recognition.stop();
    },
    isSupported() {
      return supported;
    },
  };
}
