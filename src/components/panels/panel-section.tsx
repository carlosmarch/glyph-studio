import { useId, useState, type ReactNode } from "react"
import { ChevronDown } from "lucide-react"

import { cn } from "@/lib/utils"

// A titled block in a side panel, Figma-style: small heading, optional actions, hairline below.
// Collapsible sections open by default; the heading toggles them.
export function PanelSection({
  title,
  actions,
  collapsible = false,
  className,
  children,
}: {
  title?: ReactNode
  actions?: ReactNode
  collapsible?: boolean
  className?: string
  children: ReactNode
}) {
  const [open, setOpen] = useState(true)
  const bodyId = useId()
  const expanded = !collapsible || open
  return (
    <section className={cn("grid gap-3 border-b px-4 py-3 last:border-b-0", className)}>
      {(title || actions) && (
        <div className="-my-1 flex min-h-7 items-center justify-between gap-2">
          {title &&
            (collapsible ? (
              <h2 className="text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setOpen((o) => !o)}
                  aria-expanded={open}
                  aria-controls={bodyId}
                  className="hover:text-foreground -ml-1 flex items-center gap-1 rounded px-1 py-0.5 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                >
                  <ChevronDown className={cn("text-muted-foreground size-3.5 transition-transform", !open && "-rotate-90")} />
                  {title}
                </button>
              </h2>
            ) : (
              <h2 className="text-xs font-semibold">{title}</h2>
            ))}
          {actions && <div className="-mr-2 flex items-center">{actions}</div>}
        </div>
      )}
      {expanded && (collapsible ? <div id={bodyId} className="grid gap-3">{children}</div> : children)}
    </section>
  )
}
