import { AnimatePresence, motion } from "motion/react"
import { ArrowLeftRight, Link2Off, Sparkles } from "lucide-react"
import { useState } from "react"

import { ShapeIcon } from "@/components/shape-icon"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  inferRelations,
  KIND_META,
  RELATION_META,
  RELATIONS,
  shapeLabel,
  type Doc,
  type RelationKind,
} from "@/lib/grammar"

interface RelatePanelProps {
  doc: Doc
  selectedId: string | null
  onApply: (kind: RelationKind, a: string, b: string) => void
  onUnlink: (linkId: string) => void
}

export function RelatePanel({ doc, selectedId, onApply, onUnlink }: RelatePanelProps) {
  const [kind, setKind] = useState<RelationKind>("connect")
  const [pickA, setA] = useState<string>("")
  const [pickB, setB] = useState<string>("")

  // Picks stay valid as shapes come and go; A defaults to the selection.
  const ids = doc.shapes.map((s) => s.id)
  const a = ids.includes(pickA) ? pickA : (selectedId ?? ids[0] ?? "")
  const b = ids.includes(pickB) && pickB !== a ? pickB : (ids.find((id) => id !== a) ?? "")

  const relations = inferRelations(doc)
  const byId = new Map(doc.shapes.map((s) => [s.id, s]))
  const canApply = !!a && !!b && a !== b

  const shapeSelect = (value: string, onChange: (v: string) => void, id: string, exclude?: string) => (
    <Select value={value} onValueChange={onChange} disabled={doc.shapes.length < 2}>
      <SelectTrigger id={id} className="w-full">
        <SelectValue placeholder="Pick a shape" />
      </SelectTrigger>
      <SelectContent>
        {doc.shapes.map((s) => (
          <SelectItem key={s.id} value={s.id} disabled={s.id === exclude}>
            <ShapeIcon kind={s.kind} role={s.role} />
            {shapeLabel(doc, s)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )

  return (
    <div className="grid gap-5">
      <div className="grid gap-2">
        <Label>Relation</Label>
        <ToggleGroup
          type="single"
          variant="outline"
          value={kind}
          onValueChange={(v) => v && setKind(v as RelationKind)}
          className="w-full"
        >
          {RELATIONS.map((r) => (
            <ToggleGroupItem key={r} value={r} aria-label={RELATION_META[r].name} className="h-auto min-w-0 shrink flex-col gap-0 px-1 py-1">
              <span className="font-mono text-base leading-tight">{RELATION_META[r].op}</span>
              <span className="text-[10px] leading-tight">{RELATION_META[r].name}</span>
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <AnimatePresence mode="wait" initial={false}>
          <motion.p
            key={kind}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="text-muted-foreground text-xs"
          >
            <span className="text-foreground font-mono">A {RELATION_META[kind].op} B</span> — {RELATION_META[kind].reads}
          </motion.p>
        </AnimatePresence>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-end gap-2">
        <div className="grid gap-2">
          <Label htmlFor="rel-a">A</Label>
          {shapeSelect(a, setA, "rel-a", b)}
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Swap A and B"
          onClick={() => {
            setA(b)
            setB(a)
          }}
          disabled={!canApply}
        >
          <ArrowLeftRight />
        </Button>
        <div className="grid gap-2">
          <Label htmlFor="rel-b">B</Label>
          {shapeSelect(b, setB, "rel-b", a)}
        </div>
      </div>

      <Button onClick={() => canApply && onApply(kind, a, b)} disabled={!canApply}>
        <Sparkles /> Relate A {RELATION_META[kind].op} B
      </Button>
      {doc.shapes.length < 2 && (
        <p className="text-muted-foreground text-xs">Relations need two shapes. Add another below the canvas.</p>
      )}

      <Separator />

      <div className="grid gap-2">
        <Label>Read from the canvas</Label>
        {relations.length ? (
          <ul className="grid gap-1.5">
            <AnimatePresence initial={false}>
              {relations.map((r) => {
                const ra = byId.get(r.a)!
                const rb = byId.get(r.b)!
                const sym = (s: typeof ra) => (s.role === "outline" ? KIND_META[s.kind].hollow : KIND_META[s.kind].symbol)
                return (
                  <motion.li
                    key={`${r.kind}-${r.a}-${r.b}`}
                    layout
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 6 }}
                    className="bg-muted/60 flex items-center justify-between gap-2 rounded-md px-3 py-1.5 text-sm"
                  >
                    <span>
                      <span className="font-mono">
                        {sym(ra)} {RELATION_META[r.kind].op} {sym(rb)}
                      </span>
                      <span className="text-muted-foreground ml-2 text-xs">
                        {RELATION_META[r.kind].name} · {doc.shapes.indexOf(ra) + 1} → {doc.shapes.indexOf(rb) + 1}
                      </span>
                    </span>
                    {r.linkId && (
                      <Button variant="ghost" size="icon" className="size-7" aria-label="Remove line" onClick={() => onUnlink(r.linkId!)}>
                        <Link2Off />
                      </Button>
                    )}
                  </motion.li>
                )
              })}
            </AnimatePresence>
          </ul>
        ) : (
          <p className="text-muted-foreground text-sm">No relations yet — the shapes stand alone.</p>
        )}
      </div>
    </div>
  )
}
