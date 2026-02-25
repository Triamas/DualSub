import React, { useCallback } from 'react';
import { Virtuoso } from 'react-virtuoso';
import { BatchItem, SubtitleLine } from '../types';

interface SubtitleEditorProps {
    activeItem: BatchItem | undefined;
    previewLineId: number | null;
    setPreviewLineId: (id: number | null) => void;
}

interface RowContext {
    previewLineId: number | null;
    setPreviewLineId: (id: number | null) => void;
}

const SubtitleRow = React.memo(({ sub, isSelected, onClick }: { sub: SubtitleLine, isSelected: boolean, onClick: () => void }) => {
    return (
        <div 
            id={`sub-${sub.id}`}
            onClick={onClick}
            className={`grid grid-cols-[80px_80px_1fr_1fr] gap-4 px-4 py-2 border-b border-zinc-100 dark:border-zinc-800/50 cursor-pointer transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50 items-start ${isSelected ? 'bg-yellow-50 dark:bg-yellow-500/10' : ''}`}
            role="row"
            aria-selected={isSelected}
            tabIndex={0}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onClick();
                }
            }}
        >
            <div className="font-mono text-xs text-zinc-400 pt-0.5">{sub.startTime.split(',')[0]}</div>
            <div className="font-mono text-xs text-zinc-400 pt-0.5">{sub.endTime.split(',')[0]}</div>
            <div className="text-xs text-zinc-600 dark:text-zinc-400 leading-tight">{sub.originalText}</div>
            <div className={`text-xs leading-tight font-medium ${sub.translatedText ? 'text-zinc-900 dark:text-zinc-200' : 'text-zinc-300 dark:text-zinc-700 italic'}`}>
                {sub.translatedText || '-'}
            </div>
        </div>
    );
}, (prevProps, nextProps) => {
    return (
        prevProps.isSelected === nextProps.isSelected &&
        prevProps.sub === nextProps.sub
    );
});

export const SubtitleEditor = React.memo<SubtitleEditorProps>(({
    activeItem,
    previewLineId,
    setPreviewLineId
}) => {
    
    const itemContent = useCallback((_index: number, sub: SubtitleLine, context: RowContext) => {
        return (
            <SubtitleRow 
                sub={sub} 
                isSelected={context.previewLineId === sub.id} 
                onClick={() => context.setPreviewLineId(sub.id)} 
            />
        );
    }, []);

    if (!activeItem) return null;

    return (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl flex flex-col h-[600px] overflow-hidden shadow-sm">
            <div className="p-3 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 flex justify-between items-center flex-shrink-0">
                <h3 className="font-semibold text-sm">Live Transcript</h3>
                <span className="text-xs text-zinc-500">{activeItem.subtitles.length} lines</span>
            </div>
            {/* Header Row */}
            <div className="grid grid-cols-[80px_80px_1fr_1fr] gap-4 px-4 py-2 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/30 text-[10px] font-bold text-zinc-400 uppercase tracking-wider flex-shrink-0">
                <div>Start</div>
                <div>End</div>
                <div>Source</div>
                <div>Target</div>
            </div>
            <div className="flex-1 min-h-0">
                <Virtuoso<SubtitleLine, RowContext>
                    style={{ height: '100%' }}
                    data={activeItem.subtitles}
                    context={{ previewLineId, setPreviewLineId }}
                    itemContent={itemContent}
                />
            </div>
        </div>
    );
});
