
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { SubtitleLine, ModelConfig } from "../types";

const getClient = () => {
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
      throw new Error("API Key not found. Please ensure process.env.API_KEY is set.");
    }
    return new GoogleGenAI({ apiKey });
};

// Map display names to ISO-639 codes for Google Translate
const LANGUAGE_CODES: Record<string, string> = {
    "Arabic": "ar", "Bulgarian": "bg", "Chinese (Simplified)": "zh-CN", "Chinese (Traditional)": "zh-TW",
    "Croatian": "hr", "Czech": "cs", "Danish": "da", "Dutch": "nl", "Estonian": "et", "Finnish": "fi",
    "French": "fr", "German": "de", "Greek": "el", "Hindi": "hi", "Hungarian": "hu", "Indonesian": "id",
    "Irish": "ga", "Italian": "it", "Japanese": "ja", "Korean": "ko", "Latvian": "lv", "Lithuanian": "lt",
    "Maltese": "mt", "Polish": "pl", "Portuguese": "pt", "Romanian": "ro", "Slovak": "sk", "Slovenian": "sl",
    "Spanish": "es", "Swedish": "sv", "Thai": "th", "Turkish": "tr", "Ukrainian": "uk", "Vietnamese": "vi"
};

/**
 * Wrapper to enforce a timeout on promises.
 */
const callWithTimeout = async <T>(promise: Promise<T>, timeoutMs: number): Promise<T> => {
    let timeoutHandle: ReturnType<typeof setTimeout>;
    const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutHandle = setTimeout(() => reject(new Error("REQUEST_TIMEOUT")), timeoutMs);
    });

    return Promise.race([promise, timeoutPromise]).finally(() => {
        clearTimeout(timeoutHandle);
    });
};

/**
 * Helper to parse JSON from LLM response (robust against Markdown code blocks)
 */
const parseJSONResponse = (text: string): Record<string, string> => {
    try {
        let clean = text.trim();
        // Remove Markdown code blocks if present
        clean = clean.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '');
        
        // Find the first '{' and last '}' to isolate the JSON object
        const firstOpen = clean.indexOf('{');
        const lastClose = clean.lastIndexOf('}');
        
        if (firstOpen !== -1 && lastClose !== -1 && lastClose > firstOpen) {
            clean = clean.substring(firstOpen, lastClose + 1);
        }

        return JSON.parse(clean);
    } catch (e) {
        console.warn("JSON Parse Warning: output might be malformed", e);
        // Fallback: If strict parsing fails, return empty object (caller will handle missing keys)
        return {};
    }
};

interface GoogleNMTResponse {
    data?: {
        translations?: Array<{
            translatedText: string;
        }>;
    };
    error?: {
        message?: string;
    };
}

interface OpenAIResponse {
    choices?: Array<{
        message?: {
            content?: string;
        };
    }>;
    error?: {
        message?: string;
    };
}


export class GeminiAPIError extends Error {
    constructor(message: string, public status?: number, public code?: string) {
        super(message);
        this.name = "GeminiAPIError";
    }
}

const handleAPIError = (error: unknown, provider: string): never => {
    let message = "Unknown Error";
    let status: number | undefined;

    if (error instanceof Error) {
        message = error.message;
    } else if (typeof error === 'string') {
        message = error;
    }

    // Handle specific Gemini/Google GenAI error structures
    const errObj = error as { status?: number; message?: string; response?: { status?: number } };
    if (errObj.status) {
        status = errObj.status;
    } else if (errObj.response?.status) {
        status = errObj.response.status;
    }

    const lowerMsg = message.toLowerCase();

    if (status === 400 || status === 401 || status === 403 || lowerMsg.includes("api key not found")) {
        throw new GeminiAPIError(`TERMINAL: API Key Invalid or Permission Denied (${status || 'Config'})`, status, "AUTH_ERROR");
    }
    if (lowerMsg.includes("quota") || lowerMsg.includes("exhausted") || lowerMsg.includes("billing") || status === 429) {
        throw new GeminiAPIError(`TERMINAL: Quota Exceeded. Check your API billing.`, status, "QUOTA_EXCEEDED");
    }
    if (lowerMsg.includes("timeout") || message === "REQUEST_TIMEOUT") {
        throw new GeminiAPIError(`${provider} Request Timed Out`, status, "TIMEOUT");
    }
    if (lowerMsg.includes("fetch failed") || lowerMsg.includes("network") || lowerMsg.includes("connection refused")) {
        throw new GeminiAPIError(`${provider} Network Connection Failed`, status, "NETWORK_ERROR");
    }
    if (lowerMsg.includes("terminal")) {
         // Pass through existing terminal errors
         throw new GeminiAPIError(message, status, "TERMINAL_ERROR");
    }

    throw new GeminiAPIError(`${provider} Error: ${message}`, status, "GENERIC_ERROR");
};

