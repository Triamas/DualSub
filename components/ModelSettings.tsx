import React from 'react';
import { Cpu, X, Settings2, Globe, HelpCircle } from 'lucide-react';
import { ModelConfig } from '../types';
import { AVAILABLE_MODELS, OPENAI_PRESETS } from '../constants';
import { InfoTooltip } from './InfoTooltip';

interface ModelSettingsProps {
    isOpen: boolean;
    onClose: () => void;
    config: ModelConfig;
    onConfigChange: (config: ModelConfig) => void;
    customModelMode: boolean;
    onProviderChange: (provider: ModelConfig['provider']) => void;
    onOpenAIModelChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
}

export const ModelSettings: React.FC<ModelSettingsProps> = ({
    isOpen,
    onClose,
    config,
    onConfigChange,
    customModelMode,
    onProviderChange,
    onOpenAIModelChange
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in" role="dialog" aria-modal="true" aria-labelledby="model-settings-title">
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-xl max-w-lg w-full shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between pb-2 border-b border-zinc-100 dark:border-zinc-800">
                    <h3 id="model-settings-title" className="text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2"><Cpu className="w-5 h-5 text-yellow-500"/> Model Configuration</h3>
                    <button onClick={onClose} aria-label="Close settings"><X className="w-5 h-5 text-zinc-500" /></button>
                </div>
                
                <div className="space-y-4">
                        {/* Provider Selector */}
                        <div>
                            <label className="text-xs font-semibold uppercase text-zinc-500 mb-2 block">AI Provider</label>
                            <div className="grid grid-cols-2 gap-2">
                                <button onClick={() => onProviderChange('gemini')} className={`py-2 px-3 text-sm font-medium rounded-md transition-all border ${config.provider === 'gemini' ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300' : 'bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400'}`}>Gemini (Google)</button>
                                <button onClick={() => onProviderChange('google_nmt')} className={`py-2 px-3 text-sm font-medium rounded-md transition-all border ${config.provider === 'google_nmt' ? 'bg-orange-50 dark:bg-orange-900/30 border-orange-200 dark:border-orange-800 text-orange-700 dark:text-orange-300' : 'bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400'}`}>Google Translate</button>
                                <button onClick={() => onProviderChange('local')} className={`py-2 px-3 text-sm font-medium rounded-md transition-all border ${config.provider === 'local' ? 'bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-800 text-green-700 dark:text-green-300' : 'bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400'}`}>Local (Ollama)</button>
                                <button onClick={() => onProviderChange('openai')} className={`py-2 px-3 text-sm font-medium rounded-md transition-all border ${config.provider === 'openai' ? 'bg-teal-50 dark:bg-teal-900/30 border-teal-200 dark:border-teal-800 text-teal-700 dark:text-teal-300' : 'bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400'}`}>OpenAI / Other</button>
                            </div>
                        </div>

                        {/* Provider Specific Settings */}
                        {config.provider === 'gemini' && (
                        <div className="space-y-2">
                            <label className="text-xs font-semibold uppercase text-zinc-500">Model</label>
                            <select aria-label="Gemini model" value={config.modelName} onChange={(e) => onConfigChange({...config, modelName: e.target.value})} className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded px-3 py-2 text-sm outline-none focus:border-yellow-500">{AVAILABLE_MODELS.map(model => <option key={model.id} value={model.id}>{model.name}</option>)}</select>
                        </div>
                        )}

                        {config.provider === 'google_nmt' && (
                            <div className="space-y-3 bg-zinc-50 dark:bg-zinc-800/50 p-3 rounded-lg border border-zinc-100 dark:border-zinc-800">
                                <div>
                                    <label className="text-xs font-semibold uppercase text-zinc-500">Google Cloud API Key</label>
                                    <div className="flex gap-2">
                                        <div className="bg-zinc-200 dark:bg-zinc-700 p-2 rounded text-zinc-500"><Settings2 className="w-4 h-4"/></div>
                                        <input aria-label="Google Cloud API Key" type="password" value={config.apiKey || ''} onChange={(e) => onConfigChange({...config, apiKey: e.target.value})} className="flex-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded px-3 py-2 text-sm font-mono outline-none focus:border-yellow-500" placeholder="AIzaSy..." />
                                    </div>
                                    <p className="text-[10px] text-zinc-500 mt-1">Requires 'Cloud Translation API' enabled in Google Cloud Console.</p>
                                </div>
                            </div>
                        )}

                        {(config.provider === 'local' || config.provider === 'openai') && (
                        <div className="space-y-3 bg-zinc-50 dark:bg-zinc-800/50 p-3 rounded-lg border border-zinc-100 dark:border-zinc-800">
                                <div>
                                <label className="text-xs font-semibold uppercase text-zinc-500">Endpoint URL</label>
                                <div className="flex gap-2">
                                    <div className="bg-zinc-200 dark:bg-zinc-700 p-2 rounded text-zinc-500"><Globe className="w-4 h-4"/></div>
                                    <input aria-label="Endpoint URL" type="text" value={config.localEndpoint || ''} onChange={(e) => onConfigChange({...config, localEndpoint: e.target.value})} className="flex-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded px-3 py-2 text-sm font-mono outline-none focus:border-yellow-500" placeholder="https://api.example.com/v1/..." />
                                </div>
                                </div>
                                <div>
                                <label className="text-xs font-semibold uppercase text-zinc-500">API Key</label>
                                <div className="flex gap-2">
                                    <div className="bg-zinc-200 dark:bg-zinc-700 p-2 rounded text-zinc-500"><Settings2 className="w-4 h-4"/></div>
                                    <input aria-label="API Key" type="password" value={config.apiKey || ''} onChange={(e) => onConfigChange({...config, apiKey: e.target.value})} className="flex-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded px-3 py-2 text-sm font-mono outline-none focus:border-yellow-500" placeholder="sk-..." />
                                </div>
                                </div>
                                
                                {config.provider === 'openai' ? (
                                <div>
                                    <label className="text-xs font-semibold uppercase text-zinc-500 mb-1 block">Model Selection</label>
                                    <select 
                                        aria-label="Model Selection"
                                        value={customModelMode ? 'custom' : config.modelName} 
                                        onChange={onOpenAIModelChange} 
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
                                                aria-label="Custom Model Name"
                                                type="text" 
                                                value={config.modelName} 
                                                onChange={(e) => onConfigChange({...config, modelName: e.target.value})} 
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
                                        <input aria-label="Model Name" type="text" value={config.modelName} onChange={(e) => onConfigChange({...config, modelName: e.target.value})} className="flex-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded px-3 py-2 text-sm outline-none focus:border-yellow-500" placeholder="e.g. llama3" />
                                    </div>
                                </div>
                                )}
                        </div>
                        )}

                        {/* Generation Parameters (Hidden for NMT) */}
                        {config.provider !== 'google_nmt' && (
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
                                        <span className="font-mono">{config.temperature}</span>
                                    </label>
                                    <input aria-label="Temperature" type="range" min="0" max="2" step="0.1" value={config.temperature} onChange={(e) => onConfigChange({...config, temperature: parseFloat(e.target.value)})} className="w-full h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-yellow-500" />
                                </div>
                                <div>
                                    <label className="text-xs text-zinc-500 flex justify-between items-center mb-1">
                                        <div className="flex items-center gap-1 relative group">
                                            <span>Top P</span>
                                            <HelpCircle className="w-3 h-3 text-zinc-400 cursor-help" />
                                            <InfoTooltip text="Nucleus sampling. Limits the model to the top P percentage of probability mass. Lower values (e.g. 0.5) limit vocabulary to the most likely words. Higher values (e.g. 0.95) allow for a wider vocabulary range." />
                                        </div>
                                        <span className="font-mono">{config.topP}</span>
                                    </label>
                                    <input aria-label="Top P" type="range" min="0" max="1" step="0.05" value={config.topP} onChange={(e) => onConfigChange({...config, topP: parseFloat(e.target.value)})} className="w-full h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-yellow-500" />
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs text-zinc-500 block mb-1 flex items-center gap-1 relative group w-fit">
                                        Max Output Tokens
                                        <HelpCircle className="w-3 h-3 text-zinc-400 cursor-help" />
                                        <InfoTooltip text="The maximum number of tokens the model can generate in a single response. Higher values are safer for large batches of subtitles to prevent cutoff." />
                                    </label>
                                    <input aria-label="Max Output Tokens" type="number" value={config.maxOutputTokens} onChange={(e) => onConfigChange({...config, maxOutputTokens: parseInt(e.target.value)})} className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded px-3 py-2 text-sm outline-none focus:border-yellow-500" />
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
                            <button aria-label="Toggle Simulation Mode" aria-pressed={config.useSimulation} onClick={() => onConfigChange({...config, useSimulation: !config.useSimulation})} className={`w-9 h-5 rounded-full transition-colors relative ${config.useSimulation ? 'bg-purple-600' : 'bg-zinc-300 dark:bg-zinc-600'}`}>
                                <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${config.useSimulation ? 'left-4.5' : 'left-0.5'}`} />
                            </button>
                        </div>
                    </div>

                </div>
                <button onClick={onClose} className="w-full py-2.5 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-lg font-bold hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors">Apply Settings</button>
            </div>
        </div>
    );
};
