import React from 'react';
import { Upload, FileText, RefreshCw, Trash2 } from 'lucide-react';
import { BatchItem } from '../types';

interface BatchQueueProps {
    batchItems: BatchItem[];
    activeItemId: string | null;
    setActiveItemId: (id: string | null) => void;
    onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onRemoveItem: (id: string) => void;
    onClearAll: () => void;
}

export const BatchQueue = React.memo<BatchQueueProps>(({
    batchItems,
    activeItemId,
    setActiveItemId,
    onFileUpload,
    onRemoveItem,
    onClearAll
}) => {
    return (
        <div 
            className={`relative border-2 border-dashed rounded-2xl p-8 transition-all duration-300 text-center group overflow-hidden focus-within:ring-2 focus-within:ring-yellow-500 ${batchItems.length > 0 ? 'border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/20' : 'border-zinc-300 dark:border-zinc-700 hover:border-yellow-500/50 hover:bg-zinc-100 dark:hover:bg-zinc-900/50'}`}
            tabIndex={0}
            aria-label="File upload area. Drop subtitles here or click to upload."
        >
            <input 
                type="file" 
                accept=".srt,.ass,.ssa,.vtt" 
                multiple 
                onChange={onFileUpload}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                aria-label="Upload subtitle files"
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
                             <button onClick={onClearAll} className="text-[10px] font-bold text-red-500 uppercase tracking-wider">Clear</button>
                             <button className="text-[10px] font-bold text-yellow-600 uppercase tracking-wider relative">
                                Add +
                                <input type="file" multiple onChange={onFileUpload} className="absolute inset-0 opacity-0 cursor-pointer" aria-label="Add more files" />
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
                                <div className="flex-1 min-w-0 text-left">
                                    <p className="text-sm font-medium truncate text-zinc-900 dark:text-zinc-200">{item.fileName}</p>
                                    {item.status === 'translating' ? (
                                        <div className="h-1 bg-zinc-200 dark:bg-zinc-700 rounded-full mt-2 overflow-hidden">
                                            <div className="h-full bg-yellow-500 transition-all duration-300" style={{width: `${item.progress}%`}} />
                                        </div>
                                    ) : (
                                        <p className="text-[10px] text-zinc-500 truncate">{item.message}</p>
                                    )}
                                </div>
                                <button onClick={(e) => {e.stopPropagation(); onRemoveItem(item.id)}} aria-label={`Remove ${item.fileName}`} className="text-zinc-400 hover:text-red-500 p-1"><Trash2 className="w-3.5 h-3.5" /></button>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
});
