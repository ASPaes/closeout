import { createContext, ReactNode, useMemo } from "react";
import ptBR from "./translations/pt-BR";
import type { TranslationKey } from "./translations/pt-BR";

type Language = "pt-BR";

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
  const contextValue = useMemo<LanguageContextType>(() => ({
    language: "pt-BR",
    setLanguage: () => {},
    t: (key: TranslationKey): string => {
      return ptBR[key] ?? key;
    },
  }), []);

  return (
    <LanguageContext.Provider value={contextValue}>
      {children}
    </LanguageContext.Provider>
  );
}
