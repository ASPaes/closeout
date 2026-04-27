import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "@/i18n/use-translation";
import { normalizeProductName } from "@/lib/normalize";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Upload, Search, ImageIcon, Loader2, Check, X, ThumbsUp, RefreshCw } from "lucide-react";

type SearchResult = {
  title: string;
  imageUrl: string;
  thumbnailUrl: string;
  sourceUrl: string;
};

export type EntityImageType = "product" | "combo" | "campaign";

interface EntityImageSectionProps {
  entityType: EntityImageType;
  entityId: string | null;
  entityName: string;
  currentImagePath: string | null;
  imageSource: string | null;
  onImageUpdated: (imagePath: string, imageSource: string) => void;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

function getPublicUrl(imagePath: string) {
  return `${SUPABASE_URL}/storage/v1/object/public/product-images/${imagePath}`;
}

export function EntityImageSection({
  entityType,
  entityId,
  entityName,
  currentImagePath,
  imageSource,
  onImageUpdated,
}: EntityImageSectionProps) {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [attaching, setAttaching] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const [librarySuggestion, setLibrarySuggestion] = useState<{ imagePath: string; publicUrl: string } | null>(null);
  const [libraryConfirmed, setLibraryConfirmed] = useState(false);

  useEffect(() => {
    if (currentImagePath) {
      setPreviewUrl(getPublicUrl(currentImagePath));
      setLibrarySuggestion(null);
      setLibraryConfirmed(imageSource === "library");
    } else {
      setPreviewUrl(null);
      setLibraryConfirmed(false);
    }
  }, [currentImagePath, imageSource]);

  useEffect(() => {
    if (!entityName.trim() || currentImagePath) return;
    const normalized = normalizeProductName(entityName);
    if (!normalized) return;

    const checkLibrary = async () => {
      const { data, error } = await supabase
        .from("product_image_library" as any)
        .select("image_path")
        .eq("normalized_name", normalized)
        .maybeSingle();

      if (!error && data && (data as any).image_path) {
        const imgPath = (data as any).image_path as string;
        setLibrarySuggestion({ imagePath: imgPath, publicUrl: getPublicUrl(imgPath) });
        setPreviewUrl(getPublicUrl(imgPath));
      }
    };

    const timer = setTimeout(checkLibrary, 600);
    return () => clearTimeout(timer);
  }, [entityName, currentImagePath]);

  const handleAcceptLibrary = () => {
    if (!librarySuggestion) return;
    onImageUpdated(librarySuggestion.imagePath, "library");
    setLibraryConfirmed(true);
    setLibrarySuggestion(null);
    toast.success(t("img_updated_success"));
  };

  const handleRejectLibrary = () => {
    setLibrarySuggestion(null);
    setPreviewUrl(null);
    handleSearch();
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !entityId) return;

    const allowedTypes = ["image/png", "image/jpeg", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      toast.error(t("img_invalid_type"));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error(t("img_too_large"));
      return;
    }

    setUploading(true);
    try {
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(",")[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const { data, error } = await supabase.functions.invoke("upload-product-image", {
        body: {
          entityType,
          entityId,
          fileBase64: base64,
          mimeType: file.type,
          originalFileName: file.name,
        },
      });

      if (error) throw error;
      if (data?.data?.publicUrl) {
        setPreviewUrl(data.data.publicUrl);
        setLibrarySuggestion(null);
        setLibraryConfirmed(false);
        onImageUpdated(data.data.imagePath, "upload");
        toast.success(t("img_updated_success"));
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`${t("img_upload_error")}: ${msg}`);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSearch = async () => {
    if (!entityName.trim()) {
      toast.error(t("img_search_need_name"));
      return;
    }

    setSearching(true);
    setShowResults(true);
    try {
      const { data, error } = await supabase.functions.invoke("search-product-image", {
        body: { query: entityName.trim() },
      });

      if (error) throw error;
      setSearchResults(data?.data?.results ?? []);
      if (!data?.data?.results?.length) {
        toast.info(t("img_no_results"));
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`${t("img_search_error")}: ${msg}`);
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const handleAttach = async (result: SearchResult) => {
    if (!entityId) {
      toast.error(t("img_save_product_first"));
      return;
    }

    setAttaching(result.imageUrl);
    try {
      const { data, error } = await supabase.functions.invoke("attach-searched-product-image", {
        body: {
          entityType,
          entityId,
          imageUrl: result.imageUrl,
          sourceUrl: result.sourceUrl,
        },
      });

      if (error) throw error;
      if (data?.data?.publicUrl) {
        setPreviewUrl(data.data.publicUrl);
        setLibrarySuggestion(null);
        setLibraryConfirmed(false);
        onImageUpdated(data.data.imagePath, "search");
        setShowResults(false);
        setSearchResults([]);
        toast.success(t("img_updated_success"));
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`${t("img_attach_error")}: ${msg}`);
    } finally {
      setAttaching(null);
    }
  };

  const showLibraryActions = !!librarySuggestion && !libraryConfirmed;

  return (
    <>
      <Separator className="my-2" />
      <p className="text-sm font-semibold text-foreground/80">{t("img_section_title")}</p>

      {previewUrl ? (
        <div className="relative rounded-lg border border-border/60 overflow-hidden bg-secondary/20">
          <img
            src={previewUrl}
            alt={entityName}
            className="w-full h-40 object-contain"
            onError={() => { setPreviewUrl(null); setLibrarySuggestion(null); }}
          />
          {libraryConfirmed && (
            <div className="absolute bottom-0 left-0 right-0 bg-primary/90 text-primary-foreground text-xs px-3 py-1 flex items-center gap-1">
              <Check className="h-3 w-3" />
              {t("img_library_reused")}
            </div>
          )}
          {showLibraryActions && (
            <div className="absolute bottom-0 left-0 right-0 bg-background/95 border-t border-border/60 px-3 py-2 flex items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">{t("img_library_found")}</p>
              <div className="flex gap-2">
                <Button type="button" variant="default" size="sm" onClick={handleAcceptLibrary}>
                  <ThumbsUp className="mr-1 h-3 w-3" />
                  {t("img_accept_library")}
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={handleRejectLibrary}>
                  <RefreshCw className="mr-1 h-3 w-3" />
                  {t("img_search_another")}
                </Button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-border/60 p-6 text-center">
          <ImageIcon className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">{t("img_no_image")}</p>
        </div>
      )}

      {!showLibraryActions && (
        <div className="flex flex-wrap gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={handleFileSelect}
            disabled={!entityId}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading || !entityId}
          >
            {uploading ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Upload className="mr-1 h-3 w-3" />}
            {t("img_upload")}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleSearch}
            disabled={searching || !entityId}
          >
            {searching ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Search className="mr-1 h-3 w-3" />}
            {t("img_search_web")}
          </Button>
        </div>
      )}

      {!entityId && (
        <p className="text-xs text-muted-foreground">{t("img_save_product_first")}</p>
      )}

      {showResults && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs text-muted-foreground">
              {t("img_search_results")} ({searchResults.length})
            </Label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => { setShowResults(false); setSearchResults([]); }}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
          {searching ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-2 max-h-60 overflow-y-auto">
              {searchResults.map((result, idx) => (
                <button
                  key={idx}
                  type="button"
                  className="relative rounded-md border border-border/40 overflow-hidden hover:border-primary/60 transition-colors group focus:outline-none focus:ring-2 focus:ring-primary/50"
                  onClick={() => handleAttach(result)}
                  disabled={!!attaching}
                >
                  <img
                    src={result.thumbnailUrl || result.imageUrl}
                    alt={result.title}
                    className="w-full h-20 object-cover"
                    loading="lazy"
                  />
                  {attaching === result.imageUrl && (
                    <div className="absolute inset-0 flex items-center justify-center bg-background/70">
                      <Loader2 className="h-4 w-4 animate-spin" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}