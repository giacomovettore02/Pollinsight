/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useMemo, useState } from 'react';

export type Language = 'en' | 'it';

interface LanguageContextValue {
  language: Language;
  setLanguage: (language: Language) => void;
  pick: (italian: string, english: string) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState<Language>(() => {
    const saved = window.localStorage.getItem('pollinsight-language');
    return saved === 'it' ? 'it' : 'en';
  });

  useEffect(() => {
    window.localStorage.setItem('pollinsight-language', language);
    document.documentElement.lang = language;
  }, [language]);

  const value = useMemo<LanguageContextValue>(() => ({
    language,
    setLanguage,
    pick: (italian, english) => language === 'it' ? italian : english,
  }), [language]);

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used inside LanguageProvider');
  }
  return context;
}

const ENTITY_NAMES: Record<string, string> = {
  'Apiario Principale': 'Main Apiary',
  'Apiario Collina': 'Hill Apiary',
  'Apiario Fattoria': 'Farm Apiary',
  'Alveare A': 'Hive A',
  'Alveare B': 'Hive B',
  'Alveare C': 'Hive C',
  'Alveare D': 'Hive D',
  'Alveare E': 'Hive E',
  'Alveare F': 'Hive F',
};

export function localizeEntityName(value: string, language: Language): string {
  return language === 'en' ? ENTITY_NAMES[value] ?? value : value;
}
