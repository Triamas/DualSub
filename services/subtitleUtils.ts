import { SubtitleLine, AssStyleConfig } from '../types';

const CPS = 20; // Characters per second reading speed
const MIN_GAP_MS = 50; // Strict gap between subtitles
const MIN_DURATION_MS = 1000; // Minimum duration for a subtitle line
const MAX_DURATION_MS = 6000; // Hard cap for subtitle duration (6 seconds)

const TAG_REGEX = /<[^>]*>/g;
const BR_REGEX = /\[br\]/g;
const B_TAG_OPEN = /<b>/gi;
const B_TAG_CLOSE = /<\/b>/gi;
const I_TAG_OPEN = /<i>/gi;
const I_TAG_CLOSE = /<\/i>/gi;
const U_TAG_OPEN = /<u>/gi;
const U_TAG_CLOSE = /<\/u>/gi;
const ANY_TAG = /<[^>]+>/g;

/**
 * Strips HTML tags from text to get actual character count.
 */
const stripTags = (html: string) => html.replace(TAG_REGEX, '');

/**
 * Normalize various line break formats to internal [br] token.
 */
const normalizeBreaks = (text: string): string => {
    if (!text) return "";
    return text
        .replace(/<br\s*\/?>/gi, '[br]')
        .replace(/<\/br>/gi, '[br]');
};

/**
 * Converts SRT HTML-like tags to ASS override tags.
 */
const srtToAss = (text: string): string => {
    return text
        .replace(B_TAG_OPEN, '{\\b1}').replace(B_TAG_CLOSE, '{\\b0}')
        .replace(I_TAG_OPEN, '{\\i1}').replace(I_TAG_CLOSE, '{\\i0}')
        .replace(U_TAG_OPEN, '{\\u1}').replace(U_TAG_CLOSE, '{\\u0}')
        .replace(ANY_TAG, '');
};

/**
 * Parses SRT timestamp "00:00:00,000" to milliseconds.
 */
export const parseTimeMs = (timeString: string): number => {
    if (!timeString) return 0;
    const parts = timeString.replace('.', ',').split(',');
    if (parts.length !== 2) return 0;
    const [time, ms] = parts;
    const [h, m, s] = time.split(':').map(Number);
    return (h * 3600000) + (m * 60000) + (s * 1000) + Number(ms);
};

/**
 * Formats milliseconds back to SRT timestamp "00:00:00,000".
 */
export const formatSRTTime = (totalMs: number): string => {
    const ms = Math.floor(Math.max(0, totalMs) % 1000);
    const totalSeconds = Math.floor(Math.max(0, totalMs) / 1000);
    const s = totalSeconds % 60;
    const totalMinutes = Math.floor(totalSeconds / 60);
    const m = totalMinutes % 60;
    const h = Math.floor(totalMinutes / 60);

    const pad = (n: number, w: number = 2) => n.toString().padStart(w, '0');
    return `${pad(h)}:${pad(m)}:${pad(s)},${pad(ms, 3)}`;
};

/**
 * Calculates the "Safe Duration" for each line.
 * This is the Maximum time a subtitle CAN stay on screen before it hits the next subtitle
 * or the hard duration cap, whichever comes first.
 * Used for "Thinking" Model optimizations.
 */
export const calculateSafeDurations = (subtitles: SubtitleLine[]): Map<number, number> => {
    const durationMap = new Map<number, number>();
    
    for (let i = 0; i < subtitles.length; i++) {
        const current = subtitles[i];
        const startMs = parseTimeMs(current.startTime);
        
        // Default max duration is the hard cap
        let maxAllowedEnd = startMs + MAX_DURATION_MS;

        // If there is a next subtitle, we must end before it starts
        if (i < subtitles.length - 1) {
            const next = subtitles[i+1];
            const nextStartMs = parseTimeMs(next.startTime);
            const absoluteLimit = nextStartMs - MIN_GAP_MS;
            
            // If next sub starts REALLY soon (overlap or tiny gap), clamp tightly
            if (absoluteLimit < maxAllowedEnd) {
                maxAllowedEnd = absoluteLimit;
            }
        }

        // Calculate duration, ensuring at least MIN_DURATION_MS if possible
        let safeDuration = maxAllowedEnd - startMs;
        
        // If the gap to next subtitle is extremely small (e.g. 200ms), we can't do much.
        // But we record the physical limit here.
        if (safeDuration < 0) safeDuration = 0;

        durationMap.set(current.id, safeDuration);
    }
    return durationMap;
};

