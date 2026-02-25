import { describe, it, expect } from 'vitest';
import { 
    parseTimeMs, 
    formatSRTTime, 
    parseSRT, 
    estimateTokens,
    calculateSafeDurations,
    optimizeTimings
} from '../services/subtitleUtils';

describe('subtitleUtils', () => {
    describe('parseTimeMs', () => {
        it('should parse valid SRT timestamp', () => {
            expect(parseTimeMs('00:00:01,500')).toBe(1500);
            expect(parseTimeMs('01:00:00,000')).toBe(3600000);
            expect(parseTimeMs('00:01:00,000')).toBe(60000);
        });

        it('should handle comma and dot decimal separators', () => {
            expect(parseTimeMs('00:00:01.500')).toBe(1500);
        });

        it('should return 0 for invalid input', () => {
            expect(parseTimeMs('')).toBe(0);
            expect(parseTimeMs('invalid')).toBe(0);
        });
    });

    describe('formatSRTTime', () => {
        it('should format milliseconds to SRT timestamp', () => {
            expect(formatSRTTime(1500)).toBe('00:00:01,500');
            expect(formatSRTTime(3600000)).toBe('01:00:00,000');
            expect(formatSRTTime(60000)).toBe('00:01:00,000');
        });

        it('should handle 0 and negative values', () => {
            expect(formatSRTTime(0)).toBe('00:00:00,000');
            expect(formatSRTTime(-100)).toBe('00:00:00,000');
        });
    });

    describe('parseSRT', () => {
        it('should parse valid SRT content', () => {
            const srtContent = `1
00:00:01,000 --> 00:00:04,000
Hello World

2
00:00:05,000 --> 00:00:08,000
Second line`;
            
            const result = parseSRT(srtContent);
            expect(result).toHaveLength(2);
            expect(result[0].id).toBe(1);
            expect(result[0].startTime).toBe('00:00:01,000');
            expect(result[0].endTime).toBe('00:00:04,000');
            expect(result[0].originalText).toBe('Hello World');
            expect(result[1].originalText).toBe('Second line');
        });

        it('should handle multiline text', () => {
             const srtContent = `1
00:00:01,000 --> 00:00:04,000
Line 1
Line 2`;
            const result = parseSRT(srtContent);
            expect(result[0].originalText).toBe('Line 1[br]Line 2');
        });
    });

    describe('estimateTokens', () => {
        it('should estimate tokens for LLM models', () => {
            const subtitles = [{ id: 1, startTime: '', endTime: '', originalText: 'Hello world' }];
            const result = estimateTokens(subtitles, 'gemini-3-flash');
            
            expect(result.inputTokens).toBeGreaterThan(0);
            expect(result.outputTokens).toBeGreaterThan(0);
            expect(result.cost).toContain('€');
        });

        it('should return free for local models', () => {
            const subtitles = [{ id: 1, startTime: '', endTime: '', originalText: 'Hello' }];
            const result = estimateTokens(subtitles, 'local-model');
            expect(result.cost).toBe('Local (Free)');
        });
    });

    describe('calculateSafeDurations', () => {
        it('should calculate durations respecting gaps', () => {
            const subtitles = [
                { id: 1, startTime: '00:00:01,000', endTime: '00:00:04,000', originalText: 'A' },
                { id: 2, startTime: '00:00:04,100', endTime: '00:00:08,000', originalText: 'B' }
            ];
            
            const durations = calculateSafeDurations(subtitles);
            // Sub 1 starts at 1000. Next starts at 4100. Gap 50ms.
            // Max end = 4100 - 50 = 4050.
            // Duration = 4050 - 1000 = 3050.
            expect(durations.get(1)).toBe(3050);
        });
    });

    describe('optimizeTimings', () => {
        it('should prevent overlap', () => {
            const subtitles = [
                { id: 1, startTime: '00:00:01,000', endTime: '00:00:05,000', originalText: 'A' }, // Ends at 5000
                { id: 2, startTime: '00:00:04,000', endTime: '00:00:08,000', originalText: 'B' }  // Starts at 4000
            ];
            
            const optimized = optimizeTimings(subtitles, true);
            
            // Sub 1 must end before Sub 2 starts (minus gap)
            // Sub 2 start = 4000. Limit = 3950.
            expect(parseTimeMs(optimized[0].endTime)).toBeLessThanOrEqual(3950);
        });
    });
});
