import { GoogleGenAI } from "@google/genai";
import { SubtitleLine, ModelConfig } from "../types";

const getClient = () => {
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
      throw new Error("API Key not found. Please ensure process.env.API_KEY is set.");
    }
    return new GoogleGenAI({ apiKey });
};

/**
 * Helper: Retry mechanism for API calls with exponential backoff for 429 errors.
 */
const generateContentWithRetry = async (ai: GoogleGenAI, params: any, retries = 3): Promise<any> => {
  try {
    return await ai.models.generateContent(params);
  } catch (e: any) {
    // Check for 429 (Too Many Requests) or 503 (Service Unavailable)
    if ((e.status === 429 || e.status === 503) && retries > 0) {
      const waitTime = Math.pow(2, 4 - retries) * 1000; // 2s, 4s, 8s
      console.warn(`API Rate Limit hit. Retrying in ${waitTime}ms...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      return generateContentWithRetry(ai, params, retries - 1);
    }
    throw e;
  }
};

/**
 * Generates a translation context description based on the filename.
 */
export const generateContext = async (filename: string): Promise<string> => {
    const ai = getClient();
    try {
        const response = await generateContentWithRetry(ai, {
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
    const sample = lines
        .filter(l => l.originalText.length > 5) 
        .slice(0, 20)
        .map(l => l.originalText)
        .join('\n');
        
    if (!sample) return { isEnglish: true, language: 'English' }; 

    try {
        const response = await generateContentWithRetry(ai, {
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

    instruction += `\n
    STRICT FORMATTING RULES:
    1. MAX LENGTH: Each line must be MAX 42 characters.
    2. LINE COUNT: Max 2 lines per subtitle.
    3. TIMING AWARENESS: You are provided with the duration of each line in milliseconds. 
       - If duration < 1500ms, the translation MUST be very concise (2-4 words max).
       - Do NOT fill space with fluff just because duration is long.
       - Ensure the viewer has enough time to read the text.
    4. LINGUISTIC BREAKS: Never split a noun from its article, or a preposition from its noun.
    5. DIALOGUE: If the subtitle contains dialogue for two people (starts with "- "), keep each person's speech on its own line.
    6. LINE BREAK TOKEN: Use the token "[br]" to indicate a line break within the subtitle.
    `;

    if (isRetry) {
        instruction += `\n\nCRITICAL RETRY INSTRUCTION: The previous translations were TOO LONG. You MUST condense the meaning.
        - Sacrifice minor details for brevity.
        - Use shorter synonyms.
        - STRICTLY enforce the 42 character limit.`;
    }

    return instruction;
};

export const translateBatch = async (
  lines: SubtitleLine[], 
  targetLanguage: string = "Vietnamese",
  context: string = "",
  previousLines: SubtitleLine[] = [],
  modelConfig: ModelConfig = { 
      modelName: 'gemini-3-flash-preview', 
      temperature: 0.3, 
      topP: 0.95, 
      topK: 40, 
      maxOutputTokens: 8192 
  },
  durations: Map<number, number> = new Map()
): Promise<Map<number, string>> => {
  
  const performTranslation = async (linesToProcess: SubtitleLine[], isRetry: boolean): Promise<Map<number, string>> => {
      const ai = getClient();
      
      const previousBlock = previousLines.length > 0 && !isRetry 
        ? `PREVIOUS LINES (Context only - DO NOT TRANSLATE):\n${previousLines.map(l => `${l.id} ||| ${l.originalText}`).join('\n')}\n\n` 
        : '';

      const inputBlock = linesToProcess.map(l => {
          const dur = durations.get(l.id) || 2000;
          return `ID: ${l.id} | Dur: ${dur}ms | Text: ${l.originalText}`;
      }).join('\n');
      
      const contextInstruction = getLanguageInstruction(targetLanguage, context, isRetry);

      const prompt = `You are a professional subtitle translator and formatter. Translate from English to ${targetLanguage}.

${contextInstruction}

Rules:
1. Input format: "ID: <id> | Dur: <ms> | Text: <text>". 
2. Output format: "<id> ||| <Translated Text>".
3. Keep the ID and " ||| " separator EXACTLY as is.
4. PRESERVE formatting tags (like <i>, <b>, <font>) exactly as they appear.
5. Insert "[br]" where a line break is necessary to meet the 42-char/2-line limit.

${!isRetry ? 'The "PREVIOUS LINES" section is provided for context continuity only.' : ''}

${previousBlock}LINES TO TRANSLATE:
${inputBlock}`;

      try {
        const response = await generateContentWithRetry(ai, {
            model: modelConfig.modelName, 
            contents: prompt,
            config: { 
                responseMimeType: "text/plain",
                temperature: modelConfig.temperature,
                topP: modelConfig.topP,
                topK: modelConfig.topK,
                maxOutputTokens: modelConfig.maxOutputTokens
            }
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

  initialResults.forEach((translatedText, id) => {
      const len = translatedText.replace('[br]', '').length;
      if (len > 90) {
          const originalLine = lines.find(l => l.id === id);
          if (originalLine) linesToRetry.push(originalLine);
      }
  });

  if (linesToRetry.length > 0) {
      const retryResults = await performTranslation(linesToRetry, true);
      retryResults.forEach((val, key) => {
          finalResults.set(key, val);
      });
  }

  return finalResults;
};