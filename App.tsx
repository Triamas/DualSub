import React, { useState, useRef, useEffect } from 'react';
import { Upload, FileText, CheckCircle, AlertTriangle, RefreshCw, Download as DownloadIcon, PlayCircle, Sparkles, Languages, Settings2, Layout, Palette, ArrowUpDown, RotateCcw, Monitor, Trash2, Layers, Film, Tv, Type, Cog, X, AlignJustify, AlignLeft, Cpu, FileType, Hourglass, ChevronsRight, Eye, ArrowUp, ArrowDown, Moon, Sun, BookOpen, Edit3, Save, ScrollText, Terminal, TestTube, Globe, Server } from 'lucide-react';
import { SubtitleLine, TabView, AssStyleConfig, BatchItem, ModelConfig, LogEntry } from './types';
import { parseSubtitle, generateSubtitleContent, downloadFile, STYLE_PRESETS, calculateSafeDurations } from './services/subtitleUtils';
import { translateBatch, generateContext, detectLanguage, generateShowBible, identifyShowName } from './services/geminiService';
import { saveSession, loadSession, clearSession, loadShowMetadata, saveShowMetadata } from './services/storage';
import SubtitleSearch from './components/OpenSubtitlesSearch';

// OPTIMIZED CONSTANTS FOR STABILITY
const BATCH_SIZE = 40;  // Smaller batch size ensures higher completion rate and fewer token limit issues
const CONCURRENCY = 8;  // Higher concurrency to compensate for smaller batches
const OVERLAP_SIZE = 5; 

const AVAILABLE_LANGUAGES = [
    "Arabic", "Bulgarian", "Chinese (Simplified)", "Chinese (Traditional)", "Croatian", "Czech", 
    "Danish", "Dutch", "Estonian", "Finnish", "French", "German", "Greek", "Hindi", "Hungarian", 
    "Indonesian", "Irish", "Italian", "Japanese", "Korean", "Latvian", "Lithuanian", "Maltese", 
    "Polish", "Portuguese", "Romanian", "Slovak", "Slovenian", "Spanish", "Swedish", "Thai", 
    "Turkish", "Ukrainian", "Vietnamese"
];

const AVAILABLE_MODELS = [
    { id: 'gemini-3-flash-preview', name: 'Gemini 3.0 Flash (Recommended)' },
    { id: 'gemini-3-pro-preview', name: 'Gemini 3.0 Pro (High Intelligence)' },
    { id: 'gemini-flash-lite-latest', name: 'Gemini 2.5 Flash Lite (Fastest)' }
];

const KODI_FONTS = [
    "Arial", "Arial Narrow", "Arial Black", "Comic Sans MS", "Courier New", 
    "DejaVu Sans", "Georgia", "Impact", "Times New Roman", "Trebuchet MS", "Verdana", "Teletext"
];

// --- COMPONENTS ---

