import React from 'react';
import { Palette, Layout, ArrowUp, ArrowDown, Type, Eye, Save } from 'lucide-react';
import { AssStyleConfig } from '../types';
import { STYLE_PRESETS, savePreset } from '../services/subtitleUtils';
import { KODI_FONTS } from '../constants';
import { VisualPreview } from './VisualPreview';
import { useToast } from './Toast';

interface StyleEditorProps {
    config: AssStyleConfig;
    onChange: (config: AssStyleConfig) => void;
    onReset: () => void;
    onApplyPreset: (preset: keyof typeof STYLE_PRESETS) => void;
    isOpen: boolean;
    onToggle: () => void;
    targetLang: string;
    sampleOriginal: string;
    sampleTranslated: string;
    selectedSubtitleId?: number;
}

export const StyleEditor = React.memo<StyleEditorProps>(({
    config,
    onChange,
    onReset,
    onApplyPreset,
    isOpen,
    onToggle,
    targetLang,
    sampleOriginal,
    sampleTranslated,
    selectedSubtitleId
}) => {
    // Local state for immediate preview updates
    const [localConfig, setLocalConfig] = React.useState(config);
    const [activePreset, setActivePreset] = React.useState<string | null>('DEFAULT');
    const { addToast } = useToast();
    
    // Sync local state when prop changes (e.g. reset or preset applied)
    React.useEffect(() => {
        setLocalConfig(config);
    }, [config]);

    // Debounce updates to parent
    React.useEffect(() => {
        const timer = setTimeout(() => {
            if (JSON.stringify(localConfig) !== JSON.stringify(config)) {
                onChange(localConfig);
            }
        }, 500);
        return () => clearTimeout(timer);
    }, [localConfig, onChange, config]);

    const handleLocalChange = (newConfig: AssStyleConfig) => {
        setLocalConfig(newConfig);
    };

    const handlePresetClick = (name: string) => {
        setActivePreset(name);
        onApplyPreset(name as any);
    };

    const handleSavePreset = () => {
        if (activePreset) {
            savePreset(activePreset, localConfig);
            addToast(`Saved changes to ${activePreset} preset`, 'success');
        }
    };

    const handleReset = () => {
        onReset();
        setActivePreset('DEFAULT');
    };

    return (
        <>
            {isOpen && (
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-2xl animate-in fade-in slide-in-from-top-4 mb-6">
                    
                    {/* Header / Presets */}
                    <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex flex-wrap items-center gap-3 bg-zinc-50 dark:bg-zinc-900/50">
                        <div className="flex items-center gap-2 mr-auto">
                            <Palette className="w-4 h-4 text-zinc-500" />
                            <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">Style Presets</span>
                        </div>
                        {Object.keys(STYLE_PRESETS).map(name => (
                            <button 
                                key={name} 
                                onClick={() => handlePresetClick(name)} 
                                className={`px-3 py-1.5 text-xs font-bold rounded-full border transition-all ${
                                    activePreset === name 
                                    ? 'bg-zinc-100 dark:bg-zinc-700 border-yellow-500 text-zinc-900 dark:text-white shadow-sm' 
                                    : 'bg-white dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-700 hover:border-yellow-500 dark:hover:border-yellow-500'
                                }`}
                            >
                                {name}
                            </button>
                        ))}
                        <div className="flex items-center gap-2 ml-2 pl-2 border-l border-zinc-200 dark:border-zinc-700">
                            {activePreset && (
                                <button 
                                    onClick={handleSavePreset}
                                    className="px-3 py-1.5 text-xs font-bold rounded-full text-blue-600 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-900 hover:bg-blue-100 dark:hover:bg-blue-900/20 flex items-center gap-1"
                                    title={`Save current settings to ${activePreset}`}
                                >
                                    <Save className="w-3 h-3" /> Save
                                </button>
                            )}
                            <button onClick={handleReset} className="px-3 py-1.5 text-xs font-bold rounded-full text-red-500 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900 hover:bg-red-100 dark:hover:bg-red-900/20">Reset</button>
                        </div>
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
                                            <button onClick={() => handleLocalChange({...localConfig, outputFormat: 'ass'})} className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${localConfig.outputFormat === 'ass' ? 'bg-white dark:bg-zinc-600 shadow-sm text-black dark:text-white' : 'text-zinc-500 hover:text-zinc-900'}`}>ASS (Styled)</button>
                                            <button onClick={() => handleLocalChange({...localConfig, outputFormat: 'srt'})} className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${localConfig.outputFormat === 'srt' ? 'bg-white dark:bg-zinc-600 shadow-sm text-black dark:text-white' : 'text-zinc-500 hover:text-zinc-900'}`}>SRT (Simple)</button>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-zinc-500 mb-1.5 block">Positioning</label>
                                    <div className="flex bg-zinc-100 dark:bg-zinc-800 p-1 rounded-lg">
                                            <button onClick={() => handleLocalChange({...localConfig, layout: 'stacked'})} className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${localConfig.layout === 'stacked' ? 'bg-white dark:bg-zinc-600 shadow-sm text-black dark:text-white' : 'text-zinc-500 hover:text-zinc-900'}`}>Stacked</button>
                                            <button onClick={() => handleLocalChange({...localConfig, layout: 'split'})} className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${localConfig.layout === 'split' ? 'bg-white dark:bg-zinc-600 shadow-sm text-black dark:text-white' : 'text-zinc-500 hover:text-zinc-900'}`}>Split</button>
                                    </div>
                                </div>
                                <div className="md:col-span-2">
                                    <label className="text-xs font-medium text-zinc-500 mb-1.5 block">Top Line Language</label>
                                    <div className="flex bg-zinc-100 dark:bg-zinc-800 p-1 rounded-lg">
                                            <button onClick={() => handleLocalChange({...localConfig, stackOrder: 'primary-top'})} className={`flex-1 py-2 text-xs font-bold rounded-md transition-all flex items-center justify-center gap-2 ${localConfig.stackOrder === 'primary-top' ? 'bg-white dark:bg-zinc-600 shadow-sm text-black dark:text-white' : 'text-zinc-500 hover:text-zinc-900'}`}>
                                            <ArrowUp className="w-3 h-3" /> {targetLang} (Translated)
                                            </button>
                                            <button onClick={() => handleLocalChange({...localConfig, stackOrder: 'secondary-top'})} className={`flex-1 py-2 text-xs font-bold rounded-md transition-all flex items-center justify-center gap-2 ${localConfig.stackOrder === 'secondary-top' ? 'bg-white dark:bg-zinc-600 shadow-sm text-black dark:text-white' : 'text-zinc-500 hover:text-zinc-900'}`}>
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
                                    <select aria-label="Font Family" value={localConfig.fontFamily} onChange={e => handleLocalChange({...localConfig, fontFamily: e.target.value})} className="w-full text-xs font-bold p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 focus:outline-none focus:border-yellow-500 transition-colors">
                                        {KODI_FONTS.map(f => <option key={f} value={f}>{f}</option>)}
                                    </select>
                                </div>
                                <div className="md:col-span-2 grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs font-medium text-zinc-500 mb-1.5 flex justify-between"><span>Outline</span> <span>{localConfig.outlineWidth}px</span></label>
                                        <input aria-label="Outline width" type="range" min="0" max="10" step="0.5" value={localConfig.outlineWidth} onChange={e => handleLocalChange({...localConfig, outlineWidth: parseFloat(e.target.value)})} className="w-full h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-zinc-900 dark:accent-zinc-100" />
                                    </div>
                                    <div>
                                        <label className="text-xs font-medium text-zinc-500 mb-1.5 flex justify-between"><span>Shadow</span> <span>{localConfig.shadowDepth}px</span></label>
                                        <input aria-label="Shadow depth" type="range" min="0" max="10" step="0.5" value={localConfig.shadowDepth} onChange={e => handleLocalChange({...localConfig, shadowDepth: parseFloat(e.target.value)})} className="w-full h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-zinc-900 dark:accent-zinc-100" />
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-medium text-zinc-500 mb-1.5 block">Background Style</label>
                                    <div className="flex bg-zinc-100 dark:bg-zinc-800 p-1 rounded-lg">
                                        <button onClick={() => handleLocalChange({...localConfig, borderStyle: 1})} className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${localConfig.borderStyle === 1 ? 'bg-white dark:bg-zinc-600 shadow-sm text-black dark:text-white' : 'text-zinc-500'}`}>Outline</button>
                                        <button onClick={() => handleLocalChange({...localConfig, borderStyle: 3})} className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${localConfig.borderStyle === 3 ? 'bg-white dark:bg-zinc-600 shadow-sm text-black dark:text-white' : 'text-zinc-500'}`}>Box</button>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-zinc-500 mb-1.5 block">Subtitle Lines</label>
                                    <div className="flex bg-zinc-100 dark:bg-zinc-800 p-1 rounded-lg">
                                        <button onClick={() => handleLocalChange({...localConfig, linesPerSubtitle: 2})} className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${(localConfig.linesPerSubtitle ?? 2) === 2 ? 'bg-white dark:bg-zinc-600 shadow-sm text-black dark:text-white' : 'text-zinc-500'}`}>Multi-line</button>
                                        <button onClick={() => handleLocalChange({...localConfig, linesPerSubtitle: 1})} className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${localConfig.linesPerSubtitle === 1 ? 'bg-white dark:bg-zinc-600 shadow-sm text-black dark:text-white' : 'text-zinc-500'}`}>Single Line</button>
                                    </div>
                                </div>
                            </div>

                            {/* Vertical Positioning Controls */}
                            {localConfig.layout === 'stacked' && (
                                <div className="grid grid-cols-2 gap-4 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                                    <div>
                                        <label className="text-xs font-medium text-zinc-500 mb-1.5 flex justify-between"><span>Bottom Spacing</span> <span>{localConfig.screenPadding ?? 50}px</span></label>
                                        <input aria-label="Bottom Spacing" type="range" min="0" max="200" step="5" value={localConfig.screenPadding ?? 50} onChange={e => handleLocalChange({...localConfig, screenPadding: parseInt(e.target.value)})} className="w-full h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-zinc-900 dark:accent-zinc-100" />
                                    </div>
                                    <div>
                                        <label className="text-xs font-medium text-zinc-500 mb-1.5 flex justify-between"><span>Vertical Gap</span> <span>{localConfig.verticalGap ?? 15}px</span></label>
                                        <input aria-label="Vertical Gap" type="range" min="0" max="100" step="1" value={localConfig.verticalGap ?? 15} onChange={e => handleLocalChange({...localConfig, verticalGap: parseInt(e.target.value)})} className="w-full h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-zinc-900 dark:accent-zinc-100" />
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Visual Preview (Moved Below Typography) */}
                        <div className="bg-zinc-100 dark:bg-black/40 rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800 p-4">
                             <div className="flex items-center justify-between mb-3">
                                 <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                                    <Eye className="w-4 h-4" /> Live Preview
                                </h4>
                                <p className="text-[10px] text-zinc-500">
                                    Line #{selectedSubtitleId || '-'}
                                </p>
                             </div>
                            <VisualPreview 
                                config={localConfig} 
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
                                        <span className="text-[10px] font-mono text-zinc-400">{localConfig.secondary.color}</span>
                                        <input aria-label="Original text color" type="color" value={localConfig.secondary.color} onChange={e => handleLocalChange({...localConfig, secondary: {...localConfig.secondary, color: e.target.value}})} className="w-6 h-6 rounded cursor-pointer border-0 p-0 overflow-hidden" />
                                    </div>
                                </div>
                                    <div>
                                    <label className="text-[10px] text-zinc-400 mb-1 block flex justify-between"><span>Size</span> <span>{localConfig.secondary.fontSize}px</span></label>
                                    <input aria-label="Original text size" type="range" min="10" max="100" value={localConfig.secondary.fontSize} onChange={e => handleLocalChange({...localConfig, secondary: {...localConfig.secondary, fontSize: parseInt(e.target.value)}})} className="w-full h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-yellow-500" />
                                </div>
                            </div>

                            {/* Primary Color Control (Translated Text) - MOVED SECOND */}
                            <div className="bg-zinc-50 dark:bg-zinc-800/30 p-4 rounded-xl border border-zinc-100 dark:border-zinc-800">
                                <div className="flex items-center justify-between mb-3">
                                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Translated Text</label>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] font-mono text-zinc-400">{localConfig.primary.color}</span>
                                        <input aria-label="Translated text color" type="color" value={localConfig.primary.color} onChange={e => handleLocalChange({...localConfig, primary: {...localConfig.primary, color: e.target.value}})} className="w-6 h-6 rounded cursor-pointer border-0 p-0 overflow-hidden" />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[10px] text-zinc-400 mb-1 block flex justify-between"><span>Size</span> <span>{localConfig.primary.fontSize}px</span></label>
                                    <input aria-label="Translated text size" type="range" min="10" max="100" value={localConfig.primary.fontSize} onChange={e => handleLocalChange({...localConfig, primary: {...localConfig.primary, fontSize: parseInt(e.target.value)}})} className="w-full h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-blue-500" />
                                </div>
                            </div>
                        </div>

                    </div>
                </div>
            )}
        </>
    );
});
