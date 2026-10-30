/* Writes svg/<slug>.svg for every figure in figures/index.json: the figure's
   rest pose, light theme, with every colour and stroke inlined so the file
   stands alone in Docs and the CMS. Plates are filled with the page
   background (#FFFFFF), so the figure stands loose on a white page.

   node tools/export-svg.mjs [slug ...]

   Uses the playwright-core that the skill's look.mjs installs into its cache. */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { homedir } from "node:os";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const cache = process.env.HAIRLINE_LOOK_CACHE || join(homedir(), "Library/Caches/hairline-look");
const { chromium } = createRequire(join(cache, "package.json"))("playwright-core");

const BG = "#FFFFFF", HI = "#1988CF";
/** #1988CF mixed into the background at p, as CSS color-mix(in srgb) does. */
const mix = (p) => "#" + [1, 3, 5].map((i) => {
  const c = parseInt(HI.slice(i, i + 2), 16), b = parseInt(BG.slice(i, i + 2), 16);
  return Math.round(c * p + b * (1 - p)).toString(16).padStart(2, "0");
}).join("").toUpperCase();
const PALETTE = { plate: BG, hi: HI, edge: mix(0.88), mid: mix(0.62), lo: mix(0.38) };

const kernel = readFileSync(join(root, ".claude/skills/hairline-create/kernel.js"), "utf8");
const index = JSON.parse(readFileSync(join(root, "figures/index.json"), "utf8"));
const only = process.argv.slice(2);

const browser = await chromium.launch({ channel: "chrome" }).catch(() => chromium.launch());
const page = await browser.newPage({ viewport: { width: 800, height: 640 } });
mkdirSync(join(root, "svg"), { recursive: true });

for (const { slug, alt } of index) {
  if (only.length && !only.includes(slug)) continue;
  const src = readFileSync(join(root, "figures", slug + ".js"), "utf8");
  const vars = Object.entries(PALETTE).map(([k, v]) => `--hairline-${k}:${v};`).join("") + "--hairline-stroke:1.1;";
  await page.setContent(`<!doctype html><body style="margin:0;background:${BG}"><div id="s" style="width:800px;${vars}"></div></body>`);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const svg = await page.evaluate(async ({ kernel, src, alt }) => {
    const HL = new Function(kernel + ";return HL")();
    let fig;
    new Function("HL", "hairline", src)(HL, (f) => { fig = f; });
    HL.inject(document);
    const stage = document.getElementById("s");
    stage.setAttribute("data-hairline", fig.name);
    const svg = HL.mk("svg", { viewBox: "0 0 400 320" }, stage);
    fig.mount({ stage, svg, read: { textContent: "" } }, fig.range[1]);
    await new Promise((r) => setTimeout(r, 1600));

    // Inline what the kernel's classes resolve to, then drop the classes.
    const PROPS = ["fill", "stroke", "stroke-width", "stroke-dasharray", "stroke-linecap", "stroke-linejoin"];
    const out = svg.cloneNode(true);
    const live = [...svg.querySelectorAll("*")], copy = [...out.querySelectorAll("*")];
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
    // Groups left empty by the pruning go too.
    out.querySelectorAll("g").forEach((g) => { if (!g.children.length) g.remove(); });
    out.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    out.setAttribute("width", "400");
    out.setAttribute("height", "320");
    out.setAttribute("role", "img");
    out.setAttribute("aria-label", alt);
    return out.outerHTML;
  }, { kernel, src, alt });
  if (errors.length) throw new Error(`${slug}: ${errors.join("; ")}`);
  // Two decimals are plenty at 400 × 320.
  const tidy = svg.replace(/-?\d+\.\d{3,}/g, (n) => String(Math.round(parseFloat(n) * 100) / 100)).replace(/rgb\((\d+), (\d+), (\d+)\)/g,
    (_, r, g, b) => "#" + [r, g, b].map((n) => (+n).toString(16).padStart(2, "0")).join("").toUpperCase());
  writeFileSync(join(root, "svg", slug + ".svg"), tidy + "\n");
  console.log(`svg/${slug}.svg  ${(tidy.length / 1024).toFixed(1)} KB`);
}
await browser.close();
