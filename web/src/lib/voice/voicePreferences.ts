export interface VoicePreferences {
  activationMode: 'push-to-talk' | 'always-listening';
  wakePhrase: string;
  voiceName: string | null;
  speechRate: number;
  speechPitch: number;
  autoSpeak: boolean;
  language: string;
}

const STORAGE_KEY = 'voice-preferences';

export function getDefaultPreferences(): VoicePreferences {
  return {
    activationMode: 'push-to-talk',
    wakePhrase: 'Hey Notes',
    voiceName: null,
    speechRate: 1,
    speechPitch: 1,
    autoSpeak: false,
    language: 'en-US',
  };
}

export function loadVoicePreferences(): VoicePreferences {
  const defaults = getDefaultPreferences();
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return defaults;
    const parsed = JSON.parse(stored);
    return { ...defaults, ...parsed };
  } catch {
    return defaults;
  }
}

export function saveVoicePreferences(prefs: VoicePreferences): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
}
