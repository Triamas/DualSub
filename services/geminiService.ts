import { GoogleGenAI } from "@google/genai";
import { SubtitleLine } from "../types";

const getClient = () => {
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
      throw new Error("API Key not found. Please ensure process.env.API_KEY is set.");
    }
    return new GoogleGenAI({ apiKey });
};

/**
 * Generates a translation context description based on the filename.
 */
export const generateContext = async (filename: string): Promise<string> => {
    const ai = getClient();
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: `Identify the movie or TV show from this filename: "${filename}". 
            
            Output ONLY a concise 2-3 sentence summary of the plot and main character dynamics.
            
            Rules:
            1. No "Based on the filename..." or "This appears to be...".
            2. No warnings about unreleased seasons or file discrepancies.
            3. No meta-commentary. 
            4. Start directly with the plot description.`,
            config: {
                responseMimeType: "text/plain",
            }
        });
        return response.text || "";
    } catch (error) {
        console.error("Context generation error:", error);
        return "";
    }
};

/**
 * Checks the source language. Returns object with isEnglish flag and detected language name.
 */
export const detectLanguage = async (lines: SubtitleLine[]): Promise<{ isEnglish: boolean; language: string }> => {
    const ai = getClient();
    // Take a sample from the first 20 lines, filtering out short/empty ones to get actual dialogue
    const sample = lines
        .filter(l => l.originalText.length > 5) 
        .slice(0, 20)
        .map(l => l.originalText)
        .join('\n');
        
    if (!sample) return { isEnglish: true, language: 'English' }; 

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: `Analyze the following text sample from a subtitle file. 
            Identify the primary language.
            
            Respond with ONLY the language name (e.g. "English", "Vietnamese", "Spanish").
            
            TEXT SAMPLE:
            ${sample}`,
            config: {
                responseMimeType: "text/plain",
            }
        });
        
        let text = response.text?.trim() || "English";
        // Clean up punctuation if any, keep letters and spaces
        const languageName = text.replace(/[.]/g, '').trim();
        
        const isEnglish = languageName.toLowerCase().includes("english");
        return { isEnglish, language: languageName };
    } catch (error) {
        console.warn("Language detection API failed, assuming English.", error);
        return { isEnglish: true, language: 'English' }; 
    }
};

const getLanguageInstruction = (targetLanguage: string, context: string, isRetry: boolean = false): string => {
    const baseContext = context ? `CONTEXT: ${context}.` : '';
    let instruction = `${baseContext}\n`;

    if (targetLanguage === 'Vietnamese') {
        const pronounRule = context 
            ? `PRONOUN GUIDANCE: Since speaker identity is unknown for specific lines, default to neutral/polite pronouns (Tôi/Bạn, Anh/Chị) to be safe. Only use specific relational pronouns (like Tao/Mày, Bố/Con) if the dialogue text content makes the relationship unmistakable.`
            : `Use natural Vietnamese. Default to neutral pronouns (Tôi/Bạn).`;
        instruction += pronounRule;
    } else {
        instruction += `Translate naturally and conversationally.`;
    }

    if (isRetry) {
        instruction += `\n\nCRITICAL INSTRUCTION: The previous translations for these lines were TOO LONG. You MUST translate them more concisely.
        - Shorten sentences.
        - Remove redundancy.
        - Maximum 2 lines of text visually.
        - If the English is short, the translation MUST be short.`;
    } else {
        instruction += `\nMaintain consistent tone. Avoid making the translation significantly longer than the original unless necessary for grammar.`;
    }

    return instruction;
};

export const translateBatch = async (
  lines: SubtitleLine[], 
  targetLanguage: string = "Vietnamese",
  context: string = "",
  previousLines: SubtitleLine[] = []
): Promise<Map<number, string>> => {
  
  const performTranslation = async (linesToProcess: SubtitleLine[], isRetry: boolean): Promise<Map<number, string>> => {
      const ai = getClient();
      
      const previousBlock = previousLines.length > 0 && !isRetry 
        ? `PREVIOUS LINES (Context only - DO NOT TRANSLATE):\n${previousLines.map(l => `${l.id} ||| ${l.originalText}`).join('\n')}\n\n` 
        : '';

      const inputBlock = linesToProcess.map(l => `${l.id} ||| ${l.originalText}`).join('\n');
      const contextInstruction = getLanguageInstruction(targetLanguage, context, isRetry);

      const prompt = `You are a professional subtitle translator. Translate the following lines from English to ${targetLanguage}.

${contextInstruction}

Rules:
1. Each line starts with an ID and " ||| ". Keep the ID and separator EXACTLY as is.
2. Translate the text after the separator. 
3. PRESERVE formatting tags (like <i>, <b>, <font>) exactly as they appear.
4. ACCURACY & LENGTH: Translate accurately but concisely. English subtitles usually fit in 1-2 lines. Your translation should try to match the length/duration of the original.
   - If the English is short (1 line), keep the translation short (1-2 lines).
   - Only use 3 lines if the English source is also long or dense.
   - Do not summarize proper nouns or numbers, but you may condense phrasing for readability.
5. Keep the translation natural and grammatical, suitable for subtitles.
6. Do not add any conversational filler, markdown code blocks, or explanations. Just the data.
${!isRetry ? '7. The "PREVIOUS LINES" section is provided purely for context to maintain continuity. DO NOT translate them again.' : ''}

${previousBlock}LINES TO TRANSLATE:
${inputBlock}`;

      try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview', 
            contents: prompt,
            config: { responseMimeType: "text/plain" }
        });

        const text = response.text || "";
        const resultMap = new Map<number, string>();
        const outputLines = text.split('\n');

        outputLines.forEach(line => {
            const separatorIndex = line.indexOf('|||');
            if (separatorIndex !== -1) {
                const idPart = line.substring(0, separatorIndex).trim();
                const textPart = line.substring(separatorIndex + 3).trim();
                const id = parseInt(idPart);
                if (!isNaN(id) && textPart && linesToProcess.some(l => l.id === id)) {
                    resultMap.set(id, textPart);
                }
            }
        });
        return resultMap;

      } catch (error) {
        console.error("Translation error:", error);
        return new Map();
      }
  };

  // 1. Initial Translation
  const initialResults = await performTranslation(lines, false);
  
  // 2. Length Check & Retry Logic
  const linesToRetry: SubtitleLine[] = [];
  const finalResults = new Map<number, string>(initialResults);

  // Heuristics for "Too Long"
  // Approx 40 chars per line. 
  // 3 lines ~ 120 chars. 
  // English short ~ 70 chars (less than 2 full lines).
  // If translation is > 110 chars AND English is < 70 chars, it is likely too long/verbose.
  const CHAR_LIMIT_LONG = 110; 
  const CHAR_LIMIT_SOURCE_SHORT = 70;

  initialResults.forEach((translatedText, id) => {
      const originalLine = lines.find(l => l.id === id);
      if (originalLine) {
          const enLen = originalLine.originalText.length;
          const trLen = translatedText.length;

          if (trLen > CHAR_LIMIT_LONG && enLen < CHAR_LIMIT_SOURCE_SHORT) {
              linesToRetry.push(originalLine);
          }
      }
  });

  if (linesToRetry.length > 0) {
      // Perform a targeted retry for just the problematic lines with strict instructions
      const retryResults = await performTranslation(linesToRetry, true);
      
      // Merge retry results, overwriting the verbose ones
      retryResults.forEach((val, key) => {
          finalResults.set(key, val);
      });
  }

  return finalResults;
};