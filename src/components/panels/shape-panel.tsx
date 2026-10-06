import { BringToFront, CopyPlus, Trash2 } from "lucide-react"
import { useState } from "react"

import { ShapeIcon } from "@/components/shape-icon"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { BOX_H, BOX_W, KIND_META, KINDS, MAX_SHAPES, MIN_SIZE, shapeLabel, type Doc, type Kind, type Role, type Shape } from "@/lib/grammar"

const ROLE_LABEL: Record<Role, string> = {
  fill: "Body (fill)",
  outline: "Outline (overlap)",
  ink: "Mark (nested, ink)",
}

interface ShapePanelProps {
  doc: Doc
  selectedId: string | null
  onSelect: (id: string | null) => void
  onUpdate: (id: string, patch: Partial<Omit<Shape, "id">>, transient?: boolean) => void
  onCommit: () => void
  onDuplicate: (id: string) => void
  onFront: (id: string) => void
  onRemove: (id: string) => void
}

function Field({
  label,
  value,
  min,
  max,
  onChange,
  onCommit,
}: {
  label: string
  value: number
  min: number
  max: number
  onChange: (v: number) => void
  onCommit: () => void
}) {
  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        <span className="text-muted-foreground font-mono text-xs tabular-nums">{Math.round(value)}</span>
      </div>
      <Slider
        aria-label={label}
        min={min}
        max={max}
        step={1}
        value={[value]}
        onValueChange={([v]) => onChange(v)}
        onValueCommit={onCommit}
      />
    </div>
  )
}

export function ShapePanel({ doc, selectedId, onSelect, onUpdate, onCommit, onDuplicate, onFront, onRemove }: ShapePanelProps) {
  const [lockRatio, setLockRatio] = useState(true)
  const s = doc.shapes.find((x) => x.id === selectedId)

  return (
    <div className="grid gap-5">
      <div className="grid gap-2">
        <Label>Shapes on the canvas</Label>
        {doc.shapes.length ? (
          <ToggleGroup
            type="single"
            variant="outline"
            value={selectedId ?? ""}
            onValueChange={(v) => onSelect(v || null)}
            className="w-full flex-wrap"
          >
            {doc.shapes.map((x) => (
              <ToggleGroupItem key={x.id} value={x.id} aria-label={shapeLabel(doc, x)} className="gap-1.5">
                <ShapeIcon kind={x.kind} role={x.role} />
                <span className="text-xs tabular-nums">{doc.shapes.indexOf(x) + 1}</span>
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        ) : (
          <p className="text-muted-foreground text-sm">Nothing here yet. Add a shape below the canvas.</p>
        )}
      </div>

      <Separator />

      {!s ? (
        <p className="text-muted-foreground text-sm">
          Select a shape on the canvas or above to edit it. Drag shapes to move them; a body carries its nested marks.
        </p>
      ) : (
        <div className="grid gap-5">
          <div className="grid gap-2">
            <Label>Primitive</Label>
            <ToggleGroup
              type="single"
              variant="outline"
              value={s.kind}
              onValueChange={(v) => v && onUpdate(s.id, { kind: v as Kind })}
              className="w-full"
            >
              {KINDS.map((k) => (
                <ToggleGroupItem key={k} value={k} aria-label={KIND_META[k].name} className="gap-1.5">
                  <ShapeIcon kind={k} />
                  <span className="text-xs">{KIND_META[k].name}</span>
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            <p className="text-muted-foreground text-xs">{KIND_META[s.kind].meaning}</p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="role">Role</Label>
            <Select value={s.role} onValueChange={(v) => onUpdate(s.id, { role: v as Role })}>
              <SelectTrigger id="role" className="w-full">
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
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="X" value={s.x} min={0} max={BOX_W - s.w} onChange={(x) => onUpdate(s.id, { x }, true)} onCommit={onCommit} />
            <Field label="Y" value={s.y} min={0} max={BOX_H - s.h} onChange={(y) => onUpdate(s.id, { y }, true)} onCommit={onCommit} />
            <Field
              label="Width"
              value={s.w}
              min={MIN_SIZE}
              max={BOX_W}
              onChange={(w) => onUpdate(s.id, lockRatio ? { w, h: Math.min(BOX_H, s.h * (w / s.w)) } : { w }, true)}
              onCommit={onCommit}
            />
            <Field
              label="Height"
              value={s.h}
              min={MIN_SIZE}
              max={BOX_H}
              onChange={(h) => onUpdate(s.id, lockRatio ? { h, w: Math.min(BOX_W, s.w * (h / s.h)) } : { h }, true)}
              onCommit={onCommit}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="lock">Keep proportions</Label>
            <Switch id="lock" checked={lockRatio} onCheckedChange={setLockRatio} />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => onDuplicate(s.id)} disabled={doc.shapes.length >= MAX_SHAPES}>
              <CopyPlus /> Duplicate
            </Button>
            <Button variant="outline" size="sm" onClick={() => onFront(s.id)}>
              <BringToFront /> To front
            </Button>
            <Button variant="outline" size="sm" className="text-destructive" onClick={() => onRemove(s.id)}>
              <Trash2 /> Delete
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
