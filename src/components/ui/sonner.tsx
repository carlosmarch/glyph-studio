import { Toaster as Sonner, type ToasterProps } from "sonner"

function Toaster(props: ToasterProps) {
  return (
    <Sonner
      // Always dark, in both themes — reads as a transient message over the canvas.
      theme="dark"
      className="toaster group"
      style={
        {
          "--normal-bg": "oklch(0.205 0 0)",
          "--normal-text": "oklch(0.985 0 0)",
          "--normal-border": "oklch(1 0 0 / 10%)",
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
