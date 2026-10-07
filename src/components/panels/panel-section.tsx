import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

// A titled block in a side panel, Figma-style: small heading, optional actions, hairline below.
export function PanelSection({
  title,
  actions,
  className,
  children,
}: {
  title?: ReactNode
  actions?: ReactNode
  className?: string
  children: ReactNode
}) {
  return (
    <section className={cn("grid gap-3 border-b px-4 py-3 last:border-b-0", className)}>
      {(title || actions) && (
        <div className="-my-1 flex min-h-7 items-center justify-between gap-2">
          {title && <h2 className="text-xs font-semibold">{title}</h2>}
          {actions && <div className="-mr-2 flex items-center">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  )
}
