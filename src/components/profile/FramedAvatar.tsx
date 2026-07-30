import { frameById } from "@/lib/frames";

export function FramedAvatar({
  url,
  name,
  frameId,
  size = 96,
  className = "",
}: {
  url?: string | null;
  name?: string | null;
  frameId?: string | null;
  size?: number;
  className?: string;
}) {
  const frame = frameById(frameId);
  const initials =
    (name ?? "")
      .split(" ")
      .map((p) => p[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "U";
  const pad = Math.max(3, Math.round(size * 0.035));

  return (
    <div className={`relative shrink-0 ${className}`} style={{ width: size, height: size }}>
      {frame.id !== "none" && (
        <div
          className={`absolute -inset-1 rounded-full bg-gradient-to-br ${frame.ring} blur-md opacity-60 ${
            frame.animated ? "animate-pulse" : ""
          }`}
        />
      )}
      <div
        className={`relative h-full w-full rounded-full bg-gradient-to-br ${frame.ring} ${frame.glow} flex items-center justify-center`}
        style={{ padding: pad }}
      >
        <div className="h-full w-full rounded-full overflow-hidden bg-gradient-to-br from-electric to-primary/60 flex items-center justify-center">
          {url ? (
            <img src={url} alt={name ?? "Avatar"} className="h-full w-full object-cover" />
          ) : (
            <span
              className="font-black text-primary-foreground"
              style={{ fontSize: Math.round(size * 0.32) }}
            >
              {initials}
            </span>
          )}
        </div>
      </div>
      {frame.badge && (
        <span
          className="absolute -bottom-1 -right-1 grid place-items-center rounded-full bg-background/80 ring-1 ring-white/15 backdrop-blur"
          style={{ width: size * 0.3, height: size * 0.3, fontSize: size * 0.16 }}
        >
          {frame.badge}
        </span>
      )}
    </div>
  );
}
