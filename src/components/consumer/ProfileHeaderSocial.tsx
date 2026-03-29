import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MapPin, Camera, Loader2 } from "lucide-react";
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

  const derivedUsername =
    username ||
    email.split("@")[0]?.toLowerCase().replace(/[^a-z0-9._]/g, "") ||
    "user";

  return (
    <div className="relative overflow-hidden rounded-3xl border border-white/[0.08] bg-white/[0.04] p-6 backdrop-blur-xl">
      {/* Subtle gradient glow */}
      <div className="absolute -top-20 -right-20 h-40 w-40 rounded-full bg-primary/10 blur-3xl" />
      <div className="absolute -bottom-16 -left-16 h-32 w-32 rounded-full bg-primary/5 blur-3xl" />

      <div className="relative flex flex-col items-center gap-3">
        {/* Avatar */}
        <div className="relative">
          <Avatar className="h-20 w-20 border-2 border-white/10 shadow-lg shadow-black/30">
            <AvatarImage src={avatarUrl || undefined} alt={displayName} />
            <AvatarFallback className="bg-primary/20 text-xl font-bold text-primary">
              {initials}
            </AvatarFallback>
          </Avatar>

          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md active:scale-90 transition-transform disabled:opacity-60"
          >
            {uploading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Camera className="h-3 w-3" />
            )}
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
        <div className="text-center">
          <h1 className="text-lg font-bold text-foreground leading-tight">
            {displayName}
          </h1>
          <p className="text-sm text-muted-foreground">@{derivedUsername}</p>
        </div>

        {/* Presence pill */}
        {presenceEvent ? (
          <div className="flex items-center gap-1.5 rounded-full border border-green-500/20 bg-green-500/10 px-3 py-1">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
            </span>
            <MapPin className="h-3 w-3 text-green-400" />
            <span className="text-xs font-medium text-green-400">
              {presenceEvent.name}
            </span>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground/50">Offline</span>
        )}

        {/* Edit button */}
        <button
          onClick={onEditPress}
          className="mt-1 rounded-full border border-white/10 bg-white/[0.06] px-5 py-1.5 text-xs font-medium text-foreground active:bg-white/10 transition-colors"
        >
          Editar perfil
        </button>
      </div>
    </div>
  );
}
