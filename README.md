# DualSub AI

DualSub AI is a professional-grade web application for creating dual-language subtitles. It combines advanced AI translation (Gemini 3.0 & Local LLMs) with algorithmic synchronization (Dynamic Time Warping) to produce perfectly timed, context-aware subtitles in `.ass` or `.srt` formats.

## Features

### 🧠 Advanced AI Translation
- **Models**: Native support for **Google Gemini 3.0 Flash**, **Gemini 3.0 Pro**, and **Flash Lite**.
- **Local LLM Support**: Connect to your own models (Llama 3, Mistral, Gemma 2) via OpenAI-compatible endpoints (Ollama, LM Studio).
- **Context-Aware**: Automatically identifies shows/movies to generate a **"Show Bible"** (character glossary) and plot context, ensuring consistent character voices and correct pronoun usage (specialized for Vietnamese).
- **Batch Processing**: Concurrent processing pipeline handles large files efficiently with auto-retry logic for quality assurance.

### ⏱️ Smart Synchronization
- **Linear Drift Correction**: Automatically detects and fixes framerate mismatches (e.g., syncing a 23.976fps source with a 25fps translation).
- **Dynamic Time Warping (DTW)**: Uses advanced sequence alignment algorithms to handle deleted scenes, extra credits, or non-linear timing mismatches without manual intervention.
- **Smart Timing**: Optimizes duration based on reading speed (CPS) and strictly enforces non-overlapping gaps for readability.

### 🔍 Integrated Subtitle Search
- **API Integrations**: Direct search and download from **OpenSubtitles.com** and **Subdl.com**.
- **External Hub**: One-click search link generation for Addic7ed, YIFY, TVsubtitles, and Podnapisi.
- **History**: Local search history with quick-access tag cloud.

### 🎨 Professional Styling
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
    # Required for Gemini translation features
    API_KEY=your_google_genai_api_key_here
    ```

4.  **Run Development Server**
    ```bash
    npm run dev
    ```
    Access the app at `http://localhost:5173`.

### Using Local LLMs (Ollama / LM Studio)

1.  Start your local inference server (e.g., `ollama serve`).
2.  In DualSub AI, click the **Settings (Cog Icon)**.
3.  Switch Provider to **Local LLM**.
4.  Set the endpoint (default: `http://127.0.0.1:11434/v1/chat/completions` for Ollama).

## Architecture

- **Frontend**: React 19, TypeScript, Vite.
- **UI**: Tailwind CSS, Lucide Icons.
- **State/Storage**: IndexedDB (for session & metadata caching).
- **AI/Logic**: Google GenAI SDK, Custom DP algorithms for subtitle alignment.

## License

MIT