const VisualPreview = ({ 
    config, 
    original, 
    translated,
    isSample = false
}: { 
    config: AssStyleConfig, 
    original: string, 
    translated: string,
    isSample?: boolean
}) => {
    
    const containerStyle: React.CSSProperties = {
        aspectRatio: '16/9',
        backgroundColor: '#000000', 
        backgroundImage: 'radial-gradient(circle at center, #1a1a1a 0%, #000000 100%)',
        position: 'relative',
        overflow: 'hidden',
        borderRadius: '0.75rem',
        border: '1px solid #3f3f46',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 20px 50px -12px rgba(0, 0, 0, 0.5)'
    };

    // Scale factor to simulate TV appearance on a small screen
    const SCALE = 0.6; 
    
    // Placeholder logic: If translated text is empty, show placeholder so user can see styling
    const displayOriginal = original || "Original Text Placeholder";
    const displayTranslated = translated || "Translated Text Placeholder";

    // If Output is SRT, use a simplified preview
    if (config.outputFormat === 'srt') {
        return (
            <div style={containerStyle} className="group">
                 <div className="absolute inset-0 pointer-events-none opacity-20" 
                      style={{backgroundImage: 'linear-gradient(#333 1px, transparent 1px), linear-gradient(90deg, #333 1px, transparent 1px)', backgroundSize: '40px 40px'}}>
                 </div>
                 {isSample && <div className="absolute top-2 right-2 px-2 py-1 bg-zinc-800/80 rounded text-xs text-zinc-400 font-mono">SRT PREVIEW</div>}
                
                <div style={{position: 'absolute', bottom: '10%', left: 0, right: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', padding: '0 2rem', zIndex: 10, textAlign: 'center', gap: '8px'}}>
                    {config.stackOrder === 'primary-top' ? (
                        <>
                             <div style={{color: config.primary.color, fontSize: '18px', fontWeight: 'bold', textShadow: '2px 2px 0 #000'}}>{displayTranslated}</div>
                             <div style={{color: config.secondary.color, fontSize: '18px', fontWeight: 'bold', textShadow: '2px 2px 0 #000'}}>{displayOriginal}</div>
                        </>
                    ) : (
                        <>
                             <div style={{color: config.secondary.color, fontSize: '18px', fontWeight: 'bold', textShadow: '2px 2px 0 #000'}}>{displayOriginal}</div>
                             <div style={{color: config.primary.color, fontSize: '18px', fontWeight: 'bold', textShadow: '2px 2px 0 #000'}}>{displayTranslated}</div>
                        </>
                    )}
                </div>
            </div>
        );
    }

    const getTextStyle = (isPrimary: boolean) => {
        const style = isPrimary ? config.primary : config.secondary;
        const color = style.color;
        const size = style.fontSize * SCALE;
        const outlineW = config.outlineWidth; 
        const shadowD = config.shadowDepth; 
        const shadowColor = 'rgba(0,0,0,0.8)';
        
        let textShadows = [];
        // Simulate Outline using text-shadow
        if (outlineW > 0) {
            const stroke = Math.max(1, outlineW * 0.8); 
            for(let x = -1; x <= 1; x++) {
                for(let y = -1; y <= 1; y++) {
                    if(x!==0 || y!==0) textShadows.push(`${x*stroke}px ${y*stroke}px 0 #000`);
                }
            }
        }
        // Shadow
        if (shadowD > 0) {
             textShadows.push(`${shadowD * 1.5}px ${shadowD * 1.5}px 2px ${shadowColor}`);
        }
        
        return {
            fontFamily: config.fontFamily,
            fontSize: `${size}px`,
            color: color,
            textShadow: textShadows.length ? textShadows.join(',') : 'none',
            textAlign: 'center' as const,
            fontWeight: 600,
            lineHeight: 1.25,
            margin: '4px 0',
            backgroundColor: config.borderStyle === 3 ? 'rgba(0,0,0,0.65)' : 'transparent',
            padding: config.borderStyle === 3 ? '2px 8px' : '0px',
            borderRadius: config.borderStyle === 3 ? '4px' : '0px',
            whiteSpace: 'pre-wrap' as const, 
            position: 'relative' as const,
            zIndex: 20
        };
    };

    const formatHtml = (text: string) => {
        if (!text) return { __html: "&nbsp;" };
        let content = text;
        if (config.linesPerSubtitle === 1) {
            content = content.replace(/\[br\]/g, ' ');
        } else {
            content = content.replace(/\[br\]/g, '<br/>');
        }
        return { __html: content };
    };

    const renderText = (isPrimary: boolean, text: string) => {
        const style = getTextStyle(isPrimary);
        return (
            <div 
                style={style} 
                dangerouslySetInnerHTML={formatHtml(text)} 
            />
        );
    };

    const PrimaryText = renderText(true, displayTranslated);
    const SecondaryText = renderText(false, displayOriginal);

    const MARGIN_V = '8%';

    let content;
    if (config.layout === 'split') {
        const top = config.stackOrder === 'primary-top' ? PrimaryText : SecondaryText;
        const bottom = config.stackOrder === 'primary-top' ? SecondaryText : PrimaryText;
        content = (
            <>
                <div style={{position: 'absolute', top: MARGIN_V, left: 0, right: 0, display: 'flex', justifyContent: 'center', alignItems: 'flex-start', padding: '0 2rem', zIndex: 10}}>
                    {top}
                </div>
                <div style={{position: 'absolute', bottom: MARGIN_V, left: 0, right: 0, display: 'flex', justifyContent: 'center', alignItems: 'flex-end', padding: '0 2rem', zIndex: 10}}>
                    {bottom}
                </div>
            </>
        );
    } else {
        // Stacked
        const top = config.stackOrder === 'primary-top' ? PrimaryText : SecondaryText;
        const bottom = config.stackOrder === 'primary-top' ? SecondaryText : PrimaryText;
        content = (
            <div style={{position: 'absolute', bottom: MARGIN_V, left: 0, right: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', padding: '0 2rem', zIndex: 10}}>
                {top}
                {bottom}
            </div>
        );
    }

    return (
        <div style={containerStyle} className="group transition-all duration-300">
             {/* TV Scanline Effect */}
             <div className="absolute inset-0 pointer-events-none opacity-5 z-0" 
                  style={{background: 'linear-gradient(to bottom, rgba(255,255,255,0), rgba(255,255,255,0) 50%, rgba(0,0,0,0.2) 50%, rgba(0,0,0,0.2))', backgroundSize: '100% 4px'}}>
             </div>
             {isSample && <div className="absolute top-2 right-2 px-2 py-1 bg-zinc-800/80 rounded text-xs text-zinc-400 font-mono z-30 backdrop-blur-sm">ASS PREVIEW</div>}
             {content}
        </div>
    );
};

// --- MAIN APP ---

function App() {
  // Theme State
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');

  const [activeTab, setActiveTab] = useState<TabView>(TabView.UPLOAD);
  
  // Batch State
  const [batchItems, setBatchItems] = useState<BatchItem[]>([]);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  
  // Settings
  const [autoContext, setAutoContext] = useState(true);
  const [autoBible, setAutoBible] = useState(true); // New: Auto generate Bible
  const [smartTiming, setSmartTiming] = useState(true); 
  const [targetLang, setTargetLang] = useState<string>(() => localStorage.getItem('target_language') || 'Vietnamese');
  
  // Model Configuration State
  const [modelConfig, setModelConfig] = useState<ModelConfig>({
      provider: 'gemini',
      modelName: 'gemini-3-flash-preview',
      temperature: 0.3,
      topP: 0.95,
      topK: 40,
      maxOutputTokens: 8192,
      useSimulation: false,
      localEndpoint: 'http://127.0.0.1:8080/v1/chat/completions'
  });
  const [showModelSettings, setShowModelSettings] = useState(false);

  // Style Configuration State
  const [styleConfig, setStyleConfig] = useState<AssStyleConfig>(STYLE_PRESETS.DEFAULT);
  const [showStyleConfig, setShowStyleConfig] = useState(false);

  // Confirmation Request State
  const [confirmationRequest, setConfirmationRequest] = useState<{ itemId: string; fileName: string; detectedLanguage: string; resolve: (val: boolean) => void } | null>(null);

  // Editor State for Bible/Context
  const [editorItem, setEditorItem] = useState<{ id: string; type: 'bible' | 'context' } | null>(null);
  const [editorContent, setEditorContent] = useState('');

  // Log Viewer State
  const [viewingLogs, setViewingLogs] = useState<string | null>(null);
  const logContainerRef = useRef<HTMLDivElement>(null);

  // Preview Selection State
  const [previewLineId, setPreviewLineId] = useState<number | null>(null);

  // Refs
  const isCancelled = useRef(false);
  const isTranslating = useRef(false);
  const completedLinesRef = useRef(0);
  const activeLinesRef = useRef(0); 
  const progressValueRef = useRef(0);

  // Theme Logic
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Log auto-scroll
  useEffect(() => {
      if (viewingLogs && logContainerRef.current) {
          logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
      }
  }, [viewingLogs, batchItems]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  // Session Recovery
  useEffect(() => {
    const restoreSession = async () => {
        const savedItems = await loadSession();
        if (savedItems && savedItems.length > 0) {
            // Ensure logs property exists for backward compatibility
            const itemsWithLogs = savedItems.map(item => ({...item, logs: item.logs || []}));
            setBatchItems(itemsWithLogs);
            if (savedItems.length > 0) setActiveItemId(savedItems[0].id);
        }
    };
    restoreSession();
  }, []);

  // Save Session
  useEffect(() => {
      const timeout = setTimeout(() => {
          if (batchItems.length > 0) saveSession(batchItems);
      }, 1000);
      return () => clearTimeout(timeout);
  }, [batchItems]);

  // Active Item & Auto-Preview
  const activeItem = batchItems.find(item => item.id === activeItemId) || batchItems[0];
  
  useEffect(() => {
      if (previewLineId && activeItem?.subtitles.some(s => s.id === previewLineId)) return;
      if (activeItem && activeItem.subtitles.length > 0) {
          const sample = activeItem.subtitles.slice(0, 50);
          const longest = sample.reduce((prev, current) => (prev.originalText.length > current.originalText.length) ? prev : current, sample[0]);
          if(longest) setPreviewLineId(longest.id);
      } else {
          setPreviewLineId(null);
      }
  }, [activeItemId, activeItem, previewLineId]);

  // Preview Data
  const selectedSubtitle = activeItem?.subtitles?.find(s => s.id === previewLineId);
  const sampleOriginal = selectedSubtitle?.originalText || "Select a subtitle line to preview style.";
  const sampleTranslated = selectedSubtitle?.translatedText || "";
  
  const translatingItem = batchItems.find(i => i.status === 'translating');

  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      setTargetLang(e.target.value);
      localStorage.setItem('target_language', e.target.value);
  };

  const applyPreset = (presetName: keyof typeof STYLE_PRESETS) => setStyleConfig(STYLE_PRESETS[presetName]);
  const resetStyles = () => setStyleConfig(STYLE_PRESETS.DEFAULT);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const newItems: BatchItem[] = Array.from(files).map((file: File) => ({
        id: crypto.randomUUID(),
        fileName: file.name,
        originalFile: file,
        subtitles: [],
        status: 'pending',
        progress: 0,
        message: 'Queued',
        logs: []
    }));

    setBatchItems(prev => [...prev, ...newItems]);

    newItems.forEach(item => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const content = e.target?.result as string;
            try {
                const parsed = parseSubtitle(content, item.fileName);
                setBatchItems(prev => prev.map(pi => pi.id === item.id ? { ...pi, subtitles: parsed, message: `Ready (${parsed.length} lines)` } : pi));
                if (!activeItemId) setActiveItemId(item.id);
            } catch (err) {
                setBatchItems(prev => prev.map(pi => pi.id === item.id ? { ...pi, status: 'error', message: 'Parse Error' } : pi));
            }
        };
        reader.readAsText(item.originalFile!);
    });
  };

  const handleSubtitleSelection = (content: string, name: string) => {
      try {
          const parsed = parseSubtitle(content, name);
          const newItem: BatchItem = {
              id: crypto.randomUUID(),
              fileName: name,
              subtitles: parsed,
              status: 'pending',
              progress: 0,
              message: `Ready (${parsed.length} lines)`,
              logs: []
          };
          setBatchItems(prev => [...prev, newItem]);
          setActiveItemId(newItem.id);
          setActiveTab(TabView.UPLOAD);
      } catch (err) {
          alert("Failed to parse the downloaded subtitle.");
      }
  };
  
  // Editor Handlers
  const openEditor = (e: React.MouseEvent, id: string, type: 'bible' | 'context') => {
      e.stopPropagation();
      const item = batchItems.find(i => i.id === id);
      if (item) {
          setEditorItem({ id, type });
          setEditorContent(type === 'bible' ? (item.showBible || '') : (item.context || ''));
      }
  };

  const saveEditor = () => {
      if (editorItem) {
          setBatchItems(prev => prev.map(pi => pi.id === editorItem.id ? { 
              ...pi, 
              [editorItem.type === 'bible' ? 'showBible' : 'context']: editorContent 
          } : pi));
          setEditorItem(null);
      }
  };

  const translateSingleFile = async (itemId: string) => {
      const itemIndex = batchItems.findIndex(i => i.id === itemId);
      if (itemIndex === -1) return;

      const item = batchItems[itemIndex];
      if (item.subtitles.length === 0) return;

      setBatchItems(prev => prev.map(pi => pi.id === itemId ? { ...pi, status: 'translating', progress: 0, message: 'Starting...', logs: [] } : pi));

      completedLinesRef.current = 0;
      activeLinesRef.current = 0;
      progressValueRef.current = 0;
      
      const totalLines = item.subtitles.length;

      // Logger Helper
      const logInfo = (message: string, type: 'info' | 'request' | 'response' | 'error' = 'info', data?: any) => {
          const entry: LogEntry = {
              timestamp: Date.now(),
              type,
              message,
              data
          };
          setBatchItems(prev => prev.map(pi => pi.id === itemId ? { ...pi, logs: [...pi.logs, entry] } : pi));
      };

      // DETECT LANGUAGE
      logInfo(`Detecting Language...`);
      const { isEnglish, language } = await detectLanguage(item.subtitles, modelConfig.useSimulation, modelConfig);
      logInfo(`Detected Language: ${language}`);
      
      if (!isEnglish) {
           setBatchItems(prev => prev.map(pi => pi.id === itemId ? { ...pi, message: `Detected: ${language}` } : pi));
           const userConfirmed = await new Promise<boolean>((resolve) => {
               setConfirmationRequest({ itemId, fileName: item.fileName, detectedLanguage: language, resolve: (val) => { setConfirmationRequest(null); resolve(val); } });
           });

           if (!userConfirmed) {
                setBatchItems(prev => prev.map(pi => pi.id === itemId ? { ...pi, status: 'error', progress: 0, message: `Cancelled (${language})` } : pi));
                return;
           }
      }

      // --- IDENTIFY SHOW & CACHE LOGIC ---
      let showName = "";
      if (autoContext || autoBible) {
          logInfo("Identifying Show...");
          // Step 1: Identify
          showName = await identifyShowName(item.fileName, modelConfig.useSimulation, modelConfig);
          logInfo(`Identified Show: ${showName}`);
          
          // Step 2: Check Cache
          const cachedMetadata = await loadShowMetadata(showName);
          
          if (cachedMetadata) {
              logInfo(`Loaded Metadata from Cache (${new Date(cachedMetadata.timestamp).toLocaleDateString()})`);
          }

          // Step 3: Hydrate local variables
          let context = item.context || cachedMetadata?.context || "";
          let showBible = item.showBible || cachedMetadata?.bible || "";
          
          let newDataGenerated = false;

          // Step 4: Generate if missing
          if (autoContext && !context) {
              setBatchItems(prev => prev.map(pi => pi.id === itemId ? { ...pi, message: 'Analyzing plot context...' } : pi));
              try { 
                  logInfo(`Generating Context...`);
                  context = await generateContext(item.fileName, modelConfig.useSimulation, modelConfig); 
                  logInfo(`Context Generated`, 'response', context);
                  newDataGenerated = true;
              } catch(e) { console.error("Context gen failed", e); logInfo(`Context Failed`, 'error', e); }
          }

          if (autoBible && !showBible) {
              setBatchItems(prev => prev.map(pi => pi.id === itemId ? { ...pi, message: 'Generating Glossary...' } : pi));
              try { 
                  logInfo(`Generating Glossary...`);
                  showBible = await generateShowBible(item.fileName, targetLang, modelConfig.useSimulation, modelConfig);
                  logInfo(`Glossary Generated`, 'response', showBible);
                  newDataGenerated = true;
              } catch (e) { console.error("Bible gen failed", e); logInfo(`Glossary Failed`, 'error', e); }
          }

          // Step 5: Update State & Save Cache if new data
          setBatchItems(prev => prev.map(pi => pi.id === itemId ? { ...pi, context: context, showBible: showBible } : pi));
          
          if (newDataGenerated && showName) {
              logInfo(`Saving Metadata to Cache...`);
              await saveShowMetadata(showName, { context, bible: showBible });
          }
      }

      // RE-READ STATE for Context/Bible (in case they were updated above)
      // Note: React state updates are async, so we use the local variables `context` and `showBible` computed above if possible,
      // but since we are inside an async function and just called setBatchItems, we should rely on the local vars.
      // However, to be safe and consistent with the translation loop below which expects strings:
      // We need to ensure we pass the strings we just resolved.
      
      // Let's grab them from the latest known state or local variables
      // Re-fetching from batchItems state via find() is risky due to closure staleness. 
      // We will use the local variables derived in the block above.
      
      // Need to re-fetch the *latest* item to ensure we have any *user manual edits* if they happened right before click (unlikely but safe practice)
      // Actually, standard practice in this function has been using local var or `item` reference. 
      // But since we just conditionally updated `context` and `showBible`, we should use those values.
      
      // Re-declare them for the scope of translation
      const finalContext = item.context || (await loadShowMetadata(showName))?.context || "";
      const finalBible = item.showBible || (await loadShowMetadata(showName))?.bible || "";
      
      // Just to be safe, if we generated new ones, use those.
      // The logic above sets local vars `context` and `showBible` if auto-generated/loaded.
      // Let's execute the translation with whatever we have.
      
      // Re-calc context/bible variables for clarity
      let activeContext = item.context; // User manual input takes precedence?
      let activeBible = item.showBible;

      // If user input empty, use what we resolved (Cache or Generation)
      if (!activeContext && autoContext) {
           // We generated or loaded it above into local `context` var? 
           // Wait, the block above defined `let context`. It is scoped to that block.
           // Let's refactor slightly to ensure variables are available.
      }
      
      // REFACTORING VARIABLE ACCESS
      let contextToUse = item.context || "";
      let bibleToUse = item.showBible || "";
      
      // If we did the auto-logic, we updated the item state, but we also need the string NOW.
      // Let's duplicate the resolution logic slightly or trust the async sequence.
      // Better: The previous block ensures `context` and `showBible` are saved to cache and state.
      // Let's reload from cache if state is empty, to be 100% sure we have the latest.
      if (!contextToUse && showName) contextToUse = (await loadShowMetadata(showName))?.context || "";
      if (!bibleToUse && showName) bibleToUse = (await loadShowMetadata(showName))?.bible || "";
      
      const safeDurations = calculateSafeDurations(item.subtitles);
      const newSubtitles = [...item.subtitles];
      
      interface ChunkData { lines: SubtitleLine[]; previous: SubtitleLine[]; chunkIndex: number; totalChunks: number }
      const chunks: ChunkData[] = [];
      const totalChunks = Math.ceil(totalLines / BATCH_SIZE);

      for (let i = 0; i < totalLines; i += BATCH_SIZE) {
        const chunkLines = newSubtitles.slice(i, i + BATCH_SIZE);
        const previousLines = i > 0 ? newSubtitles.slice(Math.max(0, i - OVERLAP_SIZE), i) : [];
        chunks.push({ 
            lines: chunkLines, 
            previous: previousLines,
            chunkIndex: Math.floor(i / BATCH_SIZE) + 1,
            totalChunks
        });
      }

      const processChunk = async (chunkData: ChunkData) => {
          if (isCancelled.current) return;
          const { lines, previous, chunkIndex } = chunkData;
          activeLinesRef.current += lines.length; 
          const linesToTranslate = lines.filter(l => !l.translatedText);
          
          if (linesToTranslate.length > 0) {
              
              const updateStatus = (msg: string) => {
                  setBatchItems(prev => prev.map(pi => pi.id === itemId ? { ...pi, message: msg } : pi));
              };

              let chunkAttempts = 0;
              let chunkSuccess = false;

              // Immediate Retry Loop for this specific chunk
              while (chunkAttempts < 3 && !chunkSuccess && !isCancelled.current) {
                  chunkAttempts++;
                  try {
                      if (chunkAttempts > 1) updateStatus(`Retrying block ${chunkIndex}...`);
                      
                      // Pass context, showBible, and logging callback
                      const translations = await translateBatch(
                          linesToTranslate, 
                          targetLang, 
                          contextToUse, 
                          previous, 
                          modelConfig, 
                          safeDurations, 
                          bibleToUse,
                          logInfo // <-- Pass logger here
                      );
                      
                      // Validate Completeness immediately
                      const missingIds = linesToTranslate.filter(l => !translations.has(l.id));
                      
                      if (missingIds.length === 0) {
                          // Perfect run
                          linesToTranslate.forEach(line => {
                             if (translations.has(line.id)) line.translatedText = translations.get(line.id);
                          });
                          chunkSuccess = true;
                      } else {
                          // Partial success - apply what we got, try remaining again next loop
                           linesToTranslate.forEach(line => {
                             if (translations.has(line.id)) line.translatedText = translations.get(line.id);
                          });
                          // The next loop will automatically pick up !l.translatedText lines
                          if (chunkAttempts === 3) console.warn(`Chunk ${chunkIndex} gave up on ${missingIds.length} lines`);
                      }

                  } catch (error: any) {
                      const errorMsg = error.message || "";
                      // CRITICAL: Handle Terminal Errors by stopping everything
                      if (errorMsg.includes("TERMINAL")) {
                           const cleanMsg = errorMsg.replace("TERMINAL: ", "");
                           updateStatus(`Error: ${cleanMsg}`);
                           // Mark item as failed
                           setBatchItems(prev => prev.map(pi => pi.id === itemId ? { ...pi, status: 'error', message: `Stopped: ${cleanMsg}` } : pi));
                           // Stop global processing
                           isCancelled.current = true;
                           return; // Exit immediate loop
                      }

                      console.error(`Chunk ${chunkIndex} failed attempt ${chunkAttempts}`, error);
                      // Exponential backoff for internal retry
                      await new Promise(r => setTimeout(r, 1000 * chunkAttempts));
                  }
              }
          }
          
          activeLinesRef.current -= lines.length; 
          completedLinesRef.current += lines.length;
          
          // Deterministic Progress Update
          const percentage = Math.round((completedLinesRef.current / totalLines) * 100);
          setBatchItems(prev => prev.map(pi => pi.id === itemId ? { 
              ...pi, 
              subtitles: [...newSubtitles],
              progress: percentage,
              message: `Translating... ${percentage}%`
          } : pi));
      };

      const chunkQueue = [...chunks];
      const worker = async () => {
          while (chunkQueue.length > 0 && !isCancelled.current) {
              const chunk = chunkQueue.shift();
              if (chunk) await processChunk(chunk);
          }
      };
      
      const workers = Array.from({ length: CONCURRENCY }, () => worker());
      await Promise.all(workers);
      
      // --- FINAL VERIFICATION PHASE ---
      // Even with immediate retries, some might fail. This catches the last stragglers.
      let remainingMissing = newSubtitles.filter(l => !l.translatedText);
      let retryCount = 0;
      const MAX_RETRIES = 2; // Reduced since we do immediate retries now

      while (remainingMissing.length > 0 && retryCount < MAX_RETRIES && !isCancelled.current) {
          retryCount++;
          const verifyMsg = `Final Verification... (Attempt ${retryCount}/${MAX_RETRIES}, ${remainingMissing.length} missing)`;
          setBatchItems(prev => prev.map(pi => pi.id === itemId ? { ...pi, message: verifyMsg } : pi));

          const RETRY_BATCH_SIZE = 50; 
          const retryChunks = [];
          for (let i = 0; i < remainingMissing.length; i += RETRY_BATCH_SIZE) {
              retryChunks.push(remainingMissing.slice(i, i + RETRY_BATCH_SIZE));
          }

          for (const chunkLines of retryChunks) {
              if (isCancelled.current) break;
              
              const firstLineIndex = newSubtitles.findIndex(l => l.id === chunkLines[0].id);
              const previousContext = firstLineIndex > 0 ? [newSubtitles[firstLineIndex - 1]] : [];

              try {
                  const translations = await translateBatch(
                      chunkLines, 
                      targetLang, 
                      contextToUse, 
                      previousContext, 
                      modelConfig, 
                      safeDurations, 
                      bibleToUse,
                      logInfo // Pass logger
                  );
                  chunkLines.forEach(line => {
                      if (translations.has(line.id)) {
                          line.translatedText = translations.get(line.id);
                      }
                  });
              } catch (e: any) {
                  // Catch terminal errors in verification loop too
                  if (e.message && e.message.includes("TERMINAL")) {
                       const cleanMsg = e.message.replace("TERMINAL: ", "");
                       setBatchItems(prev => prev.map(pi => pi.id === itemId ? { ...pi, status: 'error', message: `Stopped: ${cleanMsg}` } : pi));
                       isCancelled.current = true;
                       break;
                  }
                  console.error("Verification chunk failed", e);
              }
              
              setBatchItems(prev => prev.map(pi => pi.id === itemId ? { ...pi, subtitles: [...newSubtitles] } : pi));
              await new Promise(r => setTimeout(r, 800));
          }

          remainingMissing = newSubtitles.filter(l => !l.translatedText);
      }

      if (remainingMissing.length > 0 && !isCancelled.current) {
          // Final Error State
          setBatchItems(prev => prev.map(pi => pi.id === itemId ? { 
              ...pi, 
              status: 'error', 
              progress: 100,
              message: `Failed: ${remainingMissing.length} lines missing` 
          } : pi));
          alert(`Translation incomplete.\n\n${remainingMissing.length} lines could not be translated after verification.\n\nPlease check your API Key usage quotas or file integrity.`);
      } else if (!isCancelled.current) {
          setBatchItems(prev => prev.map(pi => pi.id === itemId ? { ...pi, status: 'completed', progress: 100, message: 'Done' } : pi));
      } else {
          // It was cancelled, check if it was due to error or user
          // The error state is already set in the catch block if it was an error
          // So we only set to 'Cancelled' if it's still marked as translating
          setBatchItems(prev => prev.map(pi => pi.id === itemId && pi.status === 'translating' ? { ...pi, status: 'pending', message: 'Cancelled' } : pi));
      }
  };

  const handleTranslateAll = async () => {
      // API Key check not required for Local/Simulation
      if (!modelConfig.useSimulation && modelConfig.provider === 'gemini' && !process.env.API_KEY) { 
          alert("System Error: Gemini API Key is missing."); 
          return; 
      }
      isCancelled.current = false;
      isTranslating.current = true;
      const pendingItems = batchItems.filter(i => i.status === 'pending' || i.status === 'error');
      for (const item of pendingItems) {
          if (isCancelled.current) break;
          await translateSingleFile(item.id);
      }
      isTranslating.current = false;
  };

  const handleDownloadSingle = (id: string) => {
      const item = batchItems.find(i => i.id === id);
      if (!item) return;
      const content = generateSubtitleContent(item.subtitles, styleConfig, smartTiming);
      const ext = styleConfig.outputFormat === 'srt' ? '.srt' : '.ass';
      let newName = item.fileName.replace(/\.(srt|ass|vtt)$/i, '');
      downloadFile(content, newName + ext);
  };

  const handleDownloadAll = async () => {
      const completedItems = batchItems.filter(i => i.status === 'completed');
      if (completedItems.length === 0) return;

      for (const item of completedItems) {
          handleDownloadSingle(item.id);
          // Small delay to ensure browser handles multiple downloads gracefully and doesn't block them as spam
          await new Promise(resolve => setTimeout(resolve, 500));
      }
  };

  const removeBatchItem = (id: string) => {
      setBatchItems(prev => {
          const newState = prev.filter(i => i.id !== id);
          if (activeItemId === id) setActiveItemId(newState.length > 0 ? newState[0].id : null);
          return newState;
      });
  };

  const clearAll = () => {
      if (window.confirm("Clear all files and history?")) {
        setBatchItems([]);
        setActiveItemId(null);
        clearSession();
      }
  };

  const completedCount = batchItems.filter(i => i.status === 'completed').length;
  const getDownloadLabel = () => completedCount === 1 ? `Download` : `Download All (${completedCount})`;
  
  // LOG VIEWER UTILS
  const viewingLogItem = batchItems.find(i => i.id === viewingLogs);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 flex flex-col font-sans selection:bg-yellow-500/30 transition-colors duration-300">
      {/* Header */}
      <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white/50 dark:bg-zinc-900/50 backdrop-blur-xl sticky top-0 z-50 transition-colors duration-300">
        <div className="max-w-5xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3 group cursor-default">
            <div className="bg-gradient-to-br from-yellow-400 to-yellow-600 p-2.5 rounded-xl shadow-lg shadow-yellow-500/20 group-hover:shadow-yellow-500/40 transition-all">
              <FileText className="w-5 h-5 text-black fill-current" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-white group-hover:text-yellow-600 dark:group-hover:text-yellow-400 transition-colors">DualSub AI</h1>
              <p className="text-[10px] uppercase tracking-widest text-zinc-500 font-semibold">Cinema Grade Translator</p>
            </div>
          </div>
          <div className="flex gap-4 items-center">
             {translatingItem && (
                 <div className="flex items-center gap-3 px-4 py-1.5 bg-white dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700/50 rounded-full text-xs font-medium backdrop-blur-md shadow-xl">
                     <RefreshCw className="w-3.5 h-3.5 text-yellow-600 dark:text-yellow-500 animate-spin" />
                     <span className="text-zinc-600 dark:text-zinc-300">
                         <span className="text-zinc-900 dark:text-white font-bold">{translatingItem.fileName}</span>
                     </span>
                     <span className="text-yellow-600 dark:text-yellow-500 font-mono">{translatingItem.progress}%</span>
                 </div>
             )}
             <button 
                onClick={toggleTheme}
                className="p-2.5 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white bg-zinc-100 dark:bg-zinc-800/30 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-full transition-all border border-transparent hover:border-zinc-300 dark:hover:border-zinc-700"
                title="Toggle Theme"
             >
                 {theme === 'dark' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
             </button>
             <button 
                onClick={() => setShowModelSettings(true)}
                className="p-2.5 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white bg-zinc-100 dark:bg-zinc-800/30 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-full transition-all border border-transparent hover:border-zinc-300 dark:hover:border-zinc-700"
                title="Model Settings"
             >
                 <Cog className="w-5 h-5" />
             </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto w-full px-6 py-8">
            {/* ... Rest of Main Content ... */}
            <div className="flex flex-col gap-6">
                
                {/* 1. Navigation Pills */}
                <div className="bg-zinc-100 dark:bg-zinc-900/50 p-1.5 rounded-full flex relative border border-zinc-200 dark:border-zinc-800 shadow-inner w-full md:w-2/3 mx-auto mb-4 transition-colors duration-300">
                    <button 
                        onClick={() => setActiveTab(TabView.UPLOAD)}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-full text-sm font-semibold transition-all z-10 ${activeTab === TabView.UPLOAD ? 'text-black shadow-md' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'}`}
                    >
                        <Upload className="w-4 h-4" /> Upload
                    </button>
                    <button 
                        onClick={() => setActiveTab(TabView.SEARCH)}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-full text-sm font-semibold transition-all z-10 ${activeTab === TabView.SEARCH ? 'text-black shadow-md' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'}`}
                    >
                        <Eye className="w-4 h-4" /> Search
                    </button>
                    
                    {/* Animated Pill Background */}
                    <div className={`absolute top-1.5 bottom-1.5 w-[calc(50%-6px)] bg-gradient-to-r from-yellow-400 to-yellow-500 rounded-full transition-all duration-300 ease-out ${activeTab === TabView.SEARCH ? 'left-[50%]' : 'left-1.5'}`} />
                </div>

                {/* 2. Content Area */}
                {activeTab === TabView.SEARCH ? (
                    <div className="bg-white dark:bg-zinc-900/30 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-xl transition-colors duration-300">
                        <SubtitleSearch onSelectSubtitle={handleSubtitleSelection} />
                    </div>
                ) : (
                    <>
                        {/* Drag & Drop Zone */}
                        <div className={`relative border-2 border-dashed rounded-2xl p-8 transition-all duration-300 text-center group overflow-hidden ${batchItems.length > 0 ? 'border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/20' : 'border-zinc-300 dark:border-zinc-700 hover:border-yellow-500/50 hover:bg-zinc-100 dark:hover:bg-zinc-900/50'}`}>
                            <input 
                                type="file" 
                                accept=".srt,.ass,.ssa,.vtt" 
                                multiple 
                                onChange={handleFileUpload}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" 
                                id="srt-upload" 
                                title="Drop files here"
                            />
                            
                            {batchItems.length === 0 ? (
                                <div className="flex flex-col items-center gap-4 relative z-0 pointer-events-none">
                                    <div className="w-20 h-20 bg-zinc-200 dark:bg-zinc-800/50 rounded-full flex items-center justify-center text-zinc-400 dark:text-zinc-500 group-hover:scale-110 group-hover:text-yellow-600 dark:group-hover:text-yellow-500 transition-all duration-300 ring-1 ring-zinc-300 dark:ring-zinc-700 group-hover:ring-yellow-500/30">
                                        <Upload className="w-8 h-8" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-zinc-700 dark:text-white group-hover:text-yellow-600 dark:group-hover:text-yellow-400 transition-colors">Drop subtitles here</h3>
                                        <p className="text-zinc-500 text-sm mt-1">Supports .srt, .ass, .vtt</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex flex-col gap-4 pointer-events-auto relative z-20">
                                    <div className="flex justify-between items-center pb-2 border-b border-zinc-200 dark:border-zinc-800/50">
                                        <h3 className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                                            <Layers className="w-3 h-3" /> Queue ({batchItems.length})
                                        </h3>
                                        <div className="flex gap-3">
                                             <button onClick={clearAll} className="text-[10px] font-bold text-red-500 hover:text-red-400 uppercase tracking-wider" title="Clear all">Clear</button>
                                             <label htmlFor="srt-upload" className="text-[10px] font-bold text-yellow-600 hover:text-yellow-500 uppercase tracking-wider cursor-pointer">Add +</label>
                                        </div>
                                    </div>
                                    <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1 scrollbar-thin">
                                        {batchItems.map(item => (
                                            <div 
                                                key={item.id} 
                                                onClick={() => setActiveItemId(item.id)}
                                                className={`p-3 rounded-xl border flex items-center gap-3 cursor-pointer transition-all group/item relative overflow-hidden ${activeItemId === item.id ? 'bg-zinc-100 dark:bg-zinc-800 border-yellow-500/30 shadow-[0_0_15px_-3px_rgba(234,179,8,0.15)]' : 'bg-white dark:bg-zinc-900/40 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800'}`}
                                            >
                                                {/* Active Indicator Strip */}
                                                {activeItemId === item.id && <div className="absolute left-0 top-0 bottom-0 w-1 bg-yellow-500" />}

                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 border ${item.status === 'completed' ? 'bg-green-500/10 border-green-500/20 text-green-600 dark:text-green-500' : item.status === 'translating' ? 'bg-yellow-500/10 border-yellow-500/20 text-yellow-600 dark:text-yellow-500' : item.status === 'error' ? 'bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-500' : 'bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-400 dark:text-zinc-500'}`}>
                                                    {item.status === 'completed' ? <CheckCircle className="w-4 h-4" /> : 
                                                     item.status === 'translating' ? <RefreshCw className="w-4 h-4 animate-spin" /> :
                                                     item.status === 'error' ? <AlertTriangle className="w-4 h-4 text-red-500" /> :
                                                     <FileText className="w-4 h-4" />}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex justify-between mb-1">
                                                        <span className={`font-medium text-sm truncate ${activeItemId === item.id ? 'text-zinc-900 dark:text-white' : 'text-zinc-600 dark:text-zinc-400 group-hover/item:text-zinc-900 dark:group-hover/item:text-zinc-200'}`}>{item.fileName}</span>
                                                    </div>
                                                    {item.status === 'translating' ? (
                                                        <div className="h-1 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden w-full">
                                                            <div className="h-full bg-yellow-500 transition-all duration-300 ease-out" style={{ width: `${item.progress}%` }} />
                                                        </div>
                                                    ) : (
                                                        <span className="text-[10px] text-zinc-500 font-mono truncate block">{item.message}</span>
                                                    )}
                                                </div>
                                                {/* Edit Bible/Context Button */}
                                                <button onClick={(e) => openEditor(e, item.id, 'bible')} className="opacity-0 group-hover/item:opacity-100 p-1.5 hover:bg-blue-500/10 rounded text-zinc-500 hover:text-blue-500 dark:text-zinc-600 dark:hover:text-blue-400 transition-all mr-1" title="Edit Glossary / Context">
                                                     <BookOpen className="w-3.5 h-3.5" />
                                                </button>
                                                {/* View Log Button */}
                                                <button onClick={(e) => {e.stopPropagation(); setViewingLogs(item.id)}} className="opacity-0 group-hover/item:opacity-100 p-1.5 hover:bg-emerald-500/10 rounded text-zinc-500 hover:text-emerald-500 dark:text-zinc-600 dark:hover:text-emerald-400 transition-all mr-1" title="View Realtime Log">
                                                     <ScrollText className="w-3.5 h-3.5" />
                                                </button>
                                                <button onClick={(e) => {e.stopPropagation(); removeBatchItem(item.id)}} className="opacity-0 group-hover/item:opacity-100 p-1.5 hover:bg-red-500/10 rounded text-zinc-500 hover:text-red-500 dark:text-zinc-600 dark:hover:text-red-400 transition-all">
                                                     <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {batchItems.length > 0 && (
                            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                {/* Command Center Bar */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-1.5 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl backdrop-blur-md transition-colors duration-300">
                                     {/* Target Lang */}
                                     <div className="flex items-center gap-2 bg-white dark:bg-zinc-950/50 rounded-lg px-3 py-2 border border-zinc-200 dark:border-zinc-800 focus-within:border-yellow-500/50 transition-colors">
                                        <Languages className="w-4 h-4 text-zinc-500" />
                                        <select 
                                            value={targetLang}
                                            onChange={handleLanguageChange}
                                            title="Target Language"
                                            className="bg-transparent text-sm text-zinc-900 dark:text-zinc-200 focus:outline-none w-full cursor-pointer"
                                        >
                                            {AVAILABLE_LANGUAGES.map(lang => (
                                                <option key={lang} value={lang} className="bg-white text-zinc-900 dark:bg-zinc-900 dark:text-zinc-200">{lang}</option>
                                            ))}
                                        </select>
                                     </div>

                                     {/* Toggles Group */}
                                     <div className="flex items-center justify-between gap-1">
                                        <button 
                                            onClick={() => setAutoContext(!autoContext)}
                                            title="Detect Plot Context"
                                            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium border transition-all ${autoContext ? 'bg-purple-500/10 border-purple-500/30 text-purple-600 dark:text-purple-300' : 'bg-white dark:bg-zinc-950/50 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300'}`}
                                        >
                                            <Sparkles className="w-3 h-3" /> Context
                                        </button>
                                        <button 
                                            onClick={() => setAutoBible(!autoBible)}
                                            title="Generate Character Glossary & Pronouns"
                                            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium border transition-all ${autoBible ? 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-300' : 'bg-white dark:bg-zinc-950/50 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300'}`}
                                        >
                                            <BookOpen className="w-3 h-3" /> Glossary
                                        </button>
                                        <button 
                                            onClick={() => setSmartTiming(!smartTiming)}
                                            title="Smart Timing Logic"
                                            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium border transition-all ${smartTiming ? 'bg-blue-500/10 border-blue-500/30 text-blue-600 dark:text-blue-300' : 'bg-white dark:bg-zinc-950/50 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300'}`}
                                        >
                                            <Hourglass className="w-3 h-3" /> Timing
                                        </button>
                                     </div>
                                </div>

                                {/* Main Actions */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <button
                                        onClick={handleTranslateAll}
                                        disabled={isTranslating.current}
                                        className={`group relative p-4 rounded-xl flex items-center justify-center gap-3 transition-all overflow-hidden ${
                                            isTranslating.current 
                                            ? 'bg-zinc-200 dark:bg-zinc-800 cursor-not-allowed text-zinc-500'
                                            : 'bg-yellow-500 text-black font-bold hover:shadow-[0_0_30px_-10px_rgba(234,179,8,0.5)] hover:scale-[1.02]'
                                        }`}
                                    >
                                        {isTranslating.current ? (
                                            <>Processing...</>
                                        ) : (
                                            <>
                                                <RefreshCw className="w-5 h-5 transition-transform group-hover:rotate-180" /> 
                                                <span>Translate</span>
                                            </>
                                        )}
                                        {!isTranslating.current && <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />}
                                    </button>

                                    <div className="flex gap-2">
                                        <button
                                            onClick={handleDownloadAll}
                                            disabled={completedCount === 0}
                                            className="flex-1 py-3 px-4 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-900 dark:text-zinc-100 font-medium flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:border-zinc-400 dark:hover:border-zinc-500"
                                        >
                                            <DownloadIcon className="w-4 h-4" /> 
                                            {getDownloadLabel()}
                                        </button>
                                        <button 
                                            onClick={() => setShowStyleConfig(!showStyleConfig)}
                                            className={`px-4 rounded-xl transition-all border ${showStyleConfig ? 'bg-zinc-200 dark:bg-zinc-200 text-black border-zinc-300 dark:border-zinc-200' : 'bg-zinc-100 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:border-zinc-400 dark:hover:border-zinc-500'}`}
                                            title="Style Inspector"
                                        >
                                            <Settings2 className="w-5 h-5" />
                                        </button>
                                    </div>
                                </div>
                                {/* ... Style Inspector ... */}
                                {/* ... Visual Preview ... */}
                                {/* ... Transcript List ... */}
                            </div>
                        )}
                    </>
                )}
            </div>
            
            {/* ... Modals ... */}

        {/* MODEL SETTINGS MODAL */}
        {showModelSettings && (
             <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 p-6 rounded-2xl max-w-md w-full shadow-2xl space-y-6 ring-1 ring-black/5 dark:ring-white/10">
                    <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-4">
                        <h3 className="text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2"><Cpu className="w-5 h-5 text-yellow-500"/> AI Provider Config</h3>
                        <button onClick={() => setShowModelSettings(false)} className="text-zinc-500 hover:text-zinc-900 dark:hover:text-white"><X className="w-5 h-5" /></button>
                    </div>
                    
                    <div className="space-y-5">
                         {/* Provider Toggle */}
                         <div className="flex p-1 bg-zinc-100 dark:bg-zinc-800 rounded-lg">
                             <button onClick={() => setModelConfig({...modelConfig, provider: 'gemini'})} className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${modelConfig.provider === 'gemini' ? 'bg-white dark:bg-zinc-700 shadow-sm text-zinc-900 dark:text-white' : 'text-zinc-500 dark:text-zinc-400'}`}>
                                 <div className="flex items-center justify-center gap-2"><Globe className="w-3.5 h-3.5" /> Google Gemini</div>
                             </button>
                             <button onClick={() => setModelConfig({...modelConfig, provider: 'local'})} className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${modelConfig.provider === 'local' ? 'bg-white dark:bg-zinc-700 shadow-sm text-zinc-900 dark:text-white' : 'text-zinc-500 dark:text-zinc-400'}`}>
                                 <div className="flex items-center justify-center gap-2"><Server className="w-3.5 h-3.5" /> Local LLM</div>
                             </button>
                         </div>

                         {/* Gemini Config */}
                         {modelConfig.provider === 'gemini' && (
                            <div className="space-y-4 animate-in fade-in">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Google Model</label>
                                    <select value={modelConfig.modelName} onChange={(e) => setModelConfig({...modelConfig, modelName: e.target.value})} className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-900 dark:text-zinc-200 focus:border-yellow-500 outline-none">{AVAILABLE_MODELS.map(model => <option key={model.id} value={model.id}>{model.name}</option>)}</select>
                                </div>
                            </div>
                         )}

                         {/* Local Config */}
                         {modelConfig.provider === 'local' && (
                            <div className="space-y-4 animate-in fade-in">
                                <div className="space-y-2">
                                     <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Endpoint URL</label>
                                     <input type="text" value={modelConfig.localEndpoint || ''} onChange={(e) => setModelConfig({...modelConfig, localEndpoint: e.target.value})} placeholder="http://127.0.0.1:8080/v1/chat/completions" className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-sm font-mono text-zinc-900 dark:text-zinc-200 focus:border-yellow-500 outline-none" />
                                     <p className="text-[10px] text-zinc-500">Must be an OpenAI-compatible completion endpoint.</p>
                                </div>
                                <div className="space-y-2">
                                     <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Model Name (Optional)</label>
                                     <input type="text" value={modelConfig.modelName} onChange={(e) => setModelConfig({...modelConfig, modelName: e.target.value})} placeholder="gemma-2-9b-it" className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-900 dark:text-zinc-200 focus:border-yellow-500 outline-none" />
                                </div>
                            </div>
                         )}

                         {/* Common Parameters */}
                        <div className="space-y-2">
                            <div className="flex justify-between"><label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Temperature</label><span className="text-xs text-yellow-600 dark:text-yellow-500">{modelConfig.temperature}</span></div>
                            <input type="range" min="0" max="1" step="0.1" value={modelConfig.temperature} onChange={(e) => setModelConfig({...modelConfig, temperature: parseFloat(e.target.value)})} className="w-full accent-yellow-500 h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-lg appearance-none" />
                        </div>
                        
                        {/* Simulation Mode Toggle */}
                         <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800">
                             <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                     <div className={`p-1.5 rounded-md ${modelConfig.useSimulation ? 'bg-purple-500/20 text-purple-600 dark:text-purple-400' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500'}`}>
                                         <TestTube className="w-4 h-4" />
                                     </div>
                                     <div>
                                         <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-200">Simulation Mode</h4>
                                         <p className="text-xs text-zinc-500">Test app without using API quota</p>
                                     </div>
                                </div>
                                <button 
                                    onClick={() => setModelConfig({...modelConfig, useSimulation: !modelConfig.useSimulation})}
                                    className={`relative w-11 h-6 rounded-full transition-colors duration-200 ease-in-out focus:outline-none ${modelConfig.useSimulation ? 'bg-purple-600' : 'bg-zinc-300 dark:bg-zinc-700'}`}
                                >
                                    <span className={`block w-4 h-4 transform rounded-full bg-white shadow transition-transform duration-200 ease-in-out ${modelConfig.useSimulation ? 'translate-x-6' : 'translate-x-1'}`} />
                                </button>
                             </div>
                         </div>
                    </div>
                    <button onClick={() => setShowModelSettings(false)} className="w-full py-3 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-900 dark:text-zinc-200 rounded-xl font-medium transition-colors">Save & Close</button>
                </div>
            </div>
        )}
      </main>
    </div>
  );
}

export default App;