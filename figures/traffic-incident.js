/**
 * Traffic incident: a two-lane road, its lanes split by a dashed line. In the
 * near lane a car has stopped askew, and behind it on the road stand a
 * warning triangle, upright and facing the traffic, and a cone. At rest the
 * triangle carries the bright edge: the hazard is what the figure is about.
 * When the pointer comes over the road a car drives in over the road's far
 * end in the same lane; it slows as it nears the triangle, swings out into
 * the other lane round the stopped car, picks up again, swings back, and
 * pulls up short of the near end. Let go, it drives on off the road. Cars are
 * cut at the road's ends, so only what is on the road is drawn, and not at
 * all while that is a sliver. The slider is how hard it brakes at the hazard.
 *
 * The pattern: one pass on a clock of its own: the car slows at the hazard
 * and is quick before and after it, which no single ease gives, so its
 * progress is eased by hand over 3s, and its heading follows the lane
 * change; driving off is an ease-in of 0.9s. The hit test is the road's rest
 * box on its plane, which never moves.
 */
const {
  Cam, circ, clamp, facing, fit, hull, open, poly, prism, proj, ringAt, rings, rrect, run, unproj,
  disposer, mk, pointer, put, register, solid,
} = HL;

const RX0 = -104, RX1 = 104, LW = 22, PAD = 4, PB = 4, EDGE = RX0 + 3, NEAR = RX1 - 3, SLIVER = 14;
const L = 34, WD = 18, Z0 = 3, ZB = 13, ZC = 24, WR = 5.5, DRIVE = 3000, OFF = 900;
const LANE = [LW / 2, LW + LW / 2], STOP = [22, LANE[0] + 1, 0.32], TRI = [-14, LANE[0]], TS = 15, CONE = [-2, LANE[0] - 5];
// the lane change: out between OUT0 and OUT1, back between IN0 and IN1, in x
const OUT0 = -50, OUT1 = -12, IN0 = 44, IN1 = 66, X0 = EDGE - L / 2 - 1, XSTOP = 74, X1 = NEAR + L / 2 + 1;

