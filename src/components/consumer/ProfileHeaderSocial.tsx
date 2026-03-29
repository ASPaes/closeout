import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { MapPin, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  avatarUrl: string | null;
  initials: string;
  displayName: string;
  username: string;
  email: string;
  presenceEvent: { name: string } | null;
  onEditPress: () => void;
};

export function ProfileHeaderSocial({
  avatarUrl,
  initials,
  displayName,
  username,
  email,
  presenceEvent,
  onEditPress,
}: Props) {
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
        <button
          onClick={onEditPress}
          className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground active:scale-90 transition-transform"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Name + username */}
      <h1 className="mt-3 text-lg font-bold text-foreground leading-tight">{displayName}</h1>
      <p className="text-sm text-muted-foreground">@{username}</p>

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
