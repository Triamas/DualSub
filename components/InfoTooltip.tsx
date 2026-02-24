export const InfoTooltip = ({ text }: { text: string }) => (
    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 p-2.5 bg-zinc-900 dark:bg-zinc-800 text-white text-xs leading-relaxed rounded-lg shadow-xl border border-zinc-700/50 hidden group-hover:block z-[100] pointer-events-none animate-in fade-in slide-in-from-bottom-1 duration-200" role="tooltip">
        {text}
        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-zinc-900 dark:border-t-zinc-800"></div>
    </div>
);
