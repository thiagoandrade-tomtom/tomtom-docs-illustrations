/**
 * Routing: two roads from an origin to a destination, no tile under them. The
 * origin is a round puck with a dot on it, the start; the destination is a
 * map pin standing on the far end, a thick round-headed plate with a hole in
 * its head, its point in the ground. The main road takes two turns on the
 * left; the alternative swings wide round the right. The road the pointer is
 * on lifts, and the route draws along it, bright, from the start to the pin;
 * the other road settles flat, its route wound back. The puck and pin stay
 * where they are and keep the silhouette weight always, so the ends outweigh
 * every road but the chosen one. At rest the main road sits a little raised,
 * its route drawn. The slider is the lift.
 *
 * The pattern: one of many. Tweens for which road, and a hit test on the
 * ground plane (which never moves): the side of the line from origin to
 * destination the pointer is on.
 */
const {
  Cam, circ, clamp, facing, fillet, fit, hull, open, poly, proj, prism, unproj,
  tdone, tset, tval, tween, disposer, flatDot, mk, place, pointer, put, register, solid,
} = HL;

const O = [50, 50], D = [-50, -50], HW = 5.5, TH = 3, PK = 9, PKR = 18;
const ROADS = [
  [O, [-8, 50], [-8, 14], [-50, 14], D],
  [O, [58, -50], D],
];
const PIN_R = 19, PIN_H = 52, PIN_T = 6;

/** A road's outline: the polyline widened by HW on each side, mitred at the turns, every corner rounded. */
function outline(raw) {
  const trim = (a, b, d) => { const l = Math.hypot(b[0] - a[0], b[1] - a[1]); return [a[0] + ((b[0] - a[0]) * d) / l, a[1] + ((b[1] - a[1]) * d) / l]; };
  const n = raw.length, nor = [], pts = raw.slice();
  pts[0] = trim(raw[0], raw[1], PKR + 4); pts[n - 1] = trim(raw[n - 1], raw[n - 2], 3);
  for (let i = 0; i < n - 1; i++) {
    const dx = pts[i + 1][0] - pts[i][0], dy = pts[i + 1][1] - pts[i][1], l = Math.hypot(dx, dy);
    nor.push([-dy / l, dx / l]);
  }
  const side = (s) => pts.map((p, k) => {
    const a = nor[Math.max(0, k - 1)], b = nor[Math.min(n - 2, k)];
    const m = [a[0] + b[0], a[1] + b[1]], q = 1 + a[0] * b[0] + a[1] * b[1];
    return [p[0] + (s * HW * m[0]) / q, p[1] + (s * HW * m[1]) / q];
  });
  const shape = side(1).concat(side(-1).reverse());
  return fillet(shape, shape.map(() => 6));
}

