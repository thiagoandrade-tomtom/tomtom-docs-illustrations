/**
 * Map layers: three map sheets stacked loose, one over the other, from raw
 * data up to the map people see. The bottom one is the data: a field of
 * points, thick where the city is. The middle one is the road network drawn
 * from it, main roads and the streets between them. The top one is the
 * finished map, kept simple: the river, a park, and a route between two map
 * pins standing on it. At rest the stack sits
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
const NAMES = ["data", "roads", "map"];
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

/** The data: a jittered grid over the sheet, and two clusters where the city is; one point in five is brighter. */
const POINTS = (() => {
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const pts = [];
  for (let i = 0; i < 13; i++) for (let j = 0; j < 13; j++) pts.push([8 + i * 8 + (rnd() - 0.5) * 6, 8 + j * 8 + (rnd() - 0.5) * 6]);
  for (const [cx, cy, n, sp] of [[40, 40, 70, 16], [78, 70, 50, 13]])
    for (let k = 0; k < n; k++) { const a = rnd() * Math.PI * 2, r = sp * Math.sqrt(rnd()); pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
  return pts.filter(([u, v]) => u > 5 && u < W - 5 && v > 5 && v < W - 5).map((p, k) => [...p, k % 5 === 0]);
})();
// the road network: main roads, then the streets between them
const MAIN = [[[8, 34], [W - 8, 34]], [[40, 8], [40, W - 8]], [[8, 82], [52, 82], [70, 62], [W - 8, 62]]];
const STREETS = [[[84, 8], [84, 34]], [[84, 62], [84, W - 8]], [[40, 100], [W - 8, 100]], [[8, 58], [40, 58]], [[62, 8], [62, 34]], [[18, 34], [18, 82]], [[52, 82], [52, W - 8]]];
// the finished map's route, from one pin to the other along the roads
const ROUTE = [[PLACES[0][0], 34], [40, 34], [40, 62], [70, 62], [PLACES[1][0], PLACES[1][1]]];

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
    const faint = mk("path", { class: "nf lo" }, grp), marks = mk("path", { class: "nf" }, grp), route = mk("path", { class: "nf sil" }, grp);
    const dots = i === 0 ? POINTS.map(([, , b]) => flatDot(grp, C, b ? 1.3 : 1.05, b ? "dot m" : "dot off")) : [];
    const pins = i === 2 ? PLACES.slice(0, 2).map(() => ({ sil: mk("path", { class: "sil" }, grp), face: mk("path", { class: "nf lo" }, grp), hole: mk("path", { class: "nf" }, grp) })) : [];
    return { i, s, faint, marks, route, dots, pins, z: tween(z0), drawn: NaN };
  });

  /** The sheet's lines at height z, [faint, main, route]: none on the data (it is points), the streets and main roads, or the finished map. */
  function marks(i, z) {
    const at = (u, v) => P(u, v, z), lines = (ls) => ls.map((l) => open(l.map(([u, v]) => at(u, v)))).join("");
    if (i === 0) return ["", "", ""];
    if (i === 1) return [lines(STREETS), lines(MAIN), ""];
    const park = rings(64, 78, 96, 102, 5, 1)[0];
    return ["", open(RIVER.map(([u, v]) => at(u, v))) + open(RIVER.map(([u, v]) => at(u, v + 5))) + poly(park.map((q) => at(q.u, q.v))), lines([ROUTE])];
  }

  function draw(sh, z) {
    if (z === sh.drawn) return;
    sh.drawn = z;
    put(sh.s, prism(P, front, ring, inner, z, z + TH));
    const [f, m, r] = marks(sh.i, z + TH);
    sh.faint.setAttribute("d", f); sh.marks.setAttribute("d", m); sh.route.setAttribute("d", r);
    sh.dots.forEach((d, k) => place(d, P(POINTS[k][0], POINTS[k][1], z + TH)));
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
  means: "Three map sheets, data points, roads and the finished map: over the stack they fan apart and the one under the pointer lights.",
  rules: [1, 2, 4, 5],
  range: [40, 48, 58],
  tour: [[200, 110], [200, 185], [200, 245], null],
  mount,
});