/**
 * Optimizes subtitle timings to ensure NO OVERLAP and readable duration.
 * STRICT MODE: Never changes Start Time.
 */
export const optimizeTimings = (subtitles: SubtitleLine[], enableSmartTiming: boolean = true): SubtitleLine[] => {
    if (!enableSmartTiming) return subtitles;

    return subtitles.map((sub, index) => {
        const startMs = parseTimeMs(sub.startTime);
        
        // 1. Calculate the Target End Time based on Content Reading Speed
        // Strip tags AND [br] tokens for accurate length calculation
        const cleanForLength = (s: string) => stripTags(s || '').replace(BR_REGEX, '');
        const textEn = cleanForLength(sub.originalText);
        const textVi = cleanForLength(sub.translatedText || '');
        const maxChars = Math.max(textEn.length, textVi.length);
        
        // Ideal duration based on reading speed
        const readingDuration = maxChars > 0 ? (maxChars / CPS) * 1000 : 0;
        
        // We prefer the original duration, unless it's too short for the new text
        const currentEndMs = parseTimeMs(sub.endTime);
        const originalDuration = currentEndMs - startMs;
        
        let targetDuration = Math.max(originalDuration, readingDuration);
        
        // 2. Enforce Minimum Duration (1s)
        if (targetDuration < MIN_DURATION_MS && maxChars > 0) {
            targetDuration = MIN_DURATION_MS;
        }

        // 3. Enforce Maximum Duration (Hard Cap - e.g. 6s)
        if (targetDuration > MAX_DURATION_MS) {
            targetDuration = MAX_DURATION_MS;
        }

        let newEndMs = startMs + targetDuration;

        // 4. Enforce Non-Overlap with Next Subtitle (The most critical rule)
        if (index < subtitles.length - 1) {
            const nextSub = subtitles[index + 1];
            const nextStartMs = parseTimeMs(nextSub.startTime);
            
            // The absolute latest this sub can end is (NextStart - Gap)
            const absoluteLimit = nextStartMs - MIN_GAP_MS;
            
            if (newEndMs > absoluteLimit) {
                newEndMs = absoluteLimit;
            }
        }
        
        // 5. Sanity Check: End cannot be before Start
        if (newEndMs <= startMs) {
             // If we are crunched, give it at least a tiny flash (unless next sub is literally overlapping start)
             // But strictly, we must not overlap next start.
             if (index < subtitles.length - 1) {
                 const nextStart = parseTimeMs(subtitles[index+1].startTime);
                 if (nextStart > startMs) {
                     newEndMs = nextStart - 10; // 10ms gap emergency
                 } else {
                     newEndMs = startMs + 100; // Overlap inevitable in source, just keep small
                 }
             } else {
                 newEndMs = startMs + MIN_DURATION_MS;
             }
        }

        return {
            ...sub,
            endTime: formatSRTTime(newEndMs)
        };
    });
};

/**
 * Merges imported translated subtitles into source subtitles.
 * 
 * ALGORITHM:
 * 1. 1:1 Match Check: If counts match and start/end times align closely, simple merge.
 * 2. Linear Drift Calculation: Detect framerate mismatch (24fps vs 25fps) and calculate ratio.
 * 3. Dynamic Time Warping (DTW): Find optimal alignment path, allowing for:
 *    - Matches (Time is close)
 *    - Insertions (Target has line, Source doesn't - e.g. Credits) -> Preserved
 *    - Deletions (Source has line, Target doesn't) -> Source kept empty
 */
