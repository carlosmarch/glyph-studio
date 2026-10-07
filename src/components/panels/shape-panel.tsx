import { CopyPlus, Link, Unlink, Trash2 } from "lucide-react"
import { useRef, useState, type PointerEvent } from "react"

import { PanelSection } from "@/components/panels/panel-section"
import { ShapeIcon } from "@/components/shape-icon"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { BOX_H, BOX_W, KIND_META, KINDS, MAX_SHAPES, MIN_SIZE, type Doc, type Kind, type Role, type Shape } from "@/lib/grammar"

const ROLE_LABEL: Record<Role, string> = {
  fill: "Body (fill)",
  outline: "Outline (overlap)",
  ink: "Mark (nested, ink)",
}

interface ShapePanelProps {
  doc: Doc
  shape: Shape
  onUpdate: (id: string, patch: Partial<Omit<Shape, "id">>, transient?: boolean) => void
  onCommit: () => void
  onDuplicate: (id: string) => void
  onRemove: (id: string) => void
}

const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max)

// A Figma-style number box: type a value, or drag the letter to scrub it.
function NumberField({
  label,
  name,
  value,
  min,
  max,
  onChange,
  onCommit,
}: {
  label: string
  name: string
  value: number
  min: number
  max: number
  onChange: (v: number) => void
  onCommit: () => void
}) {
  const [draft, setDraft] = useState<string | null>(null)
  const scrub = useRef<{ x: number; v: number } | null>(null)

  const onScrubStart = (e: PointerEvent<HTMLSpanElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    scrub.current = { x: e.clientX, v: value }
  }
  const onScrubMove = (e: PointerEvent<HTMLSpanElement>) => {
    if (!scrub.current) return
    const step = e.shiftKey ? 5 : 1
    onChange(clamp(Math.round(scrub.current.v + ((e.clientX - scrub.current.x) / 2) * step), min, max))
  }
  const onScrubEnd = () => {
    if (!scrub.current) return
    scrub.current = null
    onCommit()
  }

  const apply = (text: string) => {
    const v = Number(text)
    if (text.trim() && Number.isFinite(v)) {
      onChange(clamp(Math.round(v), min, max))
      onCommit()
    }
    setDraft(null)
  }

  return (
    <label className="border-input hover:border-ring/60 focus-within:border-ring dark:bg-input/30 flex h-8 items-center rounded-md border bg-transparent text-sm">
      <span
        title={`${name} — drag to adjust`}
        className="text-muted-foreground grid h-full w-7 shrink-0 cursor-ew-resize place-items-center text-xs select-none"
        onPointerDown={onScrubStart}
        onPointerMove={onScrubMove}
        onPointerUp={onScrubEnd}
        onPointerCancel={onScrubEnd}
      >
        {label}
      </span>
      <input
        aria-label={name}
        inputMode="numeric"
        className="h-full w-full min-w-0 bg-transparent pr-2 font-mono text-xs tabular-nums outline-none"
        value={draft ?? String(Math.round(value))}
        onFocus={(e) => e.currentTarget.select()}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={(e) => draft !== null && apply(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") apply(e.currentTarget.value)
          else if (e.key === "Escape") {
            setDraft(null)
            e.currentTarget.blur()
          } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
            e.preventDefault()
            const d = (e.key === "ArrowUp" ? 1 : -1) * (e.shiftKey ? 10 : 1)
            onChange(clamp(Math.round(value) + d, min, max))
            onCommit()
            setDraft(null)
          }
        }}
      />
    </label>
  )
}

export function ShapePanel({ doc, shape: s, onUpdate, onCommit, onDuplicate, onRemove }: ShapePanelProps) {
  const [lockRatio, setLockRatio] = useState(true)
  const n = doc.shapes.indexOf(s) + 1

  return (
    <>
      <PanelSection
        collapsible
        title={`${KIND_META[s.kind].name} ${n}`}
        actions={
          <>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  aria-label="Duplicate"
                  onClick={() => onDuplicate(s.id)}
                  disabled={doc.shapes.length >= MAX_SHAPES}
                >
                  <CopyPlus />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Duplicate</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="size-7" aria-label="Delete" onClick={() => onRemove(s.id)}>
                  <Trash2 />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                Delete <span className="ml-2 opacity-60">⌫</span>
              </TooltipContent>
            </Tooltip>
          </>
        }
      >
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          value={s.kind}
          onValueChange={(v) => v && onUpdate(s.id, { kind: v as Kind })}
          className="w-full"
          aria-label="Primitive"
        >
          {KINDS.map((k) => (
            <ToggleGroupItem key={k} value={k} aria-label={KIND_META[k].name} className="gap-1.5">
              <ShapeIcon kind={k} />
              <span className="text-xs">{KIND_META[k].name}</span>
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <p className="text-muted-foreground -mt-1 text-xs">{KIND_META[s.kind].meaning}</p>
        <Select value={s.role} onValueChange={(v) => onUpdate(s.id, { role: v as Role })}>
          <SelectTrigger aria-label="Role" size="sm" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
              <SelectItem key={r} value={r}>
                <ShapeIcon kind={s.kind} role={r} />
                {ROLE_LABEL[r]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </PanelSection>

      <PanelSection collapsible title="Layout">
        <div className="grid grid-cols-[1fr_1fr_28px] items-center gap-2">
          <NumberField label="X" name="X position" value={s.x} min={0} max={BOX_W - s.w} onChange={(x) => onUpdate(s.id, { x }, true)} onCommit={onCommit} />
          <NumberField label="Y" name="Y position" value={s.y} min={0} max={BOX_H - s.h} onChange={(y) => onUpdate(s.id, { y }, true)} onCommit={onCommit} />
          <span />
          <NumberField
            label="W"
            name="Width"
            value={s.w}
            min={MIN_SIZE}
            max={BOX_W - s.x}
            onChange={(w) => onUpdate(s.id, lockRatio ? { w, h: clamp(s.h * (w / s.w), MIN_SIZE, BOX_H - s.y) } : { w }, true)}
            onCommit={onCommit}
          />
          <NumberField
            label="H"
            name="Height"
            value={s.h}
            min={MIN_SIZE}
            max={BOX_H - s.y}
            onChange={(h) => onUpdate(s.id, lockRatio ? { h, w: clamp(s.w * (h / s.h), MIN_SIZE, BOX_W - s.x) } : { h }, true)}
            onCommit={onCommit}
          />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={lockRatio ? "secondary" : "ghost"}
                size="icon"
                className="size-7"
                aria-label="Keep proportions"
                aria-pressed={lockRatio}
                onClick={() => setLockRatio(!lockRatio)}
              >
                {lockRatio ? <Link /> : <Unlink />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{lockRatio ? "Proportions locked" : "Keep proportions"}</TooltipContent>
          </Tooltip>
        </div>
      </PanelSection>
    </>
  )
}
