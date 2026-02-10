
import React, { useState, useRef, useEffect } from 'react';
import { Upload, FileText, CheckCircle, AlertTriangle, RefreshCw, Download as DownloadIcon, PlayCircle, Sparkles, Languages, Settings2, Layout, Palette, ArrowUpDown, RotateCcw, Monitor, Trash2, Layers, Film, Tv, Type, Cog, X, AlignJustify, AlignLeft, Cpu, FileType, Hourglass, ChevronsRight, Eye, ArrowUp, ArrowDown, Moon, Sun, BookOpen, Edit3, Save, ScrollText, Terminal, TestTube, Globe, Server, FileInput, CloudCog, Coins, HelpCircle } from 'lucide-react';
import { SubtitleLine, TabView, AssStyleConfig, BatchItem, ModelConfig, LogEntry } from './types';
import { parseSubtitle, generateSubtitleContent, downloadFile, STYLE_PRESETS, calculateSafeDurations, mergeAndOptimizeSubtitles, estimateTokens } from './services/subtitleUtils';
import { translateBatch, generateContext, detectLanguage, generateShowBible, identifyShowName } from './services/geminiService';
import { saveSession, loadSession, clearSession, loadShowMetadata, saveShowMetadata } from './services/storage';
import SubtitleSearch from './components/OpenSubtitlesSearch';
import { ToastProvider, useToast } from './components/Toast';

// OPTIMIZED CONSTANTS FOR STABILITY
const BATCH_SIZE = 40;  
const CONCURRENCY = 8;  
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

const OPENAI_PRESETS = [
    { label: "OpenAI", options: [
        { id: "gpt-4o", name: "GPT-4o" },
        { id: "gpt-4-turbo", name: "GPT-4 Turbo" },
        { id: "gpt-3.5-turbo", name: "GPT-3.5 Turbo" }
    ]},
    { label: "DeepSeek", options: [
        { id: "deepseek-chat", name: "DeepSeek Chat (V3)" },
        { id: "deepseek-reasoner", name: "DeepSeek Reasoner (R1)" }
    ]},
    { label: "Mistral", options: [
        { id: "mistral-large-latest", name: "Mistral Large" },
        { id: "mistral-small-latest", name: "Mistral Small" }
    ]},
    { label: "Groq (Llama)", options: [
        { id: "llama3-70b-8192", name: "Llama 3 70B" },
        { id: "llama3-8b-8192", name: "Llama 3 8B" }
    ]},
    { label: "Anthropic (via Proxy)", options: [
        { id: "claude-3-opus-20240229", name: "Claude 3 Opus" },
        { id: "claude-3-5-sonnet-20240620", name: "Claude 3.5 Sonnet" }
    ]}
];

const KODI_FONTS = [
    "Arial", "Arial Narrow", "Arial Black", "Comic Sans MS", "Courier New", 
    "DejaVu Sans", "Georgia", "Impact", "Times New Roman", "Trebuchet MS", "Verdana", "Teletext"
];

// --- COMPONENTS ---

const InfoTooltip = ({ text }: { text: string }) => (
    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 p-2.5 bg-zinc-900 dark:bg-zinc-800 text-white text-xs leading-relaxed rounded-lg shadow-xl border border-zinc-700/50 hidden group-hover:block z-[100] pointer-events-none animate-in fade-in slide-in-from-bottom-1 duration-200">
        {text}
        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-zinc-900 dark:border-t-zinc-800"></div>
    </div>
);

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
    
    // Green Screen Background for Contrast Check
    const containerStyle: React.CSSProperties = {
        aspectRatio: '16/9',
        backgroundColor: '#166534', 
        backgroundImage: 'radial-gradient(circle at center, #4ade80 0%, #14532d 100%)',
        position: 'relative',
        overflow: 'hidden',
        borderRadius: '0.75rem',
        border: '1px solid #3f3f46',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 20px 50px -12px rgba(0, 0, 0, 0.5)'
    };

    // Reduced scale to simulate 4K TV resolution proportions on small preview
    const SCALE = 0.25; 
    
    const displayOriginal = original || "Original Text Placeholder";
    const displayTranslated = translated || "Translated Text Placeholder";

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
        if (outlineW > 0) {
            const stroke = Math.max(1, outlineW * 0.8); 
            for(let x = -1; x <= 1; x++) {
                for(let y = -1; y <= 1; y++) {
                    if(x!==0 || y!==0) textShadows.push(`${x*stroke}px ${y*stroke}px 0 #000`);
                }
            }
        }
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
        
        // Normalize HTML breaks to [br] first
        let content = text.replace(/<br\s*\/?>/gi, '[br]').replace(/<\/br>/gi, '[br]');
        
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
             <div className="absolute inset-0 pointer-events-none opacity-5 z-0" 
                  style={{background: 'linear-gradient(to bottom, rgba(255,255,255,0), rgba(255,255,255,0) 50%, rgba(0,0,0,0.2) 50%, rgba(0,0,0,0.2))', backgroundSize: '100% 4px'}}>
             </div>
             {isSample && <div className="absolute top-2 right-2 px-2 py-1 bg-zinc-800/80 rounded text-xs text-zinc-400 font-mono z-30 backdrop-blur-sm">ASS PREVIEW</div>}
             {content}
        </div>
    );
};

// --- MAIN APP CONTENT (Refactored to support ToastProvider wrapper) ---

