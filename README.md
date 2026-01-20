# DualSub AI

DualSub AI is a modern web application designed to create professional dual-language subtitles. It retrieves or accepts English SRT files, translates them using Google's advanced Gemini models, and formats them into the ASS (Advanced Substation Alpha) format for a seamless viewing experience.

## Features

### 🤖 AI-Powered Translation
- **Engine**: Powered by Google Gemini (`gemini-3-flash-preview`).
- **Context-Aware**: Generates translation context based on filenames to ensure correct tone and pronoun usage (specifically optimized for Vietnamese pronouns).
- **Length Control**: Intelligent retry logic ensures translations fit within readable time constraints, condensing text when necessary.

### 🔍 Integrated Subtitle Search
- **Providers**: Native support for **OpenSubtitles** and **Subdl**.
- **Security**: API keys for subtitle providers are stored securely in your browser's LocalStorage and are masked in the UI.
- **External Links**: Quick access to manual search on Subscene, Addic7ed, YIFY, and more.

### 🎨 Advanced Styling & Formatting
- **Dual-Language Layouts**:
  - **Stacked**: Both languages at the bottom (e.g., Translation above Original).
  - **Split**: One language at the top, one at the bottom.
- **Customization**: Granular control over font colors, sizes, and vertical stacking order.
- **Timing Optimization**: Algorithms to prevent subtitle overlap and ensure minimum display durations.

### ⚡ Performance
- **Batch Processing**: Handles large subtitle files efficiently using concurrent requests.
- **Resume Capability**: Skips already translated lines if the process is paused.

## Usage Guide

1.  **Load Subtitles**:
    -   Navigate to **Upload File** to use a local `.srt` file.
    -   Or use **Search Subtitles** to find and download subtitles directly within the app.
2.  **Configure Translation**:
    -   Select your **Target Language** (e.g., Vietnamese, Spanish, German).
    -   Use the **Auto-Detect** button to let AI summarize the movie plot/context for better translation accuracy.
3.  **Translate**:
    -   Click **Translate** to start. You can monitor progress in real-time.
4.  **Style & Export**:
    -   Click the **Settings** (slider icon) to adjust colors and layout.
    -   Preview the result in the embedded viewer.
    -   Click **Download .ass File** to save your dual-language subtitles.

## Player Support

The generated `.ass` files allow for complex formatting that standard `.srt` files cannot handle. For the best experience, use a player that fully supports ASS rendering:
- **Windows**: VLC, MPC-HC, PotPlayer.
- **macOS**: IINA, VLC.
- **Linux**: MPV, VLC.

## API Configuration

- **Gemini API**: The application requires a Google GenAI API key set in the environment (`process.env.API_KEY`).
- **Subtitle Search**: To use the search feature, enter your personal API keys for OpenSubtitles or Subdl in the settings panel of the Search tab.

## Technologies

Built with React, TypeScript, Tailwind CSS, and the Google GenAI SDK.
