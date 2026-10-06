import { useCallback, useRef, useState } from "react"

const LIMIT = 100

interface History<T> {
  past: T[]
  present: T
  future: T[]
}

/**
 * Undo/redo state. `set(next, { transient: true })` updates the present
 * without a history step (e.g. while dragging); `commit()` then records the
 * value from before the transient run as one step.
 */
export function useHistory<T>(initial: T) {
  const [state, setState] = useState<History<T>>({ past: [], present: initial, future: [] })
  const transientBase = useRef<T | null>(null)

  const set = useCallback((next: T | ((prev: T) => T), opts?: { transient?: boolean }) => {
    setState((h) => {
      const value = typeof next === "function" ? (next as (prev: T) => T)(h.present) : next
      if (Object.is(value, h.present)) return h
      if (opts?.transient) {
        if (transientBase.current === null) transientBase.current = h.present
        return { ...h, present: value }
      }
      transientBase.current = null
      return { past: [...h.past, h.present].slice(-LIMIT), present: value, future: [] }
    })
  }, [])

  const commit = useCallback(() => {
    // Read the ref outside the updater: StrictMode runs updaters twice.
    const base = transientBase.current
    transientBase.current = null
    if (base === null) return
    setState((h) => {
      if (Object.is(base, h.present)) return h
      return { past: [...h.past, base].slice(-LIMIT), present: h.present, future: [] }
    })
  }, [])

  const undo = useCallback(() => {
    setState((h) => {
      if (!h.past.length) return h
      return { past: h.past.slice(0, -1), present: h.past[h.past.length - 1], future: [h.present, ...h.future] }
    })
  }, [])

  const redo = useCallback(() => {
    setState((h) => {
      if (!h.future.length) return h
      return { past: [...h.past, h.present], present: h.future[0], future: h.future.slice(1) }
    })
  }, [])

  return {
    value: state.present,
    set,
    commit,
    undo,
    redo,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
  }
}
