import { useMemo } from "react"
import { motion } from "motion/react"
import { FolderOpen, Pencil, Trash2 } from "lucide-react"

import { StaticGlyph } from "@/components/glyph-canvas"
import { PanelSection } from "@/components/panels/panel-section"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
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
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <li className={cn("grid grid-cols-[80px_minmax(0,1fr)] gap-3 rounded-lg p-2 data-[state=open]:bg-muted/60", active && "bg-muted")}>
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
            <button type="button" onClick={() => onOpen(glyph)} className="min-w-0 text-left text-sm font-medium hover:underline">
              <span className="block truncate">{glyph.title}</span>
            </button>
            {glyph.description && <p className="text-muted-foreground line-clamp-3 text-xs leading-snug">{glyph.description}</p>}
            <p className="text-muted-foreground text-[11px]">
              {active && <span className="text-foreground font-medium">Open · </span>}
              {dateFormat.format(glyph.savedAt)}
            </p>
          </div>
        </li>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-44">
        <ContextMenuLabel>{glyph.title}</ContextMenuLabel>
        <ContextMenuSeparator />
        <ContextMenuItem onSelect={() => onOpen(glyph)}>
          <FolderOpen />
          Open
        </ContextMenuItem>
        <ContextMenuItem onSelect={() => onEdit(glyph)}>
          <Pencil />
          Edit details
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem variant="destructive" onSelect={() => onDelete(glyph)}>
          <Trash2 />
          Delete
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}

export function SavedPanel({ library, activeId, ...actions }: SavedPanelProps) {
  if (!library.length) {
    return (
      <PanelSection title="Saved" collapsible>
        <p className="text-muted-foreground text-xs">Nothing saved yet. Press Save (⌘S) to keep a glyph here with a title and description.</p>
      </PanelSection>
    )
  }
  return (
    <PanelSection title="Saved" collapsible actions={<span className="text-muted-foreground pr-2 text-xs tabular-nums">{library.length}</span>}>
      <p className="text-muted-foreground text-xs">Kept in this browser only. Click one to open it, right-click for more options.</p>
      <ul className="-mx-2 grid gap-1">
        {[...library]
          .sort((a, b) => b.savedAt - a.savedAt)
          .map((g) => (
            <SavedTile key={g.id} glyph={g} active={g.id === activeId} {...actions} />
          ))}
      </ul>
    </PanelSection>
  )
}
