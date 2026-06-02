import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  loadVoicePreferences,
  saveVoicePreferences,
  getDefaultPreferences,
  type VoicePreferences,
} from './voicePreferences';

const STORAGE_KEY = 'voice-preferences';

describe('voicePreferences', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('getDefaultPreferences', () => {
    it('should return default preferences', () => {
      const defaults = getDefaultPreferences();
      expect(defaults).toEqual({
        activationMode: 'push-to-talk',
        wakePhrase: 'Hey Notes',
        voiceName: null,
        speechRate: 1,
        speechPitch: 1,
        autoSpeak: false,
        language: 'en-US',
      });
    });

    it('should return a new object each time', () => {
      const a = getDefaultPreferences();
      const b = getDefaultPreferences();
      expect(a).not.toBe(b);
      expect(a).toEqual(b);
    });
  });

  describe('loadVoicePreferences', () => {
    it('should return defaults when nothing is stored', () => {
      const prefs = loadVoicePreferences();
      expect(prefs).toEqual(getDefaultPreferences());
    });

    it('should load saved preferences from localStorage', () => {
      const saved: VoicePreferences = {
        activationMode: 'always-listening',
        wakePhrase: 'Hey Buddy',
        voiceName: 'Samantha',
        speechRate: 1.5,
        speechPitch: 0.8,
        autoSpeak: true,
        language: 'fr-FR',
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
      const prefs = loadVoicePreferences();
      expect(prefs).toEqual(saved);
    });

    it('should merge partial saved data with defaults', () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ speechRate: 1.8 }));
      const prefs = loadVoicePreferences();
      expect(prefs.speechRate).toBe(1.8);
      expect(prefs.activationMode).toBe('push-to-talk');
      expect(prefs.language).toBe('en-US');
    });

    it('should return defaults when stored JSON is invalid', () => {
      localStorage.setItem(STORAGE_KEY, 'not valid json!!!');
      const prefs = loadVoicePreferences();
      expect(prefs).toEqual(getDefaultPreferences());
    });
  });

  describe('saveVoicePreferences', () => {
    it('should persist preferences to localStorage', () => {
      const prefs: VoicePreferences = {
        activationMode: 'always-listening',
        wakePhrase: 'OK Notes',
        voiceName: 'Alex',
        speechRate: 2.0,
        speechPitch: 0.5,
        autoSpeak: true,
        language: 'de-DE',
      };
      saveVoicePreferences(prefs);
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
      expect(stored).toEqual(prefs);
    });

    it('should overwrite previous preferences', () => {
      const prefs1 = getDefaultPreferences();
      saveVoicePreferences(prefs1);

      const prefs2 = { ...prefs1, speechRate: 1.5 };
      saveVoicePreferences(prefs2);

      const loaded = loadVoicePreferences();
      expect(loaded.speechRate).toBe(1.5);
    });
  });
});