function DualSubApp() {
  // Theme State
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');
  const [activeTab, setActiveTab] = useState<TabView>(TabView.UPLOAD);
  
  // Batch State
  const [batchItems, setBatchItems] = useState<BatchItem[]>([]);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  
  // Settings
  const [autoContext, setAutoContext] = useState(true);
  const [autoBible, setAutoBible] = useState(true);
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
      localEndpoint: 'http://127.0.0.1:8080/v1/chat/completions',
      apiKey: ''
  });
  const [showModelSettings, setShowModelSettings] = useState(false);
  const [customModelMode, setCustomModelMode] = useState(false);

  // Check if current OpenAI model is custom or preset
  useEffect(() => {
    if (modelConfig.provider === 'openai') {
        const isPreset = OPENAI_PRESETS.some(grp => grp.options.some(opt => opt.id === modelConfig.modelName));
        setCustomModelMode(!isPreset && modelConfig.modelName !== 'gpt-4o');
    }
  }, [modelConfig.provider]);

  // Style Configuration State - Load from localStorage if available
  const [styleConfig, setStyleConfig] = useState<AssStyleConfig>(() => {
    try {
        const saved = localStorage.getItem('user_style_config');
        return saved ? JSON.parse(saved) : STYLE_PRESETS.DEFAULT;
    } catch {
        return STYLE_PRESETS.DEFAULT;
    }
  });
  const [showStyleConfig, setShowStyleConfig] = useState(false);
  
  // Toast
  const { addToast } = useToast();

  // Token Estimator State
  const [estimation, setEstimation] = useState<{ cost: string, count: number } | null>(null);

  // Auto-save style configuration changes
  useEffect(() => {
    localStorage.setItem('user_style_config', JSON.stringify(styleConfig));
  }, [styleConfig]);

  // Confirmation Request State
  const [confirmationRequest, setConfirmationRequest] = useState<{ itemId: string; fileName: string; detectedLanguage: string; resolve: (val: boolean) => void } | null>(null);

  // Editor State
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

  // Cost Estimation Effect
  useEffect(() => {
      if (!activeItem) {
          setEstimation(null);
          return;
      }
      // Calculate only for pending lines to be useful for "Translate" action context
      // Or just total file for general info. Let's do Total File Cost as that is most informative.
      const { inputTokens, outputTokens, cost } = estimateTokens(activeItem.subtitles, modelConfig.modelName);
      setEstimation({ cost, count: inputTokens + outputTokens });
  }, [activeItem, modelConfig.modelName]);

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
  
  const resetStyles = () => {
      if (window.confirm("Reset all style settings to factory defaults?")) {
        setStyleConfig(STYLE_PRESETS.DEFAULT);
        addToast("Style settings reset to default", "info");
      }
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
    
    // Parse all files first
    const parsedFiles = results.map(({ file, content }) => {
        try {
            const subtitles = parseSubtitle(content, file.name);
            const nameNoExt = file.name.replace(/\.(srt|ass|vtt|ssa)$/i, "");
            return { file, subtitles, nameNoExt, valid: subtitles.length > 0 };
        } catch (e) {
            return { file, subtitles: [], nameNoExt: file.name, valid: false };
        }
    });

    setBatchItems(prev => {
        const nextBatch = [...prev];
        const usedIndices = new Set<number>();

        // 1. Try to merge new files into EXISTING batch items
        parsedFiles.forEach((pFile, idx) => {
            if (!pFile.valid) return;

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
                const merged = mergeAndOptimizeSubtitles(existing.subtitles, pFile.subtitles, smartTiming);
                
                nextBatch[matchIndex] = {
                    ...existing,
                    subtitles: merged,
                    status: 'completed',
                    progress: 100,
                    message: `Merged: ${pFile.file.name}`
                };
                usedIndices.add(idx);
                addToast(`Merged ${pFile.file.name} into existing item`, 'success');
            }
        });

        // 2. Pair remaining new files with each other
        const remainingFiles = parsedFiles
            .map((f, i) => ({ ...f, origIndex: i }))
            .filter((_, i) => !usedIndices.has(i));

        // Sort by name length (shortest is likely source)
        remainingFiles.sort((a, b) => a.nameNoExt.length - b.nameNoExt.length);

        const mergedInBatch = new Set<number>(); // IDs within remainingFiles array
        const newBatchItems: BatchItem[] = [];

        remainingFiles.forEach((source, i) => {
            if (mergedInBatch.has(i)) return; 

            let currentSubtitles = source.subtitles;
            let status: BatchItem['status'] = source.valid ? 'pending' : 'error';
            let message = source.valid ? `Ready (${source.subtitles.length} lines)` : 'Parse Error';
            let progress = 0;

            if (source.valid) {
                // Look for translations of this source in the rest of the new files
                remainingFiles.forEach((trans, j) => {
                    if (i === j) return;
                    if (mergedInBatch.has(j)) return;
                    if (!trans.valid) return;

                    if (trans.nameNoExt.startsWith(source.nameNoExt)) {
                         const suffix = trans.nameNoExt.substring(source.nameNoExt.length);
                         if (/^([-_.]\w{2}|\s\(\d+\))$/.test(suffix)) {
                             // Matched translation
                             currentSubtitles = mergeAndOptimizeSubtitles(currentSubtitles, trans.subtitles, smartTiming);
                             status = 'completed';
                             progress = 100;
                             message = `Auto-merged: ${trans.file.name}`;
                             mergedInBatch.add(j);
                         }
                    }
                });
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
        });
        
        return [...nextBatch, ...newBatchItems];
    });

    if (addedCount > 0) addToast(`Added ${addedCount} files to queue`, 'success');
    
    // Clear input
    event.target.value = '';
  };

  const handleImportTranslation = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file || !activeItemId) return;
        
        const reader = new FileReader();
        reader.onload = (e) => {
            const content = e.target?.result as string;
            try {
                const importedSubtitles = parseSubtitle(content, file.name);
                
                setBatchItems(prev => prev.map(item => {
                    if (item.id !== activeItemId) return item;
                    
                    const mergedSubtitles = mergeAndOptimizeSubtitles(
                        item.subtitles,
                        importedSubtitles,
                        smartTiming
                    );
                    
                    return {
                        ...item,
                        subtitles: mergedSubtitles,
                        status: 'completed',
                        progress: 100,
                        message: 'Translation Imported & Optimized'
                    };
                }));
                addToast("Translation merged successfully", "success");
            } catch (err) {
                addToast("Failed to parse imported translation file", "error");
            }
        };
        reader.readAsText(file);
        
        // Reset input
        event.target.value = '';
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
          addToast(`Loaded subtitle: ${name}`, 'success');
      } catch (err) {
          addToast("Failed to parse the downloaded subtitle", "error");
      }
  };
  
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

      const logInfo = (message: string, type: 'info' | 'request' | 'response' | 'error' = 'info', data?: any) => {
          const entry: LogEntry = { timestamp: Date.now(), type, message, data };
          setBatchItems(prev => prev.map(pi => pi.id === itemId ? { ...pi, logs: [...pi.logs, entry] } : pi));
      };

      const { isEnglish, language } = await detectLanguage(item.subtitles, modelConfig.useSimulation, modelConfig);
      
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

      let showName = "";
      if (autoContext || autoBible) {
          showName = await identifyShowName(item.fileName, modelConfig.useSimulation, modelConfig);
          const cachedMetadata = await loadShowMetadata(showName);
          let context = item.context || cachedMetadata?.context || "";
          let showBible = item.showBible || cachedMetadata?.bible || "";
          let newDataGenerated = false;

          if (autoContext && !context) {
              setBatchItems(prev => prev.map(pi => pi.id === itemId ? { ...pi, message: 'Analyzing plot context...' } : pi));
              try { 
                  context = await generateContext(item.fileName, modelConfig.useSimulation, modelConfig); 
                  newDataGenerated = true;
              } catch(e) { console.error(e); }
          }
          if (autoBible && !showBible) {
              setBatchItems(prev => prev.map(pi => pi.id === itemId ? { ...pi, message: 'Generating Glossary...' } : pi));
              try { 
                  showBible = await generateShowBible(item.fileName, targetLang, modelConfig.useSimulation, modelConfig);
                  newDataGenerated = true;
              } catch (e) { console.error(e); }
          }
          setBatchItems(prev => prev.map(pi => pi.id === itemId ? { ...pi, context: context, showBible: showBible } : pi));
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
                      if (chunkAttempts > 1) setBatchItems(prev => prev.map(pi => pi.id === itemId ? { ...pi, message: `Retrying block ${chunkIndex}...` } : pi));
                      const translations = await translateBatch(linesToTranslate, targetLang, contextToUse, previous, modelConfig, safeDurations, bibleToUse, logInfo);
                      const missingIds = linesToTranslate.filter(l => !translations.has(l.id));
                      if (missingIds.length === 0) {
                          linesToTranslate.forEach(line => { if (translations.has(line.id)) line.translatedText = translations.get(line.id); });
                          chunkSuccess = true;
                      } else {
                           linesToTranslate.forEach(line => { if (translations.has(line.id)) line.translatedText = translations.get(line.id); });
                      }
                  } catch (error: any) {
                      if (error.message?.includes("TERMINAL")) {
                           setBatchItems(prev => prev.map(pi => pi.id === itemId ? { ...pi, status: 'error', message: `Stopped: ${error.message}` } : pi));
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
          setBatchItems(prev => prev.map(pi => pi.id === itemId ? { ...pi, subtitles: [...newSubtitles], progress: percentage, message: `Translating... ${percentage}%` } : pi));
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
          setBatchItems(prev => prev.map(pi => pi.id === itemId ? { ...pi, status: 'completed', progress: 100, message: 'Done' } : pi));
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
        addToast("Workspace cleared", "info");
      }
  };

  const completedCount = batchItems.filter(i => i.status === 'completed').length;
  const getDownloadLabel = () => completedCount === 1 ? `Download` : `Download All (${completedCount})`;
  
  // Set default configurations when switching providers
  const handleProviderChange = (provider: ModelConfig['provider']) => {
      const newConfig = { ...modelConfig, provider };
      
      if (provider === 'gemini') {
          newConfig.modelName = 'gemini-3-flash-preview';
          newConfig.apiKey = ''; // Reset custom key, use env
      } else if (provider === 'google_nmt') {
          // Reset NMT config
          newConfig.modelName = 'google_nmt';
          newConfig.apiKey = ''; // Requires user input
          
          // NMT doesn't support context features
          if (autoContext || autoBible) {
              addToast("Context features disabled for Google Translate", "info");
              setAutoContext(false);
              setAutoBible(false);
          }

      } else if (provider === 'local') {
          newConfig.modelName = 'llama3';
          newConfig.localEndpoint = 'http://127.0.0.1:8080/v1/chat/completions';
          newConfig.apiKey = '';
      } else {
          // Generic OpenAI
          newConfig.modelName = 'gpt-4o';
          newConfig.localEndpoint = 'https://api.openai.com/v1/chat/completions';
      }
      setModelConfig(newConfig);
      addToast(`Switched provider to ${provider}`, 'info');
  };

  const handleOpenAIModelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const val = e.target.value;
      if (val === 'custom') {
          setCustomModelMode(true);
          setModelConfig({ ...modelConfig, modelName: '' });
      } else {
          setCustomModelMode(false);
          setModelConfig({ ...modelConfig, modelName: val });
      }
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 flex flex-col font-sans transition-colors duration-300">
      {/* Header */}
      <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 z-50">
        <div className="max-w-5xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2 group cursor-default">
            <div className="bg-yellow-500 p-2.5 rounded-xl shadow-lg shadow-yellow-500/20 group-hover:shadow-yellow-500/40 transition-all">
              <FileText className="w-5 h-5 text-black" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-zinc-900 dark:text-white leading-none">DualSub AI</h1>
              <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-semibold mt-1">Cinema Grade Translator</p>
            </div>
          </div>
          <div className="flex gap-4 items-center">
             <button onClick={toggleTheme} className="p-2.5 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white rounded-full bg-zinc-100 dark:bg-zinc-800/30 hover:bg-zinc-200 dark:hover:bg-zinc-800">
                 {theme === 'dark' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
             </button>
             <button onClick={() => setShowModelSettings(true)} className="p-2.5 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white rounded-full bg-zinc-100 dark:bg-zinc-800/30 hover:bg-zinc-200 dark:hover:bg-zinc-800">
                 <Cog className="w-5 h-5" />
             </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto w-full px-6 py-8">
            
            {/* Tabs */}
            <div className="bg-zinc-100 dark:bg-zinc-900/50 p-1.5 rounded-full flex relative border border-zinc-200 dark:border-zinc-800 shadow-inner w-full md:w-2/3 mx-auto mb-6">
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
                <div className={`absolute top-1.5 bottom-1.5 w-[calc(50%-6px)] bg-gradient-to-r from-yellow-400 to-yellow-500 rounded-full transition-all duration-300 ease-out ${activeTab === TabView.SEARCH ? 'left-[50%]' : 'left-1.5'}`} />
            </div>

            {activeTab === TabView.SEARCH ? (
                 <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-xl">
                    <SubtitleSearch onSelectSubtitle={handleSubtitleSelection} />
                </div>
            ) : (
                <div className="space-y-6">
                    {/* 1. Upload & Queue Section */}
                    <div className={`relative border-2 border-dashed rounded-2xl p-8 transition-all duration-300 text-center group overflow-hidden ${batchItems.length > 0 ? 'border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/20' : 'border-zinc-300 dark:border-zinc-700 hover:border-yellow-500/50 hover:bg-zinc-100 dark:hover:bg-zinc-900/50'}`}>
                        <input 
                            type="file" 
                            accept=".srt,.ass,.ssa,.vtt" 
                            multiple 
                            onChange={handleFileUpload}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                        />
                        {batchItems.length === 0 ? (
                            <div className="flex flex-col items-center gap-4">
                                <div className="w-20 h-20 bg-zinc-200 dark:bg-zinc-800/50 rounded-full flex items-center justify-center text-zinc-400 group-hover:text-yellow-600 dark:group-hover:text-yellow-500 transition-colors">
                                    <Upload className="w-8 h-8" />
                                </div>
                                <h3 className="text-lg font-bold text-zinc-700 dark:text-white">Drop subtitles here</h3>
                                <p className="text-zinc-500 text-sm">Supports .srt, .ass, .vtt</p>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-4 pointer-events-auto relative z-20">
                                <div className="flex justify-between items-center pb-2 border-b border-zinc-200 dark:border-zinc-800/50">
                                    <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Queue ({batchItems.length})</h3>
                                    <div className="flex gap-3">
                                         <button onClick={clearAll} className="text-[10px] font-bold text-red-500 uppercase tracking-wider">Clear</button>
                                         <button className="text-[10px] font-bold text-yellow-600 uppercase tracking-wider relative">
                                            Add +
                                            <input type="file" multiple onChange={handleFileUpload} className="absolute inset-0 opacity-0 cursor-pointer" />
                                         </button>
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[250px] overflow-y-auto pr-1">
                                    {batchItems.map(item => (
                                        <div 
                                            key={item.id}
                                            onClick={() => setActiveItemId(item.id)}
                                            className={`p-3 rounded-xl border flex items-center gap-3 cursor-pointer transition-all relative overflow-hidden ${activeItemId === item.id ? 'bg-zinc-100 dark:bg-zinc-800 border-yellow-500/30 shadow-sm' : 'bg-white dark:bg-zinc-900/40 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800'}`}
                                        >
                                            {activeItemId === item.id && <div className="absolute left-0 top-0 bottom-0 w-1 bg-yellow-500" />}
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 border ${item.status === 'completed' ? 'bg-green-500/10 border-green-500/20 text-green-600' : item.status === 'translating' ? 'bg-yellow-500/10 border-yellow-500/20 text-yellow-600' : 'bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-400'}`}>
                                                {item.status === 'translating' ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium truncate text-zinc-900 dark:text-zinc-200">{item.fileName}</p>
                                                {item.status === 'translating' ? (
                                                    <div className="h-1 bg-zinc-200 dark:bg-zinc-700 rounded-full mt-2 overflow-hidden">
                                                        <div className="h-full bg-yellow-500 transition-all duration-300" style={{width: `${item.progress}%`}} />
                                                    </div>
                                                ) : (
                                                    <p className="text-[10px] text-zinc-500 truncate">{item.message}</p>
                                                )}
                                            </div>
                                            <button onClick={(e) => {e.stopPropagation(); removeBatchItem(item.id)}} className="text-zinc-400 hover:text-red-500 p-1"><Trash2 className="w-3.5 h-3.5" /></button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* 2. Command Center & Actions */}
                    {batchItems.length > 0 && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            
                            {/* Command Center Bar */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 p-1.5 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl backdrop-blur-md">
                                 {/* Target Lang */}
                                 <div className="flex items-center gap-2 bg-white dark:bg-zinc-950/50 rounded-lg px-3 py-2 border border-zinc-200 dark:border-zinc-800 focus-within:border-yellow-500/50 transition-colors">
                                    <Languages className="w-4 h-4 text-zinc-500" />
                                    <select 
                                        value={targetLang}
                                        onChange={handleLanguageChange}
                                        className="bg-transparent text-sm text-zinc-900 dark:text-zinc-200 focus:outline-none w-full cursor-pointer dark:[&>option]:bg-zinc-900 dark:[&>option]:text-zinc-200 [&>option]:bg-white [&>option]:text-zinc-900"
                                    >
                                        {AVAILABLE_LANGUAGES.map(lang => <option key={lang} value={lang}>{lang}</option>)}
                                    </select>
                                 </div>

                                 {/* Toggles */}
                                 <div className="flex items-center justify-between gap-1">
                                    <button 
                                        onClick={() => { if(modelConfig.provider !== 'google_nmt') setAutoContext(!autoContext); }} 
                                        disabled={modelConfig.provider === 'google_nmt'}
                                        title={modelConfig.provider === 'google_nmt' ? "Not available with Google Translate" : "Enable Context Awareness"}
                                        className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium border transition-all ${
                                            modelConfig.provider === 'google_nmt' 
                                            ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 border-zinc-200 dark:border-zinc-700 cursor-not-allowed opacity-60'
                                            : autoContext 
                                                ? 'bg-purple-500/10 border-purple-500/30 text-purple-600 dark:text-purple-300' 
                                                : 'bg-white dark:bg-zinc-950/50 border-zinc-200 dark:border-zinc-800 text-zinc-500'
                                        }`}
                                    >
                                        <Sparkles className="w-3 h-3" /> Context
                                    </button>
                                    <button 
                                        onClick={() => { if(modelConfig.provider !== 'google_nmt') setAutoBible(!autoBible); }} 
                                        disabled={modelConfig.provider === 'google_nmt'}
                                        title={modelConfig.provider === 'google_nmt' ? "Not available with Google Translate" : "Enable Glossary/Show Bible"}
                                        className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium border transition-all ${
                                            modelConfig.provider === 'google_nmt' 
                                            ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 border-zinc-200 dark:border-zinc-700 cursor-not-allowed opacity-60'
                                            : autoBible 
                                                ? 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-300' 
                                                : 'bg-white dark:bg-zinc-950/50 border-zinc-200 dark:border-zinc-800 text-zinc-500'
                                        }`}
                                    >
                                        <BookOpen className="w-3 h-3" /> Glossary
                                    </button>
                                    <button onClick={() => setSmartTiming(!smartTiming)} className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium border transition-all ${smartTiming ? 'bg-blue-500/10 border-blue-500/30 text-blue-600 dark:text-blue-300' : 'bg-white dark:bg-zinc-950/50 border-zinc-200 dark:border-zinc-800 text-zinc-500'}`}>
                                        <Hourglass className="w-3 h-3" /> Timing
                                    </button>
                                 </div>
                            </div>

                            {/* Main Actions & Cost Estimator */}
                            <div className="flex flex-col gap-3">
                                {/* Actions Row */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <div className="flex gap-2">
                                        <button
                                            onClick={handleTranslateAll}
                                            disabled={isTranslating.current}
                                            className={`flex-1 group relative p-4 rounded-xl flex items-center justify-center gap-3 transition-all overflow-hidden ${
                                                isTranslating.current 
                                                ? 'bg-zinc-200 dark:bg-zinc-800 cursor-not-allowed text-zinc-500'
                                                : 'bg-yellow-500 text-black font-bold hover:shadow-[0_0_30px_-10px_rgba(234,179,8,0.5)] hover:scale-[1.02]'
                                            }`}
                                        >
                                            {isTranslating.current ? 'Processing...' : <><RefreshCw className="w-5 h-5 transition-transform group-hover:rotate-180" /> <span>Translate</span></>}
                                        </button>
                                        
                                        <button
                                            className="relative p-4 rounded-xl flex items-center justify-center gap-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-900 dark:text-zinc-200 font-bold transition-all border border-zinc-300 dark:border-zinc-700 w-16 group"
                                            title="Import translated file to merge"
                                        >
                                            <FileInput className="w-5 h-5" />
                                            <div className="absolute bottom-full mb-2 hidden group-hover:block bg-black text-white text-xs px-2 py-1 rounded whitespace-nowrap">Merge Translation</div>
                                            <input 
                                                type="file" 
                                                accept=".srt,.ass,.ssa,.vtt" 
                                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                                onChange={handleImportTranslation}
                                            />
                                        </button>
                                    </div>

                                    <div className="flex gap-2">
                                        <button
                                            onClick={handleDownloadAll}
                                            disabled={completedCount === 0}
                                            className="flex-1 py-3 px-4 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-900 dark:text-zinc-100 font-medium flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            <DownloadIcon className="w-4 h-4" /> 
                                            {getDownloadLabel()}
                                        </button>
                                        <button 
                                            onClick={() => setShowStyleConfig(!showStyleConfig)}
                                            className={`px-4 rounded-xl transition-all border ${showStyleConfig ? 'bg-zinc-200 dark:bg-zinc-200 text-black border-zinc-300' : 'bg-zinc-100 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 text-zinc-500'}`}
                                        >
                                            <Settings2 className="w-5 h-5" />
                                        </button>
                                    </div>
                                </div>
                                
                                {/* Token & Cost Estimator Pill */}
                                {activeItem && !activeItem.translatedText && (
                                    <div className="flex justify-center">
                                        <div 
                                            className="relative group inline-flex items-center gap-4 bg-zinc-100 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 rounded-full px-4 py-1.5 shadow-sm cursor-help transition-colors hover:bg-zinc-200 dark:hover:bg-zinc-900"
                                        >
                                            <InfoTooltip text={modelConfig.provider === 'google_nmt' 
                                                ? "Cost based on total character count (€20.00 per 1 Million characters)." 
                                                : "Estimated cost based on Input Tokens (Source Text + Prompt) and Output Tokens (Translation). Prices vary by model."} 
                                            />
                                            <div className="flex items-center gap-1.5 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                                                <Cpu className="w-3.5 h-3.5" />
                                                <span>{modelConfig.modelName === 'google_nmt' ? 'Google Translate (NMT)' : modelConfig.modelName.split('/').pop()?.replace('-preview', '')}</span>
                                            </div>
                                            <div className="w-px h-3 bg-zinc-300 dark:bg-zinc-700"></div>
                                            {estimation ? (
                                                <div className="flex items-center gap-3">
                                                    {modelConfig.provider === 'google_nmt' ? (
                                                        // NMT shows characters, not tokens
                                                        <div className="flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-300">
                                                            <Type className="w-3.5 h-3.5" />
                                                            <span>~{(estimation.count).toLocaleString()} chars</span>
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-300">
                                                            <ScrollText className="w-3.5 h-3.5" />
                                                            <span>~{(estimation.count / 1000).toFixed(1)}k tokens</span>
                                                        </div>
                                                    )}
                                                    
                                                    <div className="flex items-center gap-1.5 text-xs font-bold text-green-600 dark:text-green-400">
                                                        <Coins className="w-3.5 h-3.5" />
                                                        <span>{estimation.cost}</span>
                                                    </div>
                                                </div>
                                            ) : (
                                                <span className="text-xs text-zinc-400 italic">Calculating estimate...</span>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>

                           {/* Collapsible Style Inspector & Preview - RESTRUCTURED */}
                           {showStyleConfig && (
                                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-2xl animate-in fade-in slide-in-from-top-4">
                                    
                                    {/* Header / Presets */}
                                    <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex flex-wrap items-center gap-3 bg-zinc-50 dark:bg-zinc-900/50">
                                        <div className="flex items-center gap-2 mr-auto">
                                            <Palette className="w-4 h-4 text-zinc-500" />
                                            <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">Style Presets</span>
                                        </div>
                                        {Object.keys(STYLE_PRESETS).map(name => (
                                            <button 
                                                key={name} 
                                                onClick={() => applyPreset(name as any)} 
                                                className="px-3 py-1.5 text-xs font-bold rounded-full bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-700 hover:border-yellow-500 dark:hover:border-yellow-500 transition-all"
                                            >
                                                {name}
                                            </button>
                                        ))}
                                        <button onClick={resetStyles} className="ml-2 px-3 py-1.5 text-xs font-bold rounded-full text-red-500 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900 hover:bg-red-100 dark:hover:bg-red-900/20">Reset</button>
                                    </div>
                                    
                                    <div className="p-6 space-y-8">
                                        
                                        {/* Section 1: Layout & Structure */}
                                        <div className="space-y-4">
                                            <div className="flex items-center gap-2 mb-2">
                                                <Layout className="w-4 h-4 text-yellow-500" />
                                                <h4 className="text-sm font-bold text-zinc-900 dark:text-white uppercase tracking-wider">Layout & Structure</h4>
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div>
                                                    <label className="text-xs font-medium text-zinc-500 mb-1.5 block">Export Format</label>
                                                    <div className="flex bg-zinc-100 dark:bg-zinc-800 p-1 rounded-lg">
                                                            <button onClick={() => setStyleConfig({...styleConfig, outputFormat: 'ass'})} className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${styleConfig.outputFormat === 'ass' ? 'bg-white dark:bg-zinc-600 shadow-sm text-black dark:text-white' : 'text-zinc-500 hover:text-zinc-900'}`}>ASS (Styled)</button>
                                                            <button onClick={() => setStyleConfig({...styleConfig, outputFormat: 'srt'})} className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${styleConfig.outputFormat === 'srt' ? 'bg-white dark:bg-zinc-600 shadow-sm text-black dark:text-white' : 'text-zinc-500 hover:text-zinc-900'}`}>SRT (Simple)</button>
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className="text-xs font-medium text-zinc-500 mb-1.5 block">Positioning</label>
                                                    <div className="flex bg-zinc-100 dark:bg-zinc-800 p-1 rounded-lg">
                                                            <button onClick={() => setStyleConfig({...styleConfig, layout: 'stacked'})} className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${styleConfig.layout === 'stacked' ? 'bg-white dark:bg-zinc-600 shadow-sm text-black dark:text-white' : 'text-zinc-500 hover:text-zinc-900'}`}>Stacked</button>
                                                            <button onClick={() => setStyleConfig({...styleConfig, layout: 'split'})} className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${styleConfig.layout === 'split' ? 'bg-white dark:bg-zinc-600 shadow-sm text-black dark:text-white' : 'text-zinc-500 hover:text-zinc-900'}`}>Split</button>
                                                    </div>
                                                </div>
                                                <div className="md:col-span-2">
                                                    <label className="text-xs font-medium text-zinc-500 mb-1.5 block">Top Line Language</label>
                                                    <div className="flex bg-zinc-100 dark:bg-zinc-800 p-1 rounded-lg">
                                                            <button onClick={() => setStyleConfig({...styleConfig, stackOrder: 'primary-top'})} className={`flex-1 py-2 text-xs font-bold rounded-md transition-all flex items-center justify-center gap-2 ${styleConfig.stackOrder === 'primary-top' ? 'bg-white dark:bg-zinc-600 shadow-sm text-black dark:text-white' : 'text-zinc-500 hover:text-zinc-900'}`}>
                                                            <ArrowUp className="w-3 h-3" /> {targetLang} (Translated)
                                                            </button>
                                                            <button onClick={() => setStyleConfig({...styleConfig, stackOrder: 'secondary-top'})} className={`flex-1 py-2 text-xs font-bold rounded-md transition-all flex items-center justify-center gap-2 ${styleConfig.stackOrder === 'secondary-top' ? 'bg-white dark:bg-zinc-600 shadow-sm text-black dark:text-white' : 'text-zinc-500 hover:text-zinc-900'}`}>
                                                            <ArrowDown className="w-3 h-3" /> English (Source)
                                                            </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="h-px bg-zinc-100 dark:bg-zinc-800" />

                                        {/* Section 2: Typography & Effects */}
                                        <div className="space-y-4">
                                            <div className="flex items-center gap-2 mb-2">
                                                <Type className="w-4 h-4 text-blue-500" />
                                                <h4 className="text-sm font-bold text-zinc-900 dark:text-white uppercase tracking-wider">Typography & Effects</h4>
                                            </div>
                                            
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                <div className="md:col-span-1">
                                                    <label className="text-xs font-medium text-zinc-500 mb-1.5 block">Font Family</label>
                                                    <select value={styleConfig.fontFamily} onChange={e => setStyleConfig({...styleConfig, fontFamily: e.target.value})} className="w-full text-xs font-bold p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 focus:outline-none focus:border-yellow-500 transition-colors">
                                                        {KODI_FONTS.map(f => <option key={f} value={f}>{f}</option>)}
                                                    </select>
                                                </div>
                                                <div className="md:col-span-2 grid grid-cols-2 gap-4">
                                                    <div>
                                                        <label className="text-xs font-medium text-zinc-500 mb-1.5 flex justify-between"><span>Outline</span> <span>{styleConfig.outlineWidth}px</span></label>
                                                        <input type="range" min="0" max="10" step="0.5" value={styleConfig.outlineWidth} onChange={e => setStyleConfig({...styleConfig, outlineWidth: parseFloat(e.target.value)})} className="w-full h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-zinc-900 dark:accent-zinc-100" />
                                                    </div>
                                                    <div>
                                                        <label className="text-xs font-medium text-zinc-500 mb-1.5 flex justify-between"><span>Shadow</span> <span>{styleConfig.shadowDepth}px</span></label>
                                                        <input type="range" min="0" max="10" step="0.5" value={styleConfig.shadowDepth} onChange={e => setStyleConfig({...styleConfig, shadowDepth: parseFloat(e.target.value)})} className="w-full h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-zinc-900 dark:accent-zinc-100" />
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="text-xs font-medium text-zinc-500 mb-1.5 block">Background Style</label>
                                                    <div className="flex bg-zinc-100 dark:bg-zinc-800 p-1 rounded-lg">
                                                        <button onClick={() => setStyleConfig({...styleConfig, borderStyle: 1})} className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${styleConfig.borderStyle === 1 ? 'bg-white dark:bg-zinc-600 shadow-sm text-black dark:text-white' : 'text-zinc-500'}`}>Outline</button>
                                                        <button onClick={() => setStyleConfig({...styleConfig, borderStyle: 3})} className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${styleConfig.borderStyle === 3 ? 'bg-white dark:bg-zinc-600 shadow-sm text-black dark:text-white' : 'text-zinc-500'}`}>Box</button>
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className="text-xs font-medium text-zinc-500 mb-1.5 block">Subtitle Lines</label>
                                                    <div className="flex bg-zinc-100 dark:bg-zinc-800 p-1 rounded-lg">
                                                        <button onClick={() => setStyleConfig({...styleConfig, linesPerSubtitle: 2})} className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${(styleConfig.linesPerSubtitle ?? 2) === 2 ? 'bg-white dark:bg-zinc-600 shadow-sm text-black dark:text-white' : 'text-zinc-500'}`}>Multi-line</button>
                                                        <button onClick={() => setStyleConfig({...styleConfig, linesPerSubtitle: 1})} className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${styleConfig.linesPerSubtitle === 1 ? 'bg-white dark:bg-zinc-600 shadow-sm text-black dark:text-white' : 'text-zinc-500'}`}>Single Line</button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Visual Preview (Moved Below Typography) */}
                                        <div className="bg-zinc-100 dark:bg-black/40 rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800 p-4">
                                             <div className="flex items-center justify-between mb-3">
                                                 <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                                                    <Eye className="w-4 h-4" /> Live Preview
                                                </h4>
                                                <p className="text-[10px] text-zinc-500">
                                                    Line #{selectedSubtitle?.id || '-'}
                                                </p>
                                             </div>
                                            <VisualPreview 
                                                config={styleConfig} 
                                                original={sampleOriginal} 
                                                translated={sampleTranslated} 
                                                isSample={false}
                                            />
                                        </div>

                                        <div className="h-px bg-zinc-100 dark:bg-zinc-800" />

                                        {/* Section 3: Color Palette (Reordered) */}
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                             {/* Secondary Color Control (Original Text) - MOVED FIRST */}
                                            <div className="bg-zinc-50 dark:bg-zinc-800/30 p-4 rounded-xl border border-zinc-100 dark:border-zinc-800">
                                                <div className="flex items-center justify-between mb-3">
                                                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Original Text</label>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[10px] font-mono text-zinc-400">{styleConfig.secondary.color}</span>
                                                        <input type="color" value={styleConfig.secondary.color} onChange={e => setStyleConfig({...styleConfig, secondary: {...styleConfig.secondary, color: e.target.value}})} className="w-6 h-6 rounded cursor-pointer border-0 p-0 overflow-hidden" />
                                                    </div>
                                                </div>
                                                    <div>
                                                    <label className="text-[10px] text-zinc-400 mb-1 block flex justify-between"><span>Size</span> <span>{styleConfig.secondary.fontSize}px</span></label>
                                                    <input type="range" min="10" max="100" value={styleConfig.secondary.fontSize} onChange={e => setStyleConfig({...styleConfig, secondary: {...styleConfig.secondary, fontSize: parseInt(e.target.value)}})} className="w-full h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-yellow-500" />
                                                </div>
                                            </div>

                                            {/* Primary Color Control (Translated Text) - MOVED SECOND */}
                                            <div className="bg-zinc-50 dark:bg-zinc-800/30 p-4 rounded-xl border border-zinc-100 dark:border-zinc-800">
                                                <div className="flex items-center justify-between mb-3">
                                                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Translated Text</label>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[10px] font-mono text-zinc-400">{styleConfig.primary.color}</span>
                                                        <input type="color" value={styleConfig.primary.color} onChange={e => setStyleConfig({...styleConfig, primary: {...styleConfig.primary, color: e.target.value}})} className="w-6 h-6 rounded cursor-pointer border-0 p-0 overflow-hidden" />
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className="text-[10px] text-zinc-400 mb-1 block flex justify-between"><span>Size</span> <span>{styleConfig.primary.fontSize}px</span></label>
                                                    <input type="range" min="10" max="100" value={styleConfig.primary.fontSize} onChange={e => setStyleConfig({...styleConfig, primary: {...styleConfig.primary, fontSize: parseInt(e.target.value)}})} className="w-full h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-blue-500" />
                                                </div>
                                            </div>
                                        </div>

                                    </div>
                                </div>
                            )}

                            {/* Transcript List (Bottom) - UPDATED TO GRID */}
                            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl flex flex-col h-[600px] overflow-hidden shadow-sm">
                                <div className="p-3 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 flex justify-between items-center">
                                    <h3 className="font-semibold text-sm">Live Transcript</h3>
                                    <span className="text-xs text-zinc-500">{activeItem.subtitles.length} lines</span>
                                </div>
                                {/* Header Row */}
                                <div className="grid grid-cols-[80px_80px_1fr_1fr] gap-4 px-4 py-2 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/30 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                                    <div>Start</div>
                                    <div>End</div>
                                    <div>Source</div>
                                    <div>Target</div>
                                </div>
                                <div className="flex-1 overflow-y-auto p-0 scrollbar-thin">
                                    {activeItem.subtitles.map((sub, idx) => (
                                        <div 
                                        key={sub.id} 
                                        id={`sub-${sub.id}`}
                                        onClick={() => setPreviewLineId(sub.id)}
                                        className={`grid grid-cols-[80px_80px_1fr_1fr] gap-4 px-4 py-2 border-b border-zinc-100 dark:border-zinc-800/50 cursor-pointer transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50 items-start ${previewLineId === sub.id ? 'bg-yellow-50 dark:bg-yellow-500/10' : ''}`}
                                        >
                                            <div className="font-mono text-xs text-zinc-400 pt-0.5">{sub.startTime.split(',')[0]}</div>
                                            <div className="font-mono text-xs text-zinc-400 pt-0.5">{sub.endTime.split(',')[0]}</div>
                                            <div className="text-xs text-zinc-600 dark:text-zinc-400 leading-tight">{sub.originalText}</div>
                                            <div className={`text-xs leading-tight font-medium ${sub.translatedText ? 'text-zinc-900 dark:text-zinc-200' : 'text-zinc-300 dark:text-zinc-700 italic'}`}>
                                                {sub.translatedText || '-'}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
            
            {/* Model Settings Modal */}
            {showModelSettings && (
                 <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in">
                    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-xl max-w-lg w-full shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between pb-2 border-b border-zinc-100 dark:border-zinc-800">
                            <h3 className="text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2"><Cpu className="w-5 h-5 text-yellow-500"/> Model Configuration</h3>
                            <button onClick={() => setShowModelSettings(false)}><X className="w-5 h-5 text-zinc-500" /></button>
                        </div>
                        
                        <div className="space-y-4">
                             {/* Provider Selector */}
                             <div>
                                 <label className="text-xs font-semibold uppercase text-zinc-500 mb-2 block">AI Provider</label>
                                 <div className="grid grid-cols-2 gap-2">
                                     <button onClick={() => handleProviderChange('gemini')} className={`py-2 px-3 text-sm font-medium rounded-md transition-all border ${modelConfig.provider === 'gemini' ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300' : 'bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400'}`}>Gemini (Google)</button>
                                     <button onClick={() => handleProviderChange('google_nmt')} className={`py-2 px-3 text-sm font-medium rounded-md transition-all border ${modelConfig.provider === 'google_nmt' ? 'bg-orange-50 dark:bg-orange-900/30 border-orange-200 dark:border-orange-800 text-orange-700 dark:text-orange-300' : 'bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400'}`}>Google Translate</button>
                                     <button onClick={() => handleProviderChange('local')} className={`py-2 px-3 text-sm font-medium rounded-md transition-all border ${modelConfig.provider === 'local' ? 'bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-800 text-green-700 dark:text-green-300' : 'bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400'}`}>Local (Ollama)</button>
                                     <button onClick={() => handleProviderChange('openai')} className={`py-2 px-3 text-sm font-medium rounded-md transition-all border ${modelConfig.provider === 'openai' ? 'bg-teal-50 dark:bg-teal-900/30 border-teal-200 dark:border-teal-800 text-teal-700 dark:text-teal-300' : 'bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400'}`}>OpenAI / Other</button>
                                 </div>
                             </div>

                             {/* Provider Specific Settings */}
                             {modelConfig.provider === 'gemini' && (
                                <div className="space-y-2">
                                    <label className="text-xs font-semibold uppercase text-zinc-500">Model</label>
                                    <select value={modelConfig.modelName} onChange={(e) => setModelConfig({...modelConfig, modelName: e.target.value})} className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded px-3 py-2 text-sm outline-none focus:border-yellow-500">{AVAILABLE_MODELS.map(model => <option key={model.id} value={model.id}>{model.name}</option>)}</select>
                                </div>
                             )}

                             {modelConfig.provider === 'google_nmt' && (
                                 <div className="space-y-3 bg-zinc-50 dark:bg-zinc-800/50 p-3 rounded-lg border border-zinc-100 dark:border-zinc-800">
                                      <div>
                                         <label className="text-xs font-semibold uppercase text-zinc-500">Google Cloud API Key</label>
                                         <div className="flex gap-2">
                                             <div className="bg-zinc-200 dark:bg-zinc-700 p-2 rounded text-zinc-500"><Settings2 className="w-4 h-4"/></div>
                                             <input type="password" value={modelConfig.apiKey || ''} onChange={(e) => setModelConfig({...modelConfig, apiKey: e.target.value})} className="flex-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded px-3 py-2 text-sm font-mono outline-none focus:border-yellow-500" placeholder="AIzaSy..." />
                                         </div>
                                         <p className="text-[10px] text-zinc-500 mt-1">Requires 'Cloud Translation API' enabled in Google Cloud Console.</p>
                                      </div>
                                 </div>
                             )}

                             {(modelConfig.provider === 'local' || modelConfig.provider === 'openai') && (
                                <div className="space-y-3 bg-zinc-50 dark:bg-zinc-800/50 p-3 rounded-lg border border-zinc-100 dark:border-zinc-800">
                                     <div>
                                        <label className="text-xs font-semibold uppercase text-zinc-500">Endpoint URL</label>
                                        <div className="flex gap-2">
                                            <div className="bg-zinc-200 dark:bg-zinc-700 p-2 rounded text-zinc-500"><Globe className="w-4 h-4"/></div>
                                            <input type="text" value={modelConfig.localEndpoint || ''} onChange={(e) => setModelConfig({...modelConfig, localEndpoint: e.target.value})} className="flex-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded px-3 py-2 text-sm font-mono outline-none focus:border-yellow-500" placeholder="https://api.example.com/v1/..." />
                                        </div>
                                     </div>
                                     <div>
                                        <label className="text-xs font-semibold uppercase text-zinc-500">API Key</label>
                                        <div className="flex gap-2">
                                            <div className="bg-zinc-200 dark:bg-zinc-700 p-2 rounded text-zinc-500"><Settings2 className="w-4 h-4"/></div>
                                            <input type="password" value={modelConfig.apiKey || ''} onChange={(e) => setModelConfig({...modelConfig, apiKey: e.target.value})} className="flex-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded px-3 py-2 text-sm font-mono outline-none focus:border-yellow-500" placeholder="sk-..." />
                                        </div>
                                     </div>
                                     
                                     {modelConfig.provider === 'openai' ? (
                                        <div>
                                            <label className="text-xs font-semibold uppercase text-zinc-500 mb-1 block">Model Selection</label>
                                            <select 
                                                value={customModelMode ? 'custom' : modelConfig.modelName} 
                                                onChange={handleOpenAIModelChange} 
                                                className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded px-3 py-2 text-sm outline-none focus:border-yellow-500 mb-2"
                                            >
                                                <option value="" disabled>Select a model...</option>
                                                {OPENAI_PRESETS.map((group) => (
                                                    <optgroup key={group.label} label={group.label}>
                                                        {group.options.map(opt => (
                                                            <option key={opt.id} value={opt.id}>{opt.name}</option>
                                                        ))}
                                                    </optgroup>
                                                ))}
                                                <option value="custom">Custom / Other...</option>
                                            </select>
                                            
                                            {customModelMode && (
                                                <div className="flex gap-2 animate-in fade-in slide-in-from-top-1">
                                                    <div className="bg-zinc-200 dark:bg-zinc-700 p-2 rounded text-zinc-500"><Cpu className="w-4 h-4"/></div>
                                                    <input 
                                                        type="text" 
                                                        value={modelConfig.modelName} 
                                                        onChange={(e) => setModelConfig({...modelConfig, modelName: e.target.value})} 
                                                        className="flex-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded px-3 py-2 text-sm outline-none focus:border-yellow-500" 
                                                        placeholder="Enter custom model ID (e.g. gpt-4-32k)" 
                                                        autoFocus
                                                    />
                                                </div>
                                            )}
                                        </div>
                                     ) : (
                                        <div>
                                            <label className="text-xs font-semibold uppercase text-zinc-500">Model Name</label>
                                            <div className="flex gap-2">
                                                <div className="bg-zinc-200 dark:bg-zinc-700 p-2 rounded text-zinc-500"><Cpu className="w-4 h-4"/></div>
                                                <input type="text" value={modelConfig.modelName} onChange={(e) => setModelConfig({...modelConfig, modelName: e.target.value})} className="flex-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded px-3 py-2 text-sm outline-none focus:border-yellow-500" placeholder="e.g. llama3" />
                                            </div>
                                        </div>
                                     )}
                                </div>
                             )}

                             {/* Generation Parameters (Hidden for NMT) */}
                             {modelConfig.provider !== 'google_nmt' && (
                                <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 space-y-4">
                                    <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider">Generation Parameters</h4>
                                    
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-xs text-zinc-500 flex justify-between items-center mb-1">
                                                <div className="flex items-center gap-1 relative group">
                                                    <span>Temperature</span>
                                                    <HelpCircle className="w-3 h-3 text-zinc-400 cursor-help" />
                                                    <InfoTooltip text="Controls randomness. Lower values (e.g. 0.2) result in more deterministic and consistent translations. Higher values (e.g. 0.8) allow for more creative or varied output." />
                                                </div>
                                                <span className="font-mono">{modelConfig.temperature}</span>
                                            </label>
                                            <input type="range" min="0" max="2" step="0.1" value={modelConfig.temperature} onChange={(e) => setModelConfig({...modelConfig, temperature: parseFloat(e.target.value)})} className="w-full h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-yellow-500" />
                                        </div>
                                        <div>
                                            <label className="text-xs text-zinc-500 flex justify-between items-center mb-1">
                                                <div className="flex items-center gap-1 relative group">
                                                    <span>Top P</span>
                                                    <HelpCircle className="w-3 h-3 text-zinc-400 cursor-help" />
                                                    <InfoTooltip text="Nucleus sampling. Limits the model to the top P percentage of probability mass. Lower values (e.g. 0.5) limit vocabulary to the most likely words. Higher values (e.g. 0.95) allow for a wider vocabulary range." />
                                                </div>
                                                <span className="font-mono">{modelConfig.topP}</span>
                                            </label>
                                            <input type="range" min="0" max="1" step="0.05" value={modelConfig.topP} onChange={(e) => setModelConfig({...modelConfig, topP: parseFloat(e.target.value)})} className="w-full h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-yellow-500" />
                                        </div>
                                    </div>
                                    
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-xs text-zinc-500 block mb-1 flex items-center gap-1 relative group w-fit">
                                                Max Output Tokens
                                                <HelpCircle className="w-3 h-3 text-zinc-400 cursor-help" />
                                                <InfoTooltip text="The maximum number of tokens the model can generate in a single response. Higher values are safer for large batches of subtitles to prevent cutoff." />
                                            </label>
                                            <input type="number" value={modelConfig.maxOutputTokens} onChange={(e) => setModelConfig({...modelConfig, maxOutputTokens: parseInt(e.target.value)})} className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded px-3 py-2 text-sm outline-none focus:border-yellow-500" />
                                        </div>
                                    </div>
                                </div>
                             )}
                             
                             <div className="flex flex-col justify-end pt-2">
                                <div className="flex items-center gap-2 p-2 rounded-lg bg-zinc-100 dark:bg-zinc-800">
                                    <div className="flex-1">
                                        <div className="text-xs font-semibold">Simulation Mode</div>
                                        <div className="text-[10px] text-zinc-500">Mock API calls (Free)</div>
                                    </div>
                                    <button onClick={() => setModelConfig({...modelConfig, useSimulation: !modelConfig.useSimulation})} className={`w-9 h-5 rounded-full transition-colors relative ${modelConfig.useSimulation ? 'bg-purple-600' : 'bg-zinc-300 dark:bg-zinc-600'}`}>
                                        <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${modelConfig.useSimulation ? 'left-4.5' : 'left-0.5'}`} />
                                    </button>
                                </div>
                            </div>

                        </div>
                        <button onClick={() => setShowModelSettings(false)} className="w-full py-2.5 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-lg font-bold hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors">Apply Settings</button>
                    </div>
                </div>
            )}
      </main>
    </div>
  );
}

function App() {
  return (
    <ToastProvider>
      <DualSubApp />
    </ToastProvider>
  );
}

export default App;
