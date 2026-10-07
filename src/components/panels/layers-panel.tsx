import { BringToFront, Trash2 } from "lucide-react"

import { PanelSection } from "@/components/panels/panel-section"
import { ShapeIcon } from "@/components/shape-icon"
import { Button } from "@/components/ui/button"
import { KIND_META, MAX_SHAPES, shapeLabel, type Doc, type Role } from "@/lib/grammar"
import { cn } from "@/lib/utils"

const ROLE_NAME: Record<Role, string> = { fill: "Body", outline: "Outline", ink: "Mark" }

interface LayersPanelProps {
  doc: Doc
  selectedId: string | null
  onSelect: (id: string | null) => void
  onFront: (id: string) => void
  onRemove: (id: string) => void
}

export function LayersPanel({ doc, selectedId, onSelect, onFront, onRemove }: LayersPanelProps) {
  // Topmost first, like a layer stack.
  const layers = [...doc.shapes].reverse()
  return (
    <PanelSection
      title="Layers"
      actions={<span className="text-muted-foreground pr-2 text-xs tabular-nums">{doc.shapes.length}/{MAX_SHAPES}</span>}
    >
      {layers.length ? (
        <ul className="-mx-2 grid gap-px" role="listbox" aria-label="Layers">
          {layers.map((s) => {
            const n = doc.shapes.indexOf(s) + 1
            const selected = s.id === selectedId
            return (
              <li
                key={s.id}
                role="option"
                aria-selected={selected}
                aria-label={shapeLabel(doc, s)}
                tabIndex={0}
                onClick={() => onSelect(selected ? null : s.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault()
                    onSelect(selected ? null : s.id)
                  }
                }}
                className={cn(
                  "group flex h-8 cursor-default items-center gap-2 rounded-md px-2 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
                  selected ? "bg-[var(--selection)]/15" : "hover:bg-muted",
                )}
              >
                <ShapeIcon kind={s.kind} role={s.role} />
                <span className="min-w-0 flex-1 truncate">
                  {KIND_META[s.kind].name} {n}
                </span>
                <span className="text-muted-foreground text-xs group-hover:hidden group-focus-within:hidden">{ROLE_NAME[s.role]}</span>
                <span className="-mr-1 hidden items-center group-hover:flex group-focus-within:flex">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-6"
                    aria-label={`Bring ${KIND_META[s.kind].name} ${n} to front`}
                    onClick={(e) => {
                      e.stopPropagation()
                      onFront(s.id)
                    }}
                  >
                    <BringToFront className="size-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-6"
                    aria-label={`Delete ${KIND_META[s.kind].name} ${n}`}
                    onClick={(e) => {
                      e.stopPropagation()
                      onRemove(s.id)
                    }}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </span>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="text-muted-foreground text-xs">No layers yet. Add a shape from the toolbar.</p>
      )}
    </PanelSection>
  )
}
