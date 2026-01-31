
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

export interface BatchItem {
    id: string;
    fileName: string;
    originalFile?: File; // Optional if from search
    subtitles: SubtitleLine[];
    status: 'pending' | 'translating' | 'completed' | 'error';
    progress: number;
    message?: string;
    context?: string; // Specific context for this file
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
}

export interface ModelConfig {
    modelName: string;
    temperature: number;
    topP: number;
    topK: number;
    maxOutputTokens: number;
}