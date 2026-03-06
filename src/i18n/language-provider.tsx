import { createContext, useState, ReactNode, useMemo, useCallback } from "react";
import ptBR from "./translations/pt-BR";
import enUS from "./translations/en-US";
import type { TranslationKey } from "./translations/pt-BR";

type Language = "pt-BR" | "en-US";

const translations: Record<Language, Record<TranslationKey, string>> = {
  "pt-BR": ptBR,
  "en-US": enUS,
};

type LanguageContextType = {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: TranslationKey) => string;
};

export const LanguageContext = createContext<LanguageContextType>({
  language: "pt-BR",
  setLanguage: () => {},
  t: (key) => key,
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>("pt-BR");

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
  }, []);

  const contextValue = useMemo<LanguageContextType>(() => ({
    language,
    setLanguage,
    t: (key: TranslationKey): string => {
      return translations[language]?.[key] ?? key;
    },
  }), [language, setLanguage]);

  return (
    <LanguageContext.Provider value={contextValue}>
      {children}
    </LanguageContext.Provider>
  );
}
