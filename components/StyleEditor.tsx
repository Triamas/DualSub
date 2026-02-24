import React from 'react';
import { Palette, Layout, ArrowUp, ArrowDown, Type, Eye, Settings2 } from 'lucide-react';
import { AssStyleConfig } from '../types';
import { STYLE_PRESETS } from '../services/subtitleUtils';
import { KODI_FONTS } from '../constants';
import { VisualPreview } from './VisualPreview';

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
    return (
        <>
            <div className="flex justify-end mb-4">
                 <button 
                    onClick={onToggle}
                    aria-label="Open style settings"
                    aria-expanded={isOpen}
                    className={`px-4 py-2 rounded-xl transition-all border flex items-center gap-2 ${isOpen ? 'bg-zinc-200 dark:bg-zinc-200 text-black border-zinc-300' : 'bg-zinc-100 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 text-zinc-500'}`}
                >
                    <Settings2 className="w-5 h-5" />
                    <span className="text-sm font-medium">Style Editor</span>
                </button>
            </div>

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
                                onClick={() => onApplyPreset(name as any)} 
                                className="px-3 py-1.5 text-xs font-bold rounded-full bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-700 hover:border-yellow-500 dark:hover:border-yellow-500 transition-all"
                            >
                                {name}
                            </button>
                        ))}
                        <button onClick={onReset} className="ml-2 px-3 py-1.5 text-xs font-bold rounded-full text-red-500 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900 hover:bg-red-100 dark:hover:bg-red-900/20">Reset</button>
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
                                            <button onClick={() => onChange({...config, outputFormat: 'ass'})} className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${config.outputFormat === 'ass' ? 'bg-white dark:bg-zinc-600 shadow-sm text-black dark:text-white' : 'text-zinc-500 hover:text-zinc-900'}`}>ASS (Styled)</button>
                                            <button onClick={() => onChange({...config, outputFormat: 'srt'})} className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${config.outputFormat === 'srt' ? 'bg-white dark:bg-zinc-600 shadow-sm text-black dark:text-white' : 'text-zinc-500 hover:text-zinc-900'}`}>SRT (Simple)</button>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-zinc-500 mb-1.5 block">Positioning</label>
                                    <div className="flex bg-zinc-100 dark:bg-zinc-800 p-1 rounded-lg">
                                            <button onClick={() => onChange({...config, layout: 'stacked'})} className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${config.layout === 'stacked' ? 'bg-white dark:bg-zinc-600 shadow-sm text-black dark:text-white' : 'text-zinc-500 hover:text-zinc-900'}`}>Stacked</button>
                                            <button onClick={() => onChange({...config, layout: 'split'})} className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${config.layout === 'split' ? 'bg-white dark:bg-zinc-600 shadow-sm text-black dark:text-white' : 'text-zinc-500 hover:text-zinc-900'}`}>Split</button>
                                    </div>
                                </div>
                                <div className="md:col-span-2">
                                    <label className="text-xs font-medium text-zinc-500 mb-1.5 block">Top Line Language</label>
                                    <div className="flex bg-zinc-100 dark:bg-zinc-800 p-1 rounded-lg">
                                            <button onClick={() => onChange({...config, stackOrder: 'primary-top'})} className={`flex-1 py-2 text-xs font-bold rounded-md transition-all flex items-center justify-center gap-2 ${config.stackOrder === 'primary-top' ? 'bg-white dark:bg-zinc-600 shadow-sm text-black dark:text-white' : 'text-zinc-500 hover:text-zinc-900'}`}>
                                            <ArrowUp className="w-3 h-3" /> {targetLang} (Translated)
                                            </button>
                                            <button onClick={() => onChange({...config, stackOrder: 'secondary-top'})} className={`flex-1 py-2 text-xs font-bold rounded-md transition-all flex items-center justify-center gap-2 ${config.stackOrder === 'secondary-top' ? 'bg-white dark:bg-zinc-600 shadow-sm text-black dark:text-white' : 'text-zinc-500 hover:text-zinc-900'}`}>
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
                                    <select aria-label="Font Family" value={config.fontFamily} onChange={e => onChange({...config, fontFamily: e.target.value})} className="w-full text-xs font-bold p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 focus:outline-none focus:border-yellow-500 transition-colors">
                                        {KODI_FONTS.map(f => <option key={f} value={f}>{f}</option>)}
                                    </select>
                                </div>
                                <div className="md:col-span-2 grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs font-medium text-zinc-500 mb-1.5 flex justify-between"><span>Outline</span> <span>{config.outlineWidth}px</span></label>
                                        <input aria-label="Outline width" type="range" min="0" max="10" step="0.5" value={config.outlineWidth} onChange={e => onChange({...config, outlineWidth: parseFloat(e.target.value)})} className="w-full h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-zinc-900 dark:accent-zinc-100" />
                                    </div>
                                    <div>
                                        <label className="text-xs font-medium text-zinc-500 mb-1.5 flex justify-between"><span>Shadow</span> <span>{config.shadowDepth}px</span></label>
                                        <input aria-label="Shadow depth" type="range" min="0" max="10" step="0.5" value={config.shadowDepth} onChange={e => onChange({...config, shadowDepth: parseFloat(e.target.value)})} className="w-full h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-zinc-900 dark:accent-zinc-100" />
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-medium text-zinc-500 mb-1.5 block">Background Style</label>
                                    <div className="flex bg-zinc-100 dark:bg-zinc-800 p-1 rounded-lg">
                                        <button onClick={() => onChange({...config, borderStyle: 1})} className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${config.borderStyle === 1 ? 'bg-white dark:bg-zinc-600 shadow-sm text-black dark:text-white' : 'text-zinc-500'}`}>Outline</button>
                                        <button onClick={() => onChange({...config, borderStyle: 3})} className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${config.borderStyle === 3 ? 'bg-white dark:bg-zinc-600 shadow-sm text-black dark:text-white' : 'text-zinc-500'}`}>Box</button>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-zinc-500 mb-1.5 block">Subtitle Lines</label>
                                    <div className="flex bg-zinc-100 dark:bg-zinc-800 p-1 rounded-lg">
                                        <button onClick={() => onChange({...config, linesPerSubtitle: 2})} className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${(config.linesPerSubtitle ?? 2) === 2 ? 'bg-white dark:bg-zinc-600 shadow-sm text-black dark:text-white' : 'text-zinc-500'}`}>Multi-line</button>
                                        <button onClick={() => onChange({...config, linesPerSubtitle: 1})} className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${config.linesPerSubtitle === 1 ? 'bg-white dark:bg-zinc-600 shadow-sm text-black dark:text-white' : 'text-zinc-500'}`}>Single Line</button>
                                    </div>
                                </div>
                            </div>

                            {/* Vertical Positioning Controls */}
                            {config.layout === 'stacked' && (
                                <div className="grid grid-cols-2 gap-4 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                                    <div>
                                        <label className="text-xs font-medium text-zinc-500 mb-1.5 flex justify-between"><span>Bottom Spacing</span> <span>{config.screenPadding ?? 50}px</span></label>
                                        <input aria-label="Bottom Spacing" type="range" min="0" max="200" step="5" value={config.screenPadding ?? 50} onChange={e => onChange({...config, screenPadding: parseInt(e.target.value)})} className="w-full h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-zinc-900 dark:accent-zinc-100" />
                                    </div>
                                    <div>
                                        <label className="text-xs font-medium text-zinc-500 mb-1.5 flex justify-between"><span>Vertical Gap</span> <span>{config.verticalGap ?? 15}px</span></label>
                                        <input aria-label="Vertical Gap" type="range" min="0" max="100" step="1" value={config.verticalGap ?? 15} onChange={e => onChange({...config, verticalGap: parseInt(e.target.value)})} className="w-full h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-zinc-900 dark:accent-zinc-100" />
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
                                config={config} 
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
                                        <span className="text-[10px] font-mono text-zinc-400">{config.secondary.color}</span>
                                        <input aria-label="Original text color" type="color" value={config.secondary.color} onChange={e => onChange({...config, secondary: {...config.secondary, color: e.target.value}})} className="w-6 h-6 rounded cursor-pointer border-0 p-0 overflow-hidden" />
                                    </div>
                                </div>
                                    <div>
                                    <label className="text-[10px] text-zinc-400 mb-1 block flex justify-between"><span>Size</span> <span>{config.secondary.fontSize}px</span></label>
                                    <input aria-label="Original text size" type="range" min="10" max="100" value={config.secondary.fontSize} onChange={e => onChange({...config, secondary: {...config.secondary, fontSize: parseInt(e.target.value)}})} className="w-full h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-yellow-500" />
                                </div>
                            </div>

                            {/* Primary Color Control (Translated Text) - MOVED SECOND */}
                            <div className="bg-zinc-50 dark:bg-zinc-800/30 p-4 rounded-xl border border-zinc-100 dark:border-zinc-800">
                                <div className="flex items-center justify-between mb-3">
                                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Translated Text</label>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] font-mono text-zinc-400">{config.primary.color}</span>
                                        <input aria-label="Translated text color" type="color" value={config.primary.color} onChange={e => onChange({...config, primary: {...config.primary, color: e.target.value}})} className="w-6 h-6 rounded cursor-pointer border-0 p-0 overflow-hidden" />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[10px] text-zinc-400 mb-1 block flex justify-between"><span>Size</span> <span>{config.primary.fontSize}px</span></label>
                                    <input aria-label="Translated text size" type="range" min="10" max="100" value={config.primary.fontSize} onChange={e => onChange({...config, primary: {...config.primary, fontSize: parseInt(e.target.value)}})} className="w-full h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-blue-500" />
                                </div>
                            </div>
                        </div>

                    </div>
                </div>
            )}
        </>
    );
});
