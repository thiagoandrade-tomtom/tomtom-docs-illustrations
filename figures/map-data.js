/**
 * Map Data: one map tile, three roads on it joined into one network, a main
 * road across, a crossing road and a side road off it, their kerbs opening
 * where they meet, and the buildings of the blocks between them standing
 * at their own heights. The pointer picks the road nearest it on the tile:
 * its traffic flows, runs of short bright dashes travelling both its lanes,
 * one each way, and its kerbs take the edge; the others stay still. At rest the main road's
 * dashes stand still on it, bright. The buildings never move: the data that
 * changes is the traffic. The slider is the flow's speed.
 *
 * The pattern: one of many, and a flow while chosen. The hit test is the
 * distance to each road's middle on the tile's plane, which never moves; the
 * flow runs only while a road is chosen, and stands still for reduced motion.
 */
const {
  Cam, clamp, facing, fit, open, prism, proj, reducedMotion, rings, unproj,
  disposer, mk, pointer, put, register, solid,
} = HL;

const W = 124, TH = 3, HW = 7, LANE = 3, DASH = 8, EVERY = 17;
// Each road's middle on the tile, as a polyline.
const ROADS = [[[4, 62], [W - 4, 62]], [[40, 4], [40, W - 4]], [[92, 62], [92, W - 4]]];
// The buildings: footprint [x0, y0, x1, y1] and height.
const BLD = [
  [10, 10, 30, 48, 12], [52, 10, 80, 26, 8], [86, 10, 114, 48, 16], [52, 32, 80, 48, 6],
  [10, 76, 30, 112, 9], [52, 76, 80, 94, 14], [104, 76, 114, 110, 10], [52, 100, 80, 114, 5],
];

/** A road as its middle's points with running length. */
const measure = (pts) => { const run = [0]; for (let i = 1; i < pts.length; i++) run.push(run[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])); return { pts, run, total: run[run.length - 1] }; };
const along = (m, s) => {
  for (let i = 1; i < m.pts.length; i++) if (s <= m.run[i] || i === m.pts.length - 1) {
    const f = clamp((s - m.run[i - 1]) / (m.run[i] - m.run[i - 1]), 0, 1), p = m.pts[i - 1], q = m.pts[i];
    return [p[0] + (q[0] - p[0]) * f, p[1] + (q[1] - p[1]) * f];
  }
};

/** Which axis road r runs along (0: x, 1: y), where its middle is across it, and its extent along it. */
const axis = (r) => { const [a, b] = ROADS[r], k = a[1] === b[1] ? 0 : 1; return { k, at: a[1 - k], lo: Math.min(a[k], b[k]), hi: Math.max(a[k], b[k]) }; };

