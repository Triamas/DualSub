import React, { useState, useRef, useEffect } from 'react';
import { Upload, Eye, Sparkles, Languages, BookOpen, Hourglass, Download as DownloadIcon, Cpu, Type, ScrollText, Coins, FileInput, RefreshCw } from 'lucide-react';
import { TabView, ModelConfig } from './types';
import { STYLE_PRESETS } from './services/subtitleUtils';
import SubtitleSearch from './components/OpenSubtitlesSearch';
import { ToastProvider, useToast } from './components/Toast';
import { Header } from './components/Header';
import { BatchQueue } from './components/BatchQueue';
import { StyleEditor } from './components/StyleEditor';
import { ModelSettings } from './components/ModelSettings';
import { SubtitleEditor } from './components/SubtitleEditor';
import { InfoTooltip } from './components/InfoTooltip';
import { AVAILABLE_LANGUAGES, OPENAI_PRESETS } from './constants';
import { BatchProvider, useBatch } from './contexts/BatchContext';
import { SettingsProvider, useSettings } from './contexts/SettingsContext';
import { useCostEstimator } from './hooks/useCostEstimator';
import { useSubtitleFile } from './hooks/useSubtitleFile';
import { useTranslationEngine } from './hooks/useTranslationEngine';

// --- MAIN APP CONTENT ---

