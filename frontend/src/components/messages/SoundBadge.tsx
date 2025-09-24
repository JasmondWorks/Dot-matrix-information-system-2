import { Volume2, VolumeX } from "lucide-react";

const SoundBadge = ({ enabled }: { enabled?: boolean }) => {
  const Icon = enabled ? Volume2 : VolumeX;
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-background px-2 py-0.5 text-xs text-muted-foreground">
      <Icon className="size-3.5" />
      {enabled ? "Sound on" : "Muted"}
    </span>
  );
};

export default SoundBadge;

