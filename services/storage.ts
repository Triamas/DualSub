import { openDB } from 'idb';
import { BatchItem } from '../types';

const DB_NAME = 'DualSubAI';
const STORE_NAME = 'session';
const KEY = 'batchItems';

const initDB = async () => {
  return openDB(DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    },
  });
};

export const saveSession = async (items: BatchItem[]) => {
  try {
    const db = await initDB();
    // We strip out the File objects because they can't be reliably serialized/persisted long-term
    // without consuming massive space, and standard IDB cloning rules apply. 
    // For a text-based app, we only strictly need the text content.
    // If the user refreshes, they might lose the "originalFile" reference for re-downloading,
    // but the parsed subtitles are what matters.
    const serializableItems = items.map(item => {
        const { originalFile, ...rest } = item; 
        return rest;
    });
    await db.put(STORE_NAME, serializableItems, KEY);
  } catch (error) {
    console.warn("Failed to save session to IndexedDB:", error);
  }
};

export const loadSession = async (): Promise<BatchItem[]> => {
  try {
    const db = await initDB();
    const items = await db.get(STORE_NAME, KEY);
    return items || [];
  } catch (error) {
    console.warn("Failed to load session from IndexedDB:", error);
    return [];
  }
};

export const clearSession = async () => {
    try {
        const db = await initDB();
        await db.delete(STORE_NAME, KEY);
    } catch (e) {
        console.error(e);
    }
};