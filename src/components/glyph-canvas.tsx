import { useEffect, useId, useMemo, useRef, useState, type PointerEvent } from "react"
import { AnimatePresence, motion, type Transition } from "motion/react"

import { BOX_H, BOX_W, center, shapePath, type Doc, type Shape } from "@/lib/grammar"
import type { Style } from "@/lib/presets"
import { cn } from "@/lib/utils"

const PAD = 12
const NODE_R = 2.4
/** Selection handle size, in screen pixels. */
const HANDLE_PX = 7
const SPRING: Transition = { type: "spring", stiffness: 420, damping: 32, mass: 0.8 }
const INSTANT: Transition = { duration: 0 }

export interface ShapeMove {
  id: string
  x: number
  y: number
}

interface GlyphCanvasProps {
  doc: Doc
  style: Style
  label: string
  selectedId: string | null
  showFrame: boolean
  onSelect: (id: string | null) => void
  /** Called on every pointer move while dragging (transient). */
  onMove: (moves: ShapeMove[]) => void
  /** Called once when a drag ends, to record one undo step. */
  onMoveEnd: () => void
  className?: string
}

interface DragState {
  ids: string[]
  offsets: { id: string; dx: number; dy: number }[]
}

/** Shapes nested (ink) inside a body travel with it when it's dragged. */
function passengers(doc: Doc, s: Shape): Shape[] {
  if (s.role !== "fill") return []
  return doc.shapes.filter(
    (k) => k.role === "ink" && k.x >= s.x - 1 && k.y >= s.y - 1 && k.x + k.w <= s.x + s.w + 1 && k.y + k.h <= s.y + s.h + 1,
  )
}

