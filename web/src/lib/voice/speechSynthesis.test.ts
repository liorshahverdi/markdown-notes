import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  getAvailableVoices,
  speak,
  stopSpeaking,
  pauseSpeaking,
  resumeSpeaking,
  isSpeaking,
} from './speechSynthesis';

// Mock SpeechSynthesisUtterance
class MockUtterance {
  text = '';
  voice: any = null;
  rate = 1;
  pitch = 1;
  constructor(text: string) {
    this.text = text;
  }
}

describe('speechSynthesis', () => {
  let mockSynthesis: {
    speak: ReturnType<typeof vi.fn>;
    cancel: ReturnType<typeof vi.fn>;
    pause: ReturnType<typeof vi.fn>;
    resume: ReturnType<typeof vi.fn>;
    speaking: boolean;
    getVoices: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockSynthesis = {
      speak: vi.fn(),
      cancel: vi.fn(),
      pause: vi.fn(),
      resume: vi.fn(),
      speaking: false,
      getVoices: vi.fn(() => [
        { name: 'Samantha', lang: 'en-US' },
        { name: 'Thomas', lang: 'fr-FR' },
      ]),
    };
    (globalThis as any).speechSynthesis = mockSynthesis;
    (globalThis as any).SpeechSynthesisUtterance = MockUtterance;
  });

  afterEach(() => {
    delete (globalThis as any).speechSynthesis;
    delete (globalThis as any).SpeechSynthesisUtterance;
  });

  describe('getAvailableVoices', () => {
    it('should return voices from speechSynthesis API', () => {
      const voices = getAvailableVoices();
      expect(voices).toHaveLength(2);
      expect(voices[0].name).toBe('Samantha');
    });

    it('should return empty array when API not available', () => {
      delete (globalThis as any).speechSynthesis;
      const voices = getAvailableVoices();
      expect(voices).toEqual([]);
    });
  });

  describe('speak', () => {
    it('should create utterance and call speechSynthesis.speak', () => {
      speak('Hello world');
      expect(mockSynthesis.speak).toHaveBeenCalledTimes(1);
      const utterance = mockSynthesis.speak.mock.calls[0][0];
      expect(utterance.text).toBe('Hello world');
    });

    it('should apply rate and pitch options', () => {
      speak('Test', { rate: 1.5, pitch: 0.8 });
      const utterance = mockSynthesis.speak.mock.calls[0][0];
      expect(utterance.rate).toBe(1.5);
      expect(utterance.pitch).toBe(0.8);
    });

    it('should return the utterance object', () => {
      const utterance = speak('Test');
      expect(utterance).toBeInstanceOf(MockUtterance);
      expect(utterance.text).toBe('Test');
    });
  });

  describe('stopSpeaking', () => {
    it('should call speechSynthesis.cancel', () => {
      stopSpeaking();
      expect(mockSynthesis.cancel).toHaveBeenCalled();
    });
  });

  describe('pauseSpeaking', () => {
    it('should call speechSynthesis.pause', () => {
      pauseSpeaking();
      expect(mockSynthesis.pause).toHaveBeenCalled();
    });
  });

  describe('resumeSpeaking', () => {
    it('should call speechSynthesis.resume', () => {
      resumeSpeaking();
      expect(mockSynthesis.resume).toHaveBeenCalled();
    });
  });

  describe('isSpeaking', () => {
    it('should return speaking state', () => {
      mockSynthesis.speaking = false;
      expect(isSpeaking()).toBe(false);

      mockSynthesis.speaking = true;
      expect(isSpeaking()).toBe(true);
    });

    it('should return false when API not available', () => {
      delete (globalThis as any).speechSynthesis;
      expect(isSpeaking()).toBe(false);
    });
  });
});
