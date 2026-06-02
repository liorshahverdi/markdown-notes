export interface TTSOptions {
  voice?: SpeechSynthesisVoice | null;
  rate?: number;
  pitch?: number;
}

export function getAvailableVoices(): SpeechSynthesisVoice[] {
  if (typeof globalThis === 'undefined' || !(globalThis as any).speechSynthesis) {
    return [];
  }
  return speechSynthesis.getVoices();
}

export function speak(text: string, options?: TTSOptions): SpeechSynthesisUtterance {
  const utterance = new SpeechSynthesisUtterance(text);

  if (options?.voice) {
    utterance.voice = options.voice;
  }
  if (options?.rate !== undefined) {
    utterance.rate = options.rate;
  }
  if (options?.pitch !== undefined) {
    utterance.pitch = options.pitch;
  }

  speechSynthesis.speak(utterance);
  return utterance;
}

export function stopSpeaking(): void {
  if (typeof globalThis !== 'undefined' && (globalThis as any).speechSynthesis) {
    speechSynthesis.cancel();
  }
}

export function pauseSpeaking(): void {
  if (typeof globalThis !== 'undefined' && (globalThis as any).speechSynthesis) {
    speechSynthesis.pause();
  }
}

export function resumeSpeaking(): void {
  if (typeof globalThis !== 'undefined' && (globalThis as any).speechSynthesis) {
    speechSynthesis.resume();
  }
}

export function isSpeaking(): boolean {
  if (typeof globalThis === 'undefined' || !(globalThis as any).speechSynthesis) {
    return false;
  }
  return speechSynthesis.speaking;
}