function DualSubAppContent() {
  const { state: batchState, dispatch: batchDispatch } = useBatch();
  const { batchItems, activeItemId } = batchState;

  const {
      theme, setTheme,
      targetLang, setTargetLang,
      autoContext, setAutoContext,
      autoBible, setAutoBible,
      smartTiming, setSmartTiming,
      modelConfig, setModelConfig,
      styleConfig, setStyleConfig,
      customModelMode, setCustomModelMode
  } = useSettings();

  const [activeTab, setActiveTab] = useState<TabView>(TabView.UPLOAD);
  const [showModelSettings, setShowModelSettings] = useState(false);
  const [showStyleConfig, setShowStyleConfig] = useState(false);
  
  // Toast
  const { addToast } = useToast();

  // Active Item & Auto-Preview
  const activeItem = React.useMemo(() => 
    batchItems.find(item => item.id === activeItemId) || batchItems[0],
    [batchItems, activeItemId]
  );

  // Hooks
  const estimation = useCostEstimator(activeItem, modelConfig);
  const { 
      handleFileUpload, 
      handleImportTranslation, 
      handleSubtitleSelection, 
      handleDownloadAll, 
      removeBatchItem, 
      clearAll 
  } = useSubtitleFile(setActiveTab);
  
  const { handleTranslateAll, isTranslatingRef } = useTranslationEngine();

  // Check if current OpenAI model is custom or preset
  useEffect(() => {
    if (modelConfig.provider === 'openai') {
        const isPreset = OPENAI_PRESETS.some(grp => grp.options.some(opt => opt.id === modelConfig.modelName));
        setCustomModelMode(!isPreset && modelConfig.modelName !== 'gpt-4o');
    }
  }, [modelConfig.provider, modelConfig.modelName, setCustomModelMode]);

  // Log Viewer State
  const [viewingLogs] = useState<string | null>(null);
  const logContainerRef = useRef<HTMLDivElement>(null);

  // Preview Selection State
  const [previewLineId, setPreviewLineId] = useState<number | null>(null);

  // Log auto-scroll
  useEffect(() => {
      if (viewingLogs && logContainerRef.current) {
          logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
      }
  }, [viewingLogs, batchItems]);

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };
  
  useEffect(() => {
      if (activeItem && activeItem.subtitles.length > 0) {
          // If previewLineId is already set and valid for this item, keep it
          if (previewLineId && activeItem.subtitles.some(s => s.id === previewLineId)) return;

          const sample = activeItem.subtitles.slice(0, 50);
          const longest = sample.reduce((prev, current) => (prev.originalText.length > current.originalText.length) ? prev : current, sample[0]);
          if(longest) setPreviewLineId(longest.id);
      } else {
          setPreviewLineId(null);
      }
      // Only re-run when active item changes (not on every progress update)
      // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeItemId]);

  // Preview Data
  const selectedSubtitle = React.useMemo(() => 
    activeItem?.subtitles?.find(s => s.id === previewLineId),
    [activeItem, previewLineId]
  );
  const sampleOriginal = selectedSubtitle?.originalText || "Select a subtitle line to preview style.";
  const sampleTranslated = selectedSubtitle?.translatedText || "";
  
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
      <Header theme={theme} toggleTheme={toggleTheme} onOpenSettings={() => setShowModelSettings(true)} />

      <main className="flex-1 max-w-5xl mx-auto w-full px-6 py-8">
            
            {/* Tabs */}
            <div role="tablist" className="bg-zinc-100 dark:bg-zinc-900/50 p-1.5 rounded-full flex relative border border-zinc-200 dark:border-zinc-800 shadow-inner w-full md:w-2/3 mx-auto mb-6">
                <button 
                    role="tab"
                    aria-selected={activeTab === TabView.UPLOAD}
                    onClick={() => setActiveTab(TabView.UPLOAD)}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-full text-sm font-semibold transition-all z-10 ${activeTab === TabView.UPLOAD ? 'text-black shadow-md bg-white dark:bg-zinc-800' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'}`}
                >
                    <Upload className="w-4 h-4" /> Upload
                </button>
                <button 
                    role="tab"
                    aria-selected={activeTab === TabView.SEARCH}
                    onClick={() => setActiveTab(TabView.SEARCH)}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-full text-sm font-semibold transition-all z-10 ${activeTab === TabView.SEARCH ? 'text-black shadow-md bg-white dark:bg-zinc-800' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'}`}
                >
                    <Eye className="w-4 h-4" /> Search
                </button>
            </div>

            {activeTab === TabView.SEARCH ? (
                 <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-xl">
                    <SubtitleSearch onSelectSubtitle={handleSubtitleSelection} />
                </div>
            ) : (
                <div className="space-y-6">
                    <BatchQueue 
                        batchItems={batchItems}
                        activeItemId={activeItemId}
                        setActiveItemId={(id) => batchDispatch({ type: 'SET_ACTIVE_ITEM', payload: id })}
                        onFileUpload={handleFileUpload}
                        onRemoveItem={removeBatchItem}
                        onClearAll={clearAll}
                    />

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
                                        aria-label="Target Language"
                                    >
                                        {AVAILABLE_LANGUAGES.map(lang => <option key={lang} value={lang}>{lang}</option>)}
                                    </select>
                                 </div>

                                 {/* Toggles */}
                                 <div className="flex items-center justify-between gap-1">
                                    <button 
                                        onClick={() => { if(modelConfig.provider !== 'google_nmt') setAutoContext(!autoContext); }} 
                                        disabled={modelConfig.provider === 'google_nmt'}
                                        aria-pressed={autoContext}
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
                                        aria-pressed={autoBible}
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
                                    <button 
                                        onClick={() => setSmartTiming(!smartTiming)} 
                                        aria-pressed={smartTiming}
                                        className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium border transition-all ${smartTiming ? 'bg-blue-500/10 border-blue-500/30 text-blue-600 dark:text-blue-300' : 'bg-white dark:bg-zinc-950/50 border-zinc-200 dark:border-zinc-800 text-zinc-500'}`}
                                    >
                                        <Hourglass className="w-3 h-3" /> Smart Timing
                                    </button>
                                 </div>
                            </div>

                            {/* Main Actions */}
                            <div className="flex gap-4">
                                <button 
                                    onClick={handleTranslateAll}
                                    disabled={isTranslatingRef.current}
                                    className={`flex-[2] py-4 px-6 rounded-2xl font-bold text-lg shadow-xl shadow-yellow-500/20 hover:shadow-yellow-500/40 transform hover:-translate-y-0.5 transition-all flex items-center justify-center gap-3 ${isTranslatingRef.current ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 cursor-not-allowed' : 'bg-yellow-500 text-black hover:bg-yellow-400'}`}
                                >
                                    {isTranslatingRef.current ? (
                                        <><RefreshCw className="w-6 h-6 animate-spin" /> Translating...</>
                                    ) : (
                                        <><Sparkles className="w-6 h-6" /> Translate All</>
                                    )}
                                </button>
                                
                                <div className="flex-1 flex gap-2">
                                     {/* Merge Translation Button */}
                                    <div className="relative flex-1 group">
                                        <button 
                                            className={`w-full h-full rounded-xl border font-medium flex flex-col items-center justify-center gap-1 transition-all ${
                                                !activeItemId 
                                                ? 'bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-400 cursor-not-allowed' 
                                                : 'bg-white dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
                                            }`}
                                            disabled={!activeItemId}
                                            aria-label={!activeItemId ? "Select a file to merge translation" : "Merge existing translation"}
                                        >
                                            <FileInput className="w-5 h-5" />
                                            <span className="text-xs">Merge Translation</span>
                                        </button>
                                        <input 
                                            type="file" 
                                            accept=".srt,.ass,.ssa,.vtt" 
                                            onChange={handleImportTranslation}
                                            disabled={!activeItemId}
                                            className="absolute inset-0 opacity-0 cursor-pointer disabled:cursor-not-allowed"
                                            title={!activeItemId ? "Select a file first" : "Import translation file"}
                                        />
                                        {!activeItemId && (
                                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max px-2 py-1 bg-zinc-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                                Select a file first
                                            </div>
                                        )}
                                    </div>

                                    <button 
                                        onClick={handleDownloadAll}
                                        disabled={completedCount === 0}
                                        className="flex-1 py-3 px-4 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-900 dark:text-zinc-100 font-medium flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <DownloadIcon className="w-4 h-4" /> 
                                        {getDownloadLabel()}
                                    </button>
                                </div>
                            </div>
                            
                            {/* Token & Cost Estimator Pill */}
                            {activeItem && activeItem.status !== 'completed' && (
                                <div className="flex justify-center">
                                    <div 
                                        className="relative group inline-flex items-center gap-4 bg-zinc-100 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 rounded-full px-4 py-1.5 shadow-sm cursor-help transition-colors hover:bg-zinc-200 dark:hover:bg-zinc-900"
                                        tabIndex={0}
                                        aria-label="Cost Estimation Tooltip"
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
                    )}

                    <StyleEditor 
                        config={styleConfig}
                        onChange={setStyleConfig}
                        onReset={resetStyles}
                        onApplyPreset={applyPreset}
                        isOpen={showStyleConfig}
                        onToggle={() => setShowStyleConfig(!showStyleConfig)}
                        targetLang={targetLang}
                        sampleOriginal={sampleOriginal}
                        sampleTranslated={sampleTranslated}
                        selectedSubtitleId={selectedSubtitle?.id}
                    />

                    <SubtitleEditor 
                        activeItem={activeItem}
                        previewLineId={previewLineId}
                        setPreviewLineId={setPreviewLineId}
                    />
                </div>
            )}
            
            <ModelSettings 
                isOpen={showModelSettings}
                onClose={() => setShowModelSettings(false)}
                config={modelConfig}
                onConfigChange={setModelConfig}
                customModelMode={customModelMode}
                onProviderChange={handleProviderChange}
                onOpenAIModelChange={handleOpenAIModelChange}
            />
      </main>
    </div>
  );
}

function App() {
  return (
    <ToastProvider>
      <SettingsProvider>
        <BatchProvider>
          <DualSubAppContent />
        </BatchProvider>
      </SettingsProvider>
    </ToastProvider>
  );
}

export default App;
