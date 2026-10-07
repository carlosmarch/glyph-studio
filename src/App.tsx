import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { AnimatePresence, MotionConfig, motion } from "motion/react"
import {
  AlertTriangle,
  ChevronDown,
  Code2,
  Copy,
  Dices,
  Download,
  Eraser,
  ExternalLink,
  FilePlus2,
  Film,
  HelpCircle,
  ImagePlay,
  Link2,
  Moon,
  Pencil,
  Redo2,
  RotateCcw,
  Save,
  Sun,
  Undo2,
} from "lucide-react"
import { toast } from "sonner"

import { FormulaField } from "@/components/formula-field"
import { GlyphCanvas, type ShapeMove } from "@/components/glyph-canvas"
import { SaveDialog, type SaveDetails } from "@/components/save-dialog"
import { LayersPanel } from "@/components/panels/layers-panel"
import { PanelSection } from "@/components/panels/panel-section"
import { PresetsPanel } from "@/components/panels/presets-panel"
import { RelatePanel } from "@/components/panels/relate-panel"
import { SavedPanel } from "@/components/panels/saved-panel"
import { ShapePanel } from "@/components/panels/shape-panel"
import { StylePanel } from "@/components/panels/style-panel"
import { ShapeIcon } from "@/components/shape-icon"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Separator } from "@/components/ui/separator"
import { Toaster } from "@/components/ui/sonner"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useHistory } from "@/hooks/use-history"
import { randomDoc } from "@/lib/formula"
import { loadLibrary, newSavedId, storeLibrary, type SavedGlyph } from "@/lib/library"
import {
  decodeState,
  download,
  encodeState,
  fileBase,
  toAnimatedSVG,
  toEntranceGIF,
  toEntranceSVG,
  toGIF,
  toSnippet,
  toSVG,
} from "@/lib/export"
import {
  addShape,
  applyRelation,
  BOX_H,
  BOX_W,
  bringToFront,
  duplicateShape,
  formula,
  KIND_META,
  KINDS,
  MAX_SHAPES,
  newId,
  RELATION_META,
  removeLink,
  removeShape,
  updateShape,
  validate,
  type Doc,
  type Kind,
  type RelationKind,
  type Shape,
} from "@/lib/grammar"
import { DEFAULT_STYLE, STARTER, type Style } from "@/lib/presets"

interface Studio {
  doc: Doc
  style: Style
}

const INITIAL: Studio = { doc: STARTER, style: DEFAULT_STYLE }

const TOOL_KEYS: Record<string, Kind> = { c: "circle", t: "triangle", s: "square" }

// A share link wins, then the latest save, then the starter glyph.
function initialState(library: SavedGlyph[]): Studio {
  if (typeof window === "undefined") return INITIAL
  const shared = decodeState(window.location.hash)
  if (shared) return shared
  const latest = library.reduce<SavedGlyph | null>((a, g) => (!a || g.savedAt > a.savedAt ? g : a), null)
  return (latest && decodeState(latest.state)) || INITIAL
}

function useDarkMode() {
  const [dark, setDark] = useState(() => window.matchMedia("(prefers-color-scheme: dark)").matches)
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark)
  }, [dark])
  return [dark, setDark] as const
}

const SHORTCUTS: [string, string][] = [
  ["Add circle · triangle · square", "C T S"],
  ["Random glyph", "R"],
  ["Move selection", "←↑→↓"],
  ["Move ×5", "⇧ + arrows"],
  ["Resize, keep proportions", "⇧ + drag corner"],
  ["Delete selection", "⌫"],
  ["Deselect", "Esc"],
  ["Undo / redo", "⌘Z / ⇧⌘Z"],
  ["Save", "⌘S"],
]

function IconAction({
  label,
  shortcut,
  side,
  children,
  ...props
}: React.ComponentProps<typeof Button> & { label: string; shortcut?: string; side?: "top" | "bottom" | "left" | "right" }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={label} {...props}>
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side={side}>
        {label}
        {shortcut && <span className="ml-2 opacity-60">{shortcut}</span>}
      </TooltipContent>
    </Tooltip>
  )
}

// Text tabs along the top of a side panel, as in Figma's Layers/Assets and Design/Prototype.
function PanelTabs({ children }: { children: React.ReactNode }) {
  return (
    <div className="shrink-0 border-b px-2 py-1.5">
      <TabsList className="h-8 gap-1 bg-transparent p-0">{children}</TabsList>
    </div>
  )
}

function PanelTab(props: React.ComponentProps<typeof TabsTrigger>) {
  return (
    <TabsTrigger
      className="text-muted-foreground hover:text-foreground data-[state=active]:bg-muted data-[state=active]:text-foreground dark:data-[state=active]:bg-muted h-7 flex-none border-0 px-2.5 text-xs font-semibold data-[state=active]:shadow-none dark:data-[state=active]:border-transparent"
      {...props}
    />
  )
}

function exportGIF(render: Promise<Blob>, filename: string) {
  toast.promise(render, { loading: "Rendering GIF…", success: `Downloaded ${filename}`, error: "Couldn't render the GIF" })
  render.then((blob) => download(filename, blob, "image/gif")).catch(() => {})
}

function ExportItems({ doc, style, name, copy }: { doc: Doc; style: Style; name: string; copy: (text: string, what: string) => void }) {
  return (
    <>
      <DropdownMenuLabel>SVG</DropdownMenuLabel>
      <DropdownMenuItem onSelect={() => download(`${name}.svg`, toSVG(doc, style), "image/svg+xml")}>
        <Download /> Download SVG
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={() => copy(toSVG(doc, style), "SVG")}>
        <Copy /> Copy SVG markup
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuLabel>Animated · boiling line</DropdownMenuLabel>
      <DropdownMenuItem onSelect={() => download(`${name}-boil.svg`, toAnimatedSVG(doc, style), "image/svg+xml")}>
        <Film /> Animated SVG
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={() => exportGIF(toGIF(doc, style), `${name}-boil.gif`)}>
        <ImagePlay /> GIF
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuLabel>Animated · with entrance</DropdownMenuLabel>
      <DropdownMenuItem onSelect={() => download(`${name}-entrance.svg`, toEntranceSVG(doc, style), "image/svg+xml")}>
        <Film /> Animated SVG
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={() => exportGIF(toEntranceGIF(doc, style), `${name}-entrance.gif`)}>
        <ImagePlay /> GIF
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuLabel>Portfolio</DropdownMenuLabel>
      <DropdownMenuItem onSelect={() => copy(toSnippet(doc), "glyphs.ts entry")}>
        <Code2 /> Copy glyphs.ts entry
      </DropdownMenuItem>
    </>
  )
}

export default function App() {
  const [library, setLibrary] = useState(loadLibrary)
  const [initial] = useState(() => initialState(library))
  const history = useHistory<Studio>(initial)
  const { set: setHistory, undo, redo } = history
  const { doc, style } = history.value
  const beforeFormula = useRef<Studio | null>(null)
  const [selection, setSelectedId] = useState<string | null>(null)
  const [showFrame, setShowFrame] = useState(true)
  const [leftTab, setLeftTab] = useState("layers")
  const [rightTab, setRightTab] = useState("design")
  const [dark, setDark] = useDarkMode()
  const encoded = useMemo(() => encodeState({ doc, style }), [doc, style])
  // The saved glyph on the canvas: whichever save matches what was loaded at start.
  const [activeId, setActiveId] = useState(() => library.find((g) => g.state === encoded)?.id ?? null)
  const active = library.find((g) => g.id === activeId) ?? null
  const dirty = !!active && encoded !== active.state
  const exportName = fileBase(active?.title)
  const [dialog, setDialog] = useState<{ mode: "save" | "edit"; glyph: SavedGlyph | null } | null>(null)

  // A selection that no longer exists (undo, preset load…) reads as none.
  const selectedId = selection && doc.shapes.some((s) => s.id === selection) ? selection : null
  const glyphFormula = useMemo(() => formula(doc), [doc])
  const issues = useMemo(() => validate(doc), [doc])
  const full = doc.shapes.length >= MAX_SHAPES

  const setDoc = useCallback(
    (next: (d: Doc) => Doc, transient = false) => setHistory((s) => ({ ...s, doc: next(s.doc) }), { transient }),
    [setHistory],
  )
  const setStyle = useCallback(
    (patch: Partial<Style>, transient = false) => setHistory((s) => ({ ...s, style: { ...s.style, ...patch } }), { transient }),
    [setHistory],
  )

  // Keep the share link current.
  useEffect(() => {
    const t = window.setTimeout(() => {
      window.history.replaceState(null, "", `#g=${encoded}`)
    }, 250)
    return () => window.clearTimeout(t)
  }, [encoded])

  const commitLibrary = (next: SavedGlyph[]) => {
    if (!storeLibrary(next)) {
      toast.error("Couldn't save — browser storage is unavailable")
      return false
    }
    setLibrary(next)
    return true
  }

  const onSaveDialog = ({ title, description }: SaveDetails, asNew: boolean) => {
    const target = dialog?.glyph
    setDialog(null)
    if (dialog?.mode === "edit" && target) {
      commitLibrary(library.map((g) => (g.id === target.id ? { ...g, title, description } : g)))
      return
    }
    const glyph: SavedGlyph = { id: asNew || !target ? newSavedId() : target.id, title, description, state: encoded, savedAt: Date.now() }
    const next = asNew || !target ? [...library, glyph] : library.map((g) => (g.id === glyph.id ? glyph : g))
    if (commitLibrary(next)) {
      setActiveId(glyph.id)
      toast.success(`Saved “${title}”`)
    }
  }

  // ⌘S updates the open save in place; otherwise it asks for a title.
  const quickSave = () => {
    if (!active) return setDialog({ mode: "save", glyph: null })
    if (!dirty) return toast("Already saved")
    if (commitLibrary(library.map((g) => (g.id === active.id ? { ...g, state: encoded, savedAt: Date.now() } : g)))) {
      toast.success(`Saved “${active.title}”`)
    }
  }
  const quickSaveRef = useRef(quickSave)
  useEffect(() => {
    quickSaveRef.current = quickSave
  })

  const openSaved = (glyph: SavedGlyph) => {
    const state = decodeState(glyph.state)
    if (!state) return
    history.set(state)
    setActiveId(glyph.id)
    setSelectedId(null)
    toast(`Opened “${glyph.title}”`)
  }

  const deleteSaved = (glyph: SavedGlyph) => {
    const before = library
    if (!commitLibrary(library.filter((g) => g.id !== glyph.id))) return
    if (glyph.id === activeId) setActiveId(null)
    toast(`Deleted “${glyph.title}”`, {
      action: {
        label: "Undo",
        onClick: () => {
          if (commitLibrary(before) && glyph.id === activeId) setActiveId(glyph.id)
        },
      },
    })
  }

  const randomize = useCallback(() => {
    const { doc: next, formula: f } = randomDoc()
    setHistory((s) => ({ ...s, doc: next }))
    setSelectedId(null)
    toast(`Random glyph: ${f}`)
  }, [setHistory])

  // Back to the starter glyph and default style, as one undoable step.
  const reset = () => {
    history.set(INITIAL)
    setActiveId(null)
    setSelectedId(null)
    toast("Reset to the starter glyph", { action: { label: "Undo", onClick: history.undo } })
  }

  const add = useCallback(
    (kind: Kind) => {
      if (full) return
      const id = newId()
      setDoc((d) => addShape(d, kind, id).doc)
      setSelectedId(id)
      setRightTab("design")
    },
    [full, setDoc],
  )

  const clearCanvas = () => {
    history.set((s) => ({ ...s, doc: { shapes: [], links: [] } }))
    setSelectedId(null)
  }

  const remove = useCallback(
    (id: string) => {
      setDoc((d) => removeShape(d, id))
      setSelectedId(null)
    },
    [setDoc],
  )

  const relate = (kind: RelationKind, a: string, b: string) => {
    setDoc((d) => applyRelation(d, kind, a, b))
    setSelectedId(a)
  }

  // Move a dragged group as one unit, clamped so it stays inside the box together.
  const onMove = (moves: ShapeMove[]) =>
    setDoc((d) => {
      const group = moves.map((m) => ({ m, s: d.shapes.find((s) => s.id === m.id) })).filter((g) => g.s)
      if (!group.length) return d
      const lead = group[0]
      let dx = lead.m.x - lead.s!.x
      let dy = lead.m.y - lead.s!.y
      for (const { s } of group) {
        dx = Math.min(Math.max(dx, -s!.x), BOX_W - s!.w - s!.x)
        dy = Math.min(Math.max(dy, -s!.y), BOX_H - s!.h - s!.y)
      }
      if (!dx && !dy) return d
      return group.reduce((acc, { s }) => updateShape(acc, s!.id, { x: s!.x + dx, y: s!.y + dy }), d)
    }, true)

  const loadPreset = (next: Doc, name: string) => {
    history.set((s) => ({ ...s, doc: next }))
    setSelectedId(null)
    toast(`Loaded ${name}`)
  }

  // Keyboard: delete, nudge, undo/redo, escape.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement
      if (target.closest("input, textarea, [contenteditable=true], [role=dialog]")) return
      const mod = e.metaKey || e.ctrlKey
      if (mod && e.key.toLowerCase() === "s") {
        e.preventDefault()
        quickSaveRef.current()
        return
      }
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault()
        if (e.shiftKey) redo()
        else undo()
        return
      }
      if (mod && e.key.toLowerCase() === "y") {
        e.preventDefault()
        redo()
        return
      }
      if (e.key === "Escape") setSelectedId(null)
      if (!mod && !e.altKey && e.key.toLowerCase() === "r" && !target.closest("[role=menu]")) {
        e.preventDefault()
        randomize()
        return
      }
      // C, T, S add a shape — the same letters the formula field reads.
      const tool = TOOL_KEYS[e.key.toLowerCase()]
      if (!mod && !e.altKey && tool && !target.closest("[role=menu]")) {
        e.preventDefault()
        add(tool)
        return
      }
      if (!selectedId || target.closest("[role=slider], [role=listbox], [role=menu]")) return
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault()
        remove(selectedId)
      }
      const step = e.shiftKey ? 5 : 1
      const delta: Record<string, [number, number]> = {
        ArrowLeft: [-step, 0],
        ArrowRight: [step, 0],
        ArrowUp: [0, -step],
        ArrowDown: [0, step],
      }
      const d = delta[e.key]
      if (d) {
        e.preventDefault()
        setDoc((doc) => {
          const s = doc.shapes.find((x) => x.id === selectedId)
          return s ? updateShape(doc, s.id, { x: s.x + d[0], y: s.y + d[1] }) : doc
        })
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [undo, redo, randomize, add, selectedId, remove, setDoc])

  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success(`${what} copied`)
    } catch {
      toast.error("Couldn't reach the clipboard")
    }
  }

  const label = glyphFormula ? `Glyph: ${glyphFormula.replace(/ {2}· {2}/g, ", ")}` : "Empty glyph canvas"
  const selectedShape = doc.shapes.find((s) => s.id === selectedId) ?? null
  // Clicking empty workspace deselects, as in Figma.
  const onWorkspacePointerDown = (e: React.PointerEvent) => {
    if (e.target === e.currentTarget) setSelectedId(null)
  }

  return (
    <MotionConfig reducedMotion="user">
      <TooltipProvider>
        <div className="flex min-h-dvh flex-col lg:grid lg:h-dvh lg:grid-cols-[260px_minmax(0,1fr)_288px] lg:overflow-hidden">
          {/* Left: file + layers and assets */}
          <aside className="bg-card flex min-h-0 flex-col border-b lg:border-r lg:border-b-0" aria-label="Layers and assets">
            <div className="flex h-12 shrink-0 items-center gap-1 border-b px-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="h-9 gap-1 px-1.5" aria-label="Main menu">
                    <span className="grid size-7 place-items-center rounded-md bg-[#FFF59D] text-[#020617]" aria-hidden>
                      <svg viewBox="0 0 16 16" className="size-4">
                        <rect x="3" y="3" width="10" height="10" fill="currentColor" />
                        <circle cx="8" cy="8" r="2.3" fill="#fff" />
                      </svg>
                    </span>
                    <ChevronDown className="text-muted-foreground size-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-60">
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>File</DropdownMenuSubTrigger>
                    <DropdownMenuSubContent className="w-56">
                      <DropdownMenuItem onSelect={quickSave}>
                        <Save /> Save <DropdownMenuShortcut>⌘S</DropdownMenuShortcut>
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => setDialog({ mode: "save", glyph: active })}>
                        <FilePlus2 /> Save as…
                      </DropdownMenuItem>
                      <DropdownMenuItem disabled={!active} onSelect={() => active && setDialog({ mode: "edit", glyph: active })}>
                        <Pencil /> Rename…
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onSelect={() => copy(window.location.href, "Share link")}>
                        <Link2 /> Copy share link
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={reset} disabled={history.value === INITIAL}>
                        <RotateCcw /> Reset to starter glyph
                      </DropdownMenuItem>
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>Edit</DropdownMenuSubTrigger>
                    <DropdownMenuSubContent className="w-56">
                      <DropdownMenuItem onSelect={history.undo} disabled={!history.canUndo}>
                        <Undo2 /> Undo <DropdownMenuShortcut>⌘Z</DropdownMenuShortcut>
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={history.redo} disabled={!history.canRedo}>
                        <Redo2 /> Redo <DropdownMenuShortcut>⇧⌘Z</DropdownMenuShortcut>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onSelect={randomize}>
                        <Dices /> Random glyph <DropdownMenuShortcut>R</DropdownMenuShortcut>
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={clearCanvas} disabled={!doc.shapes.length}>
                        <Eraser /> Clear canvas
                      </DropdownMenuItem>
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>View</DropdownMenuSubTrigger>
                    <DropdownMenuSubContent className="w-56">
                      <DropdownMenuCheckboxItem checked={showFrame} onCheckedChange={setShowFrame}>
                        Show 200 × 100 frame
                      </DropdownMenuCheckboxItem>
                      <DropdownMenuCheckboxItem checked={dark} onCheckedChange={setDark}>
                        Dark mode
                      </DropdownMenuCheckboxItem>
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger disabled={!doc.shapes.length}>Export</DropdownMenuSubTrigger>
                    <DropdownMenuSubContent className="w-56">
                      <ExportItems doc={doc} style={style} name={exportName} copy={copy} />
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <a href="https://carlosmarch.es/playground/shape-grammar">
                      <ExternalLink /> About the shape grammar
                    </a>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <button
                type="button"
                onClick={() => setDialog(active ? { mode: "edit", glyph: active } : { mode: "save", glyph: null })}
                className="hover:bg-muted min-w-0 flex-1 rounded-md px-1.5 py-1 text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                title={active ? "Rename" : "Save with a title"}
              >
                <h1 className="flex items-center gap-1.5 truncate text-sm leading-tight font-semibold">
                  <span className="truncate">{active?.title ?? "Untitled glyph"}</span>
                  {dirty && <span className="bg-primary size-1.5 shrink-0 rounded-full" aria-label="Unsaved changes" />}
                </h1>
                <p className="text-muted-foreground truncate text-xs">Glyph System Studio</p>
              </button>
            </div>

            <Tabs value={leftTab} onValueChange={setLeftTab} className="min-h-0 flex-1 gap-0">
              <PanelTabs>
                <PanelTab value="layers">Layers</PanelTab>
                <PanelTab value="assets">
                  Assets
                  {library.length > 0 && <span className="text-muted-foreground text-xs tabular-nums">{library.length}</span>}
                </PanelTab>
              </PanelTabs>
              <TabsContent value="layers" className="min-h-0 overflow-y-auto">
                <LayersPanel
                  doc={doc}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                  onFront={(id) => setDoc((d) => bringToFront(d, id))}
                  onRemove={remove}
                />
              </TabsContent>
              <TabsContent value="assets" className="min-h-0 overflow-y-auto">
                <SavedPanel
                  library={library}
                  activeId={activeId}
                  onOpen={openSaved}
                  onEdit={(glyph) => setDialog({ mode: "edit", glyph })}
                  onDelete={deleteSaved}
                />
                <PresetsPanel style={style} onLoad={loadPreset} />
              </TabsContent>
            </Tabs>
          </aside>

          {/* Centre: the workspace */}
          <main
            className="bg-muted/70 relative flex min-h-[70vh] flex-col overflow-auto lg:min-h-0"
            aria-label="Canvas"
            onPointerDown={onWorkspacePointerDown}
          >
            {/* Formula toolbar, mirroring the tools toolbar below */}
            <div className="pointer-events-none sticky top-0 z-10 flex h-[4.5rem] shrink-0 items-start justify-center px-4 pt-4">
              <FormulaField
                value={glyphFormula}
                onStart={() => {
                  beforeFormula.current = history.value
                }}
                onPreview={(next) => {
                  setHistory((s) => ({ ...s, doc: next }), { transient: true })
                  setSelectedId(null)
                }}
                onCommit={history.commit}
                onCancel={() => {
                  // Restore the exact state from before editing, so commit() records nothing.
                  if (beforeFormula.current) setHistory(beforeFormula.current, { transient: true })
                  history.commit()
                  beforeFormula.current = null
                }}
              />
            </div>

            <div className="mx-auto grid w-full max-w-3xl flex-1 content-center gap-4 px-4 pt-2 pb-4 sm:px-8" onPointerDown={onWorkspacePointerDown}>
              <div className="-mb-3 flex min-w-0">
                {/* The glyph's name sits on the frame's corner, like a frame name in Figma. */}
                <button
                  type="button"
                  onClick={() => setDialog(active ? { mode: "edit", glyph: active } : { mode: "save", glyph: null })}
                  className="text-muted-foreground hover:text-foreground -mx-1 truncate rounded px-1 text-xs font-medium outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  title={active ? "Rename" : "Save with a title"}
                >
                  {active?.title ?? "Untitled glyph"}
                </button>
              </div>

              <div className="overflow-hidden rounded-sm shadow-[0_1px_3px_rgb(0_0_0/0.08),0_8px_24px_-8px_rgb(0_0_0/0.15)]" style={{ background: style.ground }}>
                <GlyphCanvas
                  doc={doc}
                  style={style}
                  label={label}
                  selectedId={selectedId}
                  showFrame={showFrame}
                  onSelect={(id) => {
                    setSelectedId(id)
                    if (id) setRightTab((t) => (t === "relate" ? t : "design"))
                  }}
                  onMove={onMove}
                  onResize={(id, rect) => setDoc((d) => updateShape(d, id, rect), true)}
                  onMoveEnd={history.commit}
                />
              </div>

              <AnimatePresence initial={false}>
                {issues.map((issue) => (
                  <motion.p
                    key={issue.message}
                    layout
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className={
                      issue.level === "error"
                        ? "text-destructive flex items-center gap-2 text-sm"
                        : "text-muted-foreground flex items-center gap-2 text-sm"
                    }
                  >
                    <AlertTriangle className="size-4 shrink-0" /> {issue.message}
                  </motion.p>
                ))}
              </AnimatePresence>
            </div>

            {/* Floating toolbar, Figma UI3 style */}
            <div className="pointer-events-none sticky bottom-0 flex items-end justify-center gap-2 px-4 pb-4">
              <div
                role="toolbar"
                aria-label="Tools"
                className="bg-popover pointer-events-auto flex items-center gap-0.5 rounded-xl border p-1 shadow-lg"
              >
                {KINDS.map((k) => (
                  <Tooltip key={k}>
                    <TooltipTrigger asChild>
                      <span tabIndex={full ? 0 : -1}>
                        <Button variant="ghost" size="icon" onClick={() => add(k)} disabled={full} aria-label={`Add ${KIND_META[k].name.toLowerCase()}`}>
                          <ShapeIcon kind={k} />
                        </Button>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      {full ? (
                        `The grammar allows ${MAX_SHAPES} shapes`
                      ) : (
                        <>
                          {KIND_META[k].name}
                          <span className="ml-2 opacity-60">{k[0].toUpperCase()}</span>
                        </>
                      )}
                    </TooltipContent>
                  </Tooltip>
                ))}
                <span className="text-muted-foreground px-1.5 text-xs tabular-nums" aria-label={`${doc.shapes.length} of ${MAX_SHAPES} shapes`}>
                  {doc.shapes.length}/{MAX_SHAPES}
                </span>
                <Separator orientation="vertical" className="mx-1 data-[orientation=vertical]:h-5" />
                <IconAction label="Random glyph" shortcut="R" side="top" onClick={randomize}>
                  <Dices />
                </IconAction>
                <IconAction label="Clear canvas" side="top" onClick={clearCanvas} disabled={!doc.shapes.length}>
                  <Eraser />
                </IconAction>
                <Separator orientation="vertical" className="mx-1 data-[orientation=vertical]:h-5" />
                <IconAction label="Undo" shortcut="⌘Z" side="top" onClick={history.undo} disabled={!history.canUndo}>
                  <Undo2 />
                </IconAction>
                <IconAction label="Redo" shortcut="⇧⌘Z" side="top" onClick={history.redo} disabled={!history.canRedo}>
                  <Redo2 />
                </IconAction>
              </div>
            </div>

            <div className="absolute right-4 bottom-4 hidden sm:block">
              <DropdownMenu>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="icon" className="bg-popover size-8 rounded-full shadow-sm" aria-label="Keyboard shortcuts">
                        <HelpCircle />
                      </Button>
                    </DropdownMenuTrigger>
                  </TooltipTrigger>
                  <TooltipContent side="left">Keyboard shortcuts</TooltipContent>
                </Tooltip>
                <DropdownMenuContent align="end" side="top" className="w-72">
                  <DropdownMenuLabel>Canvas</DropdownMenuLabel>
                  {SHORTCUTS.map(([what, key]) => (
                    <div key={what} className="flex items-center justify-between px-2 py-1 text-sm">
                      {what}
                      <kbd className="text-muted-foreground font-mono text-xs">{key}</kbd>
                    </div>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel>Relations</DropdownMenuLabel>
                  {(Object.keys(RELATION_META) as RelationKind[]).map((r) => (
                    <div key={r} className="flex items-center justify-between px-2 py-1 text-sm">
                      {RELATION_META[r].name}
                      <span className="text-muted-foreground font-mono text-xs">A {RELATION_META[r].op} B</span>
                    </div>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </main>

          {/* Right: properties */}
          <aside className="bg-card flex min-h-0 flex-col border-t lg:border-t-0 lg:border-l" aria-label="Properties">
            <div className="flex h-12 shrink-0 items-center justify-end gap-1.5 border-b px-3">
              <IconAction label={dark ? "Light mode" : "Dark mode"} className="size-8" onClick={() => setDark(!dark)}>
                {dark ? <Sun /> : <Moon />}
              </IconAction>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="sm" className="relative" onClick={quickSave}>
                    Save
                    {dirty && <span className="bg-primary absolute top-1 right-1 size-1.5 rounded-full" aria-label="Unsaved changes" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {active ? (dirty ? `Unsaved changes to “${active.title}”` : `Saved as “${active.title}”`) : "Save with a title and description"}
                  <span className="ml-2 opacity-60">⌘S</span>
                </TooltipContent>
              </Tooltip>
              <Button size="sm" className="bg-[var(--selection)] text-white hover:bg-[var(--selection)]/90" onClick={() => copy(window.location.href, "Share link")}>
                Share
              </Button>
            </div>

            <Tabs value={rightTab} onValueChange={setRightTab} className="min-h-0 flex-1 gap-0">
              <PanelTabs>
                <PanelTab value="design">Design</PanelTab>
                <PanelTab value="relate">Relate</PanelTab>
              </PanelTabs>
              <TabsContent value="design" className="min-h-0 overflow-y-auto">
                {selectedShape && (
                  <ShapePanel
                    doc={doc}
                    shape={selectedShape}
                    onUpdate={(id, patch: Partial<Omit<Shape, "id">>, transient) => setDoc((d) => updateShape(d, id, patch), transient)}
                    onCommit={history.commit}
                    onDuplicate={(id) => {
                      const copyId = newId()
                      setDoc((d) => duplicateShape(d, id, copyId)?.doc ?? d)
                      setSelectedId(copyId)
                    }}
                    onRemove={remove}
                  />
                )}
                <StylePanel style={style} showFrame={showFrame} onChange={setStyle} onCommit={history.commit} onShowFrame={setShowFrame} />
                <PanelSection collapsible title="Export">
                  <div className="grid grid-cols-[1fr_auto] gap-2">
                    <Button variant="outline" size="sm" disabled={!doc.shapes.length} onClick={() => download(`${exportName}.svg`, toSVG(doc, style), "image/svg+xml")}>
                      <Download /> Export SVG
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="icon" className="size-8" aria-label="More export options" disabled={!doc.shapes.length}>
                          <ChevronDown />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-56">
                        <ExportItems doc={doc} style={style} name={exportName} copy={copy} />
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <p className="text-muted-foreground text-xs">
                    Or copy a <code className="font-mono">glyphs.ts</code> entry for the portfolio.
                  </p>
                </PanelSection>
              </TabsContent>
              <TabsContent value="relate" className="min-h-0 overflow-y-auto">
                <RelatePanel doc={doc} selectedId={selectedId} onApply={relate} onUnlink={(id) => setDoc((d) => removeLink(d, id))} />
              </TabsContent>
            </Tabs>
          </aside>
        </div>
        <SaveDialog
          open={!!dialog}
          onOpenChange={(open) => !open && setDialog(null)}
          current={dialog?.glyph ?? null}
          mode={dialog?.mode ?? "save"}
          suggestedTitle={glyphFormula || "Untitled glyph"}
          onSave={onSaveDialog}
        />
        {/* Bottom-centre, above the tools toolbar — the top is the formula toolbar. */}
        <Toaster position="bottom-center" offset={{ bottom: 76 }} mobileOffset={{ bottom: 76 }} />
      </TooltipProvider>
    </MotionConfig>
  )
}