export const mergeAndOptimizeSubtitles = (
    sourceSubtitles: SubtitleLine[], 
    importedSubtitles: SubtitleLine[], 
    enableSmartTiming: boolean
): SubtitleLine[] => {
    
    // Pre-calculate timestamps for performance
    const sTimes = sourceSubtitles.map(s => ({ start: parseTimeMs(s.startTime), end: parseTimeMs(s.endTime) }));
    const iTimes = importedSubtitles.map(s => ({ start: parseTimeMs(s.startTime), end: parseTimeMs(s.endTime) }));

    // --- STEP 1: 1:1 EXACT MATCH HEURISTIC ---
    // If files are identical in structure, avoid expensive processing.
    const isExact = () => {
        if (sourceSubtitles.length !== importedSubtitles.length) return false;
        if (sourceSubtitles.length === 0) return true;
        
        // Check start, middle, and end for alignment
        const indices = [0, Math.floor(sourceSubtitles.length/2), sourceSubtitles.length-1];
        for (const i of indices) {
             if (Math.abs(sTimes[i].start - iTimes[i].start) > 500) return false;
        }
        return true;
    };

    if (isExact()) {
        const merged = sourceSubtitles.map((src, i) => ({
            ...src,
            translatedText: importedSubtitles[i].originalText // Note: imported 'originalText' is the translation content here
        }));
        return optimizeTimings(merged, enableSmartTiming);
    }

    // --- STEP 2: LINEAR DRIFT CORRECTION ---
    let ratio = 1.0;
    let offset = 0;
    
    // Only calculate drift if we have enough data points
    if (sTimes.length > 10 && iTimes.length > 10) {
        // Use 10% - 90% range to avoid intro/outro credit anomalies
        const startIdx = Math.floor(sTimes.length * 0.1);
        const endIdx = Math.floor(sTimes.length * 0.9);
        
        const iStartIdx = Math.floor(iTimes.length * 0.1);
        const iEndIdx = Math.floor(iTimes.length * 0.9);

        const sDur = sTimes[endIdx].start - sTimes[startIdx].start;
        const iDur = iTimes[iEndIdx].start - iTimes[iStartIdx].start;

        // If significant duration difference (>1%), apply correction
        if (iDur > 0 && sDur > 0) {
            const rawRatio = sDur / iDur;
            if (Math.abs(1 - rawRatio) > 0.01) {
                ratio = rawRatio;
            }
        }
        
        // Calculate offset based on the start anchor adjusted by ratio
        offset = sTimes[startIdx].start - (iTimes[iStartIdx].start * ratio);
    }
    
    const getAdjustedImportStart = (idx: number) => (iTimes[idx].start * ratio) + offset;

    // --- STEP 3: DYNAMIC TIME WARPING (DTW) ---
    const n = sourceSubtitles.length;
    const m = importedSubtitles.length;
    
    // Costs
    const SKIP_SOURCE_COST = 5000; // Expensive to skip source (we want to fill them)
    const SKIP_IMPORT_COST = 500;  // Cheap to skip import (allows inserting credits easily)
    
    // DP Arrays (Using TypedArrays for memory efficiency on large files)
    const dp = new Float32Array((n + 1) * (m + 1));
    const ptr = new Int8Array((n + 1) * (m + 1)); // 0: Match, 1: Skip Import (Insert), 2: Skip Source (Delete)
    
    const idx = (r: number, c: number) => r * (m + 1) + c;

    // Initialization
    dp[0] = 0;
    for (let i = 1; i <= n; i++) { dp[idx(i, 0)] = i * SKIP_SOURCE_COST; ptr[idx(i, 0)] = 2; }
    for (let j = 1; j <= m; j++) { dp[idx(0, j)] = j * SKIP_IMPORT_COST; ptr[idx(0, j)] = 1; }

    // Fill Matrix
    for (let i = 1; i <= n; i++) {
        for (let j = 1; j <= m; j++) {
            const sTime = sTimes[i-1].start;
            const iTimeAdjusted = getAdjustedImportStart(j-1);
            
            const matchCost = Math.abs(sTime - iTimeAdjusted);
            
            const costMatch = dp[idx(i-1, j-1)] + matchCost;
            const costSkipSource = dp[idx(i-1, j)] + SKIP_SOURCE_COST;
            const costSkipImport = dp[idx(i, j-1)] + SKIP_IMPORT_COST;

            if (costMatch <= costSkipSource && costMatch <= costSkipImport) {
                dp[idx(i, j)] = costMatch;
                ptr[idx(i, j)] = 0;
            } else if (costSkipImport <= costSkipSource) {
                dp[idx(i, j)] = costSkipImport;
                ptr[idx(i, j)] = 1;
            } else {
                dp[idx(i, j)] = costSkipSource;
                ptr[idx(i, j)] = 2;
            }
        }
    }

    // Traceback to build result
    const result: SubtitleLine[] = [];
    let i = n;
    let j = m;

    while (i > 0 || j > 0) {
        const p = ptr[idx(i, j)];
        
        if (i > 0 && j > 0 && p === 0) {
            // MATCH: Use Source time, add Translation
            result.push({
                ...sourceSubtitles[i-1],
                translatedText: importedSubtitles[j-1].originalText
            });
            i--; j--;
        } else if (j > 0 && (i === 0 || p === 1)) {
            // INSERTION: Import has line, Source doesn't.
            // This preserves credits/extra lines from the translation file.
            // We MUST map the time to the Source timeline using ratio/offset.
            const imp = importedSubtitles[j-1];
            const newStart = (iTimes[j-1].start * ratio) + offset;
            const newEnd = (iTimes[j-1].end * ratio) + offset;
            
            result.push({
                id: -1, // Temp ID, fixed later
                startTime: formatSRTTime(newStart),
                endTime: formatSRTTime(newEnd),
                originalText: "", // No English source
                translatedText: imp.originalText
            });
            j--;
        } else if (i > 0 && (j === 0 || p === 2)) {
            // DELETION: Source has line, Import doesn't.
            // Keep source line empty.
            result.push({
                ...sourceSubtitles[i-1],
                translatedText: ""
            });
            i--;
        }
    }

    // Traceback builds backwards
    result.reverse();
    
    // Re-index IDs and Optimize
    return optimizeTimings(result.map((r, index) => ({...r, id: index + 1})), enableSmartTiming);
};