const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const laneY = (x) => LANE[0] + (LANE[1] - LANE[0]) * (smooth(OUT0, OUT1, x) - smooth(IN0, IN1, x));
/** A ring of car samples, in the car's frame (u along, v across, the front at +u), turned by th and set down at (x, y). */
const place2 = (ring, x, y, th) => {
  const c = Math.cos(th), s = Math.sin(th);
  return ring.map((q) => ({ ...q, u: x + q.u * c - q.v * s, v: y + q.u * s + q.v * c, nu: q.nu * c - q.nv * s, nv: q.nu * s + q.nv * c }));
};

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  let brake = value;
  const C = Cam(45, 0.5, 1.72);
  fit(C, [[RX0, -PAD, -PB], [RX1, 2 * LW + PAD, -PB], [RX1, -PAD, 0], [RX0, 2 * LW + PAD, -PB], [TRI[0], TRI[1], TS], [STOP[0], STOP[1], ZC]], 200, 166);
  const P = proj(C), front = facing(C);
  // everything off the road's ends is pressed flat onto them: a car is cut there
  const Pc = (x, y, z) => P(clamp(x, EDGE, NEAR), y, z);

  const g = mk("g", {}, svg);
  put(solid(g), prism(P, front, ...rings(RX0, -PAD, RX1, 2 * LW + PAD, 8, 2), -PB, 0));
  mk("path", { class: "dash nf", d: open([P(RX0 + 6, LW, 0), P(RX1 - 6, LW, 0)]) }, g);

  // a car, in its own frame: a body, a cabin whose top is shorter than its foot, wheels on the side we see
  const H = L / 2, W2 = WD / 2;
  const [body, bodyIn] = rings(-H, -W2, H, W2, 6, 1.4);
  const foot = rrect(-H + 6, -W2 + 1.8, H - 7, W2 - 1.8, 4, 4), top = rrect(-H + 9, -W2 + 3.2, H - 15, W2 - 3.2, 2, 4), topIn = rrect(-H + 10.2, -W2 + 4.4, H - 16.2, W2 - 4.4, 1.2, 4);
  function makeCar() {
    const grp = mk("g", {}, g);
    return { grp, b: solid(grp), c: solid(grp), w: [0, 1].map(() => mk("path", { class: "sil" }, grp)), drawn: "" };
  }
  function drawCar(car, x, y, th) {
    const key = [x, y, th].map((v) => v.toFixed(3)).join();
    if (key === car.drawn) return;
    car.drawn = key;
    const c = Math.cos(th), s = Math.sin(th);
    if (Math.min(x + H * Math.abs(c), NEAR) - Math.max(x - H * Math.abs(c), EDGE) < SLIVER) {
      put(car.b, { sil: "", crease: "" }); put(car.c, { sil: "", crease: "" }); car.w.forEach((w) => w.setAttribute("d", ""));
      return;
    }
    const pl = (ring) => place2(ring, x, y, th);
    put(car.b, prism(Pc, front, pl(body), pl(bodyIn), Z0, ZB));
    put(car.c, { sil: poly(hull(ringAt(Pc, pl(foot), ZB).concat(ringAt(Pc, pl(top), ZC)))), crease: open(ringAt(Pc, run(pl(topIn), front), ZC)) });
    const side = c - s > 0 ? W2 + 0.4 : -W2 - 0.4;
    [-H + 8, H - 8].forEach((cu, i) => {
      const wx = x + cu * c - side * s;
      if (wx - WR < EDGE || wx + WR > NEAR) { car.w[i].setAttribute("d", ""); return; }
      const pts = Array.from({ length: 20 }, (_, j) => { const t = (j / 20) * Math.PI * 2, u = cu + WR * Math.cos(t); return P(x + u * c - side * s, y + u * s + side * c, WR + WR * Math.sin(t)); });
      car.w[i].setAttribute("d", poly(pts));
    });
  }

  // back to front: the moving car (it comes from the far end), the triangle and the cone, the stopped car
  const mover = makeCar();
  // the warning triangle: a rounded triangle upright in the y–z plane, facing the oncoming traffic (−x), on a short foot
  const triG = mk("g", {}, g);
  const tri = (r) => { const pts = []; for (let k = 0; k < 3; k++) { const a = Math.PI / 2 + (k * 2 * Math.PI) / 3; pts.push([r * Math.cos(a), r * Math.sin(a) + r * 0.5]); } return pts; };
  const triAt = (r, dx, lift) => tri(r).map(([v, h]) => P(TRI[0] + dx, TRI[1] + v, h + lift));
  const roundTri = (r, dx, lift) => { const pts = triAt(r, dx, lift); return poly(pts.flatMap((p, k) => { const a = pts[(k + 2) % 3], b = pts[(k + 1) % 3], m = (q, t) => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]; return [m(a, 0.12), p, m(b, 0.12)]; })); };
  mk("path", { class: "lo", d: roundTri(TS / 1.5, 1.6, 2) }, triG);
  mk("path", { class: "sil hi", d: roundTri(TS / 1.5, 0, 2) }, triG);
  mk("path", { class: "nf", d: roundTri(TS / 1.5 - 3.4, 0, 2.6) }, triG);
  mk("path", { class: "nf sil", d: open([P(TRI[0] + 0.8, TRI[1] - 4, 0), P(TRI[0] + 0.8, TRI[1], 2), P(TRI[0] + 0.8, TRI[1] + 4, 0)]) }, triG);
  // the cone: a round foot, a body tapering to its tip, a stripe round it
  const coneFoot = circ(4.6, 24).map((q) => ({ ...q, u: q.u + CONE[0], v: q.v + CONE[1] }));
  put(solid(g), prism(P, front, ...rings(CONE[0] - 6, CONE[1] - 6, CONE[0] + 6, CONE[1] + 6, 2.5, 1), 0, 1.6));
  mk("path", { class: "sil", d: poly(hull(ringAt(P, coneFoot, 1.6).concat([P(CONE[0], CONE[1], 15)]))) }, g);
  mk("path", { class: "nf lo", d: open(ringAt(P, run(circ(2.6, 24).map((q) => ({ ...q, u: q.u + CONE[0], v: q.v + CONE[1] })), front), 8)) }, g);
  const stopped = makeCar();
  drawCar(stopped, STOP[0], STOP[1], STOP[2]);

  /** The car at x, in its lane and pointing along the lane change. */
  const pose = (x) => [x, laneY(x), Math.atan2((laneY(x + 1) - laneY(x - 1)) / 2, 1)];
  /** The pass at progress p, from behind the far end to its stop: slowest at the hazard, by `brake`, which sits mid-way. */
  const passX = (p) => {
    const k = clamp(brake, 0, 0.9), m = (TRI[0] - X0) / (XSTOP - X0);
    // a speed of 1 − k·bump(p) round m, integrated and scaled to land on 1 at p = 1
    const bump = (q) => Math.exp(-(((q - m) / 0.16) ** 2)), N = 60;
    let a = 0, tot = 0;
    for (let i = 0; i < N; i++) { const q = (i + 0.5) / N, v = 1 - k * bump(q); tot += v; if (i / N < p) a += v * Math.min(1, (p - i / N) * N); }
    // ease the last stretch so it pulls up rather than stops dead
    const e = a / tot, tail = 0.85;
    return X0 + (XSTOP - X0) * (e < tail ? e : tail + (1 - tail) * (1 - (1 - (e - tail) / (1 - tail)) ** 2));
  };
  // the car's state: waiting out of sight, passing (from t0), or driving off (from t0 and x0)
  let mode = "wait", t0 = 0, x0 = X0;
  const xNow = (now) => {
    if (mode === "pass") return passX(HL.reducedMotion() ? 1 : clamp((now - t0) / DRIVE, 0, 1));
    if (mode === "off") { const p = HL.reducedMotion() ? 1 : clamp((now - t0) / OFF, 0, 1); return x0 + (X1 - x0) * p * p; }
    return X0;
  };
  const B = register(stage, (_dt, now) => {
    const x = xNow(now);
    drawCar(mover, ...pose(x));
    if (mode === "pass") return now - t0 < DRIVE;
    if (mode === "off") { if (x >= X1) { mode = "wait"; return false; } return true; }
    return false;
  });
  bag.add(B.unregister);

  let act = null;
  function setActive(a) {
    if (a === act) return;
    act = a;
    const now = performance.now();
    // over the road a new pass starts from behind the far end; let go, a car on the road drives on off it
    if (a) { mode = "pass"; t0 = now; }
    else if (mode === "pass") { x0 = xNow(now); mode = "off"; t0 = now; }
    read.textContent = a ? "incident" : "rest";
    B.wake();
  }
  setActive(false);

  /** On the road's plane: anywhere along it. */
  function hit(p) {
    const [x, y] = unproj(C, p[0], p[1], ZB);
    return y > -PAD - 14 && y < 2 * LW + PAD + 14 && x > RX0 - 6 && x < RX1 + 6;
  }

  bag.add(pointer(stage, { move: (p) => setActive(hit(p)), leave: () => setActive(false) }));
  bag.add(() => svg.replaceChildren());

  return { set: (v) => { brake = clamp(v, 0, 0.9); }, destroy: bag.dispose };
}

hairline({
  name: "traffic-incident",
  means: "A car stopped in its lane behind a warning triangle: an oncoming car slows, swings round it into the other lane and drives on.",
  rules: [1, 4, 5, 6],
  range: [0.3, 0.6, 0.85],
  tour: [[150, 150], [220, 180], [260, 200], null],
  mount,
});
