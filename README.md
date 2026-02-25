# DualSub AI

DualSub AI is a professional-grade web application for creating dual-language subtitles. It combines advanced AI translation (Gemini 3.0 & Local LLMs) with algorithmic synchronization (Dynamic Time Warping) to produce perfectly timed, context-aware subtitles in `.ass` or `.srt` formats.

## Features

### 🧠 Advanced AI Translation
- **Models**: Native support for **Google Gemini 3.0 Flash**, **Gemini 3.0 Pro**, and **Flash Lite**.
- **Local LLM Support**: Connect to your own models (Llama 3, Mistral, Gemma 2) via OpenAI-compatible endpoints (Ollama, LM Studio).
- **Context-Aware**: Automatically identifies shows/movies to generate a **"Show Bible"** (character glossary) and plot context, ensuring consistent character voices and correct pronoun usage (specialized for Vietnamese).
- **Batch Processing**: Concurrent processing pipeline handles large files efficiently with auto-retry logic for quality assurance.

### 🔄 Merge Existing Subtitles
- **Auto-Merge**: Drag & drop a source subtitle (e.g., `Movie.srt`) together with a translated subtitle (e.g., `Movie.vi.srt`). The app automatically pairs them and fixes synchronization issues.
- **Manual Import**: Use the **"Merge Translation"** button on any active file to import a secondary subtitle track (e.g., from a downloaded file).
- **Sync Protection**: Applies **Dynamic Time Warping (DTW)** and **Linear Drift Correction** to external translations, allowing you to combine subtitles from different releases (e.g., Web-DL vs. BluRay) seamlessly.

### ⏱️ Smart Synchronization
- **Linear Drift Correction**: Automatically detects and fixes framerate mismatches (e.g., syncing a 23.976fps source with a 25fps translation).
- **Dynamic Time Warping (DTW)**: Uses advanced sequence alignment algorithms to handle deleted scenes, extra credits, or non-linear timing mismatches without manual intervention.
- **Smart Timing**: Optimizes duration based on reading speed (CPS) and strictly enforces non-overlapping gaps for readability.

### 🔍 Integrated Subtitle Search
- **API Integrations**: Direct search and download from **OpenSubtitles.com** and **Subdl.com**.
- **External Hub**: One-click search link generation for Addic7ed, YIFY, TVsubtitles, and Podnapisi.
- **History**: Local search history with quick-access tag cloud.

### 🎨 Professional Styling
- **Style Editor**: Dedicated "Style" button to toggle the visual editor.
- **Formats**: Export to rich **ASS (Advanced Substation Alpha)** or standard **SRT**.
- **Visual Preview**: Real-time rendering preview of fonts, colors, and shadows.
- **Presets**: One-click styles for **Netflix**, **Anime**, **Cinematic**, and **Kodi**.
- **Layout Control**: Stacked (dual-line) or Split (top/bottom) positioning with granular control over colors, outlines, and shadows.

## Installation & Setup

### Prerequisites
- **Node.js** (v18+)
- **Google GenAI API Key** (Get one at [aistudio.google.com](https://aistudio.google.com/))

### Quick Start

1.  **Clone the repository**
    ```bash
    git clone https://github.com/yourusername/dualsub-ai.git
    cd dualsub-ai
    ```

2.  **Install Dependencies**
    ```bash
    npm install
    ```

3.  **Environment Setup**
    Create a `.env` file in the root directory:
    ```env
    # Default Gemini API Key (Optional if you plan to set it in UI)
    API_KEY=your_google_genai_api_key_here
    ```

4.  **Run Development Server**
    ```bash
    npm run dev
    ```
    Access the app at `http://localhost:5173`.

### Configuration

- **Gemini API Key**: You can set a default key in `.env` or provide a custom key directly in the **Model Settings** (Cog Icon) > **Gemini** provider settings. The UI key overrides the environment variable.
- **Local LLMs**: Switch Provider to **Local LLM** in settings and point to your local inference server (e.g., `http://127.0.0.1:11434/v1/chat/completions`).

## Architecture

- **Frontend**: React 18, TypeScript, Vite.
- **Performance**: 
  - **Web Workers**: Heavy subtitle parsing and merging logic runs off the main thread.
  - **Virtualization**: Efficient rendering of large subtitle lists using `react-virtuoso`.
  - **Optimized Bundle**: Code splitting for fast load times.
- **UI**: Tailwind CSS, Lucide Icons.
- **State/Storage**: IndexedDB (for session & metadata caching).
- **AI/Logic**: Google GenAI SDK, Custom DP algorithms for subtitle alignment.

## License

MIT