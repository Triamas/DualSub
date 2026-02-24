import React from 'react';
import { useBatch } from '../contexts/BatchContext';
import { useSettings } from '../contexts/SettingsContext';
import { useToast } from '../components/Toast';
import { generateSubtitleContent, downloadFile } from '../services/subtitleUtils';
import { clearSession } from '../services/storage';
import { BatchItem, TabView, SubtitleLine } from '../types';

export const useSubtitleFile = (setActiveTab: (tab: TabView) => void) => {
    const { state: batchState, dispatch: batchDispatch } = useBatch();
    const { batchItems, activeItemId } = batchState;
    const { smartTiming, styleConfig } = useSettings();
    const { addToast } = useToast();
    const workerRef = React.useRef<Worker | null>(null);

    React.useEffect(() => {
        workerRef.current = new Worker(new URL('../services/worker.ts', import.meta.url), { type: 'module' });
        return () => {
            workerRef.current?.terminate();
        };
    }, []);

    const runWorker = <T>(type: string, payload: unknown): Promise<T> => {
        return new Promise((resolve, reject) => {
            if (!workerRef.current) return reject(new Error("Worker not initialized"));
            const id = crypto.randomUUID();
            const handler = (e: MessageEvent) => {
                if (e.data.id === id) {
                    workerRef.current?.removeEventListener('message', handler);
                    if (e.data.status === 'SUCCESS') resolve(e.data.result as T);
                    else reject(new Error(e.data.error));
                }
            };
            workerRef.current.addEventListener('message', handler);
            workerRef.current.postMessage({ id, type, payload });
        });
    };

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (!files || files.length === 0) return;

        // Helper to read file text
        const readFile = (file: File): Promise<{file: File, content: string}> => {
            return new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = (e) => resolve({ file, content: e.target?.result as string || '' });
                reader.onerror = () => resolve({ file, content: '' }); 
                reader.readAsText(file);
            });
        };

        const fileList = Array.from(files);
        const results = await Promise.all(fileList.map(readFile));
        let addedCount = 0;
        
        // Parse all files first using Worker
        const parsedFiles = await Promise.all(results.map(async ({ file, content }) => {
            try {
                const subtitles = await runWorker<SubtitleLine[]>('PARSE', { content, fileName: file.name });
                const nameNoExt = file.name.replace(/\.(srt|ass|vtt|ssa)$/i, "");
                return { file, subtitles, nameNoExt, valid: subtitles.length > 0 };
            } catch (e) {
                return { file, subtitles: [], nameNoExt: file.name, valid: false };
            }
        }));

        // Logic to merge and add items
        // Since we need to access current batchItems, we use the state from context
        const nextBatch = [...batchItems];
        const usedIndices = new Set<number>();

        // 1. Try to merge new files into EXISTING batch items
        for (let idx = 0; idx < parsedFiles.length; idx++) {
            const pFile = parsedFiles[idx];
            if (!pFile.valid) continue;

            // Find match in existing items (checks if pFile is translation of existing)
            const matchIndex = nextBatch.findIndex(existing => {
                 const existingNameNoExt = existing.fileName.replace(/\.(srt|ass|vtt|ssa)$/i, "");
                 if (pFile.nameNoExt.startsWith(existingNameNoExt)) {
                     const suffix = pFile.nameNoExt.substring(existingNameNoExt.length);
                     // Check suffix: -xx, _xx, .xx, or (1)
                     return /^([-_.]\w{2}|\s\(\d+\))$/.test(suffix);
                 }
                 return false;
            });

            if (matchIndex !== -1) {
                const existing = nextBatch[matchIndex];
                try {
                    const merged = await runWorker<SubtitleLine[]>('MERGE', { 
                        source: existing.subtitles, 
                        imported: pFile.subtitles, 
                        smartTiming 
                    });
                    
                    // Update existing item in nextBatch (local copy for logic)
                    nextBatch[matchIndex] = {
                        ...existing,
                        subtitles: merged,
                        status: 'completed',
                        progress: 100,
                        message: `Merged: ${pFile.file.name}`
                    };
                    
                    // Dispatch update to context
                    batchDispatch({ 
                        type: 'UPDATE_ITEM', 
                        payload: { 
                            id: existing.id, 
                            updates: {
                                subtitles: merged,
                                status: 'completed',
                                progress: 100,
                                message: `Merged: ${pFile.file.name}`
                            }
                        } 
                    });

                    usedIndices.add(idx);
                    addToast(`Merged ${pFile.file.name} into existing item`, 'success');
                } catch (e) {
                    console.error("Auto-merge failed:", e);
                    addToast(`Failed to auto-merge ${pFile.file.name}: ${(e as Error).message}`, 'error');
                }
            }
        }

        // 2. Pair remaining new files with each other
        const remainingFiles = parsedFiles
            .map((f, i) => ({ ...f, origIndex: i }))
            .filter((_, i) => !usedIndices.has(i));

        // Sort by name length (shortest is likely source)
        remainingFiles.sort((a, b) => a.nameNoExt.length - b.nameNoExt.length);

        const mergedInBatch = new Set<number>(); // IDs within remainingFiles array
        const newBatchItems: BatchItem[] = [];

        for (let i = 0; i < remainingFiles.length; i++) {
            const source = remainingFiles[i];
            if (mergedInBatch.has(i)) continue; 

            let currentSubtitles = source.subtitles;
            let status: BatchItem['status'] = source.valid ? 'pending' : 'error';
            let message = source.valid ? `Ready (${source.subtitles.length} lines)` : 'Parse Error';
            let progress = 0;

            if (source.valid) {
                // Look for translations of this source in the rest of the new files
                for (let j = 0; j < remainingFiles.length; j++) {
                    const trans = remainingFiles[j];
                    if (i === j) continue;
                    if (mergedInBatch.has(j)) continue;
                    if (!trans.valid) continue;

                    if (trans.nameNoExt.startsWith(source.nameNoExt)) {
                         const suffix = trans.nameNoExt.substring(source.nameNoExt.length);
                         if (/^([-_.]\w{2}|\s\(\d+\))$/.test(suffix)) {
                             // Matched translation
                             try {
                                 currentSubtitles = await runWorker<SubtitleLine[]>('MERGE', {
                                     source: currentSubtitles,
                                     imported: trans.subtitles,
                                     smartTiming
                                 });
                                 status = 'completed';
                                 progress = 100;
                                 message = `Auto-merged: ${trans.file.name}`;
                                 mergedInBatch.add(j);
                             } catch (e) {
                                 console.error("Auto-merge pair failed:", e);
                                 // Don't mark as merged, let it be added as separate file
                                 addToast(`Failed to pair ${trans.file.name}: ${(e as Error).message}`, 'info');
                             }
                         }
                    }
                }
            }

            newBatchItems.push({
                id: crypto.randomUUID(),
                fileName: source.file.name,
                originalFile: source.file,
                subtitles: currentSubtitles,
                status: status,
                progress: progress,
                message: message,
                logs: []
            });
            addedCount++;
        }
        
        if (newBatchItems.length > 0) {
            batchDispatch({ type: 'ADD_ITEMS', payload: newBatchItems });
        }

        if (addedCount > 0) addToast(`Added ${addedCount} files to queue`, 'success');
        
        // Clear input
        event.target.value = '';
    };

    const handleImportTranslation = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        
        if (!activeItemId) {
            addToast("Please select a file from the queue first.", "error");
            return;
        }
        
        const reader = new FileReader();
        reader.onload = async (e) => {
            const content = e.target?.result as string;
            try {
                const importedSubtitles = await runWorker<SubtitleLine[]>('PARSE', { content, fileName: file.name });
                
                if (!importedSubtitles || importedSubtitles.length === 0) {
                    throw new Error("Imported file contains no valid subtitles.");
                }

                // Find the active item to merge with
                const activeItem = batchItems.find(item => item.id === activeItemId);
                if (!activeItem) throw new Error("Active item not found.");

                // Perform merge logic OUTSIDE setBatchItems to catch errors
                const mergedSubtitles = await runWorker<SubtitleLine[]>('MERGE', {
                    source: activeItem.subtitles,
                    imported: importedSubtitles,
                    smartTiming
                });
                
                batchDispatch({
                    type: 'UPDATE_ITEM',
                    payload: {
                        id: activeItemId,
                        updates: {
                            subtitles: mergedSubtitles,
                            status: 'completed',
                            progress: 100,
                            message: 'Translation Imported & Optimized'
                        }
                    }
                });
                addToast("Translation merged successfully", "success");
            } catch (err) {
                console.error("Import failed:", err);
                addToast((err as Error).message || "Failed to parse imported translation file", "error");
            }
        };
        reader.readAsText(file);
        
        // Reset input
        event.target.value = '';
    };

    const handleSubtitleSelection = async (content: string, name: string) => {
        try {
            const parsed = await runWorker<SubtitleLine[]>('PARSE', { content, fileName: name });
            const newItem: BatchItem = {
                id: crypto.randomUUID(),
                fileName: name,
                subtitles: parsed,
                status: 'pending',
                progress: 0,
                message: `Ready (${parsed.length} lines)`,
                logs: []
            };
            batchDispatch({ type: 'ADD_ITEMS', payload: [newItem] });
            batchDispatch({ type: 'SET_ACTIVE_ITEM', payload: newItem.id });
            setActiveTab(TabView.UPLOAD);
            addToast(`Loaded subtitle: ${name}`, 'success');
        } catch (err) {
            addToast("Failed to parse the downloaded subtitle", "error");
        }
    };


    const handleDownloadSingle = (id: string) => {
        const item = batchItems.find(i => i.id === id);
        if (!item) return;
        const content = generateSubtitleContent(item.subtitles, styleConfig, smartTiming);
        const ext = styleConfig.outputFormat === 'srt' ? '.srt' : '.ass';
        downloadFile(content, item.fileName.replace(/\.(srt|ass|vtt)$/i, '') + ext);
        addToast(`Downloaded ${item.fileName}`, 'success');
    };

    const handleDownloadAll = async () => {
        const completedItems = batchItems.filter(i => i.status === 'completed');
        if (completedItems.length === 0) return;
        
        addToast(`Downloading ${completedItems.length} files...`, 'info');
        for (const item of completedItems) {
            handleDownloadSingle(item.id);
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    };

    const removeBatchItem = (id: string) => {
        batchDispatch({ type: 'REMOVE_ITEM', payload: id });
    };
  
    const clearAll = () => {
        if (window.confirm("Clear all files and history?")) {
          batchDispatch({ type: 'CLEAR_ALL' });
          clearSession();
          addToast("Workspace cleared", "info");
        }
    };

    return {
        handleFileUpload,
        handleImportTranslation,
        handleSubtitleSelection,
        handleDownloadSingle,
        handleDownloadAll,
        removeBatchItem,
        clearAll
    };
};
