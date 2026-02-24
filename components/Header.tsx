import React from 'react';
import { FileText, Moon, Sun, Cog } from 'lucide-react';

interface HeaderProps {
    theme: string;
    toggleTheme: () => void;
    onOpenSettings: () => void;
}

export const Header = React.memo<HeaderProps>(({ theme, toggleTheme, onOpenSettings }) => {
    return (
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
                    <button onClick={toggleTheme} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`} className="p-2.5 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white rounded-full bg-zinc-100 dark:bg-zinc-800/30 hover:bg-zinc-200 dark:hover:bg-zinc-800">
                        {theme === 'dark' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
                    </button>
                    <button onClick={onOpenSettings} aria-label="Open model settings" className="p-2.5 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white rounded-full bg-zinc-100 dark:bg-zinc-800/30 hover:bg-zinc-200 dark:hover:bg-zinc-800">
                        <Cog className="w-5 h-5" />
                    </button>
                </div>
            </div>
        </header>
    );
});
