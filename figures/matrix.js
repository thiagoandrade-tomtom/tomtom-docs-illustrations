/**
 * Matrix routing: a street grid on a map tile, low blocks between the streets, and
 * on it two origins, round pucks on the left avenue, each with two destinations of
 * its own, pins on the grid. Each origin is routed to its destinations along the
 * streets, its two routes running side by side where they share one; no route of
 * one origin meets the other's. At rest the first origin's routes stand lit. The
 * pointer nearest an origin lights its routes, each drawn out from it along its
 * streets; nearest a destination it lights the route to it, drawn out from its
 * origin too, for a route always starts where the trip does. The slider is the time a route takes to draw, in seconds.
 *
 * The pattern: one of six places, chosen by the pointer's distance to each on the
 * ground, and each route's drawn share running to its goal from where it is, the
 * newly lit ones a little later the longer they are. The
 * hit test is the ground's plane, which never moves.
 */
const {
  Cam, circ, clamp, facing, fillet, fit, open, poly, prism, proj, rings, unproj,
  disposer, flatDot, mk, place, pointer, put, register, solid,
} = HL;

// the tile, the streets' middles along y at XS and along x at YS, and their width
const X0 = -72, X1 = 72, Y0 = -50, Y1 = 50, TT = 3, XS = [-54, -18, 18, 54], YS = [-36, 0, 36], SW = 8;
// the origins on the left avenue, and the destinations: each origin has two of its own, so no route of one
// origin ever meets a route of the other
const O = [[-54, -36], [-54, 36]], D = [[54, -36], [-18, 0], [54, 36], [54, 0]];
// the pin, upright in its own plane: a round head of radius PR at height PC, drawn in to its point
const PR = 5, PC = 13, REACH = 16;
// at rest the first origin's routes stand lit, drawn
const REST = "o0";
// the routes along the streets, through their corners: from origin i to destination j, set off by off across the
// street so an origin's two routes run side by side where they share one
const ROUTES = [
  { i: 0, j: 0, off: -1.4, via: [] },
  { i: 0, j: 1, off: 1.4, via: [[-18, -36]] },
  { i: 1, j: 2, off: 1.4, via: [] },
  { i: 1, j: 3, off: -1.4, via: [[18, 36], [18, 0]] },
];

