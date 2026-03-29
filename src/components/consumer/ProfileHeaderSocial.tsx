import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { MapPin, Pencil, Camera, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Props = {
  userId: string;
  avatarUrl: string | null;
  initials: string;
  displayName: string;
  username: string | null;
  email: string;
  presenceEvent: { name: string } | null;
  onEditPress: () => void;
  onAvatarUpdated: (url: string) => void;
};

export function ProfileHeaderSocial({
  userId,
  avatarUrl,
  initials,
  displayName,
  username,
  email,
  presenceEvent,
  onEditPress,
  onAvatarUpdated,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !userId) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Selecione uma imagem válida");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Imagem deve ter no máximo 2MB");
      return;
    }

    setUploading(true);
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${userId}/avatar.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: true });

    if (uploadError) {
      toast.error("Erro ao enviar foto");
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage
      .from("avatars")
      .getPublicUrl(path);

    const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ avatar_url: publicUrl })
      .eq("id", userId);

    setUploading(false);

    if (updateError) {
      toast.error("Erro ao atualizar perfil");
    } else {
      toast.success("Foto atualizada!");
      onAvatarUpdated(publicUrl);
    }
  };

  return (
    <div className="flex flex-col items-center pt-2 pb-4">
      {/* Avatar */}
      <div className="relative">
        <Avatar className="h-24 w-24 border-2 border-primary/40">
          <AvatarImage src={avatarUrl || undefined} alt={displayName} />
          <AvatarFallback className="bg-primary/20 text-2xl font-bold text-primary">
            {initials}
          </AvatarFallback>
        </Avatar>

        {/* Camera button for photo upload */}
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground active:scale-90 transition-transform disabled:opacity-60"
        >
          {uploading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Camera className="h-3.5 w-3.5" />
          )}
        </button>

        {/* Edit button on the other side */}
        <button
          onClick={onEditPress}
          className="absolute -bottom-1 -left-1 flex h-8 w-8 items-center justify-center rounded-full bg-secondary border border-border/40 text-foreground active:scale-90 transition-transform"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleAvatarUpload}
        />
      </div>

      {/* Name + username */}
      <h1 className="mt-3 text-lg font-bold text-foreground leading-tight">{displayName}</h1>
      <p className="text-sm text-muted-foreground">
        @{username || email.split("@")[0]?.toLowerCase().replace(/[^a-z0-9._]/g, "") || "user"}
      </p>

      {/* Presence badge */}
      {presenceEvent ? (
        <div className="mt-2 flex items-center gap-1.5">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-green-500" />
          </span>
          <Badge
            variant="outline"
            className="border-green-500/30 bg-green-500/10 text-green-400 text-xs font-medium px-2 py-0.5"
          >
            <MapPin className="mr-1 h-3 w-3" />
            {presenceEvent.name}
          </Badge>
        </div>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground/60">Offline</p>
      )}
    </div>
  );
}
