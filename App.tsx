import React, { useState, useRef, useEffect } from 'react';
import { Upload, FileText, CheckCircle, AlertTriangle, RefreshCw, Download as DownloadIcon, PlayCircle, Sparkles, Languages, Settings2, Layout, Palette, ArrowUpDown, RotateCcw, Monitor, Trash2, Layers, Film, Tv, Type, Cog, X, AlignJustify, AlignLeft, Cpu, FileType, Hourglass } from 'lucide-react';
import { SubtitleLine, TabView, AssStyleConfig, BatchItem, ModelConfig } from './types';
import { parseSubtitle, generateSubtitleContent, downloadFile, STYLE_PRESETS, calculateSafeDurations } from './services/subtitleUtils';
import { translateBatch, generateContext, detectLanguage } from './services/geminiService';
import { saveSession, loadSession, clearSession } from './services/storage';
import SubtitleSearch from './components/OpenSubtitlesSearch';
import JSZip from 'jszip';

const BATCH_SIZE = 250; 
const CONCURRENCY = 6; 
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
    "Arial",
    "Arial Narrow",
    "Arial Black",
    "Comic Sans MS",
    "Courier New",
    "DejaVu Sans",
    "Georgia",
    "Impact",
    "Times New Roman",
    "Trebuchet MS",
    "Verdana",
    "Teletext"
];

