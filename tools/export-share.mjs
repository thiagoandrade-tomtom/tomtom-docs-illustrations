/* Writes what a link preview needs, for Slack and the like, which read a
   page's Open Graph tags and cannot see past a URL's #:

     og/<name>.png       a 1200 × 630 preview card per figure, its rest pose
                         (svg/<slug>.svg) on a light card with its name
     og/index.png        the gallery's card: a few figures side by side
     share/<name>.html   a page per figure carrying its preview tags, which
                         sends the reader on to the gallery with that
                         figure open (its own #… is passed along)

   <name> is the slug with "/" as "-": usecases/route → usecases-route.
   Run after export-svg.mjs:   node tools/export-share.mjs [slug ...]

   Uses the playwright-core that the skill's look.mjs installs into its cache. */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { homedir } from "node:os";

const SITE = "https://thiagoandrade-tomtom.github.io/tomtom-docs-illustrations/";
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const cache = process.env.HAIRLINE_LOOK_CACHE || join(homedir(), "Library/Caches/hairline-look");
const { chromium } = createRequire(join(cache, "package.json"))("playwright-core");

const index = JSON.parse(readFileSync(join(root, "figures/index.json"), "utf8"));
const only = process.argv.slice(2);
const flat = (slug) => slug.replace(/\//g, "-");
const esc = (t) => t.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
mkdirSync(join(root, "og"), { recursive: true });
mkdirSync(join(root, "share"), { recursive: true });

/** The card around one or more figures' SVG markup. */
const card = (figs, title, sub) => `<!doctype html><html><head><meta charset="utf-8"><style>
  * { box-sizing: border-box; margin: 0; }
  body { width: 1200px; height: 630px; background: #F5F6F8; font-family: -apple-system, "Segoe UI", system-ui, sans-serif; color: #1B1C1F; }
  .card { position: absolute; inset: 32px; background: #FFFFFF; border: 1px solid #E4E6EA; border-radius: 24px; overflow: hidden; }
  .figs { position: absolute; left: 48px; right: 48px; top: 36px; bottom: 124px; display: flex; gap: 40px; align-items: center; justify-content: center; }
  .figs svg { max-height: 100%; height: 100%; width: auto; max-width: 100%; flex: 0 1 auto; min-width: 0; }
  .text { position: absolute; left: 48px; right: 48px; bottom: 36px; display: flex; align-items: baseline; justify-content: space-between; gap: 24px; }
  h1 { font-size: 40px; font-weight: 650; letter-spacing: -0.01em; }
  p { font-size: 22px; color: #6B6F76; white-space: nowrap; }
</style></head><body><div class="card"><div class="figs">${figs.join("")}</div>
<div class="text"><h1>${esc(title)}</h1><p>${esc(sub)}</p></div></div></body></html>`;

const svgOf = (slug) => readFileSync(join(root, "svg", slug + ".svg"), "utf8").replace(/ width="400" height="320"/, "");

const browser = await chromium.launch({ channel: "chrome" }).catch(() => chromium.launch());
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
async function shoot(html, file) {
  await page.setContent(html);
  // each figure cropped to its drawing, with a little air, so it fills the card
  await page.evaluate(() => document.querySelectorAll(".figs svg").forEach((svg) => {
    const b = svg.getBBox(), m = Math.max(b.width, b.height) * 0.05;
    svg.setAttribute("viewBox", [b.x - m, b.y - m, b.width + 2 * m, b.height + 2 * m].join(" "));
  }));
  await page.screenshot({ path: join(root, "og", file), type: "png" });
}

for (const { slug, name, for: forWhat, alt } of index) {
  if (only.length && !only.includes(slug)) continue;
  const f = flat(slug);
  await shoot(card([svgOf(slug)], name, `TomTom Docs illustrations · ${forWhat}`), f + ".png");
  const title = `${name} · TomTom Docs illustrations`, url = `${SITE}share/${f}.html`, img = `${SITE}og/${f}.png`;
  writeFileSync(join(root, "share", f + ".html"), `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(alt)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="TomTom Docs illustrations">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(alt)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${img}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${esc(alt)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${img}">
<meta http-equiv="refresh" content="0; url=../#fig=${slug}">
<script>
  // on to the gallery with this figure open, keeping any theme, view or palette this link carries
  const extra = new URLSearchParams(location.hash.slice(1)); extra.delete("fig");
  location.replace("../#fig=${slug}" + (extra.toString() ? "&" + extra : ""));
</script>
</head><body><a href="../#fig=${slug}">${esc(name)}</a></body></html>
`);
  console.log(`og/${f}.png  share/${f}.html`);
}

if (!only.length) {
  const pick = ["map-layers", "traffic", "agentic-map", "mcps"].filter((s) => index.some((e) => e.slug === s));
  await shoot(card(pick.map(svgOf), "TomTom Docs illustrations", `${index.length} hairline illustrations`), "index.png");
  console.log("og/index.png");
}
await browser.close();
