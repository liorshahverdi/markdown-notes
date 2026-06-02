import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { matchesWakePhrase, createWakeWordDetector } from './wakeWordDetector';

// Capture the instance created inside createWakeWordDetector
let capturedInstance: any = null;

describe('matchesWakePhrase', () => {
  it('should match exact wake phrase', () => {
    expect(matchesWakePhrase('Hey Notes', 'Hey Notes')).toBe(true);
  });

  it('should be case-insensitive', () => {
    expect(matchesWakePhrase('hey notes', 'Hey Notes')).toBe(true);
    expect(matchesWakePhrase('HEY NOTES', 'Hey Notes')).toBe(true);
  });

  it('should match wake phrase at start of transcript', () => {
    expect(matchesWakePhrase('Hey Notes what is the weather', 'Hey Notes')).toBe(true);
  });

  it('should match wake phrase anywhere in transcript', () => {
    expect(matchesWakePhrase('I said hey notes please help', 'Hey Notes')).toBe(true);
  });

  it('should not match partial phrases', () => {
    expect(matchesWakePhrase('Hey Note', 'Hey Notes')).toBe(false);
  });

  it('should not match empty transcript', () => {
    expect(matchesWakePhrase('', 'Hey Notes')).toBe(false);
  });

  it('should handle custom wake phrases', () => {
    expect(matchesWakePhrase('ok computer do something', 'OK Computer')).toBe(true);
  });
});

describe('createWakeWordDetector', () => {
  beforeEach(() => {
    capturedInstance = null;
    // Use a proper constructor function (not arrow) so `new` works
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
    (globalThis as any).SpeechRecognition = MockSpeechRecognition;
  });

  afterEach(() => {
    delete (globalThis as any).SpeechRecognition;
  });

  it('should start listening in continuous mode', () => {
    const onWakeWord = vi.fn();
    const detector = createWakeWordDetector({ wakePhrase: 'Hey Notes', onWakeWord });
    detector.start();
    expect(detector.isListening).toBe(true);
  });

  it('should stop listening', () => {
    const onWakeWord = vi.fn();
    const detector = createWakeWordDetector({ wakePhrase: 'Hey Notes', onWakeWord });
    detector.start();
    detector.stop();
    expect(detector.isListening).toBe(false);
  });

  it('should call onWakeWord when wake phrase is detected', () => {
    const onWakeWord = vi.fn();
    const detector = createWakeWordDetector({ wakePhrase: 'Hey Notes', onWakeWord });
    detector.start();

    const event = {
      resultIndex: 0,
      results: [
        {
          isFinal: true,
          0: { transcript: 'Hey Notes what time is it' },
          length: 1,
        },
      ],
    };
    capturedInstance.onresult(event);

    expect(onWakeWord).toHaveBeenCalledTimes(1);
  });

  it('should not call onWakeWord for non-matching phrases', () => {
    const onWakeWord = vi.fn();
    const detector = createWakeWordDetector({ wakePhrase: 'Hey Notes', onWakeWord });
    detector.start();

    const event = {
      resultIndex: 0,
      results: [
        {
          isFinal: true,
          0: { transcript: 'Hello world' },
          length: 1,
        },
      ],
    };
    capturedInstance.onresult(event);

    expect(onWakeWord).not.toHaveBeenCalled();
  });
});