export const parseSRT = (data: string): SubtitleLine[] => {
  const normalizedData = data.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const blocks = normalizedData.trim().split('\n\n');
  const subtitles: SubtitleLine[] = [];

  blocks.forEach((block) => {
    const lines = block.split('\n');
    if (lines.length >= 3) {
      const id = parseInt(lines[0], 10);
      const timeMatch = lines[1].match(/(\d{2}:\d{2}:\d{2},\d{3}) --> (\d{2}:\d{2}:\d{2},\d{3})/);
      if (timeMatch) {
        const text = lines.slice(2).join('[br]'); 
        subtitles.push({
          id: isNaN(id) ? subtitles.length + 1 : id,
          startTime: timeMatch[1],
          endTime: timeMatch[2],
          originalText: text,
        });
      }
    }
  });

  return subtitles;
};

// Helper to convert ASS time string (H:MM:SS.cc) to SRT format (HH:MM:SS,ms)
const assTimeToSrt = (assTime: string): string => {
    const parts = assTime.split('.');
    if (parts.length < 2) return "00:00:00,000";
    const [hms, cs] = parts;
    const ms = parseInt(cs, 10) * 10; // Centiseconds to ms
    const [h, m, s] = hms.split(':').map(Number);
    
    const pad = (n: number, w: number = 2) => n.toString().padStart(w, '0');
    return `${pad(h)}:${pad(m)}:${pad(s)},${pad(ms, 3)}`;
};

export const parseASS = (data: string): SubtitleLine[] => {
    const lines = data.split(/\r?\n/);
    const subtitles: SubtitleLine[] = [];
    let formatSpec: string[] = [];
    let eventsStarted = false;

    // Default indices if Format line missing (standard ASS)
    let idxStart = 1;
    let idxEnd = 2;
    let idxText = 9;

    lines.forEach((line) => {
        const trimmed = line.trim();
        if (trimmed.startsWith('[Events]')) {
            eventsStarted = true;
            return;
        }
        if (!eventsStarted) return;

        if (trimmed.startsWith('Format:')) {
            formatSpec = trimmed.substring(7).split(',').map(s => s.trim().toLowerCase());
            idxStart = formatSpec.indexOf('start');
            idxEnd = formatSpec.indexOf('end');
            idxText = formatSpec.indexOf('text');
            return;
        }

        if (trimmed.startsWith('Dialogue:')) {
            const currentStr = trimmed.substring(9).trim(); 
            const allParts = currentStr.split(',');

            if (allParts.length > idxText) {
                const preText = allParts.slice(0, idxText);
                const textContent = allParts.slice(idxText).join(','); 
                
                const start = assTimeToSrt(preText[idxStart]);
                const end = assTimeToSrt(preText[idxEnd]);
                
                let cleanText = textContent.replace(/{[^}]*}/g, ''); 
                cleanText = cleanText.replace(/\\N/g, '[br]').replace(/\\n/g, '[br]');
                
                subtitles.push({
                    id: subtitles.length + 1,
                    startTime: start,
                    endTime: end,
                    originalText: cleanText
                });
            }
        }
    });
    return subtitles;
};

