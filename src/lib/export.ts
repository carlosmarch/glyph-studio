import { BOX_H, BOX_W, center, formula, shapePath, toSpec, type Doc, type Shape } from "./grammar"
import type { Style } from "./presets"

const NODE_R = 2.4

const pathsFor = (shapes: Shape[]) => shapes.map((s) => shapePath(s.kind, s.x, s.y, s.w, s.h)).join("")

/** Standalone SVG of the glyph on its ground, sized `scale` px per glyph unit. */
export function toSVG(doc: Doc, style: Style, scale = 4): string {
  const pad = 12
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
  const filter = style.wobble > 0
    ? `<defs><filter id="w" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="2" seed="${style.seed}"/><feDisplacementMap in="SourceGraphic" scale="${style.wobble}"/></filter></defs>`
    : ""
  const title = formula(doc)
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" width="${(BOX_W + pad * 2) * scale}" height="${(BOX_H + pad * 2) * scale}">`,
    title ? `<title>${title}</title>` : "",
    filter,
    `<rect x="${-pad}" y="${-pad}" width="${BOX_W + pad * 2}" height="${BOX_H + pad * 2}" fill="${style.ground}"/>`,
    `<g${style.wobble > 0 ? ' filter="url(#w)"' : ""}>`,
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

export function download(filename: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }))
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
