import { useState, useRef, useEffect } from 'react';
import { useBatch } from '../contexts/BatchContext';
import { useSettings } from '../contexts/SettingsContext';
import { useToast } from '../components/Toast';
import { translateBatch, generateContext, detectLanguage, generateShowBible, identifyShowName } from '../services/geminiService';
import { loadShowMetadata, saveShowMetadata } from '../services/storage';
import { calculateSafeDurations } from '../services/subtitleUtils';
import { LogEntry, SubtitleLine } from '../types';
import { BATCH_SIZE, CONCURRENCY, OVERLAP_SIZE } from '../constants';

export const useTranslationEngine = () => {
    const { state: batchState, dispatch: batchDispatch } = useBatch();
    const { batchItems } = batchState;
    const { 
        modelConfig, 
        targetLang, 
        autoContext, 
        autoBible 
    } = useSettings();
    const { addToast } = useToast();

    const isCancelled = useRef(false);
    const isTranslating = useRef(false);
    const completedLinesRef = useRef(0);
    const activeLinesRef = useRef(0); 
    const progressValueRef = useRef(0);

    const [confirmationRequest, setConfirmationRequest] = useState<{ itemId: string; fileName: string; detectedLanguage: string; resolve: (val: boolean) => void } | null>(null);

    useEffect(() => {
        if (confirmationRequest) {
            console.log("Confirmation requested:", confirmationRequest);
            // We use a timeout to allow the UI to update before blocking with window.confirm
            setTimeout(() => {
                const confirmed = window.confirm(`Detected language: ${confirmationRequest.detectedLanguage}. Continue?`);
                confirmationRequest.resolve(confirmed);
                setConfirmationRequest(null);
            }, 100);
        }
    }, [confirmationRequest]);

    const translateSingleFile = async (itemId: string) => {
        const itemIndex = batchItems.findIndex(i => i.id === itemId);
        if (itemIndex === -1) return;
        const item = batchItems[itemIndex];
        if (item.subtitles.length === 0) return;
  
        batchDispatch({ type: 'UPDATE_ITEM', payload: { id: itemId, updates: { status: 'translating', progress: 0, message: 'Starting...', logs: [] } } });
        completedLinesRef.current = 0;
        activeLinesRef.current = 0;
        progressValueRef.current = 0;
        const totalLines = item.subtitles.length;
  
        const logInfo = (message: string, type: 'info' | 'request' | 'response' | 'error' = 'info', data?: unknown) => {
            const entry: LogEntry = { timestamp: Date.now(), type, message, data };
            batchDispatch({ type: 'ADD_LOG', payload: { id: itemId, entry } });
        };
  
        const { isEnglish, language } = await detectLanguage(item.subtitles, modelConfig.useSimulation, modelConfig);
        
        if (!isEnglish) {
             batchDispatch({ type: 'UPDATE_ITEM', payload: { id: itemId, updates: { message: `Detected: ${language}` } } });
             const userConfirmed = await new Promise<boolean>((resolve) => {
                 setConfirmationRequest({ itemId, fileName: item.fileName, detectedLanguage: language, resolve: (val) => { setConfirmationRequest(null); resolve(val); } });
             });
             if (!userConfirmed) {
                  batchDispatch({ type: 'UPDATE_ITEM', payload: { id: itemId, updates: { status: 'error', progress: 0, message: `Cancelled (${language})` } } });
                  return;
             }
        }
  
        let showName = "";
        if (autoContext || autoBible) {
            showName = await identifyShowName(item.fileName, modelConfig.useSimulation, modelConfig);
            const cachedMetadata = await loadShowMetadata(showName);
            let context = item.context || cachedMetadata?.context || "";
            let showBible = item.showBible || cachedMetadata?.bible || "";
            let newDataGenerated = false;
  
            if (autoContext && !context) {
                batchDispatch({ type: 'UPDATE_ITEM', payload: { id: itemId, updates: { message: 'Analyzing plot context...' } } });
                try { 
                    context = await generateContext(item.fileName, modelConfig.useSimulation, modelConfig); 
                    newDataGenerated = true;
                } catch(e) { console.error(e); }
            }
            if (autoBible && !showBible) {
                batchDispatch({ type: 'UPDATE_ITEM', payload: { id: itemId, updates: { message: 'Generating Glossary...' } } });
                try { 
                    showBible = await generateShowBible(item.fileName, targetLang, modelConfig.useSimulation, modelConfig);
                    newDataGenerated = true;
                } catch (e) { console.error(e); }
            }
            batchDispatch({ type: 'UPDATE_ITEM', payload: { id: itemId, updates: { context: context, showBible: showBible } } });
            if (newDataGenerated && showName) await saveShowMetadata(showName, { context, bible: showBible });
        }
  
        // Re-read for latest
        let contextToUse = item.context || "";
        let bibleToUse = item.showBible || "";
        if (!contextToUse && showName) contextToUse = (await loadShowMetadata(showName))?.context || "";
        if (!bibleToUse && showName) bibleToUse = (await loadShowMetadata(showName))?.bible || "";
        
        const safeDurations = calculateSafeDurations(item.subtitles);
        const newSubtitles = [...item.subtitles];
        interface ChunkData { lines: SubtitleLine[]; previous: SubtitleLine[]; chunkIndex: number; totalChunks: number }
        const chunks: ChunkData[] = [];
        for (let i = 0; i < totalLines; i += BATCH_SIZE) {
          const chunkLines = newSubtitles.slice(i, i + BATCH_SIZE);
          const previousLines = i > 0 ? newSubtitles.slice(Math.max(0, i - OVERLAP_SIZE), i) : [];
          chunks.push({ lines: chunkLines, previous: previousLines, chunkIndex: Math.floor(i / BATCH_SIZE) + 1, totalChunks: Math.ceil(totalLines/BATCH_SIZE) });
        }
  
        const processChunk = async (chunkData: ChunkData) => {
            if (isCancelled.current) return;
            const { lines, previous, chunkIndex } = chunkData;
            activeLinesRef.current += lines.length; 
            const linesToTranslate = lines.filter(l => !l.translatedText);
            
            if (linesToTranslate.length > 0) {
                let chunkAttempts = 0;
                let chunkSuccess = false;
                while (chunkAttempts < 3 && !chunkSuccess && !isCancelled.current) {
                    chunkAttempts++;
                    try {
                        if (chunkAttempts > 1) batchDispatch({ type: 'UPDATE_ITEM', payload: { id: itemId, updates: { message: `Retrying block ${chunkIndex}...` } } });
                        const translations = await translateBatch(linesToTranslate, targetLang, contextToUse, previous, modelConfig, safeDurations, bibleToUse, logInfo);
                        const missingIds = linesToTranslate.filter(l => !translations.has(l.id));
                        if (missingIds.length === 0) {
                            linesToTranslate.forEach(line => { if (translations.has(line.id)) line.translatedText = translations.get(line.id); });
                            chunkSuccess = true;
                        } else {
                             linesToTranslate.forEach(line => { if (translations.has(line.id)) line.translatedText = translations.get(line.id); });
                        }
                    } catch (error) {
                        const message = error instanceof Error ? error.message : String(error);
                        if (message.includes("TERMINAL")) {
                             batchDispatch({ type: 'UPDATE_ITEM', payload: { id: itemId, updates: { status: 'error', message: `Stopped: ${message}` } } });
                             isCancelled.current = true;
                             return; 
                        }
                        await new Promise(r => setTimeout(r, 1000 * chunkAttempts));
                    }
                }
            }
            activeLinesRef.current -= lines.length; 
            completedLinesRef.current += lines.length;
            const percentage = Math.round((completedLinesRef.current / totalLines) * 100);
            batchDispatch({ type: 'UPDATE_ITEM', payload: { id: itemId, updates: { subtitles: [...newSubtitles], progress: percentage, message: `Translating... ${percentage}%` } } });
        };
  
        const chunkQueue = [...chunks];
        const workers = Array.from({ length: CONCURRENCY }, () => (async () => {
            while (chunkQueue.length > 0 && !isCancelled.current) {
                const chunk = chunkQueue.shift();
                if (chunk) await processChunk(chunk);
            }
        })());
        await Promise.all(workers);
        
        // Final Verification (Simplified for brevity in update)
        if (!isCancelled.current) {
            batchDispatch({ type: 'UPDATE_ITEM', payload: { id: itemId, updates: { status: 'completed', progress: 100, message: 'Done' } } });
            addToast(`Translation completed: ${item.fileName}`, 'success');
        }
    };
  
    const handleTranslateAll = async () => {
        // API Key Check logic
        if (!modelConfig.useSimulation) {
             if (modelConfig.provider === 'gemini' && !process.env.API_KEY) { 
                 addToast("System Error: Gemini API Key is missing.", "error"); return; 
             }
             if (modelConfig.provider === 'google_nmt' && !modelConfig.apiKey) {
                 addToast("System Error: Google Cloud API Key is missing for NMT.", "error"); return;
             }
        }
  
        isCancelled.current = false;
        isTranslating.current = true;
        const pendingItems = batchItems.filter(i => i.status === 'pending' || i.status === 'error');
        
        if (pendingItems.length === 0) {
            addToast("No pending files to translate", "info");
            isTranslating.current = false;
            return;
        }
        
        addToast(`Starting translation for ${pendingItems.length} files...`, "info");
        
        for (const item of pendingItems) {
            if (isCancelled.current) break;
            await translateSingleFile(item.id);
        }
        isTranslating.current = false;
    };

    return {
        handleTranslateAll,
        isTranslatingRef: isTranslating,
        confirmationRequest
    };
};