export const parseVTT = (data: string): SubtitleLine[] => {
  const normalizedData = data.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const blocks = normalizedData.trim().split('\n\n');
  const subtitles: SubtitleLine[] = [];
  
  let counter = 1;

  blocks.forEach((block) => {
    const lines = block.trim().split('\n');
    if (lines[0].startsWith('WEBVTT') || lines[0].startsWith('NOTE')) return;
    
    let timingIndex = -1;
    for(let i=0; i<lines.length; i++) {
        if (lines[i].includes('-->')) {
            timingIndex = i;
            break;
        }
    }
    
    if (timingIndex !== -1) {
        const timeLine = lines[timingIndex];
        const timeMatch = timeLine.match(/((?:\d{2}:)?\d{2}:\d{2}\.\d{3}) --> ((?:\d{2}:)?\d{2}:\d{2}\.\d{3})/);
        if (timeMatch) {
             let start = timeMatch[1].replace('.', ',');
             let end = timeMatch[2].replace('.', ',');
             
             const normalize = (t: string) => {
                 const parts = t.split(':');
                 if (parts.length === 2) return `00:${t}`;
                 return t;
             };
             
             start = normalize(start);
             end = normalize(end);
             
             const textLines = lines.slice(timingIndex + 1);
             const text = textLines.join('[br]').replace(/<[^>]*>/g, '');
             
             if (text) {
                 subtitles.push({
                     id: counter++,
                     startTime: start,
                     endTime: end,
                     originalText: text
                 });
             }
        }
    }
  });
  
  return subtitles;
};

export const parseSubtitle = (content: string, fileName: string): SubtitleLine[] => {
    const ext = fileName.toLowerCase().split('.').pop();
    if (ext === 'ass' || ext === 'ssa') {
        return parseASS(content);
    }
    if (ext === 'vtt') {
        return parseVTT(content);
    }
    return parseSRT(content);
};

const convertToASSTime = (srtTime: string): string => {
  const [time, ms] = srtTime.split(',');
  const [h, m, s] = time.split(':');
  const hour = parseInt(h, 10); 
  const centisec = Math.floor(parseInt(ms, 10) / 10).toString().padStart(2, '0');
  return `${hour}:${m}:${s}.${centisec}`;
};

const toAssColor = (hex: string, alpha: number = 0): string => {
    const cleanHex = hex.replace('#', '');
    const r = cleanHex.substring(0, 2);
    const g = cleanHex.substring(2, 4);
    const b = cleanHex.substring(4, 6);
    const alphaVal = Math.floor((1 - alpha) * 255).toString(16).padStart(2, '0').toUpperCase();
    return `&H${alphaVal}${b}${g}${r}`;
};

/**
 * Generates ASS content using optimized timings.
 */
