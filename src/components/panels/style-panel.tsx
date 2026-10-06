import { Check, Dices } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { PALETTES, type Style } from "@/lib/presets"
import { cn } from "@/lib/utils"

interface StylePanelProps {
  style: Style
  showFrame: boolean
  onChange: (patch: Partial<Style>, transient?: boolean) => void
  onCommit: () => void
  onShowFrame: (v: boolean) => void
}

const HEX = /^#[0-9a-f]{6}$/i

function ColorField({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={`${label} colour picker`}
          value={value}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          className="border-input size-9 shrink-0 cursor-pointer rounded-md border bg-transparent p-1"
        />
        <Input
          id={id}
          defaultValue={value}
          key={value}
          className="font-mono uppercase"
          maxLength={7}
          onBlur={(e) => HEX.test(e.target.value) && onChange(e.target.value.toUpperCase())}
          onKeyDown={(e) => {
            if (e.key === "Enter" && HEX.test(e.currentTarget.value)) onChange(e.currentTarget.value.toUpperCase())
          }}
        />
      </div>
    </div>
  )
}

export function StylePanel({ style, showFrame, onChange, onCommit, onShowFrame }: StylePanelProps) {
  const active = PALETTES.find((p) => p.ground === style.ground && p.fill === style.fill && p.ink === style.ink)

  return (
    <div className="grid gap-5">
      <div className="grid gap-2">
        <Label>Palette</Label>
        <div className="grid grid-cols-5 gap-2">
          {PALETTES.map((p) => (
            <button
              key={p.name}
              type="button"
              title={p.name}
              aria-label={`${p.name} palette`}
              aria-pressed={active === p}
              onClick={() => onChange({ ground: p.ground, fill: p.fill, ink: p.ink })}
              className={cn(
                "relative grid aspect-square place-items-center rounded-md border transition-transform outline-none hover:scale-105 focus-visible:ring-[3px] focus-visible:ring-ring/50",
                active === p && "ring-foreground ring-2 ring-offset-2 ring-offset-background",
              )}
              style={{ background: p.ground }}
            >
              <span className="flex items-center gap-0.5">
                <span className="size-3 rounded-full" style={{ background: p.fill }} />
                <span className="size-2 rounded-full" style={{ background: p.ink }} />
              </span>
              {active === p && <Check className="absolute top-0.5 right-0.5 size-3" style={{ color: p.ink }} />}
            </button>
          ))}
        </div>
        <p className="text-muted-foreground text-xs">{active ? active.name : "Custom"}</p>
      </div>

      <div className="grid gap-4">
        <ColorField id="ground" label="Ground" value={style.ground} onChange={(ground) => onChange({ ground })} />
        <ColorField id="fill" label="Fill · shape bodies" value={style.fill} onChange={(fill) => onChange({ fill })} />
        <ColorField id="ink" label="Ink · relations" value={style.ink} onChange={(ink) => onChange({ ink })} />
      </div>

      <Separator />

      <div className="grid gap-2">
        <div className="flex items-center justify-between">
          <Label>Hand-drawn wobble</Label>
          <span className="text-muted-foreground font-mono text-xs tabular-nums">{style.wobble.toFixed(1)}</span>
        </div>
        <Slider
          aria-label="Hand-drawn wobble"
          min={0}
          max={8}
          step={0.5}
          value={[style.wobble]}
          onValueChange={([wobble]) => onChange({ wobble }, true)}
          onValueCommit={onCommit}
        />
      </div>

      <div className="grid gap-2">
        <div className="flex items-center justify-between">
          <Label>Ink stroke</Label>
          <span className="text-muted-foreground font-mono text-xs tabular-nums">{style.stroke.toFixed(1)}</span>
        </div>
        <Slider
          aria-label="Ink stroke"
          min={0.6}
          max={4}
          step={0.2}
          value={[style.stroke]}
          onValueChange={([stroke]) => onChange({ stroke }, true)}
          onValueCommit={onCommit}
        />
      </div>

      <div className="flex items-end gap-3">
        <div className="grid flex-1 gap-2">
          <div className="flex items-center justify-between">
            <Label>Wobble seed</Label>
            <span className="text-muted-foreground font-mono text-xs tabular-nums">{style.seed}</span>
          </div>
          <Slider
            aria-label="Wobble seed"
            min={1}
            max={97}
            step={1}
            value={[style.seed]}
            onValueChange={([seed]) => onChange({ seed }, true)}
            onValueCommit={onCommit}
          />
        </div>
        <Button
          variant="outline"
          size="icon"
          aria-label="Random seed"
          onClick={() => onChange({ seed: 1 + Math.floor(Math.random() * 97) })}
        >
          <Dices />
        </Button>
      </div>

      <div className="flex items-center justify-between">
        <Label htmlFor="frame">Show the 200 × 100 frame</Label>
        <Switch id="frame" checked={showFrame} onCheckedChange={onShowFrame} />
      </div>
    </div>
  )
}
