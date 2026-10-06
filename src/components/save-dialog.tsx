import { useState, type FormEvent } from "react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import type { SavedGlyph } from "@/lib/library"

export interface SaveDetails {
  title: string
  description: string
}

interface SaveDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The saved glyph being edited; null saves a new one. */
  current: SavedGlyph | null
  /** "edit" changes only the title and description, not the glyph. */
  mode: "save" | "edit"
  suggestedTitle: string
  onSave: (details: SaveDetails, asNew: boolean) => void
}

export function SaveDialog({ open, onOpenChange, current, mode, suggestedTitle, onSave }: SaveDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {/* Keyed so the fields start fresh each time it opens. */}
        {open && <SaveForm key={current?.id ?? "new"} current={current} mode={mode} suggestedTitle={suggestedTitle} onSave={onSave} />}
      </DialogContent>
    </Dialog>
  )
}

function SaveForm({ current, mode, suggestedTitle, onSave }: Omit<SaveDialogProps, "open" | "onOpenChange">) {
  const [title, setTitle] = useState(current?.title ?? "")
  const [description, setDescription] = useState(current?.description ?? "")
  const details = () => ({ title: title.trim() || suggestedTitle, description: description.trim() })

  const submit = (e: FormEvent) => {
    e.preventDefault()
    onSave(details(), !current)
  }

  return (
    <form onSubmit={submit} className="grid gap-4">
      <DialogHeader>
        <DialogTitle>{mode === "edit" ? "Edit details" : current ? "Update saved glyph" : "Save glyph"}</DialogTitle>
        <DialogDescription>Saved in this browser. Find it again in the Saved tab.</DialogDescription>
      </DialogHeader>
      <div className="grid gap-2">
        <Label htmlFor="save-title">Title</Label>
        <Input id="save-title" value={title} placeholder={suggestedTitle} onChange={(e) => setTitle(e.target.value)} autoFocus maxLength={80} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="save-description">Description</Label>
        <Textarea
          id="save-description"
          value={description}
          placeholder="What does this glyph stand for?"
          onChange={(e) => setDescription(e.target.value)}
          maxLength={500}
        />
      </div>
      <DialogFooter>
        {current && mode === "save" && (
          <Button type="button" variant="outline" onClick={() => onSave(details(), true)}>
            Save as new
          </Button>
        )}
        <Button type="submit">{current ? "Update" : "Save"}</Button>
      </DialogFooter>
    </form>
  )
}
