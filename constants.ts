export const BATCH_SIZE = 40;  
export const CONCURRENCY = 8;  
export const OVERLAP_SIZE = 5; 

export const AVAILABLE_LANGUAGES = [
    "Arabic", "Bulgarian", "Chinese (Simplified)", "Chinese (Traditional)", "Croatian", "Czech", 
    "Danish", "Dutch", "Estonian", "Finnish", "French", "German", "Greek", "Hindi", "Hungarian", 
    "Indonesian", "Irish", "Italian", "Japanese", "Korean", "Latvian", "Lithuanian", "Maltese", 
    "Polish", "Portuguese", "Romanian", "Slovak", "Slovenian", "Spanish", "Swedish", "Thai", 
    "Turkish", "Ukrainian", "Vietnamese"
];

export const AVAILABLE_MODELS = [
    { id: 'gemini-3-flash-preview', name: 'Gemini 3.0 Flash (Recommended)' },
    { id: 'gemini-3-pro-preview', name: 'Gemini 3.0 Pro (High Intelligence)' },
    { id: 'gemini-flash-lite-latest', name: 'Gemini 2.5 Flash Lite (Fastest)' }
];

export const OPENAI_PRESETS = [
    { label: "OpenAI", options: [
        { id: "gpt-4o", name: "GPT-4o" },
        { id: "gpt-4-turbo", name: "GPT-4 Turbo" },
        { id: "gpt-3.5-turbo", name: "GPT-3.5 Turbo" }
    ]},
    { label: "DeepSeek", options: [
        { id: "deepseek-chat", name: "DeepSeek Chat (V3)" },
        { id: "deepseek-reasoner", name: "DeepSeek Reasoner (R1)" }
    ]},
    { label: "Mistral", options: [
        { id: "mistral-large-latest", name: "Mistral Large" },
        { id: "mistral-small-latest", name: "Mistral Small" }
    ]},
    { label: "Groq (Llama)", options: [
        { id: "llama3-70b-8192", name: "Llama 3 70B" },
        { id: "llama3-8b-8192", name: "Llama 3 8B" }
    ]},
    { label: "Anthropic (via Proxy)", options: [
        { id: "claude-3-opus-20240229", name: "Claude 3 Opus" },
        { id: "claude-3-5-sonnet-20240620", name: "Claude 3.5 Sonnet" }
    ]}
];

export const KODI_FONTS = [
    "Arial", "Arial Narrow", "Arial Black", "Comic Sans MS", "Courier New", 
    "DejaVu Sans", "Georgia", "Impact", "Times New Roman", "Trebuchet MS", "Verdana", "Teletext"
];
