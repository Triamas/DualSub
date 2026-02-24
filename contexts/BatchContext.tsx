import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { BatchItem } from '../types';
import { saveSession, loadSession } from '../services/storage';

interface BatchState {
    batchItems: BatchItem[];
    activeItemId: string | null;
}

type BatchAction =
    | { type: 'SET_ITEMS'; payload: BatchItem[] }
    | { type: 'ADD_ITEMS'; payload: BatchItem[] }
    | { type: 'REMOVE_ITEM'; payload: string }
    | { type: 'CLEAR_ALL' }
    | { type: 'SET_ACTIVE_ITEM'; payload: string | null }
    | { type: 'UPDATE_ITEM'; payload: { id: string; updates: Partial<BatchItem> } }
    | { type: 'ADD_LOG'; payload: { id: string; entry: any } }; // using any for LogEntry to avoid import cycle if types are not available here, but they are imported.

const initialState: BatchState = {
    batchItems: [],
    activeItemId: null,
};

const batchReducer = (state: BatchState, action: BatchAction): BatchState => {
    switch (action.type) {
        case 'SET_ITEMS':
            return {
                ...state,
                batchItems: action.payload,
                activeItemId: action.payload.length > 0 ? action.payload[0].id : null,
            };
        case 'ADD_ITEMS':
            const newItems = [...state.batchItems, ...action.payload];
            return {
                ...state,
                batchItems: newItems,
                activeItemId: state.activeItemId || (action.payload.length > 0 ? action.payload[0].id : null),
            };
        case 'REMOVE_ITEM':
            const filteredItems = state.batchItems.filter(item => item.id !== action.payload);
            let nextActiveId = state.activeItemId;
            if (state.activeItemId === action.payload) {
                nextActiveId = filteredItems.length > 0 ? filteredItems[0].id : null;
            }
            return {
                ...state,
                batchItems: filteredItems,
                activeItemId: nextActiveId,
            };
        case 'CLEAR_ALL':
            return {
                ...state,
                batchItems: [],
                activeItemId: null,
            };
        case 'SET_ACTIVE_ITEM':
            return {
                ...state,
                activeItemId: action.payload,
            };
        case 'UPDATE_ITEM':
            return {
                ...state,
                batchItems: state.batchItems.map(item =>
                    item.id === action.payload.id ? { ...item, ...action.payload.updates } : item
                ),
            };
        case 'ADD_LOG':
            return {
                ...state,
                batchItems: state.batchItems.map(item =>
                    item.id === action.payload.id ? { ...item, logs: [...(item.logs || []), action.payload.entry] } : item
                ),
            };
        default:
            return state;
    }
};

const BatchContext = createContext<{
    state: BatchState;
    dispatch: React.Dispatch<BatchAction>;
} | undefined>(undefined);

export const BatchProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [state, dispatch] = useReducer(batchReducer, initialState);

    // Session Recovery
    useEffect(() => {
        const restoreSession = async () => {
            const savedItems = await loadSession();
            if (savedItems && savedItems.length > 0) {
                const itemsWithLogs = savedItems.map(item => ({ ...item, logs: item.logs || [] }));
                dispatch({ type: 'SET_ITEMS', payload: itemsWithLogs });
            }
        };
        restoreSession();
    }, []);

    // Save Session
    useEffect(() => {
        const timeout = setTimeout(() => {
            if (state.batchItems.length > 0) {
                saveSession(state.batchItems);
            } else {
                // If explicitly cleared, we might want to clear session too, 
                // but CLEAR_ALL action handles state. 
                // If empty, saveSession might overwrite with empty array which is fine.
                // However, clearSession() is explicit.
            }
        }, 1000);
        return () => clearTimeout(timeout);
    }, [state.batchItems]);

    return (
        <BatchContext.Provider value={{ state, dispatch }}>
            {children}
        </BatchContext.Provider>
    );
};

export const useBatch = () => {
    const context = useContext(BatchContext);
    if (!context) {
        throw new Error('useBatch must be used within a BatchProvider');
    }
    return context;
};
