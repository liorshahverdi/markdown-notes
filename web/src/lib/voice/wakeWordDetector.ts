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

export interface WakeWordConfig {
  wakePhrase: string;
  onWakeWord: () => void;
}

export function matchesWakePhrase(transcript: string, wakePhrase: string): boolean {
  if (!transcript) return false;
  return transcript.toLowerCase().includes(wakePhrase.toLowerCase());
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

export function createWakeWordDetector(config: WakeWordConfig) {
  const SRClass = getSpeechRecognitionClass();
  let listening = false;
  let recognition: SpeechRecognitionInstance | null = null;

  if (SRClass) {
    recognition = new SRClass();
    recognition.continuous = true;
    recognition.interimResults = false;

    recognition.onstart = () => {
      listening = true;
    };

    recognition.onresult = (event: any) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          const transcript = result[0].transcript;
          if (matchesWakePhrase(transcript, config.wakePhrase)) {
            config.onWakeWord();
          }
        }
      }
    };

    recognition.onend = () => {
      listening = false;
      // Restart if we should still be listening (continuous mode)
    };
  }

  const detector = {
    get isListening() {
      return listening;
    },
    start() {
      if (!recognition) return;
      recognition.start();
    },
    stop() {
      if (!recognition) return;
      recognition.stop();
      listening = false;
    },
  };

  return detector;
}
