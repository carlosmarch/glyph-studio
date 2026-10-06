import { decodeState } from "./export"

/** A glyph saved in this browser. `state` is the same encoding as the share link. */
export interface SavedGlyph {
  id: string
  title: string
  description: string
  state: string
  savedAt: number
}

const KEY = "glyph-studio:library"
/** The single save slot from before the library. */
const LEGACY_KEY = "glyph-studio:saved"

export function loadLibrary(): SavedGlyph[] {
  try {
    const raw = window.localStorage.getItem(KEY)
    if (raw) {
      const list = JSON.parse(raw) as SavedGlyph[]
      return Array.isArray(list) ? list.filter((g) => typeof g?.state === "string" && decodeState(g.state)) : []
    }
    const legacy = window.localStorage.getItem(LEGACY_KEY)
    if (legacy && decodeState(legacy)) {
      return [{ id: newSavedId(), title: "Untitled glyph", description: "", state: legacy, savedAt: Date.now() }]
    }
  } catch {
    // Storage blocked or corrupt: start empty.
  }
  return []
}

/** Returns false when the browser refuses to store it. */
export function storeLibrary(list: SavedGlyph[]): boolean {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list))
    window.localStorage.removeItem(LEGACY_KEY)
    return true
  } catch {
    return false
  }
}

export const newSavedId = () => `g${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
