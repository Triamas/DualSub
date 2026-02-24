import { renderHook } from '@testing-library/react';
import { useTranslationEngine } from './useTranslationEngine';
import { BatchProvider } from '../contexts/BatchContext';
import { SettingsProvider } from '../contexts/SettingsContext';
import { ToastProvider } from '../components/Toast';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import React from 'react';

// Mock geminiService
vi.mock('../services/geminiService', () => ({
  translateBatch: vi.fn(),
  detectLanguage: vi.fn().mockResolvedValue({ isEnglish: true, language: 'English' }),
  generateContext: vi.fn().mockResolvedValue('Context'),
  generateShowBible: vi.fn().mockResolvedValue('Bible'),
  identifyShowName: vi.fn().mockResolvedValue('Show Name'),
}));

// Mock storage
vi.mock('../services/storage', () => ({
  loadSession: vi.fn().mockResolvedValue(null),
  saveSession: vi.fn(),
  clearSession: vi.fn(),
}));

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <ToastProvider>
    <SettingsProvider>
      <BatchProvider>
        {children}
      </BatchProvider>
    </SettingsProvider>
  </ToastProvider>
);

describe('useTranslationEngine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize correctly', () => {
    const { result } = renderHook(() => useTranslationEngine(), { wrapper });
    expect(result.current.isTranslatingRef.current).toBe(false);
  });
});