/**
 * Calls Google Cloud Translation API (Basic v2)
 */
const translateWithGoogleNMT = async (
    texts: string[],
    targetLang: string,
    apiKey: string
): Promise<string[]> => {
    const targetCode = LANGUAGE_CODES[targetLang] || 'en';
    const url = `https://translation.googleapis.com/language/translate/v2?key=${apiKey}`;

    try {
        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                q: texts,
                target: targetCode,
                format: "text" // Use 'text' to prevent HTML escaping of regular chars, but 'html' if tags exist
            })
        });

        if (!response.ok) {
            const err = await response.json() as GoogleNMTResponse;
            throw new Error(`Google Translate API Error: ${err.error?.message || response.statusText}`);
        }

        const data = await response.json() as GoogleNMTResponse;
        if (data.data && data.data.translations) {
            return data.data.translations.map(t => t.translatedText);
        }
        return [];
    } catch (e) {
        return handleAPIError(e, "Google NMT");
    }
};

/**
 * Call OpenAI Compatible API (Local LLM, DeepSeek, etc.)
 */
const generateOpenAICompatibleContent = async (config: ModelConfig, prompt: string, systemInstruction?: string): Promise<string> => {
    // Determine endpoint
    let endpoint = config.localEndpoint;
    if (!endpoint) {
        if (config.provider === 'local') endpoint = 'http://127.0.0.1:8080/v1/chat/completions';
        else if (config.provider === 'openai') endpoint = 'https://api.openai.com/v1/chat/completions';
    }

    if (!endpoint) throw new GeminiAPIError("Endpoint is required for this provider.", undefined, "CONFIG_ERROR");

    // Fallback model name
    const model = config.modelName || 'local-model';

    const messages = [];
    if (systemInstruction) {
        messages.push({ role: 'system', content: systemInstruction });
    }
    messages.push({ role: 'user', content: prompt });

    const headers: Record<string, string> = {
        'Content-Type': 'application/json'
    };

    if (config.apiKey) {
        headers['Authorization'] = `Bearer ${config.apiKey}`;
    }

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({
                model: model,
                messages: messages,
                temperature: config.temperature,
                top_p: config.topP,
                max_tokens: config.maxOutputTokens
            })
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`${config.provider} API Error: ${response.status} - ${errText}`);
        }

        const data = await response.json() as OpenAIResponse;
        return data.choices?.[0]?.message?.content || "";
    } catch (e) {
        return handleAPIError(e, config.provider);
    }
};

/**
 * Unified generation function that switches between providers.
 */
