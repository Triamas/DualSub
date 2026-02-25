import { describe, it, expect } from 'vitest';
import { parseSRT, mergeAndOptimizeSubtitles } from '../services/subtitleUtils';
import { SubtitleLine } from '../types';

describe('Subtitle Integration Flow', () => {
    it('should parse, translate (mock), and merge subtitles correctly', () => {
        // 1. Parse Source
        const sourceSRT = `1
00:00:01,000 --> 00:00:05,000
Hello World

2
00:00:06,000 --> 00:00:10,000
This is a test`;

        const sourceSubtitles = parseSRT(sourceSRT);
        expect(sourceSubtitles).toHaveLength(2);
        expect(sourceSubtitles[0].originalText).toBe('Hello World');

        // 2. Simulate Translation (Mocking the result of an API call)
        const translatedSubtitles: SubtitleLine[] = sourceSubtitles.map(sub => ({
            ...sub,
            originalText: `Translated ${sub.originalText}` // In the merge logic, 'originalText' of the imported file is treated as the translation content
        }));

        // 3. Merge
        const merged = mergeAndOptimizeSubtitles(sourceSubtitles, translatedSubtitles, true);

        // 4. Verify
        expect(merged).toHaveLength(2);
        expect(merged[0].originalText).toBe('Hello World');
        expect(merged[0].translatedText).toBe('Translated Hello World');
        expect(merged[1].originalText).toBe('This is a test');
        expect(merged[1].translatedText).toBe('Translated This is a test');
    });

    it('should handle drift correction during merge', () => {
        // Source: 25fps (40ms per frame)
        const sourceSRT = `1
00:00:01,000 --> 00:00:02,000
Line 1

2
00:01:00,000 --> 00:01:02,000
Line 2`;

        // Target: 24fps (approx 4% slower, so timestamps are larger)
        // 1s at 25fps = 1000ms.
        // 1s at 24fps = 1000 * (25/24) = 1041ms.
        // 60s at 25fps = 60000ms.
        // 60s at 24fps = 62500ms.
        const targetSRT = `1
00:00:01,041 --> 00:00:02,083
Translated 1

2
00:01:02,500 --> 00:01:04,583
Translated 2`;

        const source = parseSRT(sourceSRT);
        const target = parseSRT(targetSRT);

        // The merge function should detect the ratio difference and align them
        const merged = mergeAndOptimizeSubtitles(source, target, true);

        expect(merged).toHaveLength(2);
        expect(merged[0].translatedText).toBe('Translated 1');
        expect(merged[1].translatedText).toBe('Translated 2');
    });
});
