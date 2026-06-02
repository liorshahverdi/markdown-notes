import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { createSpeechRecognition, type SpeechRecognitionState } from './speechRecognition';

let capturedInstance: any = null;

function setupMockSpeechRecognition() {
  capturedInstance = null;
  function MockSpeechRecognition(this: any) {
    this.lang = '';
    this.continuous = false;
    this.interimResults = false;
    this.onresult = null;
    this.onerror = null;
    this.onend = null;
    this.onstart = null;
    this.start = vi.fn(function (this: any) {
      this.onstart?.();
    });
    this.stop = vi.fn(function (this: any) {
      this.onend?.();
    });
    this.abort = vi.fn();
    capturedInstance = this;
  }
  return MockSpeechRecognition;
}

describe('speechRecognition', () => {
  beforeEach(() => {
    (globalThis as any).SpeechRecognition = setupMockSpeechRecognition();
    (globalThis as any).webkitSpeechRecognition = undefined;
  });

  afterEach(() => {
    delete (globalThis as any).SpeechRecognition;
    delete (globalThis as any).webkitSpeechRecognition;
  });

  describe('isSupported', () => {
    it('should return true when SpeechRecognition exists', () => {
      const sr = createSpeechRecognition();
      expect(sr.isSupported()).toBe(true);
    });

    it('should return true when webkitSpeechRecognition exists', () => {
      delete (globalThis as any).SpeechRecognition;
      (globalThis as any).webkitSpeechRecognition = setupMockSpeechRecognition();
      const sr = createSpeechRecognition();
      expect(sr.isSupported()).toBe(true);
    });

    it('should return false when no API is available', () => {
      delete (globalThis as any).SpeechRecognition;
      delete (globalThis as any).webkitSpeechRecognition;
      const sr = createSpeechRecognition();
      expect(sr.isSupported()).toBe(false);
    });
  });

  describe('state initialization', () => {
    it('should start with correct initial state', () => {
      const sr = createSpeechRecognition();
      expect(sr.state.isListening).toBe(false);
      expect(sr.state.transcript).toBe('');
      expect(sr.state.interimTranscript).toBe('');
      expect(sr.state.error).toBeNull();
      expect(sr.state.isSupported).toBe(true);
    });

    it('should set isSupported false when API unavailable', () => {
      delete (globalThis as any).SpeechRecognition;
      const sr = createSpeechRecognition();
      expect(sr.state.isSupported).toBe(false);
    });
  });

  describe('options', () => {
    it('should use default options', () => {
      createSpeechRecognition();
      expect(capturedInstance.lang).toBe('en-US');
      expect(capturedInstance.continuous).toBe(false);
      expect(capturedInstance.interimResults).toBe(true);
    });

    it('should apply custom options', () => {
      createSpeechRecognition({
        language: 'fr-FR',
        continuous: true,
        interimResults: false,
      });
      expect(capturedInstance.lang).toBe('fr-FR');
      expect(capturedInstance.continuous).toBe(true);
      expect(capturedInstance.interimResults).toBe(false);
    });
  });

  describe('start/stop', () => {
    it('should set isListening to true on start', () => {
      const sr = createSpeechRecognition();
      sr.start();
      expect(sr.state.isListening).toBe(true);
      expect(capturedInstance.start).toHaveBeenCalled();
    });

    it('should set isListening to false on stop', () => {
      const sr = createSpeechRecognition();
      sr.start();
      sr.stop();
      expect(sr.state.isListening).toBe(false);
      expect(capturedInstance.stop).toHaveBeenCalled();
    });

    it('should not throw when start called on unsupported browser', () => {
      delete (globalThis as any).SpeechRecognition;
      const sr = createSpeechRecognition();
      expect(() => sr.start()).not.toThrow();
    });
  });

  describe('recognition events', () => {
    it('should update transcript on result event with final result', () => {
      const sr = createSpeechRecognition();
      sr.start();

      const event = {
        resultIndex: 0,
        results: [
          {
            isFinal: true,
            0: { transcript: 'hello world' },
            length: 1,
          },
        ],
      };
      capturedInstance.onresult(event);

      expect(sr.state.transcript).toBe('hello world');
    });

    it('should update interimTranscript on non-final result', () => {
      const sr = createSpeechRecognition();
      sr.start();

      const event = {
        resultIndex: 0,
        results: [
          {
            isFinal: false,
            0: { transcript: 'hel' },
            length: 1,
          },
        ],
      };
      capturedInstance.onresult(event);

      expect(sr.state.interimTranscript).toBe('hel');
      expect(sr.state.transcript).toBe('');
    });

    it('should set error on error event', () => {
      const sr = createSpeechRecognition();
      sr.start();

      capturedInstance.onerror({ error: 'not-allowed' });

      expect(sr.state.error).toBe('not-allowed');
      expect(sr.state.isListening).toBe(false);
    });

    it('should set isListening to false on end event', () => {
      const sr = createSpeechRecognition();
      sr.start();

      capturedInstance.onend();

      expect(sr.state.isListening).toBe(false);
    });
  });
});
