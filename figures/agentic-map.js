/**
 * Agentic Map: a map tile with streets on it, and a chat bubble standing on
 * it, its short tail a pin's point set into the street, three typing dots on its face. Off on the ground lies a
 * destination, a dot, and the way to it is dashed. Over the bubble's corner
 * hangs the AI spark, a four-pointed star and a small one beside it. At rest
 * the spark carries the bright edge. When the pointer comes over the figure
 * the spark turns and swells, the dots type one after the other, then a
 * short route draws out from the bubble's point along the ground to the
 * destination, and the bright edge goes to the route. The
 * slider is the typing's stagger, in ms.
 *
 * The pattern: one answer, told in turn. Tweens with a stagger, the bright
 * edge handed from the bubble to the route as it starts, and a hit test on
 * the rest pose's box on screen, which never moves.
 */
const {
  Cam, clamp, facing, fillet, fit, open, poly, prism, proj, rings,
  tdone, tset, tval, tween, disposer, flatDot, mk, place, pointer, put, register, solid,
} = HL;

const A = [-26, 22], D = [50, -34], BT = 7, BW = 36, B0 = 16, B1 = 62, LIFT = 3, TURN = -20, ST = 3, TT = 3, KW = 6;
const TILE = [-66, -60, 76, 54];
// the streets' kerbs, as runs on the tile: the route keeps to the streets
const KERBS = [
  [[-62, 22 - KW], [22 - KW, 22 - KW]], [[22 + KW, 22 - KW], [72, 22 - KW]], [[-62, 22 + KW], [22 - KW, 22 + KW]], [[22 + KW, 22 + KW], [72, 22 + KW]],
  [[22 - KW, -56], [22 - KW, 22 - KW]], [[22 - KW, 22 + KW], [22 - KW, 50]], [[22 + KW, -56], [22 + KW, -34 - KW]], [[22 + KW, -34 + KW], [22 + KW, 22 - KW]], [[22 + KW, 22 + KW], [22 + KW, 50]],
  [[22 + KW, -34 - KW], [72, -34 - KW]], [[22 + KW, -34 + KW], [72, -34 + KW]],
];
// the sparks: centre (t, s) in the bubble's plane, and size
const SPARKS = [[BW + 2, B1 + 8, 13], [BW + 17, B1 - 6, 6]];

