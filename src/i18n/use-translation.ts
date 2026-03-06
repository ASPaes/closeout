import { useContext } from "react";
import { LanguageContext } from "./language-provider";

export function useTranslation() {
  const { t, language, setLanguage } = useContext(LanguageContext);
  return { t, language, setLanguage };
}
