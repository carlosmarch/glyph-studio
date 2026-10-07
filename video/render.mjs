// Render the film: node video/render.mjs [--fps 60] [--from 0] [--to 30] [--stills 1,5.5,12] [--out video/out/glyph-system-studio.mp4]
import { spawn } from "node:child_process"
import { mkdirSync } from "node:fs"
import { createRequire } from "node:module"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { createServer } from "vite"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, all) => (a.startsWith("--") ? [...acc, [a.slice(2), all[i + 1]]] : acc), []),
)
const fps = Number(args.fps ?? 60)
const from = Number(args.from ?? 0)
const to = Number(args.to ?? 30)
const out = path.resolve(root, args.out ?? "video/out/glyph-system-studio.mp4")

// Playwright: the project's own copy if installed, else the global one.
const require = createRequire(import.meta.url)
let playwright
try {
  playwright = require("playwright")
} catch {
  playwright = require(path.join(process.execPath, "../../lib/node_modules/playwright"))
}

const server = await createServer({ root, configFile: path.join(root, "vite.config.ts"), server: { port: 5199, strictPort: true }, logLevel: "error" })
await server.listen()
const browser = await playwright.chromium.launch()
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 })
await page.goto("http://localhost:5199/video/index.html?render=1")
await page.waitForFunction(() => typeof window.seek === "function")
await page.evaluate(() => document.fonts.ready)

const shoot = async (t) => {
  await page.evaluate((t) => window.seek(t), t)
  return page.screenshot({ type: "png", clip: { x: 0, y: 0, width: 1920, height: 1080 } })
}

mkdirSync(path.dirname(out), { recursive: true })
if (args.stills) {
  const { writeFileSync } = await import("node:fs")
  for (const t of args.stills.split(",").map(Number)) {
    const file = path.join(path.dirname(out), `still-${t.toFixed(2)}.png`)
    writeFileSync(file, await shoot(t))
    console.log(file)
  }
} else {
  const ff = spawn("ffmpeg", ["-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(fps), "-i", "-", "-c:v", "libx264", "-preset", "slow", "-crf", "16", "-pix_fmt", "yuv420p", "-movflags", "+faststart", out], { stdio: ["pipe", "inherit", "inherit"] })
  const total = Math.round((to - from) * fps)
  for (let f = 0; f < total; f++) {
    const png = await shoot(from + f / fps)
    if (!ff.stdin.write(png)) await new Promise((r) => ff.stdin.once("drain", r))
    if (f % fps === 0) process.stdout.write(`\r${(from + f / fps).toFixed(0)}s / ${to}s`)
  }
  ff.stdin.end()
  await new Promise((r) => ff.on("close", r))
  console.log(`\n${out}`)
}
await browser.close()
await server.close()
