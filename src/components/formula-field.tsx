import { useRef, useState, type KeyboardEvent } from "react"
import { AnimatePresence, motion } from "motion/react"
import { Check, PenLine, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { checkFormula, FORMULA_KEYS, formulaToDoc, type FormulaError } from "@/lib/formula"
import type { Doc } from "@/lib/grammar"
import { cn } from "@/lib/utils"

interface FormulaFieldProps {
  /** The formula read from the canvas. */
  value: string
  /** Called as the user types a valid formula — render it live (transient). */
  onPreview: (doc: Doc) => void
  /** Keep the previewed glyph as one undo step. */
  onCommit: () => void
  /** Put the canvas back as it was before editing. */
  onCancel: () => void
  /** Called when editing starts, so the caller can remember the canvas. */
  onStart: () => void
}

const clean = (formula: string) => formula.replace(/ {2}· {2}/g, " · ")

export function FormulaField({ value, onPreview, onCommit, onCancel, onStart }: FormulaFieldProps) {
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState("")
  const [error, setError] = useState<FormulaError | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const start = () => {
    onStart()
    setText(clean(value))
    setError(null)
    setEditing(true)
    requestAnimationFrame(() => {
      inputRef.current?.focus()
      inputRef.current?.select()
    })
  }

  const update = (next: string) => {
    setText(next)
    const err = checkFormula(next)
    setError(err)
    if (!err && next.trim()) onPreview(formulaToDoc(next))
  }

  const finish = (keep: boolean) => {
    if (keep && !error && text.trim()) onCommit()
    else onCancel()
    setEditing(false)
    setError(null)
  }

  const insert = (key: string) => {
    const el = inputRef.current
    const start = el?.selectionStart ?? text.length
    const end = el?.selectionEnd ?? text.length
    const next = text.slice(0, start) + key + text.slice(end)
    update(next)
    requestAnimationFrame(() => {
      el?.focus()
      el?.setSelectionRange(start + key.length, start + key.length)
    })
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault()
      finish(true)
    } else if (e.key === "Escape") {
      e.preventDefault()
      finish(false)
    }
  }

  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor="formula-input" className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          Formula
        </label>
        {!editing && (
          <Button variant="ghost" size="sm" className="text-muted-foreground h-7" onClick={start}>
            <PenLine /> Type a formula
          </Button>
        )}
      </div>

      {editing ? (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.15 }}
          className="grid gap-2"
        >
          <div className="flex gap-2">
            <Input
              id="formula-input"
              ref={inputRef}
              value={text}
              onChange={(e) => update(e.target.value)}
              onKeyDown={onKeyDown}
              spellCheck={false}
              autoComplete="off"
              aria-invalid={!!error}
              aria-describedby="formula-help"
              placeholder="● — (▲ ⊂ ■)"
              className="h-11 font-mono text-xl md:text-xl"
            />
            <Button size="icon" className="size-11" aria-label="Keep formula (Enter)" onClick={() => finish(true)} disabled={!!error || !text.trim()}>
              <Check />
            </Button>
            <Button size="icon" variant="outline" className="size-11" aria-label="Cancel (Esc)" onClick={() => finish(false)}>
              <X />
            </Button>
          </div>

          <div className="flex flex-wrap gap-1" role="toolbar" aria-label="Insert symbol">
            {FORMULA_KEYS.map(({ key, label }) => (
              <Tooltip key={key}>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 min-w-8 px-2 font-mono"
                    aria-label={`Insert ${label.toLowerCase()}`}
                    // Keep focus (and the caret) in the input.
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => insert(key)}
                  >
                    {key.trim()}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{label}</TooltipContent>
              </Tooltip>
            ))}
          </div>

          <p id="formula-help" className={cn("text-xs", error ? "text-destructive" : "text-muted-foreground")} aria-live="polite">
            {error ? (
              <>
                {error.message}
                {text.length > 0 && <span className="opacity-70"> — at character {error.at + 1}</span>}
              </>
            ) : (
              <>
                The canvas follows as you type. <kbd className="font-mono">Enter</kbd> keeps it,{" "}
                <kbd className="font-mono">Esc</kbd> puts it back. Typing shortcuts: <code className="font-mono">c t s</code> for
                shapes, <code className="font-mono">- / &lt; x |</code> for relations.
              </>
            )}
          </p>
        </motion.div>
      ) : (
        <button
          type="button"
          onClick={start}
          aria-label={`Formula ${value || "empty"}. Click to type a formula.`}
          className="hover:bg-muted/60 -mx-2 rounded-md px-2 py-1 text-left transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={value}
              initial={{ opacity: 0, y: 6, filter: "blur(4px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: -6, filter: "blur(4px)" }}
              transition={{ duration: 0.2 }}
              className="block font-mono text-2xl break-words [word-spacing:0.1em]"
            >
              {value || "—"}
            </motion.span>
          </AnimatePresence>
        </button>
      )}
    </div>
  )
}
