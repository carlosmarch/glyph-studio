import { useMemo, useState } from "react"
import { motion } from "motion/react"

import { StaticGlyph } from "@/components/glyph-canvas"
import { PanelSection } from "@/components/panels/panel-section"
import { ShapeIcon } from "@/components/shape-icon"
import { Button } from "@/components/ui/button"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { fromSpec, KIND_META, KINDS, RELATION_META, RELATIONS, type Doc, type Kind, type RelationKind } from "@/lib/grammar"
import { COMPOUND_THEMES, COMPOUNDS, pairSpec, PRIMITIVES, type CompoundTheme, type Preset, type Style } from "@/lib/presets"

interface PresetsPanelProps {
  style: Style
  onLoad: (doc: Doc, name: string) => void
}

// Name on one line, formula on the next, so neither truncates; the reading shows on hover.
function PresetTile({ preset, style, onLoad }: { preset: Preset; style: Style; onLoad: (doc: Doc, name: string) => void }) {
  const doc = useMemo(() => fromSpec(preset.spec), [preset])
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <motion.button
          type="button"
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => onLoad(fromSpec(preset.spec), preset.name)}
          className="group grid content-start gap-1.5 rounded-lg text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          aria-label={`Load ${preset.name}: ${preset.formula}. ${preset.reading}`}
        >
          <span className="block rounded-md p-2" style={{ background: style.ground }}>
            <StaticGlyph doc={doc} style={style} />
          </span>
          <span className="grid min-w-0 gap-0.5">
            <span className="text-xs font-medium">{preset.name}</span>
            <span className="text-muted-foreground font-mono text-[10px] break-words">{preset.formula}</span>
          </span>
        </motion.button>
      </TooltipTrigger>
      <TooltipContent side="right" className="max-w-56">
        {preset.reading}
      </TooltipContent>
    </Tooltip>
  )
}

export function PresetsPanel({ style, onLoad }: PresetsPanelProps) {
  const [a, setA] = useState<Kind>("triangle")
  const [rel, setRel] = useState<RelationKind>("stack")
  const [b, setB] = useState<Kind>("square")
  const [theme, setTheme] = useState<CompoundTheme | "All">("All")
  const shelves = (theme === "All" ? COMPOUND_THEMES : [theme]).map((t) => ({
    theme: t,
    presets: COMPOUNDS.filter((p) => p.theme === t),
  }))
  const pair = useMemo(() => fromSpec(pairSpec(rel, a, b)), [rel, a, b])
  const pairFormula = `${rel === "overlap" ? KIND_META[a].hollow : KIND_META[a].symbol} ${RELATION_META[rel].op} ${KIND_META[b].symbol}`

  const kindToggle = (value: Kind, onChange: (k: Kind) => void, label: string) => (
    <ToggleGroup
      type="single"
      variant="outline"
      size="sm"
      value={value}
      onValueChange={(v) => v && onChange(v as Kind)}
      aria-label={label}
    >
      {KINDS.map((k) => (
        <ToggleGroupItem key={k} value={k} aria-label={KIND_META[k].name}>
          <ShapeIcon kind={k} />
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )

  return (
    <>
      <PanelSection title="Primitives" collapsible>
        <div className="grid grid-cols-3 gap-2">
          {PRIMITIVES.map((p) => (
            <PresetTile key={p.name} preset={p} style={style} onLoad={onLoad} />
          ))}
        </div>
      </PanelSection>

      <PanelSection title="Ordered pairs" collapsible>
        <div>
          <p className="text-muted-foreground text-xs">
            Nine ordered pairs × five relations = 45 base glyphs. Order matters.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {kindToggle(a, setA, "Shape A")}
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            value={rel}
            onValueChange={(v) => v && setRel(v as RelationKind)}
            aria-label="Relation"
          >
            {RELATIONS.map((r) => (
              <ToggleGroupItem key={r} value={r} aria-label={RELATION_META[r].name} className="font-mono">
                {RELATION_META[r].op}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          {kindToggle(b, setB, "Shape B")}
        </div>
        <span className="block rounded-md p-3" style={{ background: style.ground }}>
          <StaticGlyph doc={pair} style={style} label={pairFormula} />
        </span>
        <div className="flex items-center justify-between gap-3">
          <span className="font-mono text-sm">{pairFormula}</span>
          <Button size="sm" variant="secondary" onClick={() => onLoad(fromSpec(pairSpec(rel, a, b)), pairFormula)}>
            Load pair
          </Button>
        </div>
      </PanelSection>

      <PanelSection title="Compounds" collapsible>
        <div>
          <p className="text-muted-foreground text-xs">
            A finished glyph behaves like a single shape, so relations chain into larger glyphs.
          </p>
        </div>
        <div className="flex flex-wrap gap-1" role="group" aria-label="Compound topics">
          {(["All", ...COMPOUND_THEMES] as const).map((t) => (
            <Button
              key={t}
              size="sm"
              variant={theme === t ? "secondary" : "ghost"}
              aria-pressed={theme === t}
              onClick={() => setTheme(t)}
              className="h-7 px-2.5 text-xs"
            >
              {t}
            </Button>
          ))}
        </div>
        {shelves.map((shelf) => (
          <div key={shelf.theme} className="grid gap-3">
            {theme === "All" && (
              <span className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">{shelf.theme}</span>
            )}
            <div className="grid grid-cols-2 gap-3">
              {shelf.presets.map((p) => (
                <PresetTile key={p.name} preset={p} style={style} onLoad={onLoad} />
              ))}
            </div>
          </div>
        ))}
      </PanelSection>
    </>
  )
}
