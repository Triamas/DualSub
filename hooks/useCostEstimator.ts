import { useMemo } from 'react';
import { BatchItem, ModelConfig } from '../types';
import { estimateTokens } from '../services/subtitleUtils';

export const useCostEstimator = (activeItem: BatchItem | undefined, modelConfig: ModelConfig) => {
    return useMemo(() => {
        if (!activeItem) {
            return null;
        }
        const { inputTokens, outputTokens, cost } = estimateTokens(activeItem.subtitles, modelConfig.modelName);
        return { cost, count: inputTokens + outputTokens };
    }, [activeItem, modelConfig.modelName]);
};
