/**
 * Parking: a stretch of car park on a tile, a kerb along its back and two
 * bays painted on it side by side. In the left bay a car is parked, nose in:
 * its body, a cabin whose top is shorter than its foot, its wheels on the
 * side we see. The right bay is free, and over it floats a parking marker,
 * its head rounded above and tapering to a point below, a P on its face, a ring on the
 * ground beneath. The marker carries the bright edge, at rest and under the
 * pointer: it is the free bay. When the pointer comes over the car park the
 * marker bobs above its bay, the ring under it shrinking as it rises, and
 * lands when let go. The slider is the bob's period, in seconds.
 *
 * The pattern: a gentle ambient loop that runs only under the pointer,
 * through register, like the navigator's pin. The hit test is the tile's
 * rest box on its plane, which never moves.
 */
const {
  Cam, circ, clamp, facing, fillet, fit, hull, open, poly, prism, proj, ringAt, rings, rrect, run, unproj,
  disposer, mk, pointer, put, register, solid,
} = HL;

// the tile, x along the kerb, y out from it; the bays painted from the kerb's foot to BY1
const TX = 72, TY0 = -50, TY1 = 38, TT = 3, KD = 7, KH = 3;
const BY0 = TY0 + KD + 3, BY1 = 18, BAYS = [-46, -8, 30];
// the car, nose in, in the left bay; the marker over the right one
const L = 36, WD = 19, Z0 = 3, ZB = 14, ZC = 26, WR = 6;
const CAR = [(BAYS[0] + BAYS[1]) / 2, (BY0 + BY1) / 2 - 1, -Math.PI / 2], M = [(BAYS[1] + BAYS[2]) / 2, (BY0 + BY1) / 2 + 4];
// the marker in its own upright plane (t across, s up): a rounded head over a point; FLOAT its tip's height
const MH = 7.5, MS0 = 11, MS1 = 26, MTIP = 5, MT = 2.6, FLOAT = 1.5, HOP = 5;
const HEAD = (() => {
  // convex, so its outline and its face are one shape: up from the tip to each side, round the top corners
  const r = 3.8, pts = [[0, MTIP], [MH, MS0 + 2]];
  const arc = (cx, cy, a0) => { for (let k = 0; k <= 6; k++) { const a = a0 + (k / 6) * (Math.PI / 2); pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); } };
  arc(MH - r, MS1 - r, 0); arc(-MH + r, MS1 - r, Math.PI / 2);
  pts.push([-MH, MS0 + 2]);
  return fillet(pts, pts.map((_, k) => (k === 0 ? 1.8 : k === 1 || k === pts.length - 1 ? 3 : 0)), 4);
})();
// the P on its face: a stem, and a bowl off its top
const P_STEM = [[-2.8, 13.6], [-2.8, 23.4]];
const P_BOWL = (() => {
  const cx = 0.6, cy = 20.5, r = 2.9, pts = [[-2.8, 23.4], [cx, 23.4]];
  for (let k = 1; k < 12; k++) { const a = Math.PI / 2 - (k / 12) * Math.PI; pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
  pts.push([cx, cy - r], [-2.8, cy - r]);
  return pts;
})();

/** A ring of car samples, in the car's frame (u along, v across, the front at +u), turned by th and set down at (x, y). */
const place2 = (ring, x, y, th) => {
  const c = Math.cos(th), s = Math.sin(th);
  return ring.map((q) => ({ ...q, u: x + q.u * c - q.v * s, v: y + q.u * s + q.v * c, nu: q.nu * c - q.nv * s, nv: q.nu * s + q.nv * c }));
};

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  let period = value;
  const C = Cam(45, 0.5, 2.05);
  fit(C, [[-TX, TY0, -TT], [TX, TY1, -TT], [TX, TY0, -TT], [-TX, TY1, -TT], [CAR[0], CAR[1], ZC], [M[0], M[1], FLOAT + MS1 + HOP + 2]], 200, 166);
  const P = proj(C), front = facing(C), at = ([x, y]) => P(x, y, 0);

  const g = mk("g", {}, svg);
  // the tile, the kerb along its back, the bays' lines painted on it
  put(solid(g), prism(P, front, ...rings(-TX, TY0, TX, TY1, 8, 1.8), -TT, 0));
  put(solid(g), prism(P, front, ...rings(-TX + 4, TY0 + 2, TX - 4, TY0 + KD, 2, 0.8), 0, KH));
  mk("path", { class: "nf", d: BAYS.map((x) => open([at([x, BY0]), at([x, BY1])])).join("") + open([at([BAYS[0], BY0]), at([BAYS[2], BY0])]) }, g);
  mk("path", { class: "nf dash lo", d: open([at([-TX + 8, BY1 + 10]), at([TX - 8, BY1 + 10])]) }, g);

  // the car, nose in: a body, a cabin whose top is shorter than its foot, wheels on the side we see
  const [cx, cy, th] = CAR, cs = Math.cos(th), sn = Math.sin(th), H = L / 2, W2 = WD / 2, pl = (ring) => place2(ring, cx, cy, th);
  const [body, bodyIn] = rings(-H, -W2, H, W2, 6.5, 1.4);
  const foot = rrect(-H + 7, -W2 + 1.8, H - 8, W2 - 1.8, 4, 4), top = rrect(-H + 10, -W2 + 3.4, H - 16, W2 - 3.4, 2, 4), topIn = rrect(-H + 11.2, -W2 + 4.6, H - 17.2, W2 - 4.6, 1.2, 4);
  const car = mk("g", {}, g);
  put(solid(car), prism(P, front, pl(body), pl(bodyIn), Z0, ZB));
  put(solid(car), { sil: poly(hull(ringAt(P, pl(foot), ZB).concat(ringAt(P, pl(top), ZC)))), crease: open(ringAt(P, run(pl(topIn), front), ZC)) });
  const side = cs - sn > 0 ? W2 + 0.4 : -W2 - 0.4;
  for (const cu of [-H + 8.5, H - 8.5]) {
    const pts = Array.from({ length: 20 }, (_, j) => { const t = (j / 20) * Math.PI * 2, u = cu + WR * Math.cos(t); return P(cx + u * cs - side * sn, cy + u * sn + side * cs, WR + WR * Math.sin(t)); });
    mk("path", { class: "sil", d: poly(pts) }, car);
  }

  // the marker over the free bay, facing the viewer, and the ring on the ground under it
  const ring = mk("path", { class: "nf lo" }, g), mark = mk("g", {}, g);
  // its outline is stroked again over the face's crease, so the bright edge runs all round it
  const mSil = mk("path", { class: "sil hi" }, mark), mFace = mk("path", { class: "nf lo" }, mark), mEdge = mk("path", { class: "nf hi" }, mark), mP = mk("path", { class: "nf sil" }, mark);
  let hop = 0, drawn = NaN;
  function draw() {
    const z = FLOAT + HOP * Math.sin(Math.PI * hop);
    if (z === drawn) return;
    drawn = z;
    const pw = (t, s, d) => P(M[0] + (t + d) / Math.SQRT2, M[1] + (d - t) / Math.SQRT2, z + s);
    const fr = HEAD.map(([t, s]) => pw(t, s, 0));
    const edge = poly(hull(fr.concat(HEAD.map(([t, s]) => pw(t, s, -MT)))));
    mSil.setAttribute("d", edge);
    mEdge.setAttribute("d", edge);
    mFace.setAttribute("d", poly(fr));
    mP.setAttribute("d", open(P_STEM.map(([t, s]) => pw(t, s, 0))) + open(P_BOWL.map(([t, s]) => pw(t, s, 0))));
    const r = 5 * (1 - (0.3 * (z - FLOAT)) / HOP);
    ring.setAttribute("d", poly(circ(r, 32).map((q) => P(M[0] + q.u, M[1] + q.v, 0))));
  }

  let on = false;
  const B = register(stage, (dt) => {
    let moving = false;
    if (on && !HL.reducedMotion()) { hop = (hop + dt / period) % 1; moving = true; }
    else if (hop > 0) { hop += dt / period; if (hop >= 1) hop = 0; else moving = true; }
    draw();
    return moving;
  });
  bag.add(B.unregister);

  let act = null;
  function setActive(a) {
    if (a === act) return;
    act = a;
    on = !!a;
    read.textContent = a ? "free bay" : "rest";
    B.wake();
  }
  setActive(false);

  /** On the tile's plane: anywhere on it. */
  function hit(p) {
    const [x, y] = unproj(C, p[0], p[1], 0);
    return x > -TX - 6 && x < TX + 6 && y > TY0 - 14 && y < TY1 + 6;
  }

  bag.add(pointer(stage, { move: (p) => setActive(hit(p)), leave: () => setActive(false) }));
  bag.add(() => svg.replaceChildren());

  return { set: (v) => { period = clamp(v, 0.6, 2); }, destroy: bag.dispose };
}

hairline({
  name: "parking",
  means: "A car parked in its bay, and beside it a free bay with a P marker over it: over the car park the marker bobs.",
  rules: [1, 4, 5, 7],
  range: [1.6, 1.2, 0.8],
  tour: [[200, 170], [240, 190], null],
  mount,
});
