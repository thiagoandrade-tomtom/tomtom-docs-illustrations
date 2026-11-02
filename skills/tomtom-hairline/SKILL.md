---
name: tomtom-hairline
description: Use when someone wants a TomTom illustration in the hairline style of the TomTom Docs gallery, or runs /tomtom-hairline with an idea. Draws one isometric line figure that answers the pointer, on the Hairline engine, in TomTom's colours, and hands it over as a live HTML page plus SVG and PNG in the format asked for (docs, square, 4:3, 3:4, 16:9).
argument-hint: "[what it is for] [format]"
---

# TomTom hairline: make an illustration

You are making one illustration for TomTom in the style of the gallery at
https://thiagoandrade-tomtom.github.io/tomtom-docs-illustrations/. Its figures are the bar.

The process is Hairline's, unchanged: read `hairline.md` in this folder and follow it, step by step
(concept, build, check, hand over). This file only adds what is TomTom's. Every file named here and
there is in this folder; run its scripts from the person's working directory, by their path here.

## What the person gives

- **What it is for**: a product, a docs section, a use case. "Live delivery dispatch", "EV charging".
- **The object**, if they have one in mind. Otherwise offer two or three concepts, as `hairline.md` says.
- **The format**, if they need one other than the default: `docs` (400 × 320, the gallery's),
  `square` (1:1), `landscape` (4:3), `portrait` (3:4) or `wide` (16:9). Also, when they say so, the
  palette (`blueprint`, the default TomTom blue; `mono`, black and white; `red`, TomTom red) and the
  theme (`light`, the default, or `dark`).

Ask only for what is for; take the defaults for the rest and say which you took.

## The TomTom style, on top of the ten rules

- One concrete object a developer recognises at a glance: a van, a pin, a charger, a road. Not a
  diagram, not a metaphor that needs a caption.
- `Cam(45, 0.5)`, drawn in the 400 × 320 frame and centred with `fit(C, pts, 200, 166)`. A plate or
  ground under the object is fine when it is part of the story (a street, a yard, a map tile);
  never a decorative base tile.
- Stroke 1.1 and the kernel's classes only. Colour comes from the tokens at export, never from the
  figure: no colours, fills or gradients in the code.
- The palettes are fixed in `export.mjs`, the same as the gallery's: never pick other tones. Blueprint is
  #1988CF (its highlight #6CC0F5 on dark); black and white is a grey ink (#6B6F78, #B4B8C0 on dark)
  with a near-black or near-white highlight; TomTom red is one red, #DF1B12, on light and on dark.
  Light stands on #FFFFFF and dark on #0C0C12, Playbook's s0.
- One highlight at a time, a composed rest pose (it is the thumbnail), one short story under the
  pointer, safe with reduced motion.
- No words, numbers or logos in the drawing. Never name or picture another company's product.
- It reads at 120 px and looks intentional at 800 px.
- The format changes nothing in the figure: draw it once, in its frame, and let the export frame it.
  Leave some air round the drawing so square, 3:4 and 16:9 crop well.

The examples: `examples/terrain.js` and `examples/riffle.js` are Hairline's;
`examples/dispatch.js` (a van being loaded, the parcels reordering) and `examples/routing.js` (two
roads, the chosen one lifting) are from the TomTom gallery. Read the one nearest your concept.

The gallery already has these, so a new one should not repeat them: Layer Stack (map layers), Rush
Hour (traffic), Hazard Ahead (traffic incidents), Lens and Pin (search), Live Streets (map data), Ask
the Way (agentic map), Ask for Places (agentic search), Connected Globe (MCPs), Dotted Earth (global
data), Tile Service (APIs), Round the Corner (automotive), Modular Cockpit (automotive UI), Free Bay
(parking), Load Order (delivery dispatch), Route Drawn (routing), Pocket Navigator (navigation SDK),
Lap Replay (activity tracker), Corner Shop (places), Charge Point (EV charger), Heat Sun
(temperature), Long Haul (EV trip), Walking Ring (neighbourhood), Doorstep (package tracking), Two
Roads (plan a route), Shared Bay (shared mobility), Geofence (fleet), Neighbourhood Moods (density),
Pull Out (city traffic). Asked for one of these subjects, offer a different object or gesture.

## Hand over, the TomTom way

After `hairline.md`'s check passes, export the rest pose:

```bash
node <this folder>/export.mjs <name>.js --format=<format> --palette=<palette> --theme=<theme>
```

It writes `<name>-<format>-<palette>-<theme>.svg` (colours inlined, strokes that do not scale, so it
pastes into Figma as vectors) and a `.png` at twice the size. Look at the PNG before you hand it
over. Then give the person, as `hairline.md`'s step 4 says, the live `hairline-<name>.html`, plus:

- the SVG and PNG, and the one command to export again in another format;
- one line of alt text: what is drawn, plainly, for a reader who cannot see it.

Without Node or a browser, say so: hand over the HTML page `hairline.md` tells you to assemble, and
say the SVG must be exported from it later, or from the gallery.