// Helper Component for Visual Preview
const VisualPreview = ({ 
    config, 
    original, 
    translated
}: { 
    config: AssStyleConfig, 
    original: string, 
    translated: string
}) => {
    
    const containerStyle: React.CSSProperties = {
        aspectRatio: '16/9',
        backgroundColor: '#0a0a0a', 
        backgroundImage: 'radial-gradient(circle at center, #1a1a1a 0%, #000000 100%)',
        position: 'relative',
        overflow: 'hidden',
        borderRadius: '0.75rem',
        border: '1px solid #27272a',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: 'inset 0 0 50px rgba(0,0,0,0.8)'
    };

    // Scale factor to simulate TV appearance on a small screen
    const SCALE = 0.5; 

    // If Output is SRT, use a simplified preview
    if (config.outputFormat === 'srt') {
        const primaryText = translated || "Translated Subtitle";
        const secondaryText = original || "Original Subtitle";
        
        return (
            <div style={containerStyle}>
                <div className="absolute inset-0 pointer-events-none opacity-10" style={{backgroundImage: 'linear-gradient(0deg, transparent 24%, #ffffff 25%, #ffffff 26%, transparent 27%, transparent 74%, #ffffff 75%, #ffffff 76%, transparent 77%, transparent), linear-gradient(90deg, transparent 24%, #ffffff 25%, #ffffff 26%, transparent 27%, transparent 74%, #ffffff 75%, #ffffff 76%, transparent 77%, transparent)', backgroundSize: '50px 50px', zIndex: 1}}></div>
                <div style={{position: 'absolute', bottom: '10%', left: 0, right: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', padding: '0 2rem', zIndex: 10, textAlign: 'center', gap: '8px'}}>
                    {config.stackOrder === 'primary-top' ? (
                        <>
                             <div style={{color: config.primary.color, fontSize: '18px', fontWeight: 'bold'}}>{primaryText}</div>
                             <div style={{color: config.secondary.color, fontSize: '18px', fontWeight: 'bold'}}>{secondaryText}</div>
                        </>
                    ) : (
                        <>
                             <div style={{color: config.secondary.color, fontSize: '18px', fontWeight: 'bold'}}>{secondaryText}</div>
                             <div style={{color: config.primary.color, fontSize: '18px', fontWeight: 'bold'}}>{primaryText}</div>
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
            // 8-point stroke simulation
            const stroke = Math.max(1, outlineW * 0.8); // Scale outline slightly down for preview
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
            lineHeight: 1.2,
            margin: '4px 0',
            // Simulate border style 3 (Opaque Box) if selected - simplistic visualization
            backgroundColor: config.borderStyle === 3 ? 'rgba(0,0,0,0.5)' : 'transparent',
            padding: config.borderStyle === 3 ? '4px 8px' : '4px',
            whiteSpace: 'pre-wrap' as const, // Ensure whitespace is respected
            position: 'relative' as const,
            zIndex: 20
        };
    };

    const formatHtml = (text: string) => {
        if (!text) return { __html: "" };
        let content = text;
        // Handle line breaks: [br] -> <br/>
        if (config.linesPerSubtitle === 1) {
            content = content.replace(/\[br\]/g, ' ');
        } else {
            content = content.replace(/\[br\]/g, '<br/>');
        }
        return { __html: content };
    };

    const renderText = (isPrimary: boolean, actualText: string | undefined) => {
        const style = getTextStyle(isPrimary);
        const displayText = actualText || (isPrimary ? "Translated Subtitle Preview" : "Original Subtitle Preview");
        const isEmpty = !actualText;

        return (
            <div 
                style={{
                    ...style, 
                    opacity: isEmpty ? 0.5 : 1
                }} 
                dangerouslySetInnerHTML={formatHtml(displayText)} 
            />
        );
    };

    const PrimaryText = renderText(true, translated);
    const SecondaryText = renderText(false, original);

    // Margins relative to the preview container size (simulating screen margins)
    const MARGIN_V = '5%';

    if (config.layout === 'split') {
        const top = config.stackOrder === 'primary-top' ? PrimaryText : SecondaryText;
        const bottom = config.stackOrder === 'primary-top' ? SecondaryText : PrimaryText;
        return (
            <div style={containerStyle}>
                {/* Grid Overlay moved first to be background */}
                <div className="absolute inset-0 pointer-events-none opacity-10" style={{backgroundImage: 'linear-gradient(0deg, transparent 24%, #ffffff 25%, #ffffff 26%, transparent 27%, transparent 74%, #ffffff 75%, #ffffff 76%, transparent 77%, transparent), linear-gradient(90deg, transparent 24%, #ffffff 25%, #ffffff 26%, transparent 27%, transparent 74%, #ffffff 75%, #ffffff 76%, transparent 77%, transparent)', backgroundSize: '50px 50px', zIndex: 1}}></div>
                
                <div style={{position: 'absolute', top: MARGIN_V, left: 0, right: 0, display: 'flex', justifyContent: 'center', alignItems: 'flex-start', padding: '0 2rem', zIndex: 10}}>
                    {top}
                </div>
                <div style={{position: 'absolute', bottom: MARGIN_V, left: 0, right: 0, display: 'flex', justifyContent: 'center', alignItems: 'flex-end', padding: '0 2rem', zIndex: 10}}>
                    {bottom}
                </div>
            </div>
        );
    } else {
        // Stacked
        const top = config.stackOrder === 'primary-top' ? PrimaryText : SecondaryText;
        const bottom = config.stackOrder === 'primary-top' ? SecondaryText : PrimaryText;
        return (
            <div style={containerStyle}>
                {/* Grid Overlay moved first to be background */}
                <div className="absolute inset-0 pointer-events-none opacity-10" style={{backgroundImage: 'linear-gradient(0deg, transparent 24%, #ffffff 25%, #ffffff 26%, transparent 27%, transparent 74%, #ffffff 75%, #ffffff 76%, transparent 77%, transparent), linear-gradient(90deg, transparent 24%, #ffffff 25%, #ffffff 26%, transparent 27%, transparent 74%, #ffffff 75%, #ffffff 76%, transparent 77%, transparent)', backgroundSize: '50px 50px', zIndex: 1}}></div>
                
                <div style={{position: 'absolute', bottom: MARGIN_V, left: 0, right: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', padding: '0 2rem', zIndex: 10}}>
                    {top}
                    {bottom}
                </div>
            </div>
        );
    }
};

function App() {
  const [activeTab, setActiveTab] = useState<TabView>(TabView.UPLOAD);
  
  // Batch State
  const [batchItems, setBatchItems] = useState<BatchItem[]>([]);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  
  // Settings
  const [autoContext, setAutoContext] = useState(true);
  const [smartTiming, setSmartTiming] = useState(true); // New Toggle
  const [targetLang, setTargetLang] = useState<string>(() => {
      return localStorage.getItem('target_language') || 'Vietnamese';
  });
  
  // Model Configuration State
  const [modelConfig, setModelConfig] = useState<ModelConfig>({
      modelName: 'gemini-3-flash-preview',
      temperature: 0.3,
      topP: 0.95,
      topK: 40,
      maxOutputTokens: 8192
  });
  const [showModelSettings, setShowModelSettings] = useState(false);

  // Style Configuration State
  const [styleConfig, setStyleConfig] = useState<AssStyleConfig>(STYLE_PRESETS.DEFAULT);
  const [showStyleConfig, setShowStyleConfig] = useState(false);

  // Confirmation Request State
  const [confirmationRequest, setConfirmationRequest] = useState<{ itemId: string; fileName: string; detectedLanguage: string; resolve: (val: boolean) => void } | null>(null);

  // Preview Selection State
  const [previewLineId, setPreviewLineId] = useState<number | null>(null);

  // Refs for cancelling translation & Progress Tracking
  const isCancelled = useRef(false);
  const isTranslating = useRef(false);
  
  // Refs for smooth progress interpolation
  const completedLinesRef = useRef(0);
  const activeLinesRef = useRef(0); // Lines currently being processed by API
  const progressValueRef = useRef(0); // Current displayed float value

  // Session Recovery Effect
  useEffect(() => {
    const restoreSession = async () => {
        const savedItems = await loadSession();
        if (savedItems && savedItems.length > 0) {
            setBatchItems(savedItems);
            // Restore active item if possible
            if (savedItems.length > 0) {
                setActiveItemId(savedItems[0].id);
            }
        }
    };
    restoreSession();
  }, []);

  // Save Session Effect (Debounced roughly)
  useEffect(() => {
      const timeout = setTimeout(() => {
          if (batchItems.length > 0) {
              saveSession(batchItems);
          } else {
              // Optionally clear if empty, or keep last state
              // clearSession(); 
          }
      }, 1000);
      return () => clearTimeout(timeout);
  }, [batchItems]);

  // Computed: Active Subtitles for Preview
  const activeItem = batchItems.find(item => item.id === activeItemId) || batchItems[0];
  
  // Effect: Auto-select longest line in the first 100 lines when a NEW file becomes active
  useEffect(() => {
      // If we already have a valid preview line for the currently active item, don't re-calculate
      if (previewLineId && activeItem?.subtitles.some(s => s.id === previewLineId)) {
          return;
      }

      if (activeItem && activeItem.subtitles.length > 0) {
          const sample = activeItem.subtitles.slice(0, 100);
          if (sample.length > 0) {
              const longest = sample.reduce((prev, current) => 
                  (prev.originalText.length > current.originalText.length) ? prev : current
              );
              setPreviewLineId(longest.id);
          }
      } else {
          setPreviewLineId(null);
      }
  }, [activeItemId, activeItem, previewLineId]);

  // Get sample subtitle for visual preview based on selection
  const selectedSubtitle = activeItem?.subtitles?.find(s => s.id === previewLineId);
  const sampleOriginal = selectedSubtitle?.originalText || "The quick <b>brown</b> fox jumps over the <i>lazy</i> dog.";
  const sampleTranslated = selectedSubtitle?.translatedText || "Con cáo <b>nâu</b> nhanh nhẹn nhảy qua chú chó <i>lười</i>.";
  
  // Helper to find the item currently being translated
  const translatingItem = batchItems.find(i => i.status === 'translating');

  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const lang = e.target.value;
      setTargetLang(lang);
      localStorage.setItem('target_language', lang);
  };

  const applyPreset = (presetName: keyof typeof STYLE_PRESETS) => {
      setStyleConfig(STYLE_PRESETS[presetName]);
  };

  const resetStyles = () => {
      setStyleConfig(STYLE_PRESETS.DEFAULT);
  };

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
        message: 'Queued'
    }));

    setBatchItems(prev => [...prev, ...newItems]);

    // Async parse each file
    newItems.forEach(item => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const content = e.target?.result as string;
            try {
                // Determine format and parse
                const parsed = parseSubtitle(content, item.fileName);
                setBatchItems(prev => prev.map(pi => pi.id === item.id ? { 
                    ...pi, 
                    subtitles: parsed, 
                    message: `Ready (${parsed.length} lines)` 
                } : pi));
                if (!activeItemId) setActiveItemId(item.id);
            } catch (err) {
                console.error(err);
                setBatchItems(prev => prev.map(pi => pi.id === item.id ? { 
                    ...pi, 
                    status: 'error', 
                    message: 'Parse Error' 
                } : pi));
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
              message: `Ready (${parsed.length} lines)`
          };
          setBatchItems(prev => [...prev, newItem]);
          setActiveItemId(newItem.id);
          setActiveTab(TabView.UPLOAD);
      } catch (err) {
          alert("Failed to parse the downloaded subtitle.");
      }
  };

  const translateSingleFile = async (itemId: string) => {
      const itemIndex = batchItems.findIndex(i => i.id === itemId);
      if (itemIndex === -1) return;

      const item = batchItems[itemIndex];
      if (item.subtitles.length === 0) return;

      // Update Status to Translating
      setBatchItems(prev => prev.map(pi => pi.id === itemId ? { ...pi, status: 'translating', progress: 0, message: 'Starting...' } : pi));

      // Reset smooth progress refs
      completedLinesRef.current = 0;
      activeLinesRef.current = 0;
      progressValueRef.current = 0;
      
      const totalLines = item.subtitles.length;

      // Start the smooth progress ticker
      const progressInterval = setInterval(() => {
          if (isCancelled.current) return;

          // Target is: (Completed / Total) * 100
          const floorPercent = (completedLinesRef.current / totalLines) * 100;

          // To prevent the progress bar from rushing to 100% when multiple chunks are active,
          // we limit the visual "active" progress to just one batch size ahead of completion.
          // This gives a step-by-step crawl effect (e.g. crawl to 25%, then 50%...) even if concurrency is high.
          const visibleActiveLines = Math.min(activeLinesRef.current, BATCH_SIZE);
          const ceilingPercent = ((completedLinesRef.current + visibleActiveLines) / totalLines) * 100;
          
          let current = progressValueRef.current;
          
          // If current is behind the "floor" (completed), jump to floor immediately
          if (current < floorPercent) {
              current = floorPercent;
          } 
          // If current is less than the visual ceiling, creep up slowly
          else if (current < ceilingPercent && current < 99) {
              // 0.1 per 100ms = 1% per second. 
              // This is a conservative speed to ensure the bar is still moving but doesn't finish too early.
              current += 0.1; 
          }

          if (current > 99) current = 99;
          
          progressValueRef.current = current;

          setBatchItems(prev => prev.map(pi => pi.id === itemId ? { 
              ...pi, 
              progress: Math.round(current), // Integer for UI
              message: `Translating... ${Math.round(current)}%`
          } : pi));

      }, 100);

      // 1. Language Verification
      setBatchItems(prev => prev.map(pi => pi.id === itemId ? { ...pi, message: 'Verifying language...' } : pi));
      const { isEnglish, language } = await detectLanguage(item.subtitles);
      
      if (!isEnglish) {
           setBatchItems(prev => prev.map(pi => pi.id === itemId ? { ...pi, message: `Detected: ${language}` } : pi));
           
           const userConfirmed = await new Promise<boolean>((resolve) => {
               setConfirmationRequest({
                   itemId,
                   fileName: item.fileName,
                   detectedLanguage: language,
                   resolve: (val) => {
                       setConfirmationRequest(null);
                       resolve(val);
                   }
               });
           });

           if (!userConfirmed) {
                setBatchItems(prev => prev.map(pi => pi.id === itemId ? { 
                    ...pi, 
                    status: 'error', 
                    progress: 0, 
                    message: `Cancelled (${language})`
                } : pi));
                clearInterval(progressInterval);
                return;
           }
      }

      // 2. Generate Context if needed
      let context = item.context || "";
      if (autoContext && !context) {
          setBatchItems(prev => prev.map(pi => pi.id === itemId ? { ...pi, message: 'Analyzing context...' } : pi));
          try {
             context = await generateContext(item.fileName);
          } catch(e) {
             console.error("Context gen failed", e);
          }
      }
      
      // 3. Pre-calculate Durations for Context Awareness
      const safeDurations = calculateSafeDurations(item.subtitles);

      // Prepare Chunks
      const newSubtitles = [...item.subtitles];
      interface ChunkData {
        lines: SubtitleLine[];
        previous: SubtitleLine[];
      }
      const chunks: ChunkData[] = [];
      for (let i = 0; i < totalLines; i += BATCH_SIZE) {
        const chunkLines = newSubtitles.slice(i, i + BATCH_SIZE);
        const previousLines = i > 0 ? newSubtitles.slice(Math.max(0, i - OVERLAP_SIZE), i) : [];
        chunks.push({ lines: chunkLines, previous: previousLines });
      }

      // Translation Queue
      const processChunk = async (chunkData: ChunkData) => {
          if (isCancelled.current) return;
          const { lines, previous } = chunkData;
          
          activeLinesRef.current += lines.length; // Mark these lines as "in progress"

          const linesToTranslate = lines.filter(l => !l.translatedText);
          
          if (linesToTranslate.length > 0) {
              try {
                // PASS DURATION INFO AND MODEL CONFIG
                const translations = await translateBatch(
                    linesToTranslate, 
                    targetLang, 
                    context, 
                    previous, 
                    modelConfig,
                    safeDurations
                );
                linesToTranslate.forEach(line => {
                    if (translations.has(line.id)) {
                        line.translatedText = translations.get(line.id);
                    }
                });
              } catch (error) {
                  console.error("Batch failed", error);
              }
          }
          
          activeLinesRef.current -= lines.length; // Unmark
          completedLinesRef.current += lines.length; // Mark as done

          // Update data without forcing progress jump (interval handles that)
          setBatchItems(prev => prev.map(pi => pi.id === itemId ? { 
              ...pi, 
              subtitles: [...newSubtitles] 
          } : pi));
      };

      // Worker Pool
      const chunkQueue = [...chunks];
      const worker = async () => {
          while (chunkQueue.length > 0 && !isCancelled.current) {
              const chunk = chunkQueue.shift();
              if (chunk) await processChunk(chunk);
          }
      };
      
      const workers = Array.from({ length: CONCURRENCY }, () => worker());
      await Promise.all(workers);
      
      clearInterval(progressInterval);

      if (!isCancelled.current) {
          setBatchItems(prev => prev.map(pi => pi.id === itemId ? { ...pi, status: 'completed', progress: 100, message: 'Done' } : pi));
      } else {
          setBatchItems(prev => prev.map(pi => pi.id === itemId ? { ...pi, status: 'pending', message: 'Cancelled' } : pi));
      }
  };

  const handleTranslateAll = async () => {
      if (!process.env.API_KEY) {
          alert("System Error: Gemini API Key is missing.");
          return;
      }
      isCancelled.current = false;
      isTranslating.current = true;

      const pendingItems = batchItems.filter(i => i.status === 'pending' || i.status === 'error');
      
      // Process sequentially to manage rate limits and stability better for batch
      for (const item of pendingItems) {
          if (isCancelled.current) break;
          await translateSingleFile(item.id);
      }
      isTranslating.current = false;
  };

  const handleDownloadSingle = (id: string) => {
      const item = batchItems.find(i => i.id === id);
      if (!item) return;
      
      // Use unified generator which checks styleConfig.outputFormat and smartTiming
      const content = generateSubtitleContent(item.subtitles, styleConfig, smartTiming);
      
      // Determine extension based on config
      const ext = styleConfig.outputFormat === 'srt' ? '.srt' : '.ass';
      
      let newName = item.fileName.replace(/\.(srt|ass|vtt)$/i, '');
      downloadFile(content, newName + ext);
  };

  const handleDownloadAll = async () => {
      const completedItems = batchItems.filter(i => i.status === 'completed');
      
      // Smart Download: If only 1 file, download it directly
      if (completedItems.length === 1) {
          handleDownloadSingle(completedItems[0].id);
          return;
      }

      const zip = new JSZip();
      let count = 0;
      const ext = styleConfig.outputFormat === 'srt' ? '.srt' : '.ass';

      completedItems.forEach(item => {
          if (item.subtitles.length > 0) {
              const content = generateSubtitleContent(item.subtitles, styleConfig, smartTiming);
              let newName = item.fileName.replace(/\.(srt|ass|vtt)$/i, '') + ext;
              zip.file(newName, content);
              count++;
          }
      });
      
      if (count === 0) return;
      
      const blob = await zip.generateAsync({type:"blob"});
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = "translated_subtitles.zip";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  const removeBatchItem = (id: string) => {
      setBatchItems(prev => {
          const newState = prev.filter(i => i.id !== id);
          if (activeItemId === id) {
              setActiveItemId(newState.length > 0 ? newState[0].id : null);
          }
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
  const isSingleFileDownload = completedCount === 1;

  // Render download button label
  const getDownloadLabel = () => {
      const ext = styleConfig.outputFormat === 'srt' ? '.srt' : '.ass';
      if (isSingleFileDownload) return `Download ${ext} File`;
      return `Download All (${completedCount} Files)`;
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      <header className="border-b border-zinc-800 bg-zinc-900/50 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="bg-yellow-500 p-2 rounded-lg">
              <FileText className="w-6 h-6 text-zinc-900" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">DualSub AI</h1>
              <p className="text-xs text-zinc-400">SRT/ASS to Dual-Language ASS/SRT Converter</p>
            </div>
          </div>
          <div className="flex gap-4 items-center">
             {translatingItem && (
                 <div className="flex items-center gap-2 px-3 py-1 bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 rounded-full text-sm">
                     <RefreshCw className="w-4 h-4 animate-spin" />
                     <span className="font-mono text-xs font-bold truncate max-w-[200px]">
                         {batchItems.length > 1 ? 'BATCH: ' : ''}
                         {translatingItem.fileName} ({translatingItem.progress}%)
                     </span>
                 </div>
             )}
             <button 
                onClick={() => setShowModelSettings(true)}
                className="p-2 text-zinc-400 hover:text-white bg-zinc-800/50 hover:bg-zinc-800 rounded-lg transition-colors border border-transparent hover:border-zinc-700"
                title="Model Settings"
             >
                 <Cog className="w-5 h-5" />
             </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto w-full px-6 py-8">
        <div className="flex gap-4 mb-8 border-b border-zinc-800">
            <button 
                onClick={() => setActiveTab(TabView.UPLOAD)}
                className={`pb-4 px-2 font-medium text-sm transition-colors relative ${activeTab === TabView.UPLOAD ? 'text-yellow-500' : 'text-zinc-400 hover:text-zinc-200'}`}
                title="Upload .srt, .ass, or .vtt files from your device"
            >
                Upload & Batch
                {activeTab === TabView.UPLOAD && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-yellow-500 rounded-t-full" />}
            </button>
            <button 
                onClick={() => setActiveTab(TabView.SEARCH)}
                className={`pb-4 px-2 font-medium text-sm transition-colors relative ${activeTab === TabView.SEARCH ? 'text-yellow-500' : 'text-zinc-400 hover:text-zinc-200'}`}
                title="Search and download subtitles from online providers"
            >
                Search Subtitles
                {activeTab === TabView.SEARCH && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-yellow-500 rounded-t-full" />}
            </button>
        </div>

        {activeTab === TabView.SEARCH ? (
            <SubtitleSearch onSelectSubtitle={handleSubtitleSelection} />
        ) : (
            <div className="space-y-6">
                {/* Upload Area */}
                <div className={`border-2 border-dashed rounded-xl p-8 transition-colors text-center ${batchItems.length > 0 ? 'border-zinc-700 bg-zinc-900/30' : 'border-zinc-700 hover:border-yellow-500/50 hover:bg-zinc-900'}`}>
                    <input 
                        type="file" 
                        accept=".srt,.ass,.ssa,.vtt" 
                        multiple 
                        onChange={handleFileUpload}
                        className="hidden" 
                        id="srt-upload" 
                    />
                    
                    {batchItems.length === 0 ? (
                        <label htmlFor="srt-upload" className="cursor-pointer flex flex-col items-center gap-4" title="Click or drag files to upload">
                            <div className="w-16 h-16 bg-zinc-800 rounded-full flex items-center justify-center text-zinc-400">
                                <Upload className="w-8 h-8" />
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold">Drop subtitle files here</h3>
                                <p className="text-zinc-500 mt-1">Supports .srt, .ass, .vtt</p>
                            </div>
                        </label>
                    ) : (
                        <div className="flex flex-col gap-4">
                            <div className="flex justify-between items-center">
                                <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">File Queue ({batchItems.length})</h3>
                                <div className="flex items-center gap-4">
                                     <button onClick={clearAll} className="text-xs text-red-500 hover:text-red-400 flex items-center gap-1" title="Remove all files from the queue">
                                         <Trash2 className="w-3 h-3" /> Clear All
                                     </button>
                                     <label htmlFor="srt-upload" className="text-xs text-yellow-500 hover:text-yellow-400 cursor-pointer flex items-center gap-1" title="Add more subtitle files to the batch">
                                         <Upload className="w-3 h-3" /> Add more files
                                     </label>
                                </div>
                            </div>
                            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
                                {batchItems.map(item => (
                                    <div 
                                        key={item.id} 
                                        onClick={() => setActiveItemId(item.id)}
                                        className={`p-3 rounded-lg border flex items-center justify-between gap-4 cursor-pointer transition-all ${activeItemId === item.id ? 'bg-zinc-800 border-yellow-500/50 shadow-lg shadow-black/50' : 'bg-zinc-900/50 border-zinc-700 hover:bg-zinc-800'}`}
                                    >
                                        <div className="flex items-center gap-3 overflow-hidden flex-1">
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${item.status === 'completed' ? 'bg-green-500/20 text-green-500' : item.status === 'translating' ? 'bg-yellow-500/20 text-yellow-500' : 'bg-zinc-700 text-zinc-400'}`}>
                                                {item.status === 'completed' ? <CheckCircle className="w-4 h-4" /> : 
                                                 item.status === 'translating' ? <RefreshCw className="w-4 h-4 animate-spin" /> :
                                                 item.status === 'error' ? <AlertTriangle className="w-4 h-4 text-red-500" /> :
                                                 <FileText className="w-4 h-4" />}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex justify-between mb-1">
                                                    <span className="font-medium text-sm truncate">{item.fileName}</span>
                                                    <span className="text-xs text-zinc-500">{item.message}</span>
                                                </div>
                                                <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
                                                    <div 
                                                        className={`h-full transition-all duration-300 ease-out ${item.status === 'completed' ? 'bg-green-500' : 'bg-yellow-500'}`} 
                                                        style={{ width: `${item.progress}%` }}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                             {item.status === 'completed' && (
                                                 <button onClick={(e) => {e.stopPropagation(); handleDownloadSingle(item.id)}} className="p-2 hover:bg-zinc-700 rounded text-zinc-400 hover:text-white" title="Download translated file">
                                                     <DownloadIcon className="w-4 h-4" />
                                                 </button>
                                             )}
                                             <button onClick={(e) => {e.stopPropagation(); removeBatchItem(item.id)}} className="p-2 hover:bg-red-900/30 rounded text-zinc-600 hover:text-red-400" title="Remove file from queue">
                                                 <Trash2 className="w-4 h-4" />
                                             </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {batchItems.length > 0 && (
                    <div className="space-y-4">
                        {/* Translation Controls */}
                        <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl space-y-4">
                             <div className="flex flex-col md:flex-row md:items-center gap-4 pb-4 border-b border-zinc-800 justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="flex items-center gap-2 text-zinc-300 font-medium text-sm">
                                        <Languages className="w-4 h-4 text-yellow-500" />
                                        <label>Target Language</label>
                                    </div>
                                    <select 
                                        value={targetLang}
                                        onChange={handleLanguageChange}
                                        title="Select the language to translate into"
                                        className="bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-zinc-200 focus:border-yellow-500 focus:outline-none"
                                    >
                                        {AVAILABLE_LANGUAGES.map(lang => (
                                            <option key={lang} value={lang}>{lang}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className="flex items-center gap-2">
                                        <input 
                                            type="checkbox" 
                                            id="autoContext" 
                                            checked={autoContext} 
                                            onChange={(e) => setAutoContext(e.target.checked)}
                                            className="w-4 h-4 rounded border-zinc-700 bg-zinc-900 accent-yellow-500"
                                            title="Analyze filename to detect movie/show context for better translation"
                                        />
                                        <label htmlFor="autoContext" className="text-sm text-zinc-300 flex items-center gap-2 cursor-pointer" title="Analyze filename to detect movie/show context for better translation">
                                            <Sparkles className="w-3 h-3 text-yellow-500" />
                                            Use context
                                        </label>
                                    </div>
                                    
                                    <div className="flex items-center gap-2">
                                        <input 
                                            type="checkbox" 
                                            id="smartTiming" 
                                            checked={smartTiming} 
                                            onChange={(e) => setSmartTiming(e.target.checked)}
                                            className="w-4 h-4 rounded border-zinc-700 bg-zinc-900 accent-yellow-500"
                                            title="Prevents overlaps and caps duration to 6s"
                                        />
                                        <label htmlFor="smartTiming" className="text-sm text-zinc-300 flex items-center gap-2 cursor-pointer" title="Prevents overlaps and caps duration to 6s">
                                            <Hourglass className="w-3 h-3 text-yellow-500" />
                                            Smart Timing
                                        </label>
                                    </div>
                                </div>
                             </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <button
                                onClick={handleTranslateAll}
                                disabled={isTranslating.current}
                                title="Start processing all pending files in the queue"
                                className={`p-4 rounded-xl border flex items-center justify-center gap-3 transition-all ${
                                    isTranslating.current 
                                    ? 'bg-zinc-800 border-zinc-700 text-zinc-500 cursor-not-allowed'
                                    : 'bg-yellow-500 border-yellow-400 text-black hover:bg-yellow-400 hover:shadow-lg hover:shadow-yellow-500/20'
                                }`}
                            >
                                {isTranslating.current ? (
                                    <>Processing Queue...</>
                                ) : (
                                    <><RefreshCw className="w-5 h-5" /> Translate All Pending</>
                                )}
                            </button>

                            <div className="relative group flex gap-2">
                                <button
                                    onClick={handleDownloadAll}
                                    disabled={completedCount === 0}
                                    title="Download all completed translations as a ZIP file"
                                    className="flex-1 p-4 rounded-xl border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 flex items-center justify-center gap-3 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <DownloadIcon className="w-5 h-5" /> 
                                    {getDownloadLabel()}
                                </button>
                                <button 
                                    onClick={() => setShowStyleConfig(!showStyleConfig)}
                                    className="px-4 bg-zinc-700 hover:bg-zinc-600 rounded-xl text-zinc-300 hover:text-white transition-colors border border-zinc-600"
                                    title="Configure Subtitle Style"
                                >
                                    <Settings2 className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                        {/* Style Configuration Panel */}
                        {showStyleConfig && (
                            <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-xl space-y-6 animate-in fade-in slide-in-from-top-2">
                                <div className="flex flex-col gap-4 border-b border-zinc-800 pb-4">
                                    <div className="flex justify-between items-center">
                                        <h3 className="font-semibold text-zinc-100 flex items-center gap-2">
                                            <Palette className="w-4 h-4 text-yellow-500" />
                                            Style Transfer Presets
                                        </h3>
                                        <button 
                                            onClick={resetStyles}
                                            title="Reset style settings to default"
                                            className="text-xs flex items-center gap-1.5 text-zinc-400 hover:text-white transition-colors px-2 py-1 rounded bg-zinc-800"
                                        >
                                            <RotateCcw className="w-3 h-3" /> Reset
                                        </button>
                                    </div>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                        <button onClick={() => applyPreset('NETFLIX')} title="Apply Netflix-like styling (Standard Sans-Serif)" className="flex items-center justify-center gap-2 py-2 px-3 rounded-lg border border-zinc-700 hover:border-red-600 hover:bg-red-600/10 text-xs font-medium transition-all group">
                                            <Tv className="w-3 h-3 text-red-500 group-hover:text-red-400" /> Netflix Style
                                        </button>
                                        <button onClick={() => applyPreset('ANIME')} title="Apply Anime fansub styling (Styled, specific colors)" className="flex items-center justify-center gap-2 py-2 px-3 rounded-lg border border-zinc-700 hover:border-pink-500 hover:bg-pink-500/10 text-xs font-medium transition-all group">
                                            <Layers className="w-3 h-3 text-pink-500 group-hover:text-pink-400" /> Anime Fansub
                                        </button>
                                        <button onClick={() => applyPreset('CINEMATIC')} title="Apply Cinematic styling (Black bars, narrow font)" className="flex items-center justify-center gap-2 py-2 px-3 rounded-lg border border-zinc-700 hover:border-amber-400 hover:bg-amber-400/10 text-xs font-medium transition-all group">
                                            <Film className="w-3 h-3 text-amber-400 group-hover:text-amber-300" /> Cinematic
                                        </button>
                                        <button onClick={() => applyPreset('KODI')} title="Apply Kodi/TV styling (Large, readable, simple)" className="flex items-center justify-center gap-2 py-2 px-3 rounded-lg border border-zinc-700 hover:border-blue-400 hover:bg-blue-400/10 text-xs font-medium transition-all group">
                                            <Monitor className="w-3 h-3 text-blue-400 group-hover:text-blue-300" /> TV / Kodi
                                        </button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                    {/* Left Column: Layout & Effects */}
                                    <div className="space-y-4">
                                        <label className="text-xs text-zinc-400 font-bold uppercase tracking-wider">Layout & Effects</label>
                                        
                                        <div className="space-y-2">
                                            <span className="text-xs text-zinc-500">Output Format</span>
                                            <div className="grid grid-cols-2 gap-3">
                                                <button 
                                                    onClick={() => setStyleConfig({...styleConfig, outputFormat: 'ass'})}
                                                    title="Use .ass format for rich styling and positioning"
                                                    className={`py-2 px-3 rounded-lg text-xs font-medium border flex items-center justify-center gap-2 ${styleConfig.outputFormat === 'ass' ? 'bg-yellow-500/10 border-yellow-500 text-yellow-500' : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:bg-zinc-750'}`}
                                                >
                                                    <FileText className="w-3 h-3" /> Advanced (.ass)
                                                </button>
                                                <button 
                                                    onClick={() => setStyleConfig({...styleConfig, outputFormat: 'srt'})}
                                                    title="Use .srt format for broad compatibility (limited styling)"
                                                    className={`py-2 px-3 rounded-lg text-xs font-medium border flex items-center justify-center gap-2 ${styleConfig.outputFormat === 'srt' ? 'bg-yellow-500/10 border-yellow-500 text-yellow-500' : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:bg-zinc-750'}`}
                                                >
                                                    <FileType className="w-3 h-3" /> Standard (.srt)
                                                </button>
                                            </div>
                                            <p className="text-xs text-zinc-600 px-1">
                                                {styleConfig.outputFormat === 'ass' ? 'Supports precise positioning and styling. Best for PC/VLC.' : 'Standard text format. Supports basic colors only. Best for TVs.'}
                                            </p>
                                        </div>

                                        <div className="grid grid-cols-2 gap-3">
                                            {/* Disable Layout Toggle if SRT, as SRT only supports stacked-ish text */}
                                            <button 
                                                onClick={() => setStyleConfig({...styleConfig, layout: 'stacked'})}
                                                disabled={styleConfig.outputFormat === 'srt'}
                                                title="Both languages appear at the bottom of the screen"
                                                className={`py-3 px-4 rounded-lg text-sm font-medium border flex items-center justify-center gap-2 ${styleConfig.layout === 'stacked' ? 'bg-yellow-500/10 border-yellow-500 text-yellow-500' : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:bg-zinc-750'} ${styleConfig.outputFormat === 'srt' ? 'opacity-50 cursor-not-allowed' : ''}`}
                                            >
                                                <Layout className="w-4 h-4 rotate-180" /> Stacked (Bottom)
                                            </button>
                                            <button 
                                                onClick={() => setStyleConfig({...styleConfig, layout: 'split'})}
                                                disabled={styleConfig.outputFormat === 'srt'}
                                                title="One language at top, one at bottom"
                                                className={`py-3 px-4 rounded-lg text-sm font-medium border flex items-center justify-center gap-2 ${styleConfig.layout === 'split' ? 'bg-yellow-500/10 border-yellow-500 text-yellow-500' : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:bg-zinc-750'} ${styleConfig.outputFormat === 'srt' ? 'opacity-50 cursor-not-allowed' : ''}`}
                                            >
                                                <Layout className="w-4 h-4" /> Split (Top/Bottom)
                                            </button>
                                        </div>

                                        <div className="space-y-2">
                                            <span className="text-xs text-zinc-500">Lines per Subtitle</span>
                                            <div className="grid grid-cols-2 gap-3">
                                                <button 
                                                    onClick={() => setStyleConfig({...styleConfig, linesPerSubtitle: 1})}
                                                    title="Merge text into a single line where possible"
                                                    className={`py-2 px-3 rounded-lg text-xs font-medium border flex items-center justify-center gap-2 ${styleConfig.linesPerSubtitle === 1 ? 'bg-yellow-500/10 border-yellow-500 text-yellow-500' : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:bg-zinc-750'}`}
                                                >
                                                    <AlignLeft className="w-3 h-3" /> Single Line
                                                </button>
                                                <button 
                                                    onClick={() => setStyleConfig({...styleConfig, linesPerSubtitle: 2})}
                                                    title="Allow up to 2 lines per subtitle"
                                                    className={`py-2 px-3 rounded-lg text-xs font-medium border flex items-center justify-center gap-2 ${styleConfig.linesPerSubtitle === 2 || !styleConfig.linesPerSubtitle ? 'bg-yellow-500/10 border-yellow-500 text-yellow-500' : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:bg-zinc-750'}`}
                                                >
                                                    <AlignJustify className="w-3 h-3" /> Double Line
                                                </button>
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <span className="text-xs text-zinc-500">Vertical Order (Stack Mode)</span>
                                            <button 
                                                onClick={() => setStyleConfig({...styleConfig, stackOrder: styleConfig.stackOrder === 'primary-top' ? 'secondary-top' : 'primary-top'})}
                                                title="Swap vertical position of Original vs Translated text"
                                                className="w-full py-2 px-3 rounded-lg border border-zinc-700 bg-zinc-800 text-zinc-300 text-sm hover:text-white flex items-center justify-between"
                                            >
                                                <span>
                                                    Top: {styleConfig.stackOrder === 'primary-top' ? targetLang : 'English'}
                                                </span>
                                                <ArrowUpDown className="w-4 h-4" />
                                            </button>
                                        </div>

                                        <div className={`space-y-4 pt-2 border-t border-zinc-800 ${styleConfig.outputFormat === 'srt' ? 'opacity-30 pointer-events-none' : ''}`}>
                                            <div className="space-y-2">
                                                <div className="flex justify-between">
                                                    <span className="text-xs text-zinc-400">Outline Width</span>
                                                    <span className="text-xs text-zinc-500">{styleConfig.outlineWidth}px</span>
                                                </div>
                                                <input 
                                                    type="range" min="0" max="10" step="1"
                                                    value={styleConfig.outlineWidth}
                                                    onChange={(e) => setStyleConfig({...styleConfig, outlineWidth: parseInt(e.target.value)})}
                                                    title="Adjust the thickness of the text border"
                                                    className="w-full accent-zinc-500 h-1.5 bg-zinc-700 rounded-lg appearance-none cursor-pointer"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <div className="flex justify-between">
                                                    <span className="text-xs text-zinc-400">Shadow Depth</span>
                                                    <span className="text-xs text-zinc-500">{styleConfig.shadowDepth}px</span>
                                                </div>
                                                <input 
                                                    type="range" min="0" max="10" step="1"
                                                    value={styleConfig.shadowDepth}
                                                    onChange={(e) => setStyleConfig({...styleConfig, shadowDepth: parseInt(e.target.value)})}
                                                    title="Adjust the distance of the drop shadow"
                                                    className="w-full accent-zinc-500 h-1.5 bg-zinc-700 rounded-lg appearance-none cursor-pointer"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Right Column: Typography & Colors */}
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between">
                                            <label className="text-xs text-zinc-400 font-bold uppercase tracking-wider">Typography & Colors</label>
                                        </div>
                                        
                                        {/* Primary Style Config */}
                                        <div className="bg-zinc-800/50 p-3 rounded-lg border border-zinc-700/50 space-y-3">
                                            <div className="flex justify-between items-center">
                                                <span className="text-sm font-medium text-zinc-200">{targetLang}</span>
                                                <div className="flex items-center gap-2 bg-zinc-900 rounded p-1 border border-zinc-700">
                                                    <span className="text-xs font-mono text-zinc-400 pl-1">{styleConfig.primary.color.toUpperCase()}</span>
                                                    <input 
                                                        type="color" 
                                                        value={styleConfig.primary.color}
                                                        onChange={(e) => setStyleConfig({...styleConfig, primary: {...styleConfig.primary, color: e.target.value}})}
                                                        title="Set color for the translated text"
                                                        className="w-6 h-6 rounded cursor-pointer bg-transparent border-none p-0"
                                                    />
                                                </div>
                                            </div>
                                            <div className={`flex items-center gap-3 transition-opacity ${styleConfig.outputFormat === 'srt' ? 'opacity-30 pointer-events-none' : ''}`}>
                                                <span className="text-xs text-zinc-500 w-12">Size: {styleConfig.primary.fontSize}</span>
                                                <input 
                                                    type="range" min="30" max="120" step="2"
                                                    value={styleConfig.primary.fontSize}
                                                    onChange={(e) => setStyleConfig({...styleConfig, primary: {...styleConfig.primary, fontSize: parseInt(e.target.value)}})}
                                                    title="Set font size for the translated text"
                                                    className="flex-1 accent-yellow-500 h-1.5 bg-zinc-700 rounded-lg appearance-none cursor-pointer"
                                                />
                                            </div>
                                        </div>

                                        {/* Secondary Style Config */}
                                        <div className="bg-zinc-800/50 p-3 rounded-lg border border-zinc-700/50 space-y-3">
                                            <div className="flex justify-between items-center">
                                                <span className="text-sm font-medium text-zinc-200">English</span>
                                                <div className="flex items-center gap-2 bg-zinc-900 rounded p-1 border border-zinc-700">
                                                    <span className="text-xs font-mono text-zinc-400 pl-1">{styleConfig.secondary.color.toUpperCase()}</span>
                                                    <input 
                                                        type="color" 
                                                        value={styleConfig.secondary.color}
                                                        onChange={(e) => setStyleConfig({...styleConfig, secondary: {...styleConfig.secondary, color: e.target.value}})}
                                                        title="Set color for the original text"
                                                        className="w-6 h-6 rounded cursor-pointer bg-transparent border-none p-0"
                                                    />
                                                </div>
                                            </div>
                                            <div className={`flex items-center gap-3 transition-opacity ${styleConfig.outputFormat === 'srt' ? 'opacity-30 pointer-events-none' : ''}`}>
                                                <span className="text-xs text-zinc-500 w-12">Size: {styleConfig.secondary.fontSize}</span>
                                                <input 
                                                    type="range" min="30" max="120" step="2"
                                                    value={styleConfig.secondary.fontSize}
                                                    onChange={(e) => setStyleConfig({...styleConfig, secondary: {...styleConfig.secondary, fontSize: parseInt(e.target.value)}})}
                                                    title="Set font size for the original text"
                                                    className="flex-1 accent-zinc-500 h-1.5 bg-zinc-700 rounded-lg appearance-none cursor-pointer"
                                                />
                                            </div>
                                        </div>

                                        <div className={`space-y-2 ${styleConfig.outputFormat === 'srt' ? 'opacity-30 pointer-events-none' : ''}`}>
                                            <span className="text-xs text-zinc-500">Font Family</span>
                                            <div className="relative">
                                                <Type className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                                                <select 
                                                    value={styleConfig.fontFamily}
                                                    onChange={(e) => setStyleConfig({...styleConfig, fontFamily: e.target.value})}
                                                    title="Select the font face"
                                                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg pl-9 pr-3 py-2 text-sm text-zinc-200 focus:border-yellow-500 focus:outline-none appearance-none"
                                                >
                                                    {KODI_FONTS.map(font => (
                                                        <option key={font} value={font}>{font}</option>
                                                    ))}
                                                </select>
                                                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                                                    <svg className="w-4 h-4 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                    </svg>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="mt-8 pt-8 border-t border-zinc-800">
                                    <label className="text-xs text-zinc-400 font-bold uppercase tracking-wider block mb-4">Live Preview</label>
                                    <VisualPreview 
                                        config={styleConfig} 
                                        original={sampleOriginal} 
                                        translated={sampleTranslated} 
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {activeItem && activeItem.subtitles.length > 0 && (
                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-2xl">
                        <div className="px-6 py-4 border-b border-zinc-800 bg-zinc-900/80 flex justify-between items-center">
                            <h3 className="font-semibold text-zinc-300 flex items-center gap-2">
                                <PlayCircle className="w-4 h-4" /> Preview: <span className="text-white">{activeItem.fileName}</span>
                            </h3>
                        </div>
                        <div className="h-[500px] overflow-y-auto p-0 bg-black/20 relative">
                           <div className="grid grid-cols-12 text-xs font-semibold text-zinc-500 uppercase tracking-wider border-b border-zinc-800 bg-zinc-900/90 sticky top-0 z-10">
                               <div className="col-span-1 p-3 text-center">#</div>
                               <div className="col-span-2 p-3">Time</div>
                               <div className="col-span-4 p-3">Original</div>
                               <div className="col-span-5 p-3">{targetLang}</div>
                           </div>
                           
                           <div className="divide-y divide-zinc-800/50">
                               {activeItem.subtitles.slice(0, 100).map((sub) => (
                                   <div 
                                      key={sub.id} 
                                      onClick={() => setPreviewLineId(sub.id)}
                                      className={`grid grid-cols-12 text-sm hover:bg-white/5 transition-colors group cursor-pointer ${previewLineId === sub.id ? 'bg-yellow-500/10' : ''}`}
                                   >
                                       <div className="col-span-1 p-4 text-center text-zinc-600 font-mono text-xs">{sub.id}</div>
                                       <div className="col-span-2 p-4 text-zinc-500 font-mono text-xs whitespace-nowrap">
                                           {sub.startTime.split(',')[0]}
                                       </div>
                                       <div className="col-span-4 p-4 text-zinc-300">
                                           {/* Respect single/double line setting for preview */}
                                            {styleConfig.linesPerSubtitle === 1 
                                                ? sub.originalText.replace(/\[br\]/g, ' ')
                                                : sub.originalText.split('[br]').map((line, i) => (<React.Fragment key={i}>{i > 0 && <br />}{line}</React.Fragment>))
                                            }
                                       </div>
                                       <div className="col-span-5 p-4 text-yellow-500/90 font-medium">
                                           {sub.translatedText ? (
                                                styleConfig.linesPerSubtitle === 1
                                                ? sub.translatedText.replace(/\[br\]/g, ' ')
                                                : sub.translatedText.split('[br]').map((line, i) => (
                                                   <React.Fragment key={i}>
                                                       {i > 0 && <br />}
                                                       {line}
                                                   </React.Fragment>
                                                ))
                                            ) : (
                                               <span className="text-zinc-700 italic text-xs">Waiting for translation...</span>
                                           )}
                                       </div>
                                   </div>
                               ))}
                           </div>
                        </div>
                    </div>
                )}
            </div>
        )}
        
        {/* Confirmation Modal */}
        {confirmationRequest && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
                <div className="bg-zinc-900 border border-zinc-700 p-6 rounded-xl max-w-md w-full shadow-2xl space-y-4 ring-1 ring-white/10">
                    <div className="flex items-center gap-3 text-amber-500">
                        <AlertTriangle className="w-8 h-8" />
                        <h3 className="text-xl font-bold text-white">Non-English Source Detected</h3>
                    </div>
                    
                    <p className="text-zinc-400">
                        The file <span className="text-white font-medium">{confirmationRequest.fileName}</span> appears to be in <span className="text-amber-400 font-bold">{confirmationRequest.detectedLanguage}</span>.
                    </p>
                    
                    <p className="text-sm text-zinc-500 bg-zinc-950/50 p-3 rounded-lg border border-zinc-800">
                        This tool is optimized for <strong>English-to-{targetLang}</strong> translation. 
                        Continuing may result in lower quality translations or unexpected behavior.
                    </p>

                    <div className="flex gap-3 pt-2">
                        <button 
                            onClick={() => confirmationRequest.resolve(false)}
                            title="Cancel translation"
                            className="flex-1 px-4 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg font-medium transition-colors"
                        >
                            Cancel
                        </button>
                        <button 
                            onClick={() => confirmationRequest.resolve(true)}
                            title="Proceed with translation"
                            className="flex-1 px-4 py-3 bg-amber-500 hover:bg-amber-400 text-black rounded-lg font-bold transition-colors"
                        >
                            Translate Anyway
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* Model Settings Modal */}
        {showModelSettings && (
             <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
                <div className="bg-zinc-900 border border-zinc-700 p-6 rounded-xl max-w-md w-full shadow-2xl space-y-6 ring-1 ring-white/10">
                    <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
                        <div className="flex items-center gap-2">
                            <div className="p-2 bg-yellow-500/10 rounded-lg">
                                <Cog className="w-5 h-5 text-yellow-500" />
                            </div>
                            <h3 className="text-lg font-bold text-white">Gemini Model Settings</h3>
                        </div>
                        <button onClick={() => setShowModelSettings(false)} className="text-zinc-500 hover:text-white transition-colors" title="Close settings">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="space-y-5">
                         {/* Model Selection */}
                         <div className="space-y-2">
                             <div className="flex justify-between items-center">
                                 <label className="text-sm font-medium text-zinc-300">Model Version</label>
                                 <Cpu className="w-4 h-4 text-yellow-500" />
                             </div>
                             <select 
                                 value={modelConfig.modelName}
                                 onChange={(e) => setModelConfig({...modelConfig, modelName: e.target.value})}
                                 title="Select the AI model version"
                                 className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:border-yellow-500 focus:outline-none"
                             >
                                 {AVAILABLE_MODELS.map(model => (
                                     <option key={model.id} value={model.id}>{model.name}</option>
                                 ))}
                             </select>
                         </div>

                         {/* Temperature */}
                        <div className="space-y-2">
                            <div className="flex justify-between">
                                <label className="text-sm font-medium text-zinc-300">Temperature</label>
                                <span className="text-xs font-mono text-yellow-500">{modelConfig.temperature}</span>
                            </div>
                            <input 
                                type="range" min="0" max="1" step="0.1"
                                value={modelConfig.temperature}
                                onChange={(e) => setModelConfig({...modelConfig, temperature: parseFloat(e.target.value)})}
                                title="Control randomness: Higher = Creative, Lower = Precise"
                                className="w-full accent-yellow-500 h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
                            />
                            <p className="text-xs text-zinc-500">Higher values mean more creative/random outputs. Lower values are more deterministic.</p>
                        </div>

                        {/* Top P */}
                        <div className="space-y-2">
                            <div className="flex justify-between">
                                <label className="text-sm font-medium text-zinc-300">Top P</label>
                                <span className="text-xs font-mono text-yellow-500">{modelConfig.topP}</span>
                            </div>
                             <input 
                                type="range" min="0" max="1" step="0.05"
                                value={modelConfig.topP}
                                onChange={(e) => setModelConfig({...modelConfig, topP: parseFloat(e.target.value)})}
                                title="Nucleus sampling: Controls diversity of word choices"
                                className="w-full accent-yellow-500 h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
                            />
                            <p className="text-xs text-zinc-500">Nucleus sampling. Lower values reduce the pool of words considered.</p>
                        </div>

                        {/* Top K */}
                         <div className="space-y-2">
                            <div className="flex justify-between">
                                <label className="text-sm font-medium text-zinc-300">Top K</label>
                                <span className="text-xs font-mono text-yellow-500">{modelConfig.topK}</span>
                            </div>
                             <input 
                                type="range" min="1" max="100" step="1"
                                value={modelConfig.topK}
                                onChange={(e) => setModelConfig({...modelConfig, topK: parseInt(e.target.value)})}
                                title="Limits the pool of probable next words"
                                className="w-full accent-yellow-500 h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
                            />
                            <p className="text-xs text-zinc-500">Limits the number of highest probability tokens considered for each step.</p>
                        </div>

                        {/* Max Tokens */}
                        <div className="space-y-2">
                            <div className="flex justify-between">
                                <label className="text-sm font-medium text-zinc-300">Max Output Tokens</label>
                                <span className="text-xs font-mono text-yellow-500">{modelConfig.maxOutputTokens}</span>
                            </div>
                             <input 
                                type="range" min="1024" max="8192" step="1024"
                                value={modelConfig.maxOutputTokens}
                                onChange={(e) => setModelConfig({...modelConfig, maxOutputTokens: parseInt(e.target.value)})}
                                title="Maximum length of the generated response"
                                className="w-full accent-yellow-500 h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
                            />
                        </div>
                    </div>

                    <div className="pt-4 border-t border-zinc-800">
                        <button 
                            onClick={() => setShowModelSettings(false)}
                            title="Save and close settings"
                            className="w-full py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg font-medium transition-colors"
                        >
                            Close
                        </button>
                    </div>
                </div>
            </div>
        )}
      </main>
    </div>
  );
}

export default App;