/** The pin's outline in its own upright plane: a round head tangent down to a point, (t across, s up). */
function pinShape() {
  const cy = PIN_H - PIN_R, a0 = Math.acos(PIN_R / cy), pts = [];
  for (let k = 0; k <= 28; k++) {
    const a = a0 + (k / 28) * (2 * Math.PI - 2 * a0);
    pts.push([PIN_R * Math.sin(a), cy - PIN_R * Math.cos(a)]);
  }
  pts.push([0, 0]);
  return fillet(pts, pts.map((_, k) => (k === pts.length - 1 ? 2.5 : 0.4)), 3);
}

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  let lift = value;
  const C = Cam(45, 0.5, 1.9);
  const shapes = ROADS.map(outline);
  const ext = shapes.flat().map((p) => [p[0], p[1], 0]);
  fit(C, [...ext, [O[0] + PKR, O[1] + PKR, 0], [D[0], D[1], PIN_H], [-50, 14, 14 + TH]], 200, 166);
  const P = proj(C), front = facing(C);

  // The pin's plate faces the viewer: across it is world (1, -1), through it (1, 1).
  const pw = (t, s, d, z) => P(D[0] + (t + d) / Math.SQRT2, D[1] + (d - t) / Math.SQRT2, s + z);
  const ps = pinShape();

  const g = mk("g", {}, svg);
  const low = mk("g", {}, g), pin = mk("g", {}, g), puck = mk("g", {}, g), high = mk("g", {}, g);

  // The destination: a pin, a silhouette of both faces, the front face as its crease, a hole in its head.
  // Its silhouette is stroked again over the crease, so the pin keeps the full silhouette weight all round.
  const pinS = solid(pin), pinEdge = mk("path", { class: "nf sil" }, pin), hole = mk("path", { class: "nf sil" }, pin);
  {
    const z = 0;
    const edge = poly(hull(ps.map((p) => pw(p[0], p[1], -PIN_T, z)).concat(ps.map((p) => pw(p[0], p[1], 0, z)))));
    put(pinS, { sil: edge, crease: poly(ps.map((p) => pw(p[0], p[1], 0, z))) });
    pinEdge.setAttribute("d", edge);
    hole.setAttribute("d", poly(circ(7, 28).map((q) => pw(q.u, PIN_H - PIN_R + q.v, 0, z))));
  }

  /** A road's middle, trimmed as its outline is, with its running length: where the route draws. */
  const middle = (raw) => {
    const n = raw.length, pts = raw.slice(), trim = (a, b, d) => { const l = Math.hypot(b[0] - a[0], b[1] - a[1]); return [a[0] + ((b[0] - a[0]) * d) / l, a[1] + ((b[1] - a[1]) * d) / l]; };
    pts[0] = trim(raw[0], raw[1], PKR + 2); pts[n - 1] = trim(raw[n - 1], raw[n - 2], 6);
    const smooth = fillet(pts, pts.map((_, k) => (k === 0 || k === n - 1 ? 0 : 6)), 5).filter((p, k, a) => k === 0 || p[0] !== a[k - 1][0] || p[1] !== a[k - 1][1]);
    const run = [0];
    for (let k = 1; k < smooth.length; k++) run.push(run[k - 1] + Math.hypot(smooth[k][0] - smooth[k - 1][0], smooth[k][1] - smooth[k - 1][1]));
    return { pts: smooth, run, total: run[run.length - 1] };
  };
  /** The first share k of a middle, at height z. */
  const partial = (m, k, z) => {
    const s = k * m.total, out = [P(m.pts[0][0], m.pts[0][1], z)];
    for (let i = 1; i < m.pts.length; i++) {
      const p = m.pts[i - 1], q = m.pts[i];
      if (m.run[i] <= s) { out.push(P(q[0], q[1], z)); continue; }
      const f = (s - m.run[i - 1]) / (m.run[i] - m.run[i - 1]);
      out.push(P(p[0] + (q[0] - p[0]) * f, p[1] + (q[1] - p[1]) * f, z));
      break;
    }
    return out;
  };

  // The origin: a round puck on the near end, with a dot in its middle.
  const shift = (r) => r.map((q) => ({ ...q, u: q.u + O[0], v: q.v + O[1] }));
  put(solid(puck), prism(P, front, shift(circ(PKR, 48)), shift(circ(PKR - 2, 48)), 0, PK));
  place(flatDot(puck, C, 4, "dot m"), P(O[0], O[1], PK));

  const REST = [4, 0];
  const roads = shapes.map((shape, i) => {
    const grp = mk("g", {}, low);
    const under = mk("path", { class: "lo" }, grp), top = mk("path", { class: "lo" }, grp), line = mk("path", { class: "nf hi" }, grp);
    return { shape, grp, under, top, line, mid: middle(ROADS[i]), z: tween(REST[i]), k: tween(i === 0 ? 1 : 0), drawn: "", up: false };
  });

  function draw(r, z, k) {
    if (z + "," + k === r.drawn) return;
    r.drawn = z + "," + k;
    r.line.setAttribute("d", k < 0.01 ? "" : open(partial(r.mid, k, z + TH)));
    r.under.setAttribute("d", poly(r.shape.map((p) => P(p[0], p[1], z))));
    r.top.setAttribute("d", poly(r.shape.map((p) => P(p[0], p[1], z + TH))));
    const up = z > PK - TH;
    if (up !== r.up) { r.up = up; (up ? high : low).appendChild(r.grp); }
  }

  const B = register(stage, (_dt, now) => {
    let moving = false;
    for (const r of roads) { draw(r, tval(r.z, now), tval(r.k, now)); if (!tdone(r.z, now) || !tdone(r.k, now)) moving = true; }
    return moving;
  });
  bag.add(B.unregister);

  let act = -1;
  // The chosen road takes the silhouette's edge and its route the bright one; the other drops to the dim stroke.
  const paint = (a) => roads.forEach((r, i) => { const on = i === (a < 0 ? 0 : a); r.top.setAttribute("class", on ? "sil" : "lo"); });
  paint(-1);
  function setActive(a, force) {
    if (a === act && !force) return;
    const now = performance.now();
    act = a;
    roads.forEach((r, i) => {
      const on = i === (a < 0 ? 0 : a);
      tset(r.z, a < 0 ? REST[i] : i === a ? lift : 0, now, 0);
      // the route winds back off the road let go at once, and draws on the chosen one after it
      tset(r.k, on ? 1 : 0, now, on ? 200 : 0);
    });
    paint(a);
    read.textContent = a < 0 ? "rest" : `route ${a + 1}`;
    B.wake();
  }

  /** On the ground: left of the line from origin to destination is the main road, right of it the other. */
  function hit(p) {
    const [x, y] = unproj(C, p[0], p[1], 0);
    if (Math.abs(x + y) > 125 || Math.abs(x - y) > 150) return -1;
    return x - y < 0 ? 0 : 1;
  }

  bag.add(pointer(stage, { move: (p) => setActive(hit(p)), leave: () => setActive(-1) }));
  bag.add(() => svg.replaceChildren());

  return { set: (v) => { lift = clamp(v, 0, 14); if (act >= 0) setActive(act, true); }, destroy: bag.dispose };
}

hairline({
  name: "routing",
  means: "Two roads from a start puck to a destination pin: the one under the pointer lifts and the route draws along it.",
  rules: [1, 4, 5, 8],
  range: [6, 10, 14],
  tour: [[250, 180], [150, 150], [262, 120], null],
  mount,
});
