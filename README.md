# DualSub AI

DualSub AI is a modern web application designed to create professional dual-language subtitles. It retrieves or accepts English SRT files, translates them using Google's advanced Gemini models or Local LLMs, and formats them into the ASS (Advanced Substation Alpha) format for a seamless viewing experience.

## Features

### 🤖 AI-Powered Translation
- **Multi-Provider Support**: Switch between **Google Gemini** (`gemini-3-flash`, `pro`) and **Local LLMs** (via OpenAI-compatible endpoints like Ollama, Llama.cpp, LM Studio).
- **Context-Aware**: Generates translation context based on filenames to ensure correct tone and pronoun usage (specifically optimized for Vietnamese pronouns).
- **Smart Caching**: Automatically identifies show titles and caches plot context and character glossaries locally (IndexedDB). This ensures consistency across episodes and saves API tokens.
- **Length Control**: Intelligent retry logic ensures translations fit within readable time constraints, condensing text when necessary.
- **Batch Processing**: Upload and translate multiple subtitle files simultaneously with a visual queue and ZIP export.

### 🔍 Integrated Subtitle Search
- **Providers**: Native support for **OpenSubtitles** and **Subdl**.
- **Security**: API keys for subtitle providers are stored securely in your browser's LocalStorage and are masked in the UI.
- **External Links**: Quick access to manual search on Addic7ed, TVsubtitles, YIFY, and more.

### 🎨 Advanced Styling & Formatting
- **Dual-Language Layouts**:
  - **Stacked**: Both languages at the bottom (e.g., Translation above Original).
  - **Split**: One language at the top, one at the bottom.
- **Style Presets**: Instantly apply professional styles including **Netflix**, **Anime**, **Cinematic**, and **Kodi/TV** defaults.
- **Typography**: Select from standard media player fonts (Arial, Teletext, Trebuchet, etc.) with granular control over colors, sizes, and shadows.
- **Timing Optimization**: Algorithms to prevent subtitle overlap and ensure minimum display durations.

## Installation & Local Setup

### Prerequisites
- **Node.js** (v18 or higher)
- **Google GenAI API Key** (for Gemini features)

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

3.  **Environment Configuration**
    Create a `.env` file in the root directory:
    ```env
    # Required for Gemini features
    API_KEY=your_google_genai_api_key_here
    ```
    *(Note: If using Vite, ensure `process.env.API_KEY` is handled via `define` in `vite.config.ts` or similar bundler configuration)*

4.  **Run Development Server**
    ```bash
    npm run dev
    ```
    Open your browser to `http://localhost:5173` (or the port shown in terminal).

### Running with Local LLMs

To use local models (Llama 3, Gemma 2, Mistral, etc.) instead of Gemini:

1.  **Set up an Inference Server**:
    You need an OpenAI-compatible endpoint. Common options:
    -   **Ollama**: `ollama serve` (Default port 11434)
    -   **Llama.cpp**: `./server -m model.gguf -c 8192 --port 8080`
    -   **LM Studio**: Start Local Server (Default port 1234)

2.  **Configure App**:
    -   Click the **Settings (Cog Icon)** in the top right.
    -   Switch Provider to **Local LLM**.
    -   Enter your endpoint URL (e.g., `http://127.0.0.1:11434/v1/chat/completions` for Ollama).
    -   (Optional) Enter a model name if your server requires it.

## Player Support

The generated `.ass` files allow for complex formatting that standard `.srt` files cannot handle. For the best experience, use a player that fully supports ASS rendering:
- **Windows**: VLC, MPC-HC, PotPlayer.
- **macOS**: IINA, VLC.
- **Linux**: MPV, VLC.
- **Android/TV**: Kodi, Nova Video Player, VLC.

## Technologies

Built with React, TypeScript, Tailwind CSS, IndexedDB, and the Google GenAI SDK.