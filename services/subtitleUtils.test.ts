import { describe, it, expect } from 'vitest';
import { parseSubtitle, estimateTokens } from './subtitleUtils';

describe('subtitleUtils', () => {
  describe('parseSubtitle', () => {
    it('should parse SRT correctly', () => {
      const srt = `1
00:00:01,000 --> 00:00:04,000
Hello World

2
00:00:05,000 --> 00:00:08,000
Second Line`;
      const result = parseSubtitle(srt, 'test.srt');
      expect(result).toHaveLength(2);
      expect(result[0].originalText).toBe('Hello World');
      expect(result[0].startTime).toBe('00:00:01,000');
      expect(result[0].endTime).toBe('00:00:04,000');
    });

    it('should parse VTT correctly', () => {
      const vtt = `WEBVTT

1
00:00:01.000 --> 00:00:04.000
Hello World`;
      const result = parseSubtitle(vtt, 'test.vtt');
      expect(result).toHaveLength(1);
      expect(result[0].originalText).toBe('Hello World');
    });
  });

  describe('estimateTokens', () => {
    it('should estimate tokens correctly', () => {
      const subtitles = [
        { id: 1, startTime: '00:00:00,000', endTime: '00:00:01,000', originalText: 'Hello', translatedText: '' },
        { id: 2, startTime: '00:00:01,000', endTime: '00:00:02,000', originalText: 'World', translatedText: '' }
      ];
      const result = estimateTokens(subtitles, 'gemini-3-flash-preview');
      expect(result.inputTokens).toBeGreaterThan(0);
      expect(result.cost).toBeDefined();
    });
  });
});
