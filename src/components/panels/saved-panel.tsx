import { useMemo } from "react"
import { motion } from "motion/react"
import { Pencil, Trash2 } from "lucide-react"

import { StaticGlyph } from "@/components/glyph-canvas"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { decodeState } from "@/lib/export"
import { formula } from "@/lib/grammar"
import type { SavedGlyph } from "@/lib/library"
import { cn } from "@/lib/utils"

interface SavedPanelProps {
  library: SavedGlyph[]
  activeId: string | null
  onOpen: (glyph: SavedGlyph) => void
  onEdit: (glyph: SavedGlyph) => void
  onDelete: (glyph: SavedGlyph) => void
}

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" })

function SavedTile({ glyph, active, onOpen, onEdit, onDelete }: { glyph: SavedGlyph; active: boolean } & Omit<SavedPanelProps, "library" | "activeId">) {
  const state = useMemo(() => decodeState(glyph.state), [glyph.state])
  if (!state) return null
  return (
    <li className={cn("grid grid-cols-[96px_minmax(0,1fr)] gap-3 rounded-lg p-2", active && "bg-muted")}>
      <motion.button
        type="button"
        whileHover={{ y: -2 }}
        whileTap={{ scale: 0.97 }}
        onClick={() => onOpen(glyph)}
        className="block self-start rounded-md p-2 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        style={{ background: state.style.ground }}
        aria-label={`Open ${glyph.title}`}
      >
        <StaticGlyph doc={state.doc} style={state.style} label={formula(state.doc)} />
      </motion.button>
      <div className="grid min-w-0 content-start gap-1">
        <div className="flex items-start justify-between gap-1">
          <button type="button" onClick={() => onOpen(glyph)} className="min-w-0 text-left text-sm font-medium hover:underline">
            <span className="block truncate">{glyph.title}</span>
          </button>
          <div className="-mt-1 -mr-1 flex shrink-0">
            <Button variant="ghost" size="icon" className="size-7" aria-label={`Edit ${glyph.title}`} onClick={() => onEdit(glyph)}>
              <Pencil />
            </Button>
            <Button variant="ghost" size="icon" className="size-7" aria-label={`Delete ${glyph.title}`} onClick={() => onDelete(glyph)}>
              <Trash2 />
            </Button>
          </div>
        </div>
        {glyph.description && <p className="text-muted-foreground line-clamp-3 text-xs leading-snug">{glyph.description}</p>}
        <p className="text-muted-foreground text-[11px]">
          {active && <span className="text-foreground font-medium">Open · </span>}
          {dateFormat.format(glyph.savedAt)}
        </p>
      </div>
    </li>
  )
}

export function SavedPanel({ library, activeId, ...actions }: SavedPanelProps) {
  if (!library.length) {
    return (
      <div className="grid gap-1 py-6 text-center">
        <Label className="justify-center">Nothing saved yet</Label>
        <p className="text-muted-foreground text-xs">Press Save (⌘S) to keep a glyph here with a title and description.</p>
      </div>
    )
  }
  return (
    <div className="grid gap-3">
      <div>
        <Label>Saved glyphs</Label>
        <p className="text-muted-foreground mt-1 text-xs">Kept in this browser only. Click one to open it.</p>
      </div>
      <ul className="-mx-2 grid gap-1">
        {[...library]
          .sort((a, b) => b.savedAt - a.savedAt)
          .map((g) => (
            <SavedTile key={g.id} glyph={g} active={g.id === activeId} {...actions} />
          ))}
      </ul>
    </div>
  )
}
