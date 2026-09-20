import { useState, useEffect } from 'react';
import { AppSettings, DEFAULT_SETTINGS } from '../types/settings';

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem('gemini_clean_settings');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.warn('Failed to parse settings from storage', e);
      }
    }
    return DEFAULT_SETTINGS;
  });

  useEffect(() => {
    localStorage.setItem('gemini_clean_settings', JSON.stringify(settings));
  }, [settings]);

  return {
    settings,
    setSettings,
  };
}
