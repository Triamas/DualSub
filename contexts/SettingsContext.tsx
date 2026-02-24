import React, { createContext, useContext, useState, useEffect } from 'react';
import { ModelConfig, AssStyleConfig } from '../types';
import { STYLE_PRESETS } from '../services/subtitleUtils';

interface SettingsContextType {
    theme: string;
    setTheme: (theme: string) => void;
    targetLang: string;
    setTargetLang: (lang: string) => void;
    autoContext: boolean;
    setAutoContext: (val: boolean) => void;
    autoBible: boolean;
    setAutoBible: (val: boolean) => void;
    smartTiming: boolean;
    setSmartTiming: (val: boolean) => void;
    modelConfig: ModelConfig;
    setModelConfig: (config: ModelConfig) => void;
    styleConfig: AssStyleConfig;
    setStyleConfig: (config: AssStyleConfig) => void;
    customModelMode: boolean;
    setCustomModelMode: (mode: boolean) => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    // Theme
    const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');

    // Language
    const [targetLang, setTargetLang] = useState<string>(() => localStorage.getItem('target_language') || 'Vietnamese');

    // Toggles
    const [autoContext, setAutoContext] = useState(true);
    const [autoBible, setAutoBible] = useState(true);
    const [smartTiming, setSmartTiming] = useState(true);

    // Model Config
    const [modelConfig, setModelConfig] = useState<ModelConfig>({
        provider: 'gemini',
        modelName: 'gemini-3-flash-preview',
        temperature: 0.3,
        topP: 0.95,
        topK: 40,
        maxOutputTokens: 8192,
        useSimulation: false,
        localEndpoint: 'http://127.0.0.1:8080/v1/chat/completions',
        apiKey: ''
    });

    const [customModelMode, setCustomModelMode] = useState(false);

    // Style Config
    const [styleConfig, setStyleConfig] = useState<AssStyleConfig>(() => {
        try {
            const saved = localStorage.getItem('user_style_config');
            return saved ? JSON.parse(saved) : STYLE_PRESETS.DEFAULT;
        } catch {
            return STYLE_PRESETS.DEFAULT;
        }
    });

    // Effects
    useEffect(() => {
        if (theme === 'dark') {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
        localStorage.setItem('theme', theme);
    }, [theme]);

    useEffect(() => {
        localStorage.setItem('target_language', targetLang);
    }, [targetLang]);

    useEffect(() => {
        localStorage.setItem('user_style_config', JSON.stringify(styleConfig));
    }, [styleConfig]);

    return (
        <SettingsContext.Provider value={{
            theme, setTheme,
            targetLang, setTargetLang,
            autoContext, setAutoContext,
            autoBible, setAutoBible,
            smartTiming, setSmartTiming,
            modelConfig, setModelConfig,
            styleConfig, setStyleConfig,
            customModelMode, setCustomModelMode
        }}>
            {children}
        </SettingsContext.Provider>
    );
};

export const useSettings = () => {
    const context = useContext(SettingsContext);
    if (!context) {
        throw new Error('useSettings must be used within a SettingsProvider');
    }
    return context;
};
