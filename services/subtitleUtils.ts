import { SubtitleLine, AssStyleConfig } from '../types';

const CPS = 20; // Characters per second reading speed
const MIN_GAP_MS = 50; // Strict gap between subtitles
const MIN_DURATION_MS = 1000; // Minimum duration for a subtitle line

/**
 * Strips HTML tags from text to get actual character count.
 */
const stripTags = (html: string) => html.replace(/<[^>]*>/g, '');

/**
 * Parses SRT timestamp "00:00:00,000" to milliseconds.
 */
const parseTimeMs = (timeString: string): number => {
    if (!timeString) return 0;
    const parts = timeString.split(',');
    if (parts.length !== 2) return 0;
    const [time, ms] = parts;
    const [h, m, s] = time.split(':').map(Number);
    return (h * 3600000) + (m * 60000) + (s * 1000) + Number(ms);
};

/**
 * Formats milliseconds back to SRT timestamp "00:00:00,000".
 */
const formatSRTTime = (totalMs: number): string => {
    const ms = Math.floor(totalMs % 1000);
    const totalSeconds = Math.floor(totalMs / 1000);
    const s = totalSeconds % 60;
    const totalMinutes = Math.floor(totalSeconds / 60);
    const m = totalMinutes % 60;
    const h = Math.floor(totalMinutes / 60);

    const pad = (n: number, w: number = 2) => n.toString().padStart(w, '0');
    return `${pad(h)}:${pad(m)}:${pad(s)},${pad(ms, 3)}`;
};

/**
 * Optimizes subtitle timings to ensure NO OVERLAP and readable duration.
 */
const optimizeTimings = (subtitles: SubtitleLine[]): SubtitleLine[] => {
    return subtitles.map((sub, index) => {
        const startMs = parseTimeMs(sub.startTime);
        let endMs = parseTimeMs(sub.endTime);
        const originalDuration = endMs - startMs;

        const textEn = stripTags(sub.originalText || '');
        const textVi = stripTags(sub.translatedText || '');
        const maxChars = Math.max(textEn.length, textVi.length);
        
        // Calculate ideal reading duration
        const requiredMs = maxChars > 0 ? (maxChars / CPS) * 1000 : 0;
        
        // Extend short subtitles if needed, but prefer original duration if it's long enough
        let targetDuration = Math.max(originalDuration, requiredMs);
        if (targetDuration < MIN_DURATION_MS && maxChars > 0) {
            targetDuration = MIN_DURATION_MS;
        }

        let newEndMs = startMs + targetDuration;

        // STRICT CONSTRAINT: Never overlap the next subtitle.
        // The previous pair must disappear before the next starts.
        if (index < subtitles.length - 1) {
            const nextSub = subtitles[index + 1];
            const nextStartMs = parseTimeMs(nextSub.startTime);
            
            // Enforce a hard stop before the next subtitle begins
            if (newEndMs >= nextStartMs) {
                newEndMs = nextStartMs - MIN_GAP_MS;
            }
        }
        
        // Sanity Check: If optimization resulted in negative/zero duration (because next sub starts immediately)
        if (newEndMs <= startMs) {
            // Revert to original end if it fits, otherwise cap at next start - gap
            if (endMs > startMs && (index === subtitles.length - 1 || endMs < parseTimeMs(subtitles[index+1].startTime))) {
                newEndMs = endMs;
            } else if (index < subtitles.length - 1) {
                 const nextStart = parseTimeMs(subtitles[index+1].startTime);
                 newEndMs = Math.max(startMs + 500, nextStart - MIN_GAP_MS); // Try to give at least 500ms
                 // If 500ms still overlaps, we just have to clamp it tight
                 if (newEndMs >= nextStart) newEndMs = nextStart - 10;
            }
        }

        return {
            ...sub,
            endTime: formatSRTTime(newEndMs)
        };
    });
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
        const text = lines.slice(2).join(' '); 
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
    // ASS Alpha: 00 = Opaque, FF = Transparent
    // Input alpha: 0.0 (Transparent) -> 1.0 (Opaque) wait, usually alpha input 0-1 means opacity in CSS.
    // Let's assume input 'alpha' is Opacity (0 to 1). 
    // So 1 = 00 (Opaque), 0 = FF (Transparent).
    const alphaVal = Math.floor((1 - alpha) * 255).toString(16).padStart(2, '0').toUpperCase();
    return `&H${alphaVal}${b}${g}${r}`;
};

