
export interface SubtitleLine {
  id: number;
  startTime: string; // Format: 00:00:00,000
  endTime: string;   // Format: 00:00:00,000
  originalText: string;
  translatedText?: string;
}

export interface UnifiedSubtitle {
  id: string;
  provider: 'OpenSubtitles' | 'Subdl';
  title: string;
  language: string;
  format: string;
  downloadCount?: number;
  score?: number; // Votes or rating
  uploadDate?: string;
  hearingImpaired?: boolean;
  fps?: number;
  
  // Provider specific for download
  downloadUrl?: string; // For Subdl (direct)
  fileId?: number;      // For OpenSubtitles (needs step 2)
  fileName: string;
}

export interface OpenSubtitlesResult {
  id: string;
  attributes: {
    language: string;
    download_count: number;
    new_download_count: number;
    hearing_impaired: boolean;
    hd: boolean;
    format: string;
    fps: number;
    votes: number;
    points: number;
    ratings: number;
    from_trusted: boolean;
    foreign_parts_only: boolean;
    upload_date: string;
    release: string; // File name mostly
    files: {
      file_id: number;
      cd_number: number;
      file_name: string;
    }[];
  };
}

export interface LogEntry {
    timestamp: number;
    type: 'info' | 'request' | 'response' | 'error';
    message: string;
    data?: unknown;
}

export interface BatchItem {
    id: string;
    fileName: string;
    originalFile?: File; // Optional if from search
    subtitles: SubtitleLine[];
    status: 'pending' | 'translating' | 'completed' | 'error';
    progress: number;
    message?: string;
    context?: string; // Specific context for this file
    showBible?: string; // Character mappings and pronouns
    logs: LogEntry[]; // Realtime logs
}

export enum TabView {
  UPLOAD = 'UPLOAD',
  SEARCH = 'SEARCH',
}

export interface AssStyleConfig {
    outputFormat: 'ass' | 'srt'; // New field for Export Pattern
    layout: 'stacked' | 'split'; // Stacked (both bottom) or Split (one top, one bottom)
    stackOrder: 'primary-top' | 'secondary-top'; // Which language sits on top in stacked mode
    primary: {
        color: string;
        fontSize: number;
    };
    secondary: {
        color: string;
        fontSize: number;
    };
    outlineWidth: number;
    shadowDepth: number;
    borderStyle: 1 | 3; // 1=Outline+Shadow, 3=Opaque Box
    fontFamily: string;
    linesPerSubtitle?: 1 | 2; // 1 = Single Line (Squash), 2 = Standard (Max 2 lines)
    screenPadding?: number; // Distance from bottom of screen (default 50)
    verticalGap?: number; // Gap between subtitle blocks (default 15)
}

export interface ModelConfig {
    provider: 'gemini' | 'local' | 'google_nmt' | 'openai'; // Provider switch
    modelName: string; // Used for Gemini model ID or Local model ID
    temperature: number;
    topP: number;
    topK: number;
    maxOutputTokens: number;
    useSimulation?: boolean; 
    localEndpoint?: string; // URL for local provider
    apiKey?: string; // Optional API Key for Cloud providers (Google NMT/OpenAI)
}