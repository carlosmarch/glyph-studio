import { useCallback, useEffect, useMemo, useState } from "react"
import { AnimatePresence, MotionConfig, motion } from "motion/react"
import {
  AlertTriangle,
  Code2,
  Copy,
  Download,
  Eraser,
  Link2,
  Moon,
  Redo2,
  Sun,
  Undo2,
} from "lucide-react"
import { toast } from "sonner"

import { GlyphCanvas, type ShapeMove } from "@/components/glyph-canvas"
import { PresetsPanel } from "@/components/panels/presets-panel"
import { RelatePanel } from "@/components/panels/relate-panel"
import { ShapePanel } from "@/components/panels/shape-panel"
import { StylePanel } from "@/components/panels/style-panel"
import { ShapeIcon } from "@/components/shape-icon"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Toaster } from "@/components/ui/sonner"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useHistory } from "@/hooks/use-history"
import { decodeState, download, encodeState, toSnippet, toSVG } from "@/lib/export"
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

function initialState(): Studio {
  const shared = typeof window !== "undefined" ? decodeState(window.location.hash) : null
  return shared ?? { doc: STARTER, style: DEFAULT_STYLE }
}

function useDarkMode() {
  const [dark, setDark] = useState(() => window.matchMedia("(prefers-color-scheme: dark)").matches)
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark)
  }, [dark])
  return [dark, setDark] as const
}

function IconAction({ label, shortcut, children, ...props }: React.ComponentProps<typeof Button> & { label: string; shortcut?: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={label} {...props}>
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {label}
        {shortcut && <span className="ml-2 opacity-60">{shortcut}</span>}
      </TooltipContent>
    </Tooltip>
  )
}

export default function App() {
  const history = useHistory<Studio>(initialState())
  const { set: setHistory, undo, redo } = history
  const { doc, style } = history.value
  const [selection, setSelectedId] = useState<string | null>(null)
  const [showFrame, setShowFrame] = useState(true)
  const [tab, setTab] = useState("shape")
  const [dark, setDark] = useDarkMode()

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
      window.history.replaceState(null, "", `#g=${encodeState({ doc, style })}`)
    }, 250)
    return () => window.clearTimeout(t)
  }, [doc, style])

  const add = (kind: Kind) => {
    if (full) return
    const id = newId()
    setDoc((d) => addShape(d, kind, id).doc)
    setSelectedId(id)
    setTab("shape")
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
      if (target.closest("input, textarea, [contenteditable=true]")) return
      const mod = e.metaKey || e.ctrlKey
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
  }, [undo, redo, selectedId, remove, setDoc])

  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success(`${what} copied`)
    } catch {
      toast.error("Couldn't reach the clipboard")
    }
  }

  const label = glyphFormula ? `Glyph: ${glyphFormula.replace(/ {2}· {2}/g, ", ")}` : "Empty glyph canvas"

  return (
    <MotionConfig reducedMotion="user">
      <TooltipProvider>
        <div className="mx-auto flex min-h-dvh max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6">
          <header className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="grid size-9 place-items-center rounded-lg bg-[#FFF59D] text-[#020617]" aria-hidden>
                <svg viewBox="0 0 16 16" className="size-5">
                  <rect x="3" y="3" width="10" height="10" fill="currentColor" />
                  <circle cx="8" cy="8" r="2.3" fill="#fff" />
                </svg>
              </span>
              <div>
                <h1 className="text-lg leading-tight font-semibold">Glyph Studio</h1>
                <p className="text-muted-foreground text-sm">Three shapes. Five ways to relate.</p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <IconAction label="Undo" shortcut="⌘Z" onClick={history.undo} disabled={!history.canUndo}>
                <Undo2 />
              </IconAction>
              <IconAction label="Redo" shortcut="⇧⌘Z" onClick={history.redo} disabled={!history.canRedo}>
                <Redo2 />
              </IconAction>
              <IconAction label={dark ? "Light mode" : "Dark mode"} onClick={() => setDark(!dark)}>
                {dark ? <Sun /> : <Moon />}
              </IconAction>
              <Button variant="outline" className="ml-2" onClick={() => copy(window.location.href, "Share link")}>
                <Link2 /> Share
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button disabled={!doc.shapes.length}>
                    <Download /> Export
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>SVG</DropdownMenuLabel>
                  <DropdownMenuItem onSelect={() => download("glyph.svg", toSVG(doc, style), "image/svg+xml")}>
                    <Download /> Download SVG
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => copy(toSVG(doc, style), "SVG")}>
                    <Copy /> Copy SVG markup
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel>Portfolio</DropdownMenuLabel>
                  <DropdownMenuItem onSelect={() => copy(toSnippet(doc), "glyphs.ts entry")}>
                    <Code2 /> Copy glyphs.ts entry
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>

          <main className="grid flex-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
            <section className="grid gap-4 lg:sticky lg:top-6" aria-label="Canvas">
              <Card className="gap-0 overflow-hidden p-0">
                <GlyphCanvas
                  doc={doc}
                  style={style}
                  label={label}
                  selectedId={selectedId}
                  showFrame={showFrame}
                  onSelect={(id) => {
                    setSelectedId(id)
                    if (id) setTab((t) => (t === "relate" || t === "shape" ? t : "shape"))
                  }}
                  onMove={onMove}
                  onMoveEnd={history.commit}
                />
              </Card>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0" aria-live="polite">
                  <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Formula</p>
                  <AnimatePresence mode="popLayout" initial={false}>
                    <motion.p
                      key={glyphFormula}
                      initial={{ opacity: 0, y: 6, filter: "blur(4px)" }}
                      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                      exit={{ opacity: 0, y: -6, filter: "blur(4px)" }}
                      transition={{ duration: 0.2 }}
                      className="font-mono text-2xl break-words [word-spacing:0.1em]"
                    >
                      {glyphFormula || "—"}
                    </motion.p>
                  </AnimatePresence>
                </div>

                <div className="flex items-center gap-2">
                  {KINDS.map((k) => (
                    <Tooltip key={k}>
                      <TooltipTrigger asChild>
                        <span tabIndex={full ? 0 : -1}>
                          <Button variant="outline" onClick={() => add(k)} disabled={full} aria-label={`Add ${KIND_META[k].name.toLowerCase()}`}>
                            <ShapeIcon kind={k} />
                            <span className="hidden sm:inline">{KIND_META[k].name}</span>
                          </Button>
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>{full ? `The grammar allows ${MAX_SHAPES} shapes` : KIND_META[k].meaning}</TooltipContent>
                    </Tooltip>
                  ))}
                  <Badge variant={full ? "default" : "secondary"} className="tabular-nums">
                    {doc.shapes.length}/{MAX_SHAPES}
                  </Badge>
                  <IconAction
                    label="Clear canvas"
                    onClick={() => {
                      history.set((s) => ({ ...s, doc: { shapes: [], links: [] } }))
                      setSelectedId(null)
                    }}
                    disabled={!doc.shapes.length}
                  >
                    <Eraser />
                  </IconAction>
                </div>
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

              <p className="text-muted-foreground text-xs">
                Drag shapes to move them · <kbd className="font-mono">←↑→↓</kbd> nudge (⇧ ×5) ·{" "}
                <kbd className="font-mono">⌫</kbd> delete · <kbd className="font-mono">Esc</kbd> deselect. Relations:{" "}
                {(Object.keys(RELATION_META) as RelationKind[]).map((r) => `${RELATION_META[r].op} ${RELATION_META[r].name.toLowerCase()}`).join(" · ")}.
              </p>
            </section>

            <Card className="gap-0 py-0">
              <Tabs value={tab} onValueChange={setTab} className="gap-0">
                <div className="border-b p-3">
                  <TabsList className="w-full">
                    <TabsTrigger value="shape">Shape</TabsTrigger>
                    <TabsTrigger value="relate">Relate</TabsTrigger>
                    <TabsTrigger value="style">Style</TabsTrigger>
                    <TabsTrigger value="presets">Presets</TabsTrigger>
                  </TabsList>
                </div>
                <div className="p-5">
                  <TabsContent value="shape">
                    <ShapePanel
                      doc={doc}
                      selectedId={selectedId}
                      onSelect={setSelectedId}
                      onUpdate={(id, patch: Partial<Omit<Shape, "id">>, transient) => setDoc((d) => updateShape(d, id, patch), transient)}
                      onCommit={history.commit}
                      onDuplicate={(id) => {
                        const copyId = newId()
                        setDoc((d) => duplicateShape(d, id, copyId)?.doc ?? d)
                        setSelectedId(copyId)
                      }}
                      onFront={(id) => setDoc((d) => bringToFront(d, id))}
                      onRemove={remove}
                    />
                  </TabsContent>
                  <TabsContent value="relate">
                    <RelatePanel
                      doc={doc}
                      selectedId={selectedId}
                      onApply={relate}
                      onUnlink={(id) => setDoc((d) => removeLink(d, id))}
                    />
                  </TabsContent>
                  <TabsContent value="style">
                    <StylePanel
                      style={style}
                      showFrame={showFrame}
                      onChange={setStyle}
                      onCommit={history.commit}
                      onShowFrame={setShowFrame}
                    />
                  </TabsContent>
                  <TabsContent value="presets">
                    <PresetsPanel style={style} onLoad={loadPreset} />
                  </TabsContent>
                </div>
              </Tabs>
            </Card>
          </main>

          <footer className="text-muted-foreground border-t pt-4 text-xs">
            Based on the shape grammar by{" "}
            <a className="underline underline-offset-4 hover:text-foreground" href="https://carlosmarch.es/playground/shape-grammar">
              Carlos March
            </a>
            . Exports drop straight into the portfolio's <code className="font-mono">glyphs.ts</code>.
          </footer>
        </div>
        <Toaster position="bottom-center" />
      </TooltipProvider>
    </MotionConfig>
  )
}
