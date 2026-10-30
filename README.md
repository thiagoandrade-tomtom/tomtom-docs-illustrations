# TomTom Docs illustrations

The asset pack: every hairline illustration for TomTom Docs and the use-case
thumbnails, in one gallery: https://thiagoandrade-tomtom.github.io/tomtom-docs-illustrations/

One isometric hairline illustration per TomTom Docs section, drawn with the
[hairline-create](.claude/skills/hairline-create/SKILL.md) skill. Each figure is
used two ways: animated on the TomTom site (hover plays its tour) and as a
static SVG in TomTom Docs and the CMS.

```
figures/<slug>.js     the figure, in the skill's format (reads HL, ends with hairline({...}))
figures/usecases/     copies of the use-case thumbnails from tomtom-orbis-usecases-library;
                      that repo keeps its own, and a change there is copied here by hand.
                      fleet (the truck's shape) and density (a subtler smile, a map base) are touched up here
figures/index.json    the list: slug, the illustration's own name, what it is for, alt text
svg/<slug>.svg        the rest pose, light theme, colours inlined, 400 × 320
index.html            the gallery: a grid of every figure; open one for a large animated view, light/dark,
                      animated/static, and Copy SVG, Download SVG/PNG, Copy alt text
PROMPT.md             the brief; only the SECTION line changes per figure
tools/export-svg.mjs  writes svg/ from figures/
tools/serve.mjs       a static server for the gallery
lib/kernel.js         the hairline kernel the gallery and exporter load: a copy of the skill's,
                      outside .claude/ so GitHub Pages serves it
```

## Add a section

1. Ask Claude Code with `PROMPT.md`, the SECTION line filled in. It writes
   `figures/<slug>.js`.
2. Check it until it passes:
   ```bash
   node .claude/skills/hairline-create/look.mjs figures/<slug>.js --answer=x,y,z --edge=x,y,z
   ```
   `--answer` is a world point on the part that answers the pointer. Use the
   `--flag=value` form, so negative coordinates parse. It writes
   `hairline-<slug>-look.png` (ignored by git): read it, not just the exit code.
3. Add `{ "slug", "name", "for", "alt" }` to `figures/index.json`: `name` is the
   illustration's own name, `for` the Docs section or use case it was made for.
4. Write the static SVG: `node tools/export-svg.mjs <slug>`.
5. Look at it in the gallery: `node tools/serve.mjs`, then open
   http://127.0.0.1:4317/. The gallery's exports are made in the
   browser from the live figure, so they come in both themes; `svg/` holds
   the light ones the repo ships.

## The style

Fixed for every figure (see `PROMPT.md`): `Cam(45, 0.5)`, viewBox 400 × 320,
stroke 1.1, no text, no base tiles. One highlight, `--hairline-hi` #1988CF
(#6CC0F5 on dark). Edge, mid and lo are #1988CF mixed into the background at
88, 62 and 38%. The plate is the page background, so the figure stands loose.

To embed a figure live, set these on the stage element (as `index.html` does),
with `--ground` as the surface it sits on:

```css
--hairline-plate: var(--ground);
--hairline-hi:    #1988CF;            /* #6CC0F5 on dark */
--hairline-edge:  color-mix(in srgb, #1988CF 88%, var(--ground));
--hairline-mid:   color-mix(in srgb, #1988CF 62%, var(--ground));
--hairline-lo:    color-mix(in srgb, #1988CF 38%, var(--ground));
--hairline-stroke: 1.1;
```

The static SVGs fill their plates with white (#FFFFFF). For another background,
change `BG` in `tools/export-svg.mjs` and export again.

## Links

The gallery keeps the open figure in the address, so a link opens on it:
`…/tomtom-docs-illustrations/#fig=usecases/route&theme=dark&view=static`.
The modal's **Copy link to this view** gives that link.
