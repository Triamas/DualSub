import React, { useState, useRef, useEffect } from 'react';
import { Upload, FileText, CheckCircle, AlertTriangle, RefreshCw, Download as DownloadIcon, PlayCircle, Search as SearchIcon, Info, Sparkles, Languages, Settings2, Layout, Palette, ArrowUpDown, RotateCcw } from 'lucide-react';
import { SubtitleLine, ProcessingState, TabView, AssStyleConfig } from './types';
import { parseSRT, generateASS, downloadFile } from './services/subtitleUtils';
import { translateBatch, generateContext } from './services/geminiService';
import SubtitleSearch from './components/OpenSubtitlesSearch';

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

// Default configuration as requested
const DEFAULT_CONFIG: AssStyleConfig = {
    layout: 'stacked',
    stackOrder: 'primary-top', // Default: Primary (Translation) above, Secondary (Original) below
    primary: {
        color: '#FFFF00', // Yellow
        fontSize: 64
    },
    secondary: {
        color: '#FFFFFF', // White
        fontSize: 64
    }
};

function App() {
  const [activeTab, setActiveTab] = useState<TabView>(TabView.UPLOAD);
  const [subtitles, setSubtitles] = useState<SubtitleLine[]>([]);
  const [fileName, setFileName] = useState<string>('');
  const [contextInfo, setContextInfo] = useState<string>('');
  const [isGeneratingContext, setIsGeneratingContext] = useState(false);
  
  // Style Configuration State
  const [styleConfig, setStyleConfig] = useState<AssStyleConfig>(DEFAULT_CONFIG);
  const [showStyleConfig, setShowStyleConfig] = useState(false);

  // Language State with Persistence
  const [targetLang, setTargetLang] = useState<string>(() => {
      return localStorage.getItem('target_language') || 'Vietnamese';
  });

  const [processingState, setProcessingState] = useState<ProcessingState>({
    status: 'idle',
    message: 'Ready to start',
    progress: 0,
  });
  
  const isCancelled = useRef(false);
  const completedLinesRef = useRef(0);
  const activeLinesRef = useRef(0);
  const progressValueRef = useRef(0);

  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const lang = e.target.value;
      setTargetLang(lang);
      localStorage.setItem('target_language', lang);
  };

  const resetStyles = () => {
      setStyleConfig(DEFAULT_CONFIG);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setProcessingState({ status: 'parsing', message: 'Parsing SRT file...', progress: 0 });

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      try {
        const parsed = parseSRT(content);
        setSubtitles(parsed);
        setProcessingState({ status: 'idle', message: `Loaded ${parsed.length} lines`, progress: 0 });
      } catch (err) {
        setProcessingState({ status: 'error', message: 'Failed to parse SRT file', progress: 0 });
      }
    };
    reader.readAsText(file);
  };

  const handleSubtitleSelection = (content: string, name: string) => {
      setFileName(name);
      setProcessingState({ status: 'parsing', message: 'Parsing downloaded subtitles...', progress: 0 });
      try {
          const parsed = parseSRT(content);
          setSubtitles(parsed);
          setProcessingState({ status: 'idle', message: `Loaded ${parsed.length} lines`, progress: 0 });
          setActiveTab(TabView.UPLOAD); 
      } catch (err) {
          setProcessingState({ status: 'error', message: 'Failed to parse the downloaded subtitle', progress: 0 });
      }
  };

  const handleAutoContext = async () => {
      if (!fileName) return;
      setIsGeneratingContext(true);
      try {
          const ctx = await generateContext(fileName);
          setContextInfo(ctx);
      } catch (e) {
          console.error(e);
      } finally {
          setIsGeneratingContext(false);
      }
  };

  const startTranslation = async () => {
    if (subtitles.length === 0) return;
    
    if (!process.env.API_KEY) {
        alert("System Error: Gemini API Key is missing from environment variables.");
        return;
    }

    isCancelled.current = false;
    completedLinesRef.current = 0;
    activeLinesRef.current = 0;
    progressValueRef.current = 0;

    setProcessingState({ status: 'translating', message: `Starting translation to ${targetLang} (Turbo Mode)...`, progress: 0 });

    const newSubtitles = [...subtitles];
    const totalLines = subtitles.length;

    const progressInterval = setInterval(() => {
        if (isCancelled.current || totalLines === 0) return;

        const floorPercent = (completedLinesRef.current / totalLines) * 100;
        const currentCeilingPercent = ((completedLinesRef.current + activeLinesRef.current) / totalLines) * 100;
        let newProgress = progressValueRef.current;

        if (newProgress < floorPercent) {
             newProgress = floorPercent;
        } else if (newProgress < currentCeilingPercent * 0.98) {
             newProgress += 0.5;
        }

        if (newProgress > 99) newProgress = 99;
        progressValueRef.current = newProgress;
        
        setProcessingState(prev => {
            if (prev.status !== 'translating') return prev;
            return { 
                ...prev, 
                progress: Math.round(newProgress),
                message: `Translating... ${Math.round(newProgress)}%`
            };
        });

    }, 100);

    interface ChunkData {
        lines: SubtitleLine[];
        previous: SubtitleLine[];
    }

    const chunks: ChunkData[] = [];
    for (let i = 0; i < subtitles.length; i += BATCH_SIZE) {
        const chunkLines = newSubtitles.slice(i, i + BATCH_SIZE);
        const previousLines = i > 0 ? newSubtitles.slice(Math.max(0, i - OVERLAP_SIZE), i) : [];
        chunks.push({ lines: chunkLines, previous: previousLines });
    }

    const processChunk = async (chunkData: ChunkData) => {
        if (isCancelled.current) return;
        const { lines, previous } = chunkData;
        activeLinesRef.current += lines.length;
        const linesToTranslate = lines.filter(l => !l.translatedText);
        
        if (linesToTranslate.length > 0) {
            try {
                const translations = await translateBatch(linesToTranslate, targetLang, contextInfo, previous);
                linesToTranslate.forEach(line => {
                    if (translations.has(line.id)) {
                        line.translatedText = translations.get(line.id);
                    }
                });
            } catch (error) {
                console.error("Batch failed", error);
            }
        }

        activeLinesRef.current -= lines.length;
        completedLinesRef.current += lines.length;
        setSubtitles([...newSubtitles]);
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
    clearInterval(progressInterval);

    if (isCancelled.current) {
        setProcessingState({ status: 'idle', message: 'Translation cancelled', progress: 0 });
    } else {
        setProcessingState({ status: 'completed', message: 'Translation complete!', progress: 100 });
    }
  };

  const handleDownloadASS = () => {
    const assContent = generateASS(subtitles, styleConfig);
    const newFileName = fileName.replace('.srt', '') + '.dual.ass';
    downloadFile(assContent, newFileName);
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
              <p className="text-xs text-zinc-400">SRT to Dual-Language ASS Converter</p>
            </div>
          </div>
          <div className="flex gap-4">
             {processingState.status === 'translating' && (
                 <div className="flex items-center gap-2 px-3 py-1 bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 rounded-full text-sm">
                     <RefreshCw className="w-4 h-4 animate-spin" />
                     <span className="font-mono">{processingState.progress}%</span>
                 </div>
             )}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto w-full px-6 py-8">
        <div className="flex gap-4 mb-8 border-b border-zinc-800">
            <button 
                onClick={() => setActiveTab(TabView.UPLOAD)}
                className={`pb-4 px-2 font-medium text-sm transition-colors relative ${activeTab === TabView.UPLOAD ? 'text-yellow-500' : 'text-zinc-400 hover:text-zinc-200'}`}
            >
                Upload File
                {activeTab === TabView.UPLOAD && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-yellow-500 rounded-t-full" />}
            </button>
            <button 
                onClick={() => setActiveTab(TabView.SEARCH)}
                className={`pb-4 px-2 font-medium text-sm transition-colors relative ${activeTab === TabView.SEARCH ? 'text-yellow-500' : 'text-zinc-400 hover:text-zinc-200'}`}
            >
                Search Subtitles
                {activeTab === TabView.SEARCH && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-yellow-500 rounded-t-full" />}
            </button>
        </div>

        {activeTab === TabView.SEARCH ? (
            <SubtitleSearch onSelectSubtitle={handleSubtitleSelection} />
        ) : (
            <div className="space-y-6">
                <div className={`border-2 border-dashed rounded-xl p-8 transition-colors text-center ${subtitles.length > 0 ? 'border-zinc-700 bg-zinc-900/30' : 'border-zinc-700 hover:border-yellow-500/50 hover:bg-zinc-900'}`}>
                    <input 
                        type="file" 
                        accept=".srt" 
                        onChange={handleFileUpload}
                        className="hidden" 
                        id="srt-upload" 
                    />
                    
                    {subtitles.length === 0 ? (
                        <label htmlFor="srt-upload" className="cursor-pointer flex flex-col items-center gap-4">
                            <div className="w-16 h-16 bg-zinc-800 rounded-full flex items-center justify-center text-zinc-400">
                                <Upload className="w-8 h-8" />
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold">Drop your .srt file here</h3>
                                <p className="text-zinc-500 mt-1">or click to browse</p>
                            </div>
                        </label>
                    ) : (
                         <div className="flex items-center justify-between">
                             <div className="flex items-center gap-4 text-left">
                                 <div className="w-12 h-12 bg-green-500/20 text-green-500 rounded-lg flex items-center justify-center">
                                     <CheckCircle className="w-6 h-6" />
                                 </div>
                                 <div>
                                     <h3 className="font-semibold text-lg">{fileName}</h3>
                                     <p className="text-zinc-400">{subtitles.length} subtitle lines detected</p>
                                 </div>
                             </div>
                             <div className="flex gap-3">
                                <button 
                                    onClick={() => {
                                        isCancelled.current = true;
                                        setProcessingState({status:'idle', message:'Cancelled', progress:0});
                                    }}
                                    className={`text-sm border border-zinc-700 px-3 py-1 rounded hover:bg-zinc-800 ${processingState.status !== 'translating' ? 'hidden' : ''}`}
                                >
                                    Stop
                                </button>
                                <button 
                                    onClick={() => {setSubtitles([]); setFileName(''); setProcessingState({status:'idle', message:'', progress:0})}}
                                    className="text-sm text-red-400 hover:text-red-300 underline"
                                >
                                    Remove
                                </button>
                             </div>
                         </div>
                    )}
                </div>

                {subtitles.length > 0 && (
                    <div className="space-y-4">
                        {/* Translation Controls */}
                        <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl space-y-4">
                             <div className="flex items-center gap-4 pb-4 border-b border-zinc-800">
                                <div className="flex items-center gap-2 text-zinc-300 font-medium text-sm">
                                    <Languages className="w-4 h-4 text-yellow-500" />
                                    <label>Target Language</label>
                                </div>
                                <select 
                                    value={targetLang}
                                    onChange={handleLanguageChange}
                                    className="bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-zinc-200 focus:border-yellow-500 focus:outline-none"
                                >
                                    {AVAILABLE_LANGUAGES.map(lang => (
                                        <option key={lang} value={lang}>{lang}</option>
                                    ))}
                                </select>
                             </div>

                             <div className="space-y-2">
                                <div className="flex justify-between items-end">
                                    <div className="flex items-center gap-2 text-zinc-300 font-medium text-sm">
                                        <Info className="w-4 h-4 text-yellow-500" />
                                        <label>Description (Translation context)</label>
                                    </div>
                                    <button 
                                        onClick={handleAutoContext}
                                        disabled={isGeneratingContext}
                                        className="text-xs flex items-center gap-1.5 text-yellow-500 hover:text-yellow-400 transition-colors disabled:opacity-50"
                                    >
                                        {isGeneratingContext ? (
                                            <RefreshCw className="w-3 h-3 animate-spin" />
                                        ) : (
                                            <Sparkles className="w-3 h-3" />
                                        )}
                                        Auto-Detect from Filename
                                    </button>
                                </div>
                                <textarea 
                                    value={contextInfo}
                                    onChange={(e) => setContextInfo(e.target.value)}
                                    placeholder="Auto-detect or manually describe the movie plot and character relationships to help the AI understand context and tone."
                                    className="w-full bg-black/20 border border-zinc-700 rounded-lg p-3 text-sm text-zinc-200 focus:border-yellow-500 focus:outline-none min-h-[80px]"
                                />
                             </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <button
                                onClick={startTranslation}
                                disabled={processingState.status === 'translating' || processingState.status === 'completed'}
                                className={`p-4 rounded-xl border flex items-center justify-center gap-3 transition-all ${
                                    processingState.status === 'translating' 
                                    ? 'bg-zinc-800 border-zinc-700 text-zinc-500 cursor-not-allowed'
                                    : processingState.status === 'completed'
                                    ? 'bg-green-600 border-green-500 text-white'
                                    : 'bg-yellow-500 border-yellow-400 text-black hover:bg-yellow-400 hover:shadow-lg hover:shadow-yellow-500/20'
                                }`}
                            >
                                {processingState.status === 'translating' ? (
                                    <>Translating...</>
                                ) : processingState.status === 'completed' ? (
                                    <><CheckCircle className="w-5 h-5" /> Translation Done</>
                                ) : (
                                    <><RefreshCw className="w-5 h-5" /> Translate to {targetLang}</>
                                )}
                            </button>

                            <div className="relative group">
                                <button
                                    onClick={handleDownloadASS}
                                    disabled={subtitles.length === 0}
                                    className="w-full p-4 rounded-xl border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 flex items-center justify-center gap-3 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <DownloadIcon className="w-5 h-5" /> Download .ass File
                                </button>
                                <button 
                                    onClick={() => setShowStyleConfig(!showStyleConfig)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-zinc-700 hover:bg-zinc-600 rounded-lg text-zinc-300 hover:text-white transition-colors border border-zinc-600"
                                    title="Configure Subtitle Style"
                                >
                                    <Settings2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        {/* Style Configuration Panel */}
                        {showStyleConfig && (
                            <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-xl space-y-6 animate-in fade-in slide-in-from-top-2">
                                <div className="flex justify-between items-center border-b border-zinc-800 pb-4">
                                    <h3 className="font-semibold text-zinc-100 flex items-center gap-2">
                                        <Palette className="w-4 h-4 text-yellow-500" />
                                        Customize Subtitle Appearance
                                    </h3>
                                    <button 
                                        onClick={resetStyles}
                                        className="text-xs flex items-center gap-1.5 text-zinc-400 hover:text-white transition-colors px-2 py-1 rounded bg-zinc-800"
                                        title="Reset to recommended defaults"
                                    >
                                        <RotateCcw className="w-3 h-3" /> Reset Default
                                    </button>
                                </div>

                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                    {/* Layout Section */}
                                    <div className="space-y-4">
                                        <label className="text-xs text-zinc-400 font-bold uppercase tracking-wider">Layout & Position</label>
                                        
                                        <div className="grid grid-cols-2 gap-3">
                                            <button 
                                                onClick={() => setStyleConfig({...styleConfig, layout: 'stacked'})}
                                                className={`py-3 px-4 rounded-lg text-sm font-medium border flex items-center justify-center gap-2 ${styleConfig.layout === 'stacked' ? 'bg-yellow-500/10 border-yellow-500 text-yellow-500' : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:bg-zinc-750'}`}
                                            >
                                                <Layout className="w-4 h-4 rotate-180" /> Stacked (Bottom)
                                            </button>
                                            <button 
                                                onClick={() => setStyleConfig({...styleConfig, layout: 'split'})}
                                                className={`py-3 px-4 rounded-lg text-sm font-medium border flex items-center justify-center gap-2 ${styleConfig.layout === 'split' ? 'bg-yellow-500/10 border-yellow-500 text-yellow-500' : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:bg-zinc-750'}`}
                                            >
                                                <Layout className="w-4 h-4" /> Split (Top/Bottom)
                                            </button>
                                        </div>

                                        <div className="space-y-2">
                                            <span className="text-xs text-zinc-500">Vertical Order (Stack Mode)</span>
                                            <button 
                                                onClick={() => setStyleConfig({...styleConfig, stackOrder: styleConfig.stackOrder === 'primary-top' ? 'secondary-top' : 'primary-top'})}
                                                className="w-full py-2 px-3 rounded-lg border border-zinc-700 bg-zinc-800 text-zinc-300 text-sm hover:text-white flex items-center justify-between"
                                            >
                                                <span>
                                                    Top: {styleConfig.stackOrder === 'primary-top' ? targetLang : 'English'}
                                                </span>
                                                <ArrowUpDown className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Styling Section */}
                                    <div className="space-y-4">
                                        <label className="text-xs text-zinc-400 font-bold uppercase tracking-wider">Colors & Size</label>
                                        
                                        {/* Primary Style Config */}
                                        <div className="bg-zinc-800/50 p-3 rounded-lg border border-zinc-700/50 space-y-3">
                                            <div className="flex justify-between items-center">
                                                <span className="text-sm font-medium text-zinc-200">{targetLang}</span>
                                                <input 
                                                    type="color" 
                                                    value={styleConfig.primary.color}
                                                    onChange={(e) => setStyleConfig({...styleConfig, primary: {...styleConfig.primary, color: e.target.value}})}
                                                    className="w-6 h-6 rounded cursor-pointer bg-transparent border-none p-0"
                                                />
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <span className="text-xs text-zinc-500 w-12">Size: {styleConfig.primary.fontSize}</span>
                                                <input 
                                                    type="range" min="30" max="100" step="2"
                                                    value={styleConfig.primary.fontSize}
                                                    onChange={(e) => setStyleConfig({...styleConfig, primary: {...styleConfig.primary, fontSize: parseInt(e.target.value)}})}
                                                    className="flex-1 accent-yellow-500 h-1.5 bg-zinc-700 rounded-lg appearance-none cursor-pointer"
                                                />
                                            </div>
                                        </div>

                                        {/* Secondary Style Config */}
                                        <div className="bg-zinc-800/50 p-3 rounded-lg border border-zinc-700/50 space-y-3">
                                            <div className="flex justify-between items-center">
                                                <span className="text-sm font-medium text-zinc-200">English</span>
                                                <input 
                                                    type="color" 
                                                    value={styleConfig.secondary.color}
                                                    onChange={(e) => setStyleConfig({...styleConfig, secondary: {...styleConfig.secondary, color: e.target.value}})}
                                                    className="w-6 h-6 rounded cursor-pointer bg-transparent border-none p-0"
                                                />
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <span className="text-xs text-zinc-500 w-12">Size: {styleConfig.secondary.fontSize}</span>
                                                <input 
                                                    type="range" min="30" max="100" step="2"
                                                    value={styleConfig.secondary.fontSize}
                                                    onChange={(e) => setStyleConfig({...styleConfig, secondary: {...styleConfig.secondary, fontSize: parseInt(e.target.value)}})}
                                                    className="flex-1 accent-zinc-500 h-1.5 bg-zinc-700 rounded-lg appearance-none cursor-pointer"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {subtitles.length > 0 && (
                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-2xl">
                        <div className="px-6 py-4 border-b border-zinc-800 bg-zinc-900/80 flex justify-between items-center">
                            <h3 className="font-semibold text-zinc-300 flex items-center gap-2">
                                <PlayCircle className="w-4 h-4" /> Preview
                            </h3>
                            <span className="text-xs text-zinc-500">Showing first 100 lines</span>
                        </div>
                        <div className="h-[500px] overflow-y-auto p-0 bg-black/20 relative">
                           <div className="grid grid-cols-12 text-xs font-semibold text-zinc-500 uppercase tracking-wider border-b border-zinc-800 bg-zinc-900/90 sticky top-0 z-10">
                               <div className="col-span-1 p-3 text-center">#</div>
                               <div className="col-span-2 p-3">Time</div>
                               <div className="col-span-4 p-3">Original</div>
                               <div className="col-span-5 p-3">{targetLang}</div>
                           </div>
                           
                           <div className="divide-y divide-zinc-800/50">
                               {subtitles.slice(0, 100).map((sub) => (
                                   <div key={sub.id} className="grid grid-cols-12 text-sm hover:bg-white/5 transition-colors group">
                                       <div className="col-span-1 p-4 text-center text-zinc-600 font-mono text-xs">{sub.id}</div>
                                       <div className="col-span-2 p-4 text-zinc-500 font-mono text-xs whitespace-nowrap">
                                           {sub.startTime.split(',')[0]}
                                       </div>
                                       <div className="col-span-4 p-4 text-zinc-300">
                                           {sub.originalText}
                                       </div>
                                       <div className="col-span-5 p-4 text-yellow-500/90 font-medium">
                                           {sub.translatedText || (
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
      </main>
    </div>
  );
}

export default App;