export function GlyphCanvas({
  doc,
  style,
  label,
  selectedId,
  showFrame,
  onSelect,
  onMove,
  onMoveEnd,
  className,
}: GlyphCanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const drag = useRef<DragState | null>(null)
  const [dragging, setDragging] = useState<string[]>([])
  // Glyph units per screen pixel, so selection handles keep a constant on-screen size.
  const [unit, setUnit] = useState(1)
  const filterId = `wobble-${useId().replace(/:/g, "")}`

  const byId = useMemo(() => new Map(doc.shapes.map((s) => [s.id, s])), [doc.shapes])
  const selected = selectedId ? byId.get(selectedId) : undefined

  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const update = () => {
      const w = svg.getBoundingClientRect().width
      if (w > 0) setUnit((BOX_W + PAD * 2) / w)
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(svg)
    return () => ro.disconnect()
  }, [])

  function toGlyph(e: PointerEvent) {
    const svg = svgRef.current
    const ctm = svg?.getScreenCTM()
    if (!svg || !ctm) return { x: 0, y: 0 }
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse())
    return { x: p.x, y: p.y }
  }

  function startDrag(e: PointerEvent, s: Shape) {
    e.stopPropagation()
    onSelect(s.id)
    const p = toGlyph(e)
    const group = [s, ...passengers(doc, s)]
    drag.current = { ids: group.map((g) => g.id), offsets: group.map((g) => ({ id: g.id, dx: p.x - g.x, dy: p.y - g.y })) }
    setDragging(drag.current.ids)
    svgRef.current?.setPointerCapture(e.pointerId)
  }

  function moveDrag(e: PointerEvent) {
    const d = drag.current
    if (!d) return
    const p = toGlyph(e)
    onMove(d.offsets.map((o) => ({ id: o.id, x: Math.round(p.x - o.dx), y: Math.round(p.y - o.dy) })))
  }

  function endDrag(e: PointerEvent) {
    if (!drag.current) return
    drag.current = null
    setDragging([])
    svgRef.current?.releasePointerCapture(e.pointerId)
    onMoveEnd()
  }

  const isDragging = (id: string) => dragging.includes(id)
  const layer = (role: Shape["role"]) => doc.shapes.filter((s) => s.role === role)

  const shapeEl = (s: Shape) => {
    const props =
      s.role === "fill"
        ? { fill: style.fill, stroke: "rgba(0,0,0,0)", strokeWidth: 0 }
        : s.role === "outline"
          ? { fill: "rgba(0,0,0,0)", stroke: style.ink, strokeWidth: style.stroke }
          : { fill: style.ink, stroke: "rgba(0,0,0,0)", strokeWidth: 0 }
    return (
      <motion.path
        key={`${s.id}-${s.kind}`}
        data-shape={s.id}
        initial={{ opacity: 0, scale: 0.4, d: shapePath(s.kind, s.x, s.y, s.w, s.h) }}
        animate={{ opacity: 1, scale: 1, d: shapePath(s.kind, s.x, s.y, s.w, s.h), ...props }}
        exit={{ opacity: 0, scale: 0.4 }}
        transition={isDragging(s.id) ? { ...SPRING, d: INSTANT } : SPRING}
        strokeLinejoin="round"
        // Outlines only catch the pointer on their stroke, so bodies underneath stay draggable.
        pointerEvents={s.role === "outline" ? "visibleStroke" : "visiblePainted"}
        style={{ transformBox: "fill-box", transformOrigin: "center", cursor: isDragging(s.id) ? "grabbing" : "grab" }}
        onPointerDown={(e) => startDrag(e, s)}
      />
    )
  }

  const lines = doc.links
    .map((l) => {
      const a = byId.get(l.a)
      const b = byId.get(l.b)
      if (!a || !b) return null
      const [x1, y1] = center(a)
      const [x2, y2] = center(b)
      return { id: l.id, x1, y1, x2, y2, instant: isDragging(a.id) || isDragging(b.id) }
    })
    .filter((x): x is NonNullable<typeof x> => !!x)

  return (
    <svg
      ref={svgRef}
      viewBox={`${-PAD} ${-PAD} ${BOX_W + PAD * 2} ${BOX_H + PAD * 2}`}
      className={cn("block h-auto w-full touch-none select-none", className)}
      role="img"
      aria-label={label}
      onPointerDown={() => onSelect(null)}
      onPointerMove={moveDrag}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      <defs>
        <filter id={filterId} x="-10%" y="-10%" width="120%" height="120%">
          <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves={2} seed={style.seed} />
          {/* Plain attribute: Motion would read `scale` as a CSS transform here. */}
          <feDisplacementMap in="SourceGraphic" scale={style.wobble} />
        </filter>
      </defs>

      <motion.rect
        x={-PAD}
        y={-PAD}
        width={BOX_W + PAD * 2}
        height={BOX_H + PAD * 2}
        initial={false}
        animate={{ fill: style.ground }}
        transition={{ duration: 0.3 }}
      />

      {showFrame && (
        <rect
          x={0}
          y={0}
          width={BOX_W}
          height={BOX_H}
          fill="none"
          stroke={style.ink}
          strokeOpacity={0.22}
          strokeDasharray="2 2"
          strokeWidth={0.5}
          pointerEvents="none"
        />
      )}

      <g filter={style.wobble > 0 ? `url(#${filterId})` : undefined}>
        <AnimatePresence>{layer("fill").map(shapeEl)}</AnimatePresence>
        <AnimatePresence>{layer("outline").map(shapeEl)}</AnimatePresence>
        <AnimatePresence>{layer("ink").map(shapeEl)}</AnimatePresence>

        <AnimatePresence>
          {lines.map((l) => (
            <motion.line
              key={l.id}
              initial={{ pathLength: 0, x1: l.x1, y1: l.y1, x2: l.x2, y2: l.y2 }}
              animate={{ pathLength: 1, x1: l.x1, y1: l.y1, x2: l.x2, y2: l.y2, stroke: style.ink, strokeWidth: style.stroke }}
              exit={{ pathLength: 0, opacity: 0 }}
              transition={l.instant ? { ...SPRING, x1: INSTANT, y1: INSTANT, x2: INSTANT, y2: INSTANT } : SPRING}
              strokeLinecap="round"
              pointerEvents="none"
            />
          ))}
        </AnimatePresence>

        <AnimatePresence>
          {lines.flatMap((l) =>
            [
              [l.x1, l.y1],
              [l.x2, l.y2],
            ].map(([cx, cy], i) => (
              <motion.circle
                key={`${l.id}-${i}`}
                r={NODE_R}
                initial={{ cx, cy, scale: 0 }}
                animate={{ cx, cy, scale: 1, fill: style.ink }}
                exit={{ scale: 0 }}
                transition={l.instant ? { ...SPRING, cx: INSTANT, cy: INSTANT } : SPRING}
                style={{ transformBox: "fill-box", transformOrigin: "center" }}
                pointerEvents="none"
              />
            )),
          )}
        </AnimatePresence>
      </g>

      <AnimatePresence>
        {selected && (
          <motion.g key="selection" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} pointerEvents="none">
            <motion.rect
              initial={false}
              animate={{ x: selected.x, y: selected.y, width: selected.w, height: selected.h }}
              transition={isDragging(selected.id) ? INSTANT : SPRING}
              fill="none"
              stroke="var(--selection)"
              strokeWidth={1.5}
              vectorEffect="non-scaling-stroke"
            />
            {[
              [selected.x, selected.y],
              [selected.x + selected.w, selected.y],
              [selected.x, selected.y + selected.h],
              [selected.x + selected.w, selected.y + selected.h],
            ].map(([cx, cy], i) => (
              <motion.rect
                key={i}
                width={HANDLE_PX * unit}
                height={HANDLE_PX * unit}
                initial={false}
                animate={{ x: cx - (HANDLE_PX * unit) / 2, y: cy - (HANDLE_PX * unit) / 2 }}
                transition={isDragging(selected.id) ? INSTANT : SPRING}
                fill="white"
                stroke="var(--selection)"
                strokeWidth={1}
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </motion.g>
        )}
      </AnimatePresence>
    </svg>
  )
}

/** Non-interactive render for thumbnails (presets, matrix). */
export function StaticGlyph({ doc, style, className, label }: { doc: Doc; style: Style; className?: string; label?: string }) {
  const filterId = `thumb-${useId().replace(/:/g, "")}`
  const byId = new Map(doc.shapes.map((s) => [s.id, s]))
  const path = (role: Shape["role"]) =>
    doc.shapes
      .filter((s) => s.role === role)
      .map((s) => shapePath(s.kind, s.x, s.y, s.w, s.h))
      .join("")
  const ends = doc.links.flatMap((l) => {
    const a = byId.get(l.a)
    const b = byId.get(l.b)
    return a && b ? [[...center(a), ...center(b)]] : []
  })
  return (
    <svg
      viewBox={`0 0 ${BOX_W} ${BOX_H}`}
      className={cn("block h-auto w-full overflow-visible", className)}
      {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}
    >
      {style.wobble > 0 && (
        <defs>
          <filter id={filterId} x="-10%" y="-10%" width="120%" height="120%">
            <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves={2} seed={style.seed} />
            <feDisplacementMap in="SourceGraphic" scale={style.wobble} />
          </filter>
        </defs>
      )}
      <g filter={style.wobble > 0 ? `url(#${filterId})` : undefined}>
        <path d={path("fill") || "M0 0"} fill={style.fill} />
        <path d={path("outline") || "M0 0"} fill="none" stroke={style.ink} strokeWidth={style.stroke} />
        <path d={path("ink") || "M0 0"} fill={style.ink} />
        {ends.map(([x1, y1, x2, y2], i) => (
          <g key={i} fill={style.ink}>
            <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={style.ink} strokeWidth={style.stroke} strokeLinecap="round" />
            <circle cx={x1} cy={y1} r={NODE_R} />
            <circle cx={x2} cy={y2} r={NODE_R} />
          </g>
        ))}
      </g>
    </svg>
  )
}
