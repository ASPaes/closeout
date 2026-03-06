import { useTranslation } from "@/i18n/use-translation";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Globe } from "lucide-react";
import { toast } from "sonner";

export function LanguageSwitcher() {
  const { t, language, setLanguage } = useTranslation();
  const { user } = useAuth();

  const handleChange = async (value: string) => {
    const lang = value as "pt-BR" | "en-US";
    setLanguage(lang);

    if (user) {
      const { error } = await supabase
        .from("profiles")
        .update({ language: lang } as any)
        .eq("id", user.id);
      if (error) {
        toast.error(error.message);
      } else {
        toast.success(t("language_updated"));
      }
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Globe className="h-4 w-4 text-muted-foreground" />
      <Select value={language} onValueChange={handleChange}>
        <SelectTrigger className="w-[200px] h-8 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="pt-BR">{t("portuguese_brazil")}</SelectItem>
          <SelectItem value="en-US">{t("english_us")}</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
