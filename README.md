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
tools/export-share.mjs  writes og/ (link preview images) and share/ (a page per figure)
lib/kernel.js         the hairline kernel the gallery and exporter load: a copy of the skill's,
                      outside .claude/ so GitHub Pages serves it
```

## Make your own

The gallery's **Make yours** button walks anyone through it. The skill is
`skills/tomtom-hairline/`: Hairline's engine, its process as `hairline.md`, and
on top the TomTom style, the gallery's list, and `export.mjs`, which writes the
rest pose as SVG and PNG in a format (`docs` 400×320, `square`, `landscape` 4:3,
`portrait` 3:4, `wide` 16:9), a colour style and a theme. Install it in any
agent that runs skills:

```bash
npx skills add thiagoandrade-tomtom/tomtom-docs-illustrations
```

It copies Hairline's files from `.claude/skills/hairline-create/`; when those
change, copy them again.

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
`…/tomtom-docs-illustrations/#fig=usecases/route&theme=dark&view=static&palette=red`.
The modal's link button copies a share link instead, `…/share/<name>.html#…`:
a small page per figure that carries its preview image for Slack and the like
(which cannot see past a `#`) and sends the reader on to the gallery with the
figure open. Make the previews and share pages with
`node tools/export-share.mjs` after `export-svg.mjs`: they land in `og/` and
`share/`.

## Colour styles

The gallery can show and export every figure in three styles: **Blueprint**
(#1988CF, the default and what `svg/` ships), **Black and white** (ink #6B6F78,
#B4B8C0 on dark; bright #1B1C1F on light, #F2F3F5 on dark) and **TomTom red**
(#DF1B12, Playbook's brand red, one red on light and on dark). Edge, mid and lo
are the ink mixed into the background at 88, 62 and 38%, as for Blueprint. The
values are in `index.html` (`:root[data-palette="…"]`) and in the skill's
`export.mjs`.

The gallery's interface is on Playbook's tokens: s0 for the page, the cards and
the figures' ground (#FFFFFF, #0C0C12 on dark), s1 for controls, its borders,
text and elevation, on the 4px grid. Titles are in Space Grotesk and text in DM
Sans, free stand-ins for Gilroy and Proxima Nova, whose licences do not cover a
public site. The link previews in `og/` follow the same look.

## Credits

The figures are drawn with [hairline](https://github.com/lucasmarkes/hairline)
by Lucas Marques, MIT licensed: the skill in `.claude/skills/` and its kernel,
copied to `lib/kernel.js`. Its licence is in `lib/HAIRLINE-LICENSE`.