/** A route's line along its streets, its corners rounded. */
function route({ i, j, off, via }) {
  const pts = [O[i], ...via, D[j]].map(([x, y]) => [x + off, y + off]);
  // it leaves from the puck's rim, not its middle, so its draw is seen from the first frame, not hidden under it
  const [a, b] = pts, l = Math.hypot(b[0] - a[0], b[1] - a[1]);
  pts[0] = [a[0] + ((b[0] - a[0]) / l) * 5.5, a[1] + ((b[1] - a[1]) / l) * 5.5];
  return fillet(pts, pts.map((_, k) => (k && k < pts.length - 1 ? 4 : 0)), 4);
}
/** The first share t of a polyline, by length. */
function upto(pts, t) {
  const len = [0];
  for (let k = 1; k < pts.length; k++) len.push(len[k - 1] + Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]));
  const want = len.at(-1) * t, out = [pts[0]];
  for (let k = 1; k < pts.length; k++) {
    if (len[k] <= want) { out.push(pts[k]); continue; }
    const f = (want - len[k - 1]) / (len[k] - len[k - 1] || 1);
    out.push([pts[k - 1][0] + (pts[k][0] - pts[k - 1][0]) * f, pts[k - 1][1] + (pts[k][1] - pts[k - 1][1]) * f]);
    break;
  }
  return out;
}

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  let dur = value;
  const C = Cam(45, 0.5, 2.05);
  fit(C, [[X0, Y0, -TT], [X1, Y1, -TT], [X1, Y0, -TT], [X0, Y1, -TT], [D[0][0], D[0][1], PC + PR]], 200, 166);
  const P = proj(C), front = facing(C), at = ([x, y]) => P(x, y, 0);

  const g = mk("g", {}, svg);
  put(solid(g), prism(P, front, ...rings(X0, Y0, X1, Y1, 8, 1.8), -TT, 0));
  // the blocks between the streets, low and dim, and the streets' middles, dashed
  for (let a = 0; a < XS.length - 1; a++) for (let b = 0; b < YS.length - 1; b++) {
    const el = solid(g);
    put(el, prism(P, front, ...rings(XS[a] + SW / 2 + 2, YS[b] + SW / 2 + 2, XS[a + 1] - SW / 2 - 2, YS[b + 1] - SW / 2 - 2, 3, 1), 0, 1.6));
    el.sil.classList.add("lo");
  }
  const mids = XS.map((x) => open([at([x, Y0 + 4]), at([x, Y1 - 4])])).concat(YS.map((y) => open([at([X0 + 4, y]), at([X1 - 4, y])])));
  mk("path", { class: "nf dash lo", d: mids.join("") }, g);

  // the routes: each a dim line on the streets, and over it its lit draw
  const R = ROUTES.map((r) => {
    const pts = route(r);
    mk("path", { class: "nf lo", d: open(pts.map(at)) }, g);
    return { ...r, pts, el: mk("path", { class: "nf hi" }, g), p: 0, goal: 0, wait: 0 };
  });

  // the origins, pucks with a dot on each, and the destinations, pins standing facing the viewer, a ring under each
  const pucks = O.map(([x, y]) => {
    const sh = (r) => r.map((q) => ({ ...q, u: q.u + x, v: q.v + y })), el = solid(g);
    put(el, prism(P, front, sh(circ(5, 28)), sh(circ(3.6, 28)), 0, 2.5));
    place(flatDot(g, C, 1.6, "dot"), P(x, y, 2.5));
    return el;
  });
  const HEAD = (() => {
    const b = Math.acos(PR / PC), pts = [];
    for (let k = 0; k <= 24; k++) { const t = -Math.PI / 2 + b + ((2 * Math.PI - 2 * b) * k) / 24; pts.push([PR * Math.cos(t), PC + PR * Math.sin(t)]); }
    return pts.concat([[0, 0]]);
  })();
  const pins = D.map(([x, y]) => {
    const pw = (a, h) => P(x + a / Math.SQRT2, y - a / Math.SQRT2, h);
    mk("path", { class: "nf lo", d: poly(circ(3, 20).map((q) => P(x + q.u, y + q.v, 0))) }, g);
    const el = mk("path", { class: "sil", d: poly(HEAD.map(([a, h]) => pw(a, h))) }, g);
    mk("path", { class: "nf", d: poly(circ(1.8, 16).map((q) => pw(q.u, PC + q.v))) }, g);
    return el;
  });

  // each route's drawn share p runs toward its goal at one route a `dur`, from wherever it is: a route already
  // lit stays lit, one going out draws back from its far end, and none ever starts over
  let pick = null, drawn = "";
  const ease = (u) => u * u * (3 - 2 * u);
  function draw() {
    const key = R.map((r) => r.p.toFixed(3)).join();
    if (key === drawn) return;
    drawn = key;
    // every route draws out from its origin, whichever end the pointer picked: a route starts where the trip does
    for (const r of R) { const t = ease(r.p); r.el.setAttribute("d", t > 0.001 ? open(upto(r.pts, t).map(at)) : ""); }
  }
  const B = register(stage, (dt) => {
    let moving = false;
    for (const r of R) {
      if (r.wait > 0) { r.wait -= dt; moving = true; continue; }
      const step = dt / dur;
      r.p = r.goal ? Math.min(1, r.p + step) : Math.max(0, r.p - step);
      if (r.p !== r.goal) moving = true;
    }
    draw();
    return moving;
  });
  bag.add(B.unregister);

  /** The origin or destination nearest the pointer on the ground, within REACH of it, as "o0", "d2"; off the
   * tile, null; between the places, the last one picked, so moving from one to the next never passes through rest. */
  function hit(p) {
    const [x, y] = unproj(C, p[0], p[1], 0);
    if (x < X0 - 6 || x > X1 + 6 || y < Y0 - 6 || y > Y1 + 6) return null;
    let best = pick, bd = REACH;
    O.forEach(([a, b], k) => { const d = Math.hypot(a - x, b - y); if (d < bd) { bd = d; best = "o" + k; } });
    D.forEach(([a, b], k) => { const d = Math.hypot(a - x, b - y); if (d < bd) { bd = d; best = "d" + k; } });
    return best;
  }
  function aim(name, first = false) {
    if (name === pick && !first) return;
    pick = name;
    const lit = name ?? REST, k = +lit[1];
    R.forEach((r) => {
      const goal = (lit[0] === "o" ? r.i === k : r.j === k) ? 1 : 0;
      if (first) { r.goal = r.p = goal; r.wait = 0; return; }
      // the second of an origin's routes starts a beat after the first, so they fan out from it
      if (goal !== r.goal) { r.goal = goal; r.wait = goal && r.p === 0 ? (r.off > 0 ? 0.08 : 0) : 0; }
    });
    pucks.forEach((el, n) => el.sil.classList.toggle("hi", lit === "o" + n));
    pins.forEach((el, n) => el.classList.toggle("hi", lit === "d" + n));
    read.textContent = !name ? "rest" : name[0] === "o" ? "origin " + (k + 1) + " → 2 stops" : "stop " + (k + 1) + " ← origin " + (ROUTES.find((r) => r.j === k).i + 1);
    B.wake();
  }
  aim(null, true);

  bag.add(pointer(stage, { move: (p) => aim(hit(p)), leave: () => aim(null) }));
  bag.add(() => svg.replaceChildren());

  return { set: (v) => { dur = clamp(v, 0.2, 1.5); }, destroy: bag.dispose };
}

hairline({
  name: "matrix",
  means: "Two origins on a street grid, each routed to two stops of its own: an origin lights its routes, a stop the route to it.",
  rules: [1, 2, 4, 8],
  range: [0.9, 0.6, 0.4],
  tour: [[70, 148], [174, 148], [278, 200], null],
  mount,
});
