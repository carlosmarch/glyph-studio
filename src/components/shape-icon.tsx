import type { Kind, Role } from "@/lib/grammar"
import { cn } from "@/lib/utils"

/** Small glyph-style icon for a primitive; outline/ink roles shown as stroke/dot. */
export function ShapeIcon({ kind, role = "fill", className }: { kind: Kind; role?: Role; className?: string }) {
  const filled = role !== "outline"
  const common = {
    fill: filled ? "currentColor" : "none",
    stroke: "currentColor",
    strokeWidth: filled ? 0 : 1.6,
    strokeLinejoin: "round" as const,
  }
  return (
    <svg viewBox="0 0 16 16" className={cn("size-4 shrink-0", className)} aria-hidden="true">
      {kind === "circle" && <circle cx="8" cy="8" r="6" {...common} />}
      {kind === "square" && <rect x="2.5" y="2.5" width="11" height="11" {...common} />}
      {kind === "triangle" && <path d="M8 2 L14.5 13.5 L1.5 13.5 Z" {...common} />}
      {role === "ink" && <circle cx="8" cy={kind === "triangle" ? 10 : 8} r="2.2" className="fill-background" />}
    </svg>
  )
}
