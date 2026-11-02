#!/usr/bin/env node
/**
 * The figure's rest pose as files to use, in TomTom's colours:
 *
 *   node <skill folder>/export.mjs <name>.js [--format=docs] [--theme=light] [--palette=blueprint]
 *
 * It writes <name>-<format>-<palette>-<theme>.svg, every colour and stroke
 * inlined and the stroke not scaling, so the file stands alone in Docs, a CMS
 * or Figma (paste it, and it comes in as vectors), and a .png beside it at
 * twice the size. Prints both paths.
 *
 * Formats. docs keeps the figure's own 400 × 320 frame, as the gallery does;
 * the others frame the drawing itself, with a margin, in their shape:
 *   docs 400×320 · square 400×400 · landscape 4:3 480×360 · portrait 3:4 360×480 · wide 16:9 640×360
 * Palettes: blueprint (the TomTom blue), mono (black and white), red (TomTom red).
 * Themes: light (on white) or dark (on #14171C).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { cacheDir, launch, playwright } from "./look.mjs";

const FORMATS = { docs: [400, 320], square: [400, 400], landscape: [480, 360], portrait: [360, 480], wide: [640, 360] };
// the ink edge/mid/lo are mixed from, and the bright stroke on light and on dark, as the gallery has them
const PALETTES = {
  blueprint: { ink: "#1988CF", light: "#1988CF", dark: "#6CC0F5" },
  mono: { ink: "#6B6F78", light: "#1B1C1F", dark: "#F2F3F5" },
  red: { ink: "#DF1B12", light: "#DF1B12", dark: "#FF6F61" },
};
const GROUND = { light: "#FFFFFF", dark: "#14171C" };

const args = process.argv.slice(2), src = args.find((a) => !a.startsWith("--"));
const opt = (k, d) => args.find((a) => a.startsWith(`--${k}=`))?.split("=")[1] ?? d;
const format = opt("format", "docs"), palette = opt("palette", "blueprint"), theme = opt("theme", "light");
if (!src || !FORMATS[format] || !PALETTES[palette] || !GROUND[theme]) {
  console.error(`usage: node export.mjs <name>.js [--format=${Object.keys(FORMATS).join("|")}] [--palette=${Object.keys(PALETTES).join("|")}] [--theme=light|dark]`);
  process.exit(2);
}

/** a mixed into b at p, as CSS color-mix(in srgb) does. */
const mix = (a, b, p) => "#" + [1, 3, 5].map((i) => Math.round(parseInt(a.slice(i, i + 2), 16) * p + parseInt(b.slice(i, i + 2), 16) * (1 - p)).toString(16).padStart(2, "0")).join("").toUpperCase();
const { ink } = PALETTES[palette], bg = GROUND[theme];
const vars = { plate: bg, hi: PALETTES[palette][theme], edge: mix(ink, bg, 0.88), mid: mix(ink, bg, 0.62), lo: mix(ink, bg, 0.38) };
const style = Object.entries(vars).map(([k, v]) => `--hairline-${k}:${v};`).join("") + "--hairline-stroke:1.1;";

const kernel = readFileSync(new URL("./kernel.js", import.meta.url), "utf8");
const figure = readFileSync(src, "utf8");
const browser = await launch(playwright(cacheDir()));
const page = await browser.newPage({ viewport: { width: 800, height: 640 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.setContent(`<!doctype html><body style="margin:0;background:${bg}"><div id="s" style="width:800px;${style}"></div></body>`);
const [W, H] = FORMATS[format];
const { svg, name } = await page.evaluate(async ({ kernel, figure, W, H, crop }) => {
  const HL = new Function(kernel + ";return HL")();
  let fig;
  new Function("HL", "hairline", figure)(HL, (f) => { fig = f; });
  HL.inject(document);
  const stage = document.getElementById("s");
  stage.setAttribute("data-hairline", fig.name);
  const svg = HL.mk("svg", { viewBox: "0 0 400 320" }, stage);
  fig.mount({ stage, svg, read: { textContent: "" } }, fig.range[1]);
  await new Promise((r) => setTimeout(r, 1600));

  // inline what the kernel's classes resolve to, then drop the classes
  const PROPS = ["fill", "stroke", "stroke-width", "stroke-dasharray", "stroke-linecap", "stroke-linejoin"];
  const out = svg.cloneNode(true), live = [...svg.querySelectorAll("*")], copy = [...out.querySelectorAll("*")];
  live.forEach((el, i) => {
    const c = copy[i], cs = getComputedStyle(el);
    if (el.tagName === "g") { c.removeAttribute("class"); return; }
    if (el.getAttribute("d") === "" || (cs.fill === "none" && cs.stroke === "none")) { c.remove(); return; }
    for (const p of PROPS) {
      const v = cs.getPropertyValue(p);
      if (p === "stroke-dasharray" && v === "none") continue;
      if (p.startsWith("stroke-") && cs.stroke === "none") continue;
      c.setAttribute(p, p === "stroke-width" ? parseFloat(v).toString() : v);
    }
    if (cs.stroke !== "none") c.setAttribute("vector-effect", "non-scaling-stroke");
    c.removeAttribute("class");
    c.removeAttribute("style");
  });
  out.querySelectorAll("g").forEach((g) => { if (!g.children.length) g.remove(); });

  // the frame: docs keeps the figure's own; the others fit the drawing, a margin round it, into their shape
  if (crop) {
    const b = svg.getBBox(), m = 0.1 * Math.max(b.width, b.height);
    let w = b.width + 2 * m, h = b.height + 2 * m;
    if (w / h < W / H) w = (h * W) / H; else h = (w * H) / W;
    out.setAttribute("viewBox", [b.x + b.width / 2 - w / 2, b.y + b.height / 2 - h / 2, w, h].map((n) => +n.toFixed(2)).join(" "));
  }
  out.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  out.setAttribute("width", W);
  out.setAttribute("height", H);
  return { svg: out.outerHTML, name: fig.name };
}, { kernel, figure, W, H, crop: format !== "docs" });
if (errors.length) { console.error(`export: ${errors.join("; ")}`); process.exit(1); }

const tidy = svg.replace(/-?\d+\.\d{3,}/g, (n) => String(Math.round(parseFloat(n) * 100) / 100))
  .replace(/rgb\((\d+), (\d+), (\d+)\)/g, (_, r, g, b) => "#" + [r, g, b].map((n) => (+n).toString(16).padStart(2, "0")).join("").toUpperCase());
const base = resolve(`${name}-${format}-${palette}-${theme}`);
writeFileSync(base + ".svg", tidy + "\n");
// the png: the svg on its ground, at twice the size
const shot = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 2 });
await shot.setContent(`<!doctype html><body style="margin:0;background:${bg}">${tidy}</body>`);
await shot.locator("svg").screenshot({ path: base + ".png" });
await browser.close();
console.log(base + ".svg");
console.log(base + ".png");
