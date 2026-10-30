/**
 * Navigation: a phone lying on the table, screen up, a navigation app on it.
 * The phone is a thin slab with rounded corners, its screen inset, a camera
 * pill at the top of the screen and a home bar at its foot. On the screen a
 * map: two streets up it, two across, and the route along them, from a puck
 * near the foot, a chevron on it pointing the way, up, round the corner,
 * across and up to a pin standing on the screen near the top. At the
 * screen's foot the app's panel lies over the map. At rest the route
 * carries the bright edge, drawn whole. When the pointer comes over the
 * phone the puck drives it, slowly, and the route behind it is used up, as a
 * navigation app does, until the puck pulls up short of the pin; the pin
 * hops on the spot the while, a ring on the screen under it. Let go, the
 * puck shrinks away where it is, grows back at the start, and the route
 * draws on again from it; the pin lands. The slider is how far along the
 * route it drives.
 *
 * The pattern: the drive on a slow tween (2.6s); going back is a shrink, a
 * jump and a grow, never a drive backwards. The route is drawn from wherever
 * the puck is to the end. The hit test is the phone's rest box on screen,
 * which never moves.
 */
const {
  Cam, circ, clamp, facing, fillet, fit, hull, open, poly, prism, proj, rings, rrect,
  tdone, tset, tval, tween, disposer, mk, pointer, put, register, solid,
} = HL;

// the phone: x across, y along, its top (the camera) at -y; the screen inset SI, the map on it
const PW = 41, PL = 80, PR = 13, PT = 7, SI = 4, SR = 9;
const SX0 = -PW + SI, SX1 = PW - SI, SY0 = -PL + SI, SY1 = PL - SI;
const KW = 5, ACROSS = [20, -46], UP = [-12, 16], SHEET = 50;
const ROUTE = fillet([[-12, 42], [-12, 20], [16, 20], [16, -14]], [0, 8, 8, 0], 6).filter((p, k, a) => k === 0 || Math.hypot(p[0] - a[k - 1][0], p[1] - a[k - 1][1]) > 0.01);
const PK = 8, PKH = 2.2, PIN_R = 8, PIN_H = 26, PIN_T = 3.4, D = [16, -21], DRIVE = 2600;
// the pin's hop while the puck drives: HOP high, one hop every HOPT seconds
const HOP = 7, HOPT = 1.1;
const PIN = (() => {
  const cy = PIN_H - PIN_R, a0 = Math.acos(PIN_R / cy), pts = [];
  for (let k = 0; k <= 24; k++) { const a = a0 + (k / 24) * (2 * Math.PI - 2 * a0); pts.push([PIN_R * Math.sin(a), cy - PIN_R * Math.cos(a)]); }
  pts.push([0, 0]);
  return fillet(pts, pts.map((_, k) => (k === pts.length - 1 ? 2 : 0.4)), 3);
})();

/** The streets' kerbs, each a pair of lines either side of its middle, open where another street crosses. */
function kerbs() {
  const out = [];
  const cut = (a0, a1, at) => {
    const runs = [], gaps = at.map((c) => [c - KW, c + KW]).sort((a, b) => a[0] - b[0]);
    let s = a0;
    for (const [g0, g1] of gaps) { if (g0 > s) runs.push([s, g0]); s = Math.max(s, g1); }
    if (s < a1) runs.push([s, a1]);
    return runs;
  };
  for (const x of UP) for (const side of [-KW, KW]) for (const [y0, y1] of cut(SY0, SHEET, ACROSS)) out.push([[x + side, y0], [x + side, y1]]);
  for (const y of ACROSS) for (const side of [-KW, KW]) for (const [x0, x1] of cut(SX0, SX1, UP)) out.push([[x0, y + side], [x1, y + side]]);
  return out;
}