/** Road r's kerb on one side, as [from, to] runs along its axis: cut open wherever another road crosses it. */
function kerbRuns(r, side) {
  const A = axis(r), y = A.at + side;
  let runs = [[A.lo, A.hi]];
  ROADS.forEach((_, o) => {
    const B = axis(o);
    if (o === r || B.k === A.k || y < B.lo - HW || y > B.hi + HW) return;
    const c0 = B.at - HW, c1 = B.at + HW;
    runs = runs.flatMap(([u, v]) => [[u, Math.min(v, c0)], [Math.max(u, c1), v]]).filter(([u, v]) => v - u > 0.5);
  });
  return runs.map(([u, v]) => (A.k === 0 ? [[u, y], [v, y]] : [[y, u], [y, v]]));
}

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  let speed = value;
  const C = Cam(45, 0.5, 1.95);
  fit(C, [[0, 0, 0], [W, W, 0], [W, 0, 0], [0, W, 0], [86, 10, TH + 16]], 200, 166);
  const P = proj(C), front = facing(C), at = (p) => P(p[0], p[1], TH);
  const kerb = (r, side) => kerbRuns(r, side).map((run) => open(run.map(at))).join("");

  const g = mk("g", {}, svg);
  const [tr, ti] = rings(0, 0, W, W, 8, 1.8);
  put(solid(g), prism(P, front, tr, ti, 0, TH));

  // the roads: two kerbs each, and the flow on its middle; flat on the tile, under the buildings
  const roads = ROADS.map((pts, r) => {
    const m = measure(pts), kerbs = mk("path", { class: "nf" }, g);
    kerbs.setAttribute("d", [HW, -HW].map((side) => kerb(r, side)).join(""));
    return { m, kerbs, flow: mk("path", { class: "nf hi" }, g), drawn: NaN };
  });

  const order = BLD.map((_, i) => i).sort((p, q) => BLD[p][0] + BLD[p][1] - BLD[q][0] - BLD[q][1]);
  for (const i of order) {
    const [x0, y0, x1, y1, h] = BLD[i], [ring, inner] = rings(x0, y0, x1, y1, 2.6, 1);
    put(solid(g), prism(P, front, ring, inner, TH, TH + h));
  }

  /** Road r's dashes with the flow at phase ph, or none. */
  function drawFlow(r, ph) {
    const rd = roads[r];
    if (ph === rd.drawn) return;
    rd.drawn = ph;
    if (ph === null) { rd.flow.setAttribute("d", ""); return; }
    // two lanes, LANE either side of the middle, flowing opposite ways
    const [a, b] = rd.m.pts, nx = (-(b[1] - a[1]) / rd.m.total) * LANE, ny = ((b[0] - a[0]) / rd.m.total) * LANE;
    let d = "";
    for (const [side, dir] of [[1, 1], [-1, -1]]) {
      const shift = (p) => at([p[0] + side * nx, p[1] + side * ny]), off = (((dir * ph) % EVERY) + EVERY) % EVERY;
      for (let s = off - EVERY; s < rd.m.total; s += EVERY) {
        const s0 = clamp(s, 4, rd.m.total - 4), s1 = clamp(s + DASH, 4, rd.m.total - 4);
        if (s1 - s0 > 0.5) d += open([shift(along(rd.m, s0)), shift(along(rd.m, s1))]);
      }
    }
    rd.flow.setAttribute("d", d);
  }

  let act = null, phase = 6;
  const B = register(stage, (dt) => {
    if (act === null || act < 0 || reducedMotion()) return false;
    phase += speed * dt;
    drawFlow(act, phase);
    return true;
  });
  bag.add(B.unregister);

  function setActive(a) {
    if (a === act) return;
    act = a;
    const lit = a < 0 ? 0 : a;
    roads.forEach((rd, i) => { rd.kerbs.setAttribute("class", i === lit && a >= 0 ? "nf sil" : "nf"); drawFlow(i, i === lit ? phase : null); });
    read.textContent = a < 0 ? "rest" : `road ${a + 1}`;
    B.wake();
  }
  setActive(-1);

  /** The road whose middle is nearest the pointer on the tile, within a road and a half; -1 elsewhere. */
  function hit(p) {
    const [x, y] = unproj(C, p[0], p[1], TH);
    if (x < -8 || x > W + 8 || y < -8 || y > W + 8) return -1;
    let best = -1, bd = 18;
    roads.forEach((rd, i) => {
      const [a, b] = rd.m.pts, t = clamp(((x - a[0]) * (b[0] - a[0]) + (y - a[1]) * (b[1] - a[1])) / (rd.m.total * rd.m.total), 0, 1);
      const d = Math.hypot(x - a[0] - (b[0] - a[0]) * t, y - a[1] - (b[1] - a[1]) * t);
      if (d < bd) { bd = d; best = i; }
    });
    return best;
  }

  bag.add(pointer(stage, { move: (p) => setActive(hit(p)), leave: () => setActive(-1) }));
  bag.add(() => svg.replaceChildren());

  return { set: (v) => { speed = clamp(v, 10, 90); }, destroy: bag.dispose };
}

hairline({
  name: "map-data",
  means: "A map tile of roads and buildings: the road nearest the pointer comes alive, its traffic flowing along it.",
  rules: [1, 4, 5, 7],
  range: [20, 40, 70],
  tour: [[200, 161], [214, 124], [196, 204], null],
  mount,
});
