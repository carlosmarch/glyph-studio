import { BOX_H, BOX_W, center, formula, shapePath, toSpec, type Doc, type Shape } from "./grammar"
import type { Style } from "./presets"

const NODE_R = 2.4

const pathsFor = (shapes: Shape[]) => shapes.map((s) => shapePath(s.kind, s.x, s.y, s.w, s.h)).join("")

/** Standalone SVG of the glyph on its ground, sized `scale` px per glyph unit. */
export function toSVG(doc: Doc, style: Style, scale = 4): string {
  const filter = style.wobble > 0 ? wobbleFilter(style.wobble, `seed="${style.seed}"`) : ""
  return svgMarkup(doc, style, scale, filter)
}

// —— Animation: the hand-drawn line "boils", stepping through noise seeds ——

/** Frames in one loop, and how long each holds — about 10 fps, like hand-drawn animation. */
const BOIL_FRAMES = 8
const BOIL_FRAME_MS = 100
/** A glyph drawn without wobble still needs some to boil. */
const BOIL_MIN_WOBBLE = 2

const boilWobble = (style: Style) => Math.max(style.wobble, BOIL_MIN_WOBBLE)
const boilSeeds = (style: Style) => Array.from({ length: BOIL_FRAMES }, (_, i) => style.seed + i)

/** SVG whose wobble loops forever, animated with SMIL — no script, plays in browsers and <img>. */
export function toAnimatedSVG(doc: Doc, style: Style, scale = 4): string {
  const seeds = boilSeeds(style)
  const animate = `<animate attributeName="seed" values="${seeds.join(";")}" dur="${(BOIL_FRAMES * BOIL_FRAME_MS) / 1000}s" calcMode="discrete" repeatCount="indefinite"/>`
  return svgMarkup(doc, style, scale, wobbleFilter(boilWobble(style), `seed="${style.seed}"`, animate))
}

/** Looping GIF of the same boil, rendered frame by frame from the SVG. */
export async function toGIF(doc: Doc, style: Style, scale = 3): Promise<Blob> {
  const { GIFEncoder, quantize, applyPalette } = await import("gifenc")
  const width = (BOX_W + PAD * 2) * scale
  const height = (BOX_H + PAD * 2) * scale
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext("2d", { willReadFrequently: true })
  if (!ctx) throw new Error("Canvas is unavailable")

  const gif = GIFEncoder()
  for (const seed of boilSeeds(style)) {
    const frame = toSVG(doc, { ...style, wobble: boilWobble(style), seed }, scale)
    ctx.clearRect(0, 0, width, height)
    ctx.drawImage(await loadImage(frame), 0, 0, width, height)
    const { data } = ctx.getImageData(0, 0, width, height)
    const palette = quantize(data, 256)
    gif.writeFrame(applyPalette(data, palette), width, height, { palette, delay: BOIL_FRAME_MS })
  }
  gif.finish()
  return new Blob([gif.bytes()], { type: "image/gif" })
}

function loadImage(svg: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error("Couldn't render the glyph"))
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  })
}

// —— SVG markup ————————————————————————————————————————————————————

const PAD = 12

function wobbleFilter(wobble: number, seed: string, animate = ""): string {
  return `<defs><filter id="w" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="2" ${seed}>${animate}</feTurbulence><feDisplacementMap in="SourceGraphic" scale="${wobble}"/></filter></defs>`
}

function svgMarkup(doc: Doc, style: Style, scale: number, filter: string): string {
  const pad = PAD
  const vb = `${-pad} ${-pad} ${BOX_W + pad * 2} ${BOX_H + pad * 2}`
  const fill = pathsFor(doc.shapes.filter((s) => s.role === "fill"))
  const outline = pathsFor(doc.shapes.filter((s) => s.role === "outline"))
  const ink = pathsFor(doc.shapes.filter((s) => s.role === "ink"))
  const byId = new Map(doc.shapes.map((s) => [s.id, s]))
  let lines = ""
  let nodes = ""
  for (const l of doc.links) {
    const a = byId.get(l.a)
    const b = byId.get(l.b)
    if (!a || !b) continue
    const [x1, y1] = center(a)
    const [x2, y2] = center(b)
    lines += `M${x1} ${y1}L${x2} ${y2}`
    nodes += `<circle cx="${x1}" cy="${y1}" r="${NODE_R}"/><circle cx="${x2}" cy="${y2}" r="${NODE_R}"/>`
  }
  const title = formula(doc)
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" width="${(BOX_W + pad * 2) * scale}" height="${(BOX_H + pad * 2) * scale}">`,
    title ? `<title>${title}</title>` : "",
    filter,
    `<rect x="${-pad}" y="${-pad}" width="${BOX_W + pad * 2}" height="${BOX_H + pad * 2}" fill="${style.ground}"/>`,
    `<g${filter ? ' filter="url(#w)"' : ""}>`,
    fill && `<path d="${fill}" fill="${style.fill}"/>`,
    outline && `<path d="${outline}" fill="none" stroke="${style.ink}" stroke-width="${style.stroke}" stroke-linejoin="round"/>`,
    ink && `<path d="${ink}" fill="${style.ink}"/>`,
    lines && `<path d="${lines}" fill="none" stroke="${style.ink}" stroke-width="${style.stroke}" stroke-linecap="round"/>`,
    nodes && `<g fill="${style.ink}">${nodes}</g>`,
    `</g></svg>`,
  ].join("")
}

/** An entry for the portfolio's `src/content/glyphs.ts`. */
export function toSnippet(doc: Doc, slug = "your-post-slug"): string {
  const spec = toSpec(doc)
  const lines = Object.entries(spec).map(([key, value]) => `    ${key}: ${JSON.stringify(value)},`)
  return [
    `"${slug}": {`,
    `  formula: ${JSON.stringify(formula(doc).replace(/ {2}· {2}/g, ", "))},`,
    `  reading: "",`,
    `  spec: {`,
    ...lines,
    `  },`,
    `},`,
  ].join("\n")
}

export function download(filename: string, content: string | Blob, type: string) {
  const url = URL.createObjectURL(typeof content === "string" ? new Blob([content], { type }) : content)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// —— Shareable state in the URL hash ——————————————————————————————

interface Shared {
  doc: Doc
  style: Style
}

export function encodeState(state: Shared): string {
  const json = JSON.stringify(state)
  return btoa(String.fromCharCode(...new TextEncoder().encode(json)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "")
}

export function decodeState(hash: string): Shared | null {
  try {
    const raw = hash.replace(/^#g=/, "").replace(/-/g, "+").replace(/_/g, "/")
    const bytes = Uint8Array.from(atob(raw), (c) => c.charCodeAt(0))
    const parsed = JSON.parse(new TextDecoder().decode(bytes)) as Shared
    if (!Array.isArray(parsed?.doc?.shapes) || !Array.isArray(parsed?.doc?.links) || !parsed.style) return null
    return parsed
  } catch {
    return null
  }
}