/** The route's running length, and a point at length s along it, with the way it heads there. */
const RUN = ROUTE.reduce((a, p, i) => (i ? [...a, a[i - 1] + Math.hypot(p[0] - ROUTE[i - 1][0], p[1] - ROUTE[i - 1][1])] : [0]), []);
const TOTAL = RUN[RUN.length - 1];
function along(s) {
  s = clamp(s, 0, TOTAL);
  for (let i = 1; i < ROUTE.length; i++) if (s <= RUN[i] || i === ROUTE.length - 1) {
    const p = ROUTE[i - 1], q = ROUTE[i], f = clamp((s - RUN[i - 1]) / (RUN[i] - RUN[i - 1]), 0, 1);
    return [p[0] + (q[0] - p[0]) * f, p[1] + (q[1] - p[1]) * f, Math.atan2(q[1] - p[1], q[0] - p[0])];
  }
}
/** The route from length s to length e. */
const span = (s, e) => [along(s), ...ROUTE.filter((_, i) => RUN[i] > s && RUN[i] < e), along(e)];
// the chevron on the puck, in its own frame: its tip ahead at +u, its corners rounded
const CHEV = fillet([[5.2, 0], [-3.8, 4.6], [-1.6, 0], [-3.8, -4.6]], [0.8, 0.8, 0.4, 0.8], 3);

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  let reach = value;
  const C = Cam(45, 0.5, 1.95);
  fit(C, [[-PW, -PL, 0], [PW, PL, 0], [PW, -PL, 0], [-PW, PL, 0], [D[0], D[1], PT + PIN_H + HOP]], 200, 166);
  const P = proj(C), front = facing(C), at = (p) => P(p[0], p[1], PT);

  const g = mk("g", {}, svg);
  // the phone: a slab, its top face's ring the crease; the screen, the camera pill, the home bar
  put(solid(g), prism(P, front, ...rings(-PW, -PL, PW, PL, PR, 1.6), 0, PT));
  mk("path", { class: "nf", d: poly(rrect(SX0, SY0, SX1, SY1, SR, 6).map((q) => at([q.u, q.v]))) }, g);
  mk("path", { class: "nf", d: poly(rrect(-9, SY0 + 3, 9, SY0 + 8, 2.5, 4).map((q) => at([q.u, q.v]))) }, g);
  mk("path", { class: "nf lo", d: open([at([-11, SY1 - 3.5]), at([11, SY1 - 3.5])]) }, g);
  // the side buttons, on the edge we see
  mk("path", { class: "nf lo", d: open([P(PW + 0.6, -44, PT * 0.5), P(PW + 0.6, -30, PT * 0.5)]) }, g);

  // the map on the screen: the streets' kerbs, dim, and the route over them
  mk("path", { class: "nf lo", d: kerbs().map((k) => open(k.map(at))).join("") }, g);
  const route = mk("path", { class: "nf hi" }, g);
  // the app's panel at the foot of the screen, over the map, with a round button on it
  mk("path", { class: "lo", d: poly(rrect(SX0 + 3, SHEET, SX1 - 3, SY1 - 8, 5, 6).map((q) => at([q.u, q.v]))) }, g);
  mk("path", { class: "nf lo", d: poly(circ(4.5, 24).map((q) => at([SX1 - 12 + q.u, (SHEET + SY1 - 8) / 2 + q.v]))) }, g);

  // the pin, standing on the screen at the destination, facing the viewer
  // under it a ring on the screen where it lands, which shrinks as the pin hops up off it
  const mark = mk("path", { class: "nf lo" }, g), pinSil = mk("path", { class: "sil" }, g), pinFace = mk("path", { class: "nf lo" }, g), pinHole = mk("path", { class: "nf" }, g);
  let hop = 0, pinDrawn = NaN;
  function drawPin() {
    const z = HOP * Math.sin(Math.PI * hop);
    if (z === pinDrawn) return;
    pinDrawn = z;
    const pw = (t, h, d) => P(D[0] + (t + d) / Math.SQRT2, D[1] + (d - t) / Math.SQRT2, PT + z + h);
    const fr = PIN.map(([t, h]) => pw(t, h, 0)), r = 4.5 * (1 - (0.35 * z) / HOP);
    mark.setAttribute("d", poly(circ(r, 28).map((q) => P(D[0] + q.u, D[1] + q.v, PT))));
    pinSil.setAttribute("d", poly(hull(fr.concat(PIN.map(([t, h]) => pw(t, h, -PIN_T))))));
    pinFace.setAttribute("d", poly(fr));
    pinHole.setAttribute("d", poly(circ(3, 20).map((q) => pw(q.u, PIN_H - PIN_R + q.v, 0))));
  }

  // the puck: where you are, a low disc with a chevron on it pointing the way
  const pg = mk("g", {}, g), puckS = solid(pg), chev = mk("path", { class: "dot m" }, pg);

  // the drive; the puck's size, which shrinks it away and grows it back at the start; the route's
  // share drawn on from the puck, which draws it again from the start once the puck is back there
  const drive = tween(0, DRIVE), size = tween(1, 320), grow = tween(1, 900);
  let drawn = "";
  function draw(dv, k, gv) {
    const key = dv + "," + k + "," + gv + "," + reach;
    if (key === drawn) return;
    drawn = key;
    const s = dv * reach * TOTAL, [x, y, th] = along(s), cs = Math.cos(th), sn = Math.sin(th);
    route.setAttribute("d", gv < 0.01 ? "" : open(span(s, s + (TOTAL - s) * gv).map(at)));
    pg.setAttribute("visibility", k < 0.05 ? "hidden" : "visible");
    if (k < 0.05) return;
    const sh = (r) => r.map((q) => ({ ...q, u: q.u * k + x, v: q.v * k + y }));
    put(puckS, prism(P, front, sh(circ(PK, 32)), sh(circ(PK - 1.4, 32)), PT, PT + PKH * k));
    chev.setAttribute("d", poly(CHEV.map(([u, v]) => P(x + (u * cs - v * sn) * k, y + (u * sn + v * cs) * k, PT + PKH * k))));
  }

  let on = false, back = false;
  const B = register(stage, (dt, now) => {
    // let go: once the puck has shrunk away it is set back at the start, grows there, and the route draws on again
    if (back && tdone(size, now)) {
      back = false;
      Object.assign(drive, { from: 0, to: 0, t0: -1e9 });
      Object.assign(grow, { from: 0, to: 0, t0: -1e9 });
      tset(size, 1, now, 0); tset(grow, 1, now, 120);
    }
    draw(tval(drive, now), tval(size, now), tval(grow, now));
    // the pin hops on while the pointer is over; let go, it finishes the hop it is in and lands
    let hopping = false;
    if (on && !HL.reducedMotion()) { hop = (hop + dt / HOPT) % 1; hopping = true; }
    else if (hop > 0) { hop += dt / HOPT; if (hop >= 1) hop = 0; else hopping = true; }
    drawPin();
    return hopping || back || !tdone(drive, now) || !tdone(size, now) || !tdone(grow, now);
  });
  bag.add(B.unregister);

  let act = null;
  function setActive(a) {
    if (a === act) return;
    act = a;
    const now = performance.now();
    on = !!a;
    if (a) {
      // on again, wherever it was: the puck grows back where it is and drives on
      back = false;
      tset(size, 1, now, 0); tset(grow, 1, now, 0); tset(drive, 1, now, 300);
    } else if (tval(drive, now) > 0.01) {
      // the puck stops where it is and shrinks away, rather than run back up the road
      back = true;
      Object.assign(drive, { from: tval(drive, now), to: tval(drive, now), t0: -1e9 });
      tset(size, 0, now, 0);
    }
    read.textContent = a ? "driving" : "rest";
    B.wake();
  }
  setActive(false);

  const box = [[-PW, -PL], [PW, PL], [-PW, PL], [PW, -PL]].map(at);
  const xs = box.map((p) => p[0]), ys = box.map((p) => p[1]);
  const hit = ([x, y]) => x > Math.min(...xs) && x < Math.max(...xs) && y > Math.min(...ys) && y < Math.max(...ys) + PT * C.S;

  bag.add(pointer(stage, { move: (p) => setActive(hit(p)), leave: () => setActive(false) }));
  bag.add(() => svg.replaceChildren());

  return { set: (v) => { reach = clamp(v, 0.4, 0.92); B.wake(); }, destroy: bag.dispose };
}

hairline({
  name: "navigation",
  means: "A phone lying screen up with a navigation app on it: over the phone the puck drives the route and uses it up, to the pin.",
  rules: [1, 4, 5, 8],
  range: [0.5, 0.8, 0.92],
  tour: [[200, 170], [220, 200], null],
  mount,
});
