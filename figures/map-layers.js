/**
 * Map layers: three map sheets stacked loose, one over the other. The bottom
 * one is the base map, a river bending across it and a park; the middle one
 * carries the roads, a straight one and one that bends; the top one carries
 * the places, two map pins standing on it and a dot. At rest the stack sits
 * open, unevenly, and the top sheet takes the bright edge. When the pointer comes over the stack the
 * sheets fan apart, staggered out from the sheet under it, and that sheet
 * takes the bright edge. The slider is the gap the sheets open to.
 *
 * The pattern: one of many. Tweens for which sheet, and a hit test on the
 * open pose, which is where the sheets are going and never moves under the
 * pointer: the topmost open sheet whose face holds the pointer.
 */
const {
  Cam, circ, clamp, fillet, facing, fit, hull, open, poly, prism, proj, rings, seg, unproj,
  tdone, tset, tval, tween, disposer, flatDot, mk, place, pointer, put, register, solid,
} = HL;

const W = 112, TH = 3, R = 7, B = 1.6, MAXGAP = 58, STEP = 50;
const REST = [0, 22, 44];
const PIN_R = 8.5, PIN_H = 25, PIN_T = 3.4;
const NAMES = ["base", "roads", "places"];
const PLACES = [[34, 30], [78, 62], [40, 86]];

/** The pin's outline in its own upright plane: a round head tangent down to a point, (t across, s up). */
const PIN = (() => {
  const cy = PIN_H - PIN_R, a0 = Math.acos(PIN_R / cy), pts = [];
  for (let k = 0; k <= 24; k++) {
    const a = a0 + (k / 24) * (2 * Math.PI - 2 * a0);
    pts.push([PIN_R * Math.sin(a), cy - PIN_R * Math.cos(a)]);
  }
  pts.push([0, 0]);
  return fillet(pts, pts.map((_, k) => (k === pts.length - 1 ? 2 : 0.4)), 3);
})();

/** A curve on the sheet as samples of (u, v): the river, a wave from the left edge to the right. */
const RIVER = Array.from({ length: 25 }, (_, k) => {
  const u = 8 + (k / 24) * (W - 16);
  return [u, 74 - 22 * (u / W) + 9 * Math.sin((u / W) * Math.PI * 2)];
});

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  let gap = value;
  const C = Cam(45, 0.5, 1.42);
  fit(C, [[0, 0, 0], [W, W, 0], [W, 0, 0], [0, W, 0], [0, 0, 2 * MAXGAP + TH], [PLACES[0][0], PLACES[0][1], 2 * MAXGAP + TH + PIN_H]], 200, 166);
  const P = proj(C), front = facing(C);
  const [ring, inner] = rings(0, 0, W, W, R, B);

  const g = mk("g", {}, svg);
  const sheets = REST.map((z0, i) => {
    const grp = mk("g", {}, g);
    const s = solid(grp);
    const marks = mk("path", { class: "nf" }, grp);
    const dots = i === 2 ? [flatDot(grp, C, 3.2, "dot m")] : [];
    const pins = i === 2 ? PLACES.slice(0, 2).map(() => ({ sil: mk("path", { class: "sil" }, grp), face: mk("path", { class: "nf lo" }, grp), hole: mk("path", { class: "nf" }, grp) })) : [];
    return { i, s, marks, dots, pins, z: tween(z0), drawn: NaN };
  });

  /** The sheet's marks at height z: the river and park, the two roads, or nothing (the places are dots). */
  function marks(i, z) {
    const at = (u, v) => P(u, v, z);
    if (i === 0) {
      const park = rings(64, 78, 96, 102, 5, 1)[0];
      return open(RIVER.map(([u, v]) => at(u, v))) + open(RIVER.map(([u, v]) => at(u, v + 5))) + poly(park.map((q) => at(q.u, q.v)));
    }
    if (i === 1) return seg(at(40, 8), at(40, W - 8)) + open([at(8, 82), at(52, 82), at(70, 62), at(W - 8, 62)]);
    return "";
  }

  function draw(sh, z) {
    if (z === sh.drawn) return;
    sh.drawn = z;
    put(sh.s, prism(P, front, ring, inner, z, z + TH));
    sh.marks.setAttribute("d", marks(sh.i, z + TH));
    sh.dots.forEach((d) => place(d, P(PLACES[2][0], PLACES[2][1], z + TH)));
    sh.pins.forEach((pin, k) => {
      // the pin's plate faces the viewer: across it is world (1, -1), through it (1, 1)
      const [px, py] = PLACES[k], at = (t, h, d) => P(px + (t + d) / Math.SQRT2, py + (d - t) / Math.SQRT2, z + TH + h);
      const fr = PIN.map(([t, h]) => at(t, h, 0));
      pin.sil.setAttribute("d", poly(hull(fr.concat(PIN.map(([t, h]) => at(t, h, -PIN_T))))));
      pin.face.setAttribute("d", poly(fr));
      pin.hole.setAttribute("d", poly(circ(2.8, 20).map((q) => at(q.u, PIN_H - PIN_R + q.v, 0))));
    });
  }

  const Bk = register(stage, (_dt, now) => {
    let moving = false;
    for (const sh of sheets) { draw(sh, tval(sh.z, now)); if (!tdone(sh.z, now)) moving = true; }
    return moving;
  });
  bag.add(Bk.unregister);

  let act = null;
  /** Lights sheet a, or the top one at rest (a = -1). */
  function paint(a) {
    const lit = a < 0 ? 2 : a;
    sheets.forEach((sh) => {
      const on = sh.i === lit;
      sh.s.sil.classList.toggle("hi", on);

    });
  }

  function setActive(a, force) {
    if (a === act && !force) return;
    const now = performance.now(), from = a >= 0 ? a : act ?? 2;
    act = a;
    sheets.forEach((sh) => tset(sh.z, a < 0 ? REST[sh.i] : sh.i * gap, now, Math.abs(sh.i - from) * STEP));
    paint(a);
    read.textContent = a < 0 ? "rest" : NAMES[a];
    Bk.wake();
  }
  setActive(-1);

  /** The topmost sheet whose open face holds the pointer, or -1. */
  function hit(p) {
    for (let i = 2; i >= 0; i--) {
      const [x, y] = unproj(C, p[0], p[1], i * gap + TH);
      if (x > -4 && x < W + 4 && y > -4 && y < W + 4) return i;
    }
    return -1;
  }

  bag.add(pointer(stage, { move: (p) => setActive(hit(p)), leave: () => setActive(-1) }));
  bag.add(() => svg.replaceChildren());

  return { set: (v) => { gap = clamp(v, 40, MAXGAP); if (act >= 0) setActive(act, true); }, destroy: bag.dispose };
}

hairline({
  name: "map-layers",
  means: "Three map sheets, base, roads and places: over the stack they fan apart and the sheet under the pointer lights.",
  rules: [1, 2, 4, 5],
  range: [40, 48, 58],
  tour: [[200, 110], [200, 185], [200, 245], null],
  mount,
});
