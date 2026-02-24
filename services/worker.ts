import { parseSubtitle, mergeAndOptimizeSubtitles } from './subtitleUtils';

self.onmessage = (e) => {
    const { type, payload, id } = e.data;
    try {
        let result;
        if (type === 'PARSE') {
            result = parseSubtitle(payload.content, payload.fileName);
        } else if (type === 'MERGE') {
            result = mergeAndOptimizeSubtitles(payload.source, payload.imported, payload.smartTiming);
        }
        self.postMessage({ id, type, status: 'SUCCESS', result });
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        self.postMessage({ id, type, status: 'ERROR', error: message });
    }
};