const renderASS = (optimizedSubtitles: SubtitleLine[], config: AssStyleConfig): string => {
  const primaryColorAss = toAssColor(config.primary.color, 1); 
  const secondaryColorAss = toAssColor(config.secondary.color, 1); 

  const primSize = config.primary.fontSize;
  const secSize = config.secondary.fontSize;
  
  const outline = config.outlineWidth;
  const shadow = config.shadowDepth;
  const borderStyle = config.borderStyle || 1;
  const font = config.fontFamily || 'Arial';

  const boxColorAss = '&H66000000'; 
  const standardOutlineColor = '&H00000000'; 
  const shadowColorAss = '&H80000000'; 
  
  const effectiveOutlineColor = borderStyle === 3 ? boxColorAss : standardOutlineColor;
  
  let primMarginV = 60; 
  let secMarginV = 60;
  
  if (config.layout === 'stacked') {
      const bottomBaseMargin = 50; 
      const gap = 15; 
      const lineMultiplier = config.linesPerSubtitle || 2; 
      const lineHeightFactor = 1.25;

      if (config.stackOrder === 'secondary-top') {
          // Primary is at the bottom (Baseline at bottomBaseMargin)
          primMarginV = bottomBaseMargin;
          
          // Secondary is on top. It must be shifted up by the height of Primary + Gap.
          // Primary Block Height = Size * Lines * LineHeightFactor
          const primaryBlockHeight = primSize * lineMultiplier * lineHeightFactor;
          
          secMarginV = Math.round(bottomBaseMargin + primaryBlockHeight + gap);
      } else {
          // Secondary is at the bottom (Baseline at bottomBaseMargin)
          secMarginV = bottomBaseMargin;
          
          // Primary is on top. Shifted up by Secondary Height + Gap.
          const secondaryBlockHeight = secSize * lineMultiplier * lineHeightFactor;
          
          primMarginV = Math.round(bottomBaseMargin + secondaryBlockHeight + gap);
      }
  } else {
      // Split mode or other layouts
      if (config.stackOrder === 'primary-top') {
          primMarginV = 60; 
          secMarginV = 60;  
      } else {
          primMarginV = 60; 
          secMarginV = 60;  
      }
  }

  const commonParams = `FONTNAME,SIZE,COLOR,&H000000FF,OUT_COL,BACK_COL,0,0,0,0,100,100,0,0,BORDERSTYLE,OUTLINE,SHADOW,ALIGN,0000,0000,MARGIN,1`;

  const buildStyle = (name: string, size: number, color: string, align: number, margin: number) => {
      return `Style: ${name},` + commonParams
        .replace('FONTNAME', font)
        .replace('SIZE', size.toString())
        .replace('COLOR', color)
        .replace('OUT_COL', effectiveOutlineColor)
        .replace('BACK_COL', shadowColorAss)
        .replace('ALIGN', align.toString())
        .replace('MARGIN', margin.toString())
        .replace('OUTLINE', outline.toString())
        .replace('SHADOW', shadow.toString())
        .replace('BORDERSTYLE', borderStyle.toString());
  };

  let stylePrimary = '';
  let styleSecondary = '';

  if (config.layout === 'stacked') {
      // In ASS Alignment=2 (Bottom Center), marginV is the distance from the bottom edge.
      // Both are effectively anchored to bottom, but with different margins to stack them.
      stylePrimary = buildStyle('Primary', primSize, primaryColorAss, 2, primMarginV);
      styleSecondary = buildStyle('Secondary', secSize, secondaryColorAss, 2, secMarginV);
  } else {
      if (config.stackOrder === 'primary-top') {
          stylePrimary = buildStyle('Primary', primSize, primaryColorAss, 8, primMarginV); // 8 = Top Center
          styleSecondary = buildStyle('Secondary', secSize, secondaryColorAss, 2, secMarginV); // 2 = Bottom Center
      } else {
          stylePrimary = buildStyle('Primary', primSize, primaryColorAss, 2, primMarginV); 
          styleSecondary = buildStyle('Secondary', secSize, secondaryColorAss, 8, secMarginV); 
      }
  }

  const header = `[Script Info]
; Script generated by DualSub AI
; https://github.com/google/genai-sdk
ScriptType: v4.00+
PlayResX: 3840
PlayResY: 2160
WrapStyle: 0
ScaledBorderAndShadow: yes
YCbCr Matrix: TV.709
Collisions: Reverse

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
${stylePrimary}
${styleSecondary}

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Comment: 0,0:00:00.00,0:00:00.00,Primary,,0,0,0,,metadata: DualSub AI Generation | Date: ${new Date().toISOString().split('T')[0]}
`;

  const events = optimizedSubtitles.map((sub) => {
    const start = convertToASSTime(sub.startTime);
    const end = convertToASSTime(sub.endTime);
    
    const formatContent = (text: string) => {
        // 1. Normalize HTML breaks to [br] first so srtToAss doesn't strip them
        let normalized = normalizeBreaks(text);
        
        // 2. Convert styles (b, i, u) to ASS, strip other HTML
        let processed = srtToAss(normalized);
        
        // 3. Handle [br] based on config
        if (config.linesPerSubtitle === 1) {
             // Single Line: replace [br] with space
             return processed.split('[br]').join(' ');
        }
        // Multi-line: replace [br] with \N
        return processed.split('[br]').join('\\N');
    };

    const original = formatContent(sub.originalText); 
    const translated = sub.translatedText ? formatContent(sub.translatedText) : '';

    if (!translated && !original) return '';

    const eventPrimary = translated ? `Dialogue: 0,${start},${end},Primary,,0,0,0,,${translated}` : '';
    const eventSecondary = original ? `Dialogue: 0,${start},${end},Secondary,,0,0,0,,${original}` : '';

    return `${eventPrimary}\n${eventSecondary}`;
  }).join('\n');

  return header + events;
};

/**
 * Generates SRT content.
 */
