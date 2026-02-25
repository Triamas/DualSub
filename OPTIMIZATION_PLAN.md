# Optimization & Refactoring Plan

## 1. Architecture & Maintainability

### **Component Decomposition (High Priority)** COMPLETED
`App.tsx` has grown too large (>1500 lines) and violates the Single Responsibility Principle. It mixes business logic, UI rendering, and state management.
- **Action**: Extract UI sections into separate components:
  - `components/Header.tsx`
  - `components/BatchQueue.tsx` (File list & status)
  - `components/StyleEditor.tsx` (The visual style configuration panel)
  - `components/ModelSettings.tsx` (The settings modal)
  - `components/VisualPreview.tsx` (Move out of App.tsx)
  - `components/SubtitleEditor.tsx` (The transcript view)

### **State Management** COMPLETED
The application relies on multiple scattered `useState` hooks.
- **Action**: [COMPLETED] Consolidate complex state (like `batchItems` and `activeItemId`) into a `useReducer` or a dedicated Context (e.g., `BatchContext`). This will make state updates more predictable and easier to debug.
- **Action**: [COMPLETED] Move `modelConfig` and `styleConfig` to a `SettingsContext` to avoid prop drilling.

### **Custom Hooks**
Extract logic into reusable hooks to clean up components:
- `useTranslationEngine`: [COMPLETED] Encapsulate the translation logic, progress tracking, and cancellation.
- `useSubtitleFile`: [COMPLETED] Handle file parsing, merging, and downloading logic.
- `useCostEstimator`: [COMPLETED] Encapsulate the token estimation logic.

## 2. Performance

### **Virtualization for Subtitle Lists**
Rendering thousands of subtitle lines in the "Live Transcript" view (`activeItem.subtitles.map`) will cause DOM bloat and lag.
- **Action**: [COMPLETED] Implement `react-window` or `react-virtuoso` to render only the visible lines.

### **Memoization**
- **Action**: [COMPLETED] Wrap expensive computations (like `generateSubtitleContent` or the `VisualPreview` rendering) with `useMemo`.
- **Action**: [COMPLETED] Use `React.memo` for the `VisualPreview` component to prevent re-renders when unrelated state changes (e.g., progress updates).

### **Web Workers for Heavy Processing**
The `mergeAndOptimizeSubtitles` function uses Dynamic Time Warping (DTW), which is O(N*M). For large files, this blocks the main thread.
- **Action**: [COMPLETED] Move parsing, merging, and ASS generation to a Web Worker.

## 3. Code Quality & Safety

### **Type Safety** COMPLETED
- **Action**: Stricter typing for `any` types in `services/geminiService.ts` (e.g., error handling blocks).
- **Action**: Define explicit return types for all service functions.

### **Error Handling** COMPLETED
- **Action**: Implement a global Error Boundary component to catch crashes.
- **Action**: Centralize API error handling in `geminiService` to provide consistent user feedback (e.g., specific messages for "Quota Exceeded" vs "Network Error").

### **Testing** COMPLETED
- **Action**: Add unit tests for `subtitleUtils.ts` (especially the parser and merger logic) using Vitest.
- **Action**: Add integration tests for the translation flow.

## 4. User Experience (UX)

### **Optimistic UI** COMPLETED
- **Action**: When changing styles, apply them immediately in the preview without waiting for a full re-render of the parent.

### **Accessibility (a11y)** COMPLETED
- **Action**: Ensure all form inputs in the settings modal have associated `<label>` elements (some are currently implicit or missing `htmlFor`).
- **Action**: Verify keyboard navigation focus traps for the Modal.

## 5. Build & Infrastructure

### **Environment Variables** COMPLETED
- **Action**: Ensure all API keys and sensitive config are strictly handled via `import.meta.env` and not hardcoded defaults (except for local dev fallbacks).

### **Bundle Size** COMPLETED
- **Action**: Analyze bundle size. If `lucide-react` is importing too many icons, ensure tree-shaking is working correctly.
- **Result**: Split vendor chunks (React, GenAI, Utils) to reduce main bundle size from ~900KB to ~150KB. Tree-shaking confirmed working for `lucide-react` (only ~17KB used).
