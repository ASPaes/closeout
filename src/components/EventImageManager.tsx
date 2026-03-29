import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useTranslation } from "@/i18n/use-translation";
import { ImagePlus, X, ArrowUp, ArrowDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const MAX_IMAGES = 5;
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const BUCKET = "event-images";

type EventImage = {
  id: string;
  storage_path: string;
  public_url: string | null;
  sort_order: number;
};

type PendingFile = {
  id: string;
  file: File;
  preview: string;
};

interface EventImageManagerProps {
  eventId: string | null;
  clientId: string;
  onPendingFiles?: (files: PendingFile[]) => void;
}

export function EventImageManager({ eventId, clientId, onPendingFiles }: EventImageManagerProps) {
  const { t } = useTranslation();
  const fileRef = useRef<HTMLInputElement>(null);
  const [images, setImages] = useState<EventImage[]>([]);
  const [pending, setPending] = useState<PendingFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const totalCount = images.length + pending.length;

  useEffect(() => {
    if (!eventId) return;
    setLoading(true);
    supabase
      .from("event_images")
      .select("id, storage_path, public_url, sort_order")
      .eq("event_id", eventId)
      .order("sort_order")
      .then(({ data, error }) => {
        if (error) toast.error(error.message);
        if (data) setImages(data as EventImage[]);
        setLoading(false);
      });
  }, [eventId]);

  useEffect(() => {
    onPendingFiles?.(pending);
  }, [pending, onPendingFiles]);

  const getPublicUrl = (path: string) => {
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return data.publicUrl;
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const remaining = MAX_IMAGES - totalCount;
    if (remaining <= 0) {
      toast.error(t("event_images_max_reached"));
      return;
    }

    const validFiles = files
      .filter((f) => {
        if (!ACCEPTED_TYPES.includes(f.type)) {
          toast.error(`${f.name}: ${t("event_images_invalid_type")}`);
          return false;
        }
        return true;
      })
      .slice(0, remaining);

    if (eventId) {
      setUploading(true);
      for (const file of validFiles) {
        await uploadFile(file, eventId, clientId);
      }
      setUploading(false);
      const { data } = await supabase
        .from("event_images")
        .select("id, storage_path, public_url, sort_order")
        .eq("event_id", eventId)
        .order("sort_order");
      if (data) setImages(data as EventImage[]);
    } else {
      const newPending = validFiles.map((file) => ({
        id: crypto.randomUUID(),
        file,
        preview: URL.createObjectURL(file),
      }));
      setPending((prev) => [...prev, ...newPending]);
    }

    if (fileRef.current) fileRef.current.value = "";
  };

  const uploadFile = async (file: File, evtId: string, cliId: string) => {
    const ext = file.name.split(".").pop() || "jpg";
    const imageId = crypto.randomUUID();
    const path = `events/${evtId}/${imageId}.${ext}`;

    const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
      contentType: file.type,
    });
    if (upErr) {
      toast.error(upErr.message);
      return;
    }

    const publicUrl = getPublicUrl(path);
    const currentCount = images.length;

    const { error: dbErr } = await supabase.from("event_images").insert({
      event_id: evtId,
      client_id: cliId,
      storage_path: path,
      public_url: publicUrl,
      sort_order: currentCount,
    });
    if (dbErr) toast.error(dbErr.message);
  };

  const handleRemoveImage = async (img: EventImage) => {
    await supabase.storage.from(BUCKET).remove([img.storage_path]);
    await supabase.from("event_images").delete().eq("id", img.id);
    setImages((prev) => prev.filter((i) => i.id !== img.id));
  };

  const handleRemovePending = (id: string) => {
    setPending((prev) => {
      const item = prev.find((p) => p.id === id);
      if (item) URL.revokeObjectURL(item.preview);
      return prev.filter((p) => p.id !== id);
    });
  };

  const moveImage = async (index: number, direction: "up" | "down") => {
    const newImages = [...images];
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= newImages.length) return;

    [newImages[index], newImages[swapIndex]] = [newImages[swapIndex], newImages[index]];

    const updates = newImages.map((img, i) => ({ id: img.id, sort_order: i }));
    for (const u of updates) {
      await supabase.from("event_images").update({ sort_order: u.sort_order }).eq("id", u.id);
    }
    setImages(newImages.map((img, i) => ({ ...img, sort_order: i })));
  };

  const movePending = (index: number, direction: "up" | "down") => {
    const newPending = [...pending];
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= newPending.length) return;
    [newPending[index], newPending[swapIndex]] = [newPending[swapIndex], newPending[index]];
    setPending(newPending);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-foreground">{t("event_images_title")}</span>
        <span className="text-xs text-muted-foreground">
          {totalCount}/{MAX_IMAGES}
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {images.map((img, idx) => (
          <div key={img.id} className="relative group aspect-square rounded-xl overflow-hidden border border-border/60 bg-secondary/30">
            <img
              src={img.public_url || getPublicUrl(img.storage_path)}
              alt=""
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
              {idx > 0 && (
                <Button size="icon" variant="ghost" className="h-7 w-7 text-white hover:bg-white/20" onClick={() => moveImage(idx, "up")}>
                  <ArrowUp className="h-4 w-4" />
                </Button>
              )}
              {idx < images.length - 1 && (
                <Button size="icon" variant="ghost" className="h-7 w-7 text-white hover:bg-white/20" onClick={() => moveImage(idx, "down")}>
                  <ArrowDown className="h-4 w-4" />
                </Button>
              )}
            </div>
            <button
              onClick={() => handleRemoveImage(img)}
              className="absolute top-1.5 right-1.5 h-6 w-6 rounded-full bg-black/60 flex items-center justify-center text-white hover:bg-destructive transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
            {idx === 0 && (
              <span className="absolute bottom-1.5 left-1.5 text-[10px] bg-primary/90 text-primary-foreground px-1.5 py-0.5 rounded-md font-medium">
                {t("event_images_cover")}
              </span>
            )}
          </div>
        ))}

        {pending.map((p, idx) => (
          <div key={p.id} className="relative group aspect-square rounded-xl overflow-hidden border border-border/60 bg-secondary/30">
            <img src={p.preview} alt="" className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
              {idx > 0 && (
                <Button size="icon" variant="ghost" className="h-7 w-7 text-white hover:bg-white/20" onClick={() => movePending(idx, "up")}>
                  <ArrowUp className="h-4 w-4" />
                </Button>
              )}
              {idx < pending.length - 1 && (
                <Button size="icon" variant="ghost" className="h-7 w-7 text-white hover:bg-white/20" onClick={() => movePending(idx, "down")}>
                  <ArrowDown className="h-4 w-4" />
                </Button>
              )}
            </div>
            <button
              onClick={() => handleRemovePending(p.id)}
              className="absolute top-1.5 right-1.5 h-6 w-6 rounded-full bg-black/60 flex items-center justify-center text-white hover:bg-destructive transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
            {images.length === 0 && idx === 0 && (
              <span className="absolute bottom-1.5 left-1.5 text-[10px] bg-primary/90 text-primary-foreground px-1.5 py-0.5 rounded-md font-medium">
                {t("event_images_cover")}
              </span>
            )}
          </div>
        ))}

        {totalCount < MAX_IMAGES && (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className={cn(
              "aspect-square rounded-xl border-2 border-dashed border-border/60 flex flex-col items-center justify-center gap-1.5 text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors",
              uploading && "opacity-50 pointer-events-none"
            )}
          >
            {uploading ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              <>
                <ImagePlus className="h-6 w-6" />
                <span className="text-xs font-medium">{t("event_images_add")}</span>
              </>
            )}
          </button>
        )}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="hidden"
        onChange={handleFileSelect}
      />
    </div>
  );
}

export async function uploadPendingEventImages(
  pendingFiles: { id: string; file: File }[],
  eventId: string,
  clientId: string
) {
  for (let i = 0; i < pendingFiles.length; i++) {
    const file = pendingFiles[i].file;
    const ext = file.name.split(".").pop() || "jpg";
    const imageId = crypto.randomUUID();
    const path = `events/${eventId}/${imageId}.${ext}`;

    const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
      contentType: file.type,
    });
    if (upErr) {
      toast.error(upErr.message);
      continue;
    }

    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);

    await supabase.from("event_images").insert({
      event_id: eventId,
      client_id: clientId,
      storage_path: path,
      public_url: urlData.publicUrl,
      sort_order: i,
    });
  }
}