/**
 * Generates an ASS file content with dual subtitles.
 */
export const generateASS = (subtitles: SubtitleLine[], config: AssStyleConfig): string => {
  const optimizedSubtitles = optimizeTimings(subtitles);

  const primaryColorAss = toAssColor(config.primary.color, 1); // 100% opacity
  const secondaryColorAss = toAssColor(config.secondary.color, 1); // User manages opacity via color choice or we could add specific opacity controls later

  // Configurable Font Sizes
  const primSize = config.primary.fontSize;
  const secSize = config.secondary.fontSize;

  // Margin Calculation based on Stack Order
  let primMarginV = 80;
  let secMarginV = 40;
  
  if (config.layout === 'stacked') {
      // If Primary is Top, it gets the higher margin (80).
      // If Secondary is Top, IT gets the higher margin (80).
      if (config.stackOrder === 'secondary-top') {
          primMarginV = 40;
          secMarginV = 80;
      } else {
          primMarginV = 80;
          secMarginV = 40;
      }
  } else {
      // Split Layout
      // Bottom subtitle stays at 40 (or 50). Top goes to Alignment 8.
      if (config.stackOrder === 'primary-top') {
          // Primary Top (Align 8), Secondary Bottom (Align 2)
           // We handle alignment in the style string below, but margins need to be set logic wise
           // Actually, for split, one is Align 8, one is Align 2.
      }
  }

  // Define Layout Styles
  let stylePrimary = '';
  let styleSecondary = '';

  // Common ASS Params based on user request (ScaleY 140)
  // Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
  const commonParams = `Arial,SIZE,COLOR,&H000000FF,&H3C000000,&H7F000000,0,0,0,0,100,140,0,0,1,2,0,ALIGN,0000,0000,MARGIN,1`;

  const buildStyle = (name: string, size: number, color: string, align: number, margin: number) => {
      return `Style: ${name},` + commonParams
        .replace('SIZE', size.toString())
        .replace('COLOR', color)
        .replace('ALIGN', align.toString())
        .replace('MARGIN', margin.toString());
  };

  if (config.layout === 'stacked') {
      // Both Alignment 2 (Bottom)
      stylePrimary = buildStyle('Primary', primSize, primaryColorAss, 2, primMarginV);
      styleSecondary = buildStyle('Secondary', secSize, secondaryColorAss, 2, secMarginV);
  } else {
      // Split
      if (config.stackOrder === 'primary-top') {
          stylePrimary = buildStyle('Primary', primSize, primaryColorAss, 8, 30); // Top
          styleSecondary = buildStyle('Secondary', secSize, secondaryColorAss, 2, 40); // Bottom
      } else {
          stylePrimary = buildStyle('Primary', primSize, primaryColorAss, 2, 40); // Bottom
          styleSecondary = buildStyle('Secondary', secSize, secondaryColorAss, 8, 30); // Top
      }
  }

  const header = `[Script Info]
; Title: Dual Subtitles Generated by DualSub AI
; ScriptType: v4.00+
; Collisions: Reverse
PlayResX: 3840
PlayResY: 2160
ScaledBorderAndShadow: yes
WrapStyle: 0

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
${stylePrimary}
${styleSecondary}

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  const events = optimizedSubtitles.map((sub) => {
    const start = convertToASSTime(sub.startTime);
    const end = convertToASSTime(sub.endTime);
    
    const original = sub.originalText.replace(/<[^>]*>/g, '').trim(); 
    const translated = sub.translatedText ? sub.translatedText.replace(/<[^>]*>/g, '').trim() : '';

    if (!translated && !original) return '';

    const eventPrimary = translated ? `Dialogue: 0,${start},${end},Primary,,0,0,0,,${translated}` : '';
    const eventSecondary = original ? `Dialogue: 0,${start},${end},Secondary,,0,0,0,,${original}` : '';

    return `${eventPrimary}\n${eventSecondary}`;
  }).join('\n');

  return header + events;
};

/**
 * Triggers a browser download of text content as a file.
 */
export const downloadFile = (content: string, filename: string) => {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