const queryAI = async (
    prompt: string, 
    config: ModelConfig = { 
        provider: 'gemini',
        modelName: 'gemini-3-flash-preview', 
        temperature: 0.3, 
        topP: 0.95, 
        topK: 40, 
        maxOutputTokens: 8192,
        useSimulation: false
    },
    systemInstruction?: string
): Promise<string> => {

    // 1. Simulation Mode
    if (config.useSimulation) {
        await new Promise(r => setTimeout(r, 1000));
        // If the prompt looks like JSON (starts with TASK: JSON), return mock JSON
        if (prompt.includes("TASK: JSON-to-JSON")) {
             // Extract IDs roughly
             const ids: string[] = prompt.match(/"id_\d+"/g) || [];
             const mockObj: Record<string, string> = {};
             ids.forEach(id => {
                 mockObj[id.replace(/"/g, '')] = "[SIMULATED TRANSLATION]";
             });
             return JSON.stringify(mockObj, null, 2);
        }
        return "SIMULATION RESPONSE: " + prompt.substring(0, 50) + "...";
    }

    // 2. Google NMT Guard
    if (config.provider === 'google_nmt') {
        throw new GeminiAPIError("Generative Context/Bible features are not available when using Google Translate (NMT). Switch to an LLM provider (Gemini/OpenAI) to use these features.", undefined, "FEATURE_NOT_SUPPORTED");
    }

    // 3. OpenAI Compatible Providers (Local, Custom)
    if (config.provider === 'local' || config.provider === 'openai') {
        try {
            return await callWithTimeout(generateOpenAICompatibleContent(config, prompt, systemInstruction), 120000); 
        } catch (e) {
            handleAPIError(e, config.provider);
        }
    }

    // 4. Gemini (Cloud)
    const ai = getClient();
    try {
        // 45 Seconds Hard Timeout for Gemini API calls
        const response = await callWithTimeout<GenerateContentResponse>(ai.models.generateContent({
            model: config.modelName,
            contents: prompt,
            config: {
                responseMimeType: "text/plain", // We parse JSON manually for robustness
                systemInstruction: systemInstruction,
                temperature: config.temperature,
                topP: config.topP,
                topK: config.topK,
                maxOutputTokens: config.maxOutputTokens
            }
        }), 45000);
        
        return response.text || "";
    } catch (e) {
        return handleAPIError(e, "Gemini");
    }
};

/**
 * Identifies the Show Name from a filename for caching purposes.
 */
export const identifyShowName = async (filename: string, useSimulation: boolean = false, providerConfig?: ModelConfig): Promise<string> => {
    const config = providerConfig || { 
        provider: 'gemini', 
        modelName: 'gemini-3-flash-preview', 
        temperature: 0.3, topP: 0.95, topK: 40, maxOutputTokens: 100,
        useSimulation 
    };

    if (config.useSimulation) {
        await new Promise(r => setTimeout(r, 500));
        return "Simulated Show Title";
    }

    // Skip if NMT
    if (config.provider === 'google_nmt') return filename;

    try {
        const prompt = `Extract the official Movie or TV Show title from this filename: "${filename}". 
        
        Rules:
        1. Return ONLY the title.
        2. Remove season/episode numbers, quality tags (1080p), and format extensions.
        3. Do not add quotes or punctuation.
        
        Example: "Breaking.Bad.S01E05.720p.mkv" -> "Breaking Bad"`;

        const result = await queryAI(prompt, config);
        return result.trim().replace(/['"]/g, '');
    } catch (error) {
        console.warn("Show identification failed, using filename as key", error);
        return filename;
    }
};

/**
 * Generates a translation context description based on the filename.
 */
export const generateContext = async (filename: string, useSimulation: boolean = false, providerConfig?: ModelConfig): Promise<string> => {
    // Basic mock config if none provided, preserving simulation flag
    const config = providerConfig || { 
        provider: 'gemini', 
        modelName: 'gemini-3-flash-preview', 
        temperature: 0.3, topP: 0.95, topK: 40, maxOutputTokens: 1024,
        useSimulation 
    };

    if (config.useSimulation) {
        await new Promise(r => setTimeout(r, 1000));
        return "SIMULATION: This is a generated context for testing purposes. It simulates a plot summary derived from the filename.";
    }

    // Skip if NMT
    if (config.provider === 'google_nmt') return "";

    try {
        const prompt = `Identify the movie or TV show from this filename: "${filename}". 
            
            Output ONLY a concise 2-3 sentence summary of the plot and main character dynamics.
            
            Rules:
            1. No "Based on the filename..." or "This appears to be...".
            2. No warnings about unreleased seasons or file discrepancies.
            3. No meta-commentary. 
            4. Start directly with the plot description.`;

        return await queryAI(prompt, config);
    } catch (error) {
        console.error("Context generation error:", error);
        return "";
    }
};

/**
 * Generates a "Show Bible" / Glossary of characters and pronoun mappings.
 */
export const generateShowBible = async (filename: string, targetLanguage: string, useSimulation: boolean = false, providerConfig?: ModelConfig): Promise<string> => {
    const config = providerConfig || { 
        provider: 'gemini', 
        modelName: 'gemini-3-flash-preview', 
        temperature: 0.3, topP: 0.95, topK: 40, maxOutputTokens: 2048,
        useSimulation 
    };

    if (config.useSimulation) {
        await new Promise(r => setTimeout(r, 1500));
        return "SIMULATION GLOSSARY:\nJohn Doe - Protagonist | Pronouns: Anh/Em\nJane Doe - Sister | Pronouns: Chị/Em\nVillain - Antagonist | Pronouns: Hắn/Tao";
    }

    // Skip if NMT
    if (config.provider === 'google_nmt') return "";

    try {
        const prompt = `You are a Localization Expert constructing a "Show Bible" for the video file: "${filename}".
        Target Language: ${targetLanguage}.

        Tasks:
        1. Identify the Movie or TV Show (and Episode if applicable) from the filename.
        2. List the MAIN characters that appear.
        3. For each character, provide:
           - Name
           - Gender & Approx Age
           - Role/Relation to Protagonist
           ${targetLanguage === 'Vietnamese' ? '- VIETNAMESE PRONOUNS: Suggest the correct "Self" (Tôi/Tao/Con/Em) and "Other" (Bạn/Mày/Bố/Anh/Chị) pronouns based on their social hierarchy, age, and intimacy levels.' : ''}
        
        Output format:
        [Character Name] - [Role/Context] ${targetLanguage === 'Vietnamese' ? '| Pronouns: [Suggestions]' : ''}
        
        Keep it concise. Maximum 10 key characters.`;

        return await queryAI(prompt, config);
    } catch (error) {
        console.error("Bible generation error:", error);
        return "";
    }
};

/**
 * Checks the source language. Returns object with isEnglish flag and detected language name.
 */
export const detectLanguage = async (lines: SubtitleLine[], useSimulation: boolean = false, providerConfig?: ModelConfig): Promise<{ isEnglish: boolean; language: string }> => {
    const config = providerConfig || { 
        provider: 'gemini', 
        modelName: 'gemini-3-flash-preview', 
        temperature: 0.3, topP: 0.95, topK: 40, maxOutputTokens: 1024,
        useSimulation 
    };

    if (config.useSimulation) {
        await new Promise(r => setTimeout(r, 600));
        return { isEnglish: true, language: 'English (Simulated)' };
    }

    // Skip if NMT (assume English source for simplicity or just skip detection step in UI logic)
    if (config.provider === 'google_nmt') return { isEnglish: true, language: 'English' };

    const sample = lines
        .filter(l => l.originalText.length > 5) 
        .slice(0, 20)
        .map(l => l.originalText)
        .join('\n');
        
    if (!sample) return { isEnglish: true, language: 'English' }; 

    try {
        const prompt = `Analyze the following text sample from a subtitle file. 
            Identify the primary language.
            
            Respond with ONLY the language name (e.g. "English", "Vietnamese", "Spanish").
            
            TEXT SAMPLE:
            ${sample}`;
        
        const text = await queryAI(prompt, config);
        
        const languageName = text.trim().replace(/[.]/g, '').trim();
        const isEnglish = languageName.toLowerCase().includes("english");
        return { isEnglish, language: languageName };
    } catch (error) {
        console.warn("Language detection API failed, assuming English.", error);
        return { isEnglish: true, language: 'English' }; 
    }
};

/**
 * Main Translation Function
 */
export const translateBatch = async (
  lines: SubtitleLine[], 
  targetLanguage: string = "Vietnamese",
  context: string = "",
  previousLines: SubtitleLine[] = [],
  modelConfig: ModelConfig = { 
      provider: 'gemini',
      modelName: 'gemini-3-flash-preview', 
      temperature: 0.3, 
      topP: 0.95, 
      topK: 40, 
      maxOutputTokens: 8192,
      useSimulation: false
  },
  _durations: Map<number, number> = new Map(),
  showBible: string = "",
  onLog?: (message: string, type: 'info' | 'request' | 'response' | 'error', data?: unknown) => void
): Promise<Map<number, string>> => {

  const performTranslation = async (linesToProcess: SubtitleLine[], _isRetry: boolean): Promise<Map<number, string>> => {
      
      // --- GOOGLE NMT PATH ---
      if (modelConfig.provider === 'google_nmt') {
          if (onLog) onLog(`Sending Batch to Google Translate (${linesToProcess.length} lines)`, 'request');
          
          if (modelConfig.useSimulation) {
              await new Promise(r => setTimeout(r, 800));
              const resultMap = new Map<number, string>();
              linesToProcess.forEach(l => resultMap.set(l.id, "[NMT SIMULATED] " + l.originalText));
              return resultMap;
          }

          if (!modelConfig.apiKey) throw new Error("Google Cloud API Key is required for NMT.");

          const texts = linesToProcess.map(l => l.originalText);
          try {
              const translations = await translateWithGoogleNMT(texts, targetLanguage, modelConfig.apiKey);
              const resultMap = new Map<number, string>();
              
              linesToProcess.forEach((line, index) => {
                  if (translations[index]) {
                      // NMT usually preserves HTML entities, but let's ensure breaks are handled if needed.
                      // Google Translate often preserves <br> tags if passed, but our internal representation uses [br].
                      // The helper below might need to swap [br] back if we want NMT to respect it, but NMT treats text as plain usually.
                      resultMap.set(line.id, translations[index]); 
                  }
              });
              if (onLog) onLog(`Received NMT Response`, 'response', translations);
              return resultMap;
          } catch (e) {
              const message = e instanceof Error ? e.message : String(e);
              if (onLog) onLog(`NMT Failed`, 'error', message);
              throw e;
          }
      }

      // --- LLM PATH (Gemini/OpenAI/Local) ---

      // 1. Build Payload (JSON)
      const chunkPayload: Record<string, string> = {};
      linesToProcess.forEach(l => {
          chunkPayload[`id_${l.id}`] = l.originalText;
      });
      const payloadJson = JSON.stringify(chunkPayload, null, 2);

      // 2. Build System Instruction (Identity + Global Context)
      let systemInstruction = `You are an expert subtitle translator.
Target Language: ${targetLanguage}.

GOAL: Translate the dialogue naturally, preserving the flow, tone, and character voices.
${context ? `\nSTORY CONTEXT:\n${context}` : ''}
${showBible ? `\nCHARACTER GLOSSARY:\n${showBible}` : ''}

RULES:
1. You will receive a JSON object mapping IDs to Source Text.
2. You must output a JSON object with the exact same keys, mapping IDs to Translated Text.
3. Do NOT translate the keys (e.g. "id_10").
4. Keep the output valid JSON.
5. Translate naturally and conversationally.
6. Use the token "[br]" to indicate a line break within the subtitle.
7. Max 42 characters per line (approx).`;

      if (targetLanguage === 'Vietnamese') {
          systemInstruction += `\n8. PRONOUNS: Use strict Vietnamese pronouns (Anh/Em/Con/Bác/Hắn/Tao) based on the Character Bible. Avoid neutral "Bạn/Tôi" unless generic.`;
      }

      // 3. Build User Prompt (Task + Immediate Context + Payload)
      const previousContextText = previousLines.length > 0 
        ? `IMMEDIATE CONTEXT (Preceding lines):\n${previousLines.map(l => `- ${l.translatedText || l.originalText}`).join('\n')}\n`
        : '';

      const userPrompt = `TASK: JSON-to-JSON Translation

${previousContextText}
INPUT JSON:
${payloadJson}

RESPONSE (JSON ONLY):`;

      if (onLog) onLog(`Sending Batch Request (${linesToProcess.length} lines)`, 'request', userPrompt);

      try {
        const text = await queryAI(userPrompt, modelConfig, systemInstruction);

        if (onLog) onLog(`Received Response`, 'response', text);

        // 4. Parse Response
        const responseJson = parseJSONResponse(text);
        const resultMap = new Map<number, string>();

        // 5. Map back to IDs
        Object.keys(responseJson).forEach(key => {
            const idMatch = key.match(/id_(\d+)/);
            if (idMatch) {
                const id = parseInt(idMatch[1]);
                if (!isNaN(id) && linesToProcess.some(l => l.id === id)) {
                    resultMap.set(id, responseJson[key]);
                }
            }
        });

        return resultMap;

      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (onLog) onLog(`Batch Failed`, 'error', message);
        console.error("Translation error:", error);
        throw error; 
      }
  };

  // 1. Initial Translation
  const initialResults = await performTranslation(lines, false);
  
  // 2. Length Check & Retry Logic (Simplified for JSON flow)
  // Skip retry logic for NMT as it is deterministic
  if (modelConfig.provider === 'google_nmt') return initialResults;

  const linesToRetry: SubtitleLine[] = [];
  const finalResults = new Map<number, string>(initialResults);

  initialResults.forEach((translatedText, id) => {
      // Check for length or missing translation
      const len = translatedText.replace('[br]', '').length;
      if (len > 100 || !translatedText) { 
          const originalLine = lines.find(l => l.id === id);
          if (originalLine) linesToRetry.push(originalLine);
      }
  });

  if (linesToRetry.length > 0) {
      if (onLog) onLog(`Length/Quality Check Failed for ${linesToRetry.length} lines. Retrying...`, 'info');
      try {
        const retryResults = await performTranslation(linesToRetry, true);
        retryResults.forEach((val, key) => {
            finalResults.set(key, val);
        });
      } catch (e) {
          if (onLog) onLog(`Retry Failed. Keeping original.`, 'error');
      }
  }

  return finalResults;
};