/** A four-pointed star, an astroid, of radius r turned by th and its tips rounded: (t, s) points. */
const star = (r, th) => fillet(Array.from({ length: 48 }, (_, k) => {
  const u = (k / 48) * Math.PI * 2, x = r * Math.cos(u) ** 3, y = r * Math.sin(u) ** 3;
  return [x * Math.cos(th) - y * Math.sin(th), x * Math.sin(th) + y * Math.cos(th)];
}), Array(48).fill(0.5), 2);
const ROUTE = fillet([A, [22, 22], [22, -34], D], [0, 9, 9, 0], 6);
const OUTLINE = fillet(
  [[-BW, B0], [-6, B0], [0, 0], [6, B0], [BW, B0], [BW, B1], [-BW, B1]],
  [12, 4, 1.4, 4, 12, 12, 12], 5,
);

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  let stag = value;
  const C = Cam(45, 0.5, 1.72);
  /** A point of the bubble's plane, turned a little off facing the viewer: t across, s up, d toward the viewer. */
  const ca = Math.cos((TURN * Math.PI) / 180), sa = Math.sin((TURN * Math.PI) / 180);
  const bw = (t, s, d) => [A[0] + t * ca - d * sa, A[1] + t * sa + d * ca, s];
  fit(C, [[TILE[0], TILE[1], -TT], [TILE[2], TILE[3], -TT], [TILE[2], TILE[1], -TT], [TILE[0], TILE[3], -TT], bw(-BW, B1, 0), bw(BW, B1, 0), bw(BW + 2, B1 + 26, 0), bw(BW + 26, B1 - 6, 0), bw(-BW, 0, 0), [22, 22, 0], [D[0] + 4, D[1], 0], bw(BW, B0, 0)], 200, 166);
  const P = proj(C), at = (t, s, d) => P(...bw(t, s, d));

  // the route's length along the ground, for drawing it part-way
  const run = [0];
  for (let i = 1; i < ROUTE.length; i++) run.push(run[i - 1] + Math.hypot(ROUTE[i][0] - ROUTE[i - 1][0], ROUTE[i][1] - ROUTE[i - 1][1]));
  const total = run[run.length - 1];
  const partial = (k) => {
    const s = k * total, pts = [P(ROUTE[0][0], ROUTE[0][1], 0)];
    for (let i = 1; i < ROUTE.length; i++) {
      if (run[i] <= s) { pts.push(P(ROUTE[i][0], ROUTE[i][1], 0)); continue; }
      const f = (s - run[i - 1]) / (run[i] - run[i - 1] || 1), p = ROUTE[i - 1], q = ROUTE[i];
      pts.push(P(p[0] + (q[0] - p[0]) * f, p[1] + (q[1] - p[1]) * f, 0));
      break;
    }
    return pts;
  };

  const g = mk("g", {}, svg);
  // the map: a tile, its top at the ground, and the streets' kerbs on it
  put(solid(g), prism(P, facing(C), ...rings(TILE[0], TILE[1], TILE[2], TILE[3], 8, 2), -TT, 0));
  mk("path", { class: "nf lo", d: KERBS.map((k) => open(k.map((p) => P(p[0], p[1], 0)))).join("") }, g);
  place(flatDot(g, C, 3.4, "dot m"), P(D[0], D[1], 0));
  mk("path", { class: "nf lo", d: poly(ringAround(D, 8).map((p) => P(p[0], p[1], 0))) }, g);
  mk("path", { class: "dash nf", d: open(partial(1)) }, g);
  // the bubble: its back, then its face, then the dots on it
  mk("path", { class: "lo", d: poly(OUTLINE.map(([t, s]) => at(t, s, -BT))) }, g);
  const face = mk("path", { class: "sil", d: poly(OUTLINE.map(([t, s]) => at(t, s, 0))) }, g);
  const sparks = SPARKS.map(() => ({ back: mk("path", { class: "lo" }, g), face: mk("path", { class: "sil hi" }, g) }));
  const spin = tween(0);
  let sDrawn = NaN;
  /** The sparks at k: turned a quarter and swelling on the way, so they land as they started. */
  function drawSparks(k) {
    if (k === sDrawn) return;
    sDrawn = k;
    const grow = 1 + 0.35 * Math.sin(Math.PI * k);
    SPARKS.forEach(([ct, cs, r], i) => {
      const pts = star(r * (i ? 2 - grow : grow), (k * Math.PI) / 2);
      sparks[i].back.setAttribute("d", poly(pts.map(([x, y]) => at(ct + x, cs + y, -ST))));
      sparks[i].face.setAttribute("d", poly(pts.map(([x, y]) => at(ct + x, cs + y, 0))));
    });
  }
  const dots = [-13, 0, 13].map((t) => ({ t, el: mk("circle", { r: 3.2, class: "dot off" }, g), k: tween(0), drawn: NaN }));
  const route = mk("path", { class: "nf hi" }, g), rk = tween(0);

  let rDrawn = NaN, lit = null;
  const B = register(stage, (_dt, now) => {
    let moving = false;
    for (const d of dots) {
      const k = tval(d.k, now);
      if (!tdone(d.k, now)) moving = true;
      if (k === d.drawn) continue;
      d.drawn = k;
      // a typed dot hops up and settles a step higher, a medium dot
      place(d.el, at(d.t, (B0 + B1) / 2 + LIFT * k, 0));
      d.el.setAttribute("class", k > 0.5 ? "dot m" : "dot off");
    }
    drawSparks(tval(spin, now));
    if (!tdone(spin, now)) moving = true;
    const r = tval(rk, now);
    if (!tdone(rk, now)) moving = true;
    if (r !== rDrawn) { rDrawn = r; route.setAttribute("d", r < 0.01 ? "" : open(partial(r))); }
    const on = r >= 0.01;
    if (on !== lit) { lit = on; sparks.forEach((sp) => sp.face.classList.toggle("hi", !on)); }
    return moving;
  });
  bag.add(B.unregister);

  let act = null;
  function setActive(a) {
    if (a === act) return;
    act = a;
    const now = performance.now();
    tset(spin, a ? 1 : 0, now, 0);
    if (a) {
      dots.forEach((d, i) => tset(d.k, 1, now, i * stag));
      tset(rk, 1, now, dots.length * stag + 250);
    } else {
      tset(rk, 0, now, 0);
      dots.forEach((d, i) => tset(d.k, 0, now, (dots.length - 1 - i) * 40));
    }
    read.textContent = a ? "agent" : "rest";
    B.wake();
  }
  setActive(false);

  /** Inside the rest pose's box on screen: the bubble, the ground and the destination. */
  const box = [P(TILE[0], TILE[3], 0), P(TILE[2], TILE[1], 0), P(TILE[2], TILE[3], 0), at(-BW, B1, 0), at(BW + 2, B1 + 20, 0), at(BW + 24, B1, 0), P(...[22, 22, 0]), P(D[0], D[1], 0), at(-BW, 0, 0)];
  const [x0, x1] = [Math.min(...box.map((p) => p[0])) - 12, Math.max(...box.map((p) => p[0])) + 12];
  const [y0, y1] = [Math.min(...box.map((p) => p[1])) - 12, Math.max(...box.map((p) => p[1])) + 12];
  const hit = ([x, y]) => x > x0 && x < x1 && y > y0 && y < y1;

  bag.add(pointer(stage, { move: (p) => setActive(hit(p)), leave: () => setActive(false) }));
  bag.add(() => svg.replaceChildren());

  return { set: (v) => { stag = clamp(v, 60, 260); }, destroy: bag.dispose };
}

/** A ring of points round c on the ground, radius r. */
function ringAround(c, r) {
  return Array.from({ length: 32 }, (_, k) => [c[0] + r * Math.cos((k / 32) * Math.PI * 2), c[1] + r * Math.sin((k / 32) * Math.PI * 2)]);
}

hairline({
  name: "agentic-map",
  means: "A chat bubble whose tail is a map pin, an AI spark at its corner: it turns, the dots type, then a route draws out.",
  rules: [1, 2, 4, 5],
  range: [90, 150, 230],
  tour: [[200, 120], [260, 200], null],
  mount,
});
