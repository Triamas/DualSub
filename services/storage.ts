
import { openDB } from 'idb';
import { BatchItem } from '../types';

const DB_NAME = 'DualSubAI';
const SESSION_STORE = 'session';
const METADATA_STORE = 'show_metadata'; // New Store
const SESSION_KEY = 'batchItems';

const initDB = async () => {
  return openDB(DB_NAME, 2, { // Version bumped to 2
    upgrade(db, oldVersion, newVersion, transaction) {
      if (!db.objectStoreNames.contains(SESSION_STORE)) {
        db.createObjectStore(SESSION_STORE);
      }
      if (!db.objectStoreNames.contains(METADATA_STORE)) {
        db.createObjectStore(METADATA_STORE);
      }
    },
  });
};

export const saveSession = async (items: BatchItem[]) => {
  try {
    const db = await initDB();
    const serializableItems = items.map(item => {
        const { originalFile, ...rest } = item; 
        return rest;
    });
    await db.put(SESSION_STORE, serializableItems, SESSION_KEY);
  } catch (error) {
    console.warn("Failed to save session to IndexedDB:", error);
  }
};

export const loadSession = async (): Promise<BatchItem[]> => {
  try {
    const db = await initDB();
    const items = await db.get(SESSION_STORE, SESSION_KEY);
    return items || [];
  } catch (error) {
    console.warn("Failed to load session from IndexedDB:", error);
    return [];
  }
};

export const clearSession = async () => {
    try {
        const db = await initDB();
        await db.delete(SESSION_STORE, SESSION_KEY);
    } catch (e) {
        console.error(e);
    }
};

export interface ShowMetadata {
    showName: string;
    context: string;
    bible: string;
    timestamp: number;
}

export const saveShowMetadata = async (showName: string, data: { context: string, bible: string }) => {
    try {
        const db = await initDB();
        const key = showName.toLowerCase().trim();
        await db.put(METADATA_STORE, {
            showName: key, // Store key as lowercase for consistency
            displayTitle: showName, // Store original casing for display
            context: data.context,
            bible: data.bible,
            timestamp: Date.now()
        }, key);
    } catch (error) {
        console.warn("Failed to save show metadata:", error);
    }
};

export const loadShowMetadata = async (showName: string): Promise<ShowMetadata | null> => {
    try {
        const db = await initDB();
        const key = showName.toLowerCase().trim();
        return await db.get(METADATA_STORE, key);
    } catch (error) {
        console.warn("Failed to load show metadata:", error);
        return null;
    }
};