const renderSRT = (optimizedSubtitles: SubtitleLine[], config: AssStyleConfig): string => {
    return optimizedSubtitles.map((sub, index) => {
        const cleanText = (t: string) => {
            // 1. Normalize explicit HTML breaks to internal [br]
            let normalized = normalizeBreaks(t);

            // 2. Remove ASS override tags if any remain
            let cleaned = normalized.replace(/{[^}]*}/g, '');

            // 3. Handle [br]
            if (config.linesPerSubtitle === 1) {
                return cleaned.split('[br]').join(' ');
            }
            return cleaned.split('[br]').join('\n');
        };

        const primaryText = sub.translatedText ? cleanText(sub.translatedText) : '';
        const secondaryText = cleanText(sub.originalText);
        
        const primaryHex = config.primary.color;
        const secondaryHex = config.secondary.color;
        
        const primaryBlock = primaryText ? `<font color="${primaryHex}">${primaryText}</font>` : '';
        const secondaryBlock = secondaryText ? `<font color="${secondaryHex}">${secondaryText}</font>` : '';
        
        let content = '';
        if (config.stackOrder === 'primary-top') {
            const lines = [];
            if (primaryBlock) lines.push(primaryBlock);
            if (secondaryBlock) lines.push(secondaryBlock);
            content = lines.join('\n');
        } else {
            const lines = [];
            if (secondaryBlock) lines.push(secondaryBlock);
            if (primaryBlock) lines.push(primaryBlock);
            content = lines.join('\n');
        }
        
        return `${index + 1}\n${sub.startTime} --> ${sub.endTime}\n${content}`;
    }).join('\n\n');
};

/**
 * Main export function for unified output generation.
 * Accepts smartTiming toggle.
 */
export const generateSubtitleContent = (subtitles: SubtitleLine[], config: AssStyleConfig, smartTiming: boolean = true): string => {
  const optimizedSubtitles = optimizeTimings(subtitles, smartTiming);
  
  if (config.outputFormat === 'srt') {
      return renderSRT(optimizedSubtitles, config);
  }
  return renderASS(optimizedSubtitles, config);
};

export const downloadFile = (content: string, fileName: string) => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};

export const STYLE_PRESETS: { [key: string]: AssStyleConfig } = {
    DEFAULT: {
        outputFormat: 'ass',
        layout: 'stacked',
        stackOrder: 'primary-top',
        primary: { color: '#ffffff', fontSize: 60 },
        secondary: { color: '#ffff00', fontSize: 60 },
        outlineWidth: 3,
        shadowDepth: 2,
        borderStyle: 1,
        fontFamily: 'Arial',
        linesPerSubtitle: 2
    },
    NETFLIX: {
        outputFormat: 'ass',
        layout: 'stacked',
        stackOrder: 'secondary-top',
        primary: { color: '#ffffff', fontSize: 65 },
        secondary: { color: '#ffffff', fontSize: 65 },
        outlineWidth: 2,
        shadowDepth: 2,
        borderStyle: 1,
        fontFamily: 'Arial',
        linesPerSubtitle: 2
    },
    ANIME: {
        outputFormat: 'ass',
        layout: 'stacked',
        stackOrder: 'secondary-top',
        primary: { color: '#ffffff', fontSize: 60 },
        secondary: { color: '#ffaa00', fontSize: 55 },
        outlineWidth: 4,
        shadowDepth: 0,
        borderStyle: 1,
        fontFamily: 'Trebuchet MS',
        linesPerSubtitle: 2
    },
    CINEMATIC: {
        outputFormat: 'ass',
        layout: 'stacked',
        stackOrder: 'secondary-top',
        primary: { color: '#e0e0e0', fontSize: 50 },
        secondary: { color: '#aaaaaa', fontSize: 50 },
        outlineWidth: 0,
        shadowDepth: 0,
        borderStyle: 3,
        fontFamily: 'Arial Narrow',
        linesPerSubtitle: 1
    },
    KODI: {
        outputFormat: 'srt',
        layout: 'stacked',
        stackOrder: 'secondary-top',
        primary: { color: '#ffffff', fontSize: 32 },
        secondary: { color: '#ffff00', fontSize: 32 },
        outlineWidth: 0,
        shadowDepth: 0,
        borderStyle: 1,
        fontFamily: 'Arial',
        linesPerSubtitle: 2
    }
};