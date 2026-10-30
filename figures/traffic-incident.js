/**
 * Traffic incident: a short stretch of two-lane road, its lanes split by a
 * dashed line, and in the near lane a car broken down askew, a little smoke
 * rising off its bonnet in two small clouds, carried off to the side. At rest the car carries the bright
 * edge. When the pointer comes over the road a traffic cone drops the last
 * little way onto the road behind the car, settles with a small hop, and takes the
 * bright edge: the hazard is marked. The smoke drifts a little higher. Let
 * go, the cone lifts off again and is gone. The slider is how high the cone
 * hops when it lands.
 *
 * The pattern: one drop on a clock of its own: a fall speeds up, which the
 * kernel's ease-out cannot give, so the drop is an ease-in over 0.24s and a
 * hop of 0.16s; lifting off is the reverse. The smoke is a tween. The hit test is
 * the road's rest box on its plane, which never moves.
 */
const {
  Cam, circ, clamp, facing, fit, hull, open, poly, prism, proj, ringAt, rings, rrect, run, unproj,
  tdone, tset, tval, tween, disposer, mk, pointer, put, register, solid,
} = HL;

const RX0 = -78, RX1 = 78, LW = 22, PAD = 4, PB = 4;
const L = 36, WD = 19, Z0 = 3, ZB = 14, ZC = 26, WR = 6;
const CAR = [24, LW / 2 + 1, 0.34], CONE = [-14, LW / 2 + 2], CB = 5.5, CH = 19;
const DROP = 16, FALL = 240, HOP = 160, LIFT = 220;
// the smoke: two small clouds over the bonnet, (across, up, size), the lower first, each a cluster of round puffs
const CLOUDS = [[3, 9, 0.75], [10, 21, 1]], PUFFS = [[0, 0, 4], [4.2, 1.6, 3.2], [-3.8, 1.3, 3], [0.6, 3.6, 3]], DRIFT = 4;

/** A cloud's outline in its own plane: the boundary of a cluster of circles (t, s, r), scaled by k, ordered round its middle. */
function cloud(k) {
  const pts = [];
  PUFFS.forEach(([t, s, r], i) => {
    for (let j = 0; j < 40; j++) {
      const a = (j / 40) * Math.PI * 2, p = [(t + r * Math.cos(a)) * k, (s + r * Math.sin(a)) * k];
      if (PUFFS.every(([t2, s2, r2], m) => m === i || Math.hypot(p[0] - t2 * k, p[1] - s2 * k) > r2 * k - 0.05)) pts.push(p);
    }
  });
  const c = [0.3 * k, 1.5 * k];
  return pts.sort((a, b) => Math.atan2(a[1] - c[1], a[0] - c[0]) - Math.atan2(b[1] - c[1], b[0] - c[0]));
}

/** A ring of car samples, in the car's frame (u along, v across, the front at +u), turned by th and set down at (x, y). */
const place2 = (ring, x, y, th) => {
  const c = Math.cos(th), s = Math.sin(th);
  return ring.map((q) => ({ ...q, u: x + q.u * c - q.v * s, v: y + q.u * s + q.v * c, nu: q.nu * c - q.nv * s, nv: q.nu * s + q.nv * c }));
};

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  let hop = value;
  const C = Cam(45, 0.5, 2.15);
  const H = L / 2, W2 = WD / 2, [cx, cy, th] = CAR, cs = Math.cos(th), sn = Math.sin(th);
  const bonnet = [cx + (H - 2.5) * cs, cy + (H - 2.5) * sn];
  fit(C, [[RX0, -PAD, -PB], [RX1, 2 * LW + PAD, -PB], [RX1, -PAD, 0], [RX0, 2 * LW + PAD, -PB], [cx, cy, ZC], [bonnet[0] + 14, bonnet[1] - 14, ZB + CLOUDS[1][1] + DRIFT + 9]], 200, 166);
  const P = proj(C), front = facing(C);

  const g = mk("g", {}, svg);
  put(solid(g), prism(P, front, ...rings(RX0, -PAD, RX1, 2 * LW + PAD, 8, 2), -PB, 0));
  mk("path", { class: "dash nf", d: open([P(RX0 + 6, LW, 0), P(RX1 - 6, LW, 0)]) }, g);

  // the cone, behind the car: a square foot, a body tapering to its tip, a band round it, all lifted by z
  const coneG = mk("g", {}, g), cFoot = solid(coneG), cBody = mk("path", { class: "sil" }, coneG), cBand = mk("path", { class: "nf lo" }, coneG);
  let coneDrawn = NaN;
  function drawCone(z) {
    if (z === coneDrawn) return;
    coneDrawn = z;
    if (z === null) { put(cFoot, { sil: "", crease: "" }); cBody.setAttribute("d", ""); cBand.setAttribute("d", ""); return; }
    const [x, y] = CONE, at = (r) => circ(r, 24).map((q) => ({ ...q, u: q.u + x, v: q.v + y }));
    put(cFoot, prism(P, front, ...rings(x - CB - 1.6, y - CB - 1.6, x + CB + 1.6, y + CB + 1.6, 2, 0.8), z, z + 1.6));
    cBody.setAttribute("d", poly(hull(ringAt(P, at(CB), z + 1.6).concat([P(x, y, z + CH)]))));
    cBand.setAttribute("d", open(ringAt(P, run(at(CB * 0.55), front), z + CH * 0.45)));
  }

  // the broken-down car, askew in its lane: a body, a cabin whose top is shorter than its foot, wheels on the side we see
  const pl = (ring) => place2(ring, cx, cy, th);
  const [body, bodyIn] = rings(-H, -W2, H, W2, 6.5, 1.4);
  const foot = rrect(-H + 7, -W2 + 1.8, H - 8, W2 - 1.8, 4, 4), top = rrect(-H + 10, -W2 + 3.4, H - 16, W2 - 3.4, 2, 4), topIn = rrect(-H + 11.2, -W2 + 4.6, H - 17.2, W2 - 4.6, 1.2, 4);
  const car = mk("g", {}, g), carBody = solid(car), carCab = solid(car);
  put(carBody, prism(P, front, pl(body), pl(bodyIn), Z0, ZB));
  put(carCab, { sil: poly(hull(ringAt(P, pl(foot), ZB).concat(ringAt(P, pl(top), ZC)))), crease: open(ringAt(P, run(pl(topIn), front), ZC)) });
  const side = cs - sn > 0 ? W2 + 0.4 : -W2 - 0.4;
  for (const cu of [-H + 8.5, H - 8.5]) {
    const pts = Array.from({ length: 20 }, (_, j) => { const t = (j / 20) * Math.PI * 2, u = cu + WR * Math.cos(t); return P(cx + u * cs - side * sn, cy + u * sn + side * cs, WR + WR * Math.sin(t)); });
    mk("path", { class: "sil", d: poly(pts) }, car);
  }

  // the smoke: small clouds over the bonnet, in the plane that faces the viewer, opaque like smoke, the higher in front
  const clouds = CLOUDS.map(() => mk("path", { class: "lo" }, g)), rise = tween(0);
  let smokeDrawn = NaN;
  function drawSmoke(k) {
    if (k === smokeDrawn) return;
    smokeDrawn = k;
    CLOUDS.forEach(([across, up, size], i) => {
      const a = across + 2 * k * (i + 1), h = ZB + up + DRIFT * k * (i + 1) * 0.6, sz = size * (1 + 0.08 * k);
      clouds[i].setAttribute("d", poly(cloud(sz).map(([t, z]) => P(bonnet[0] + (a + t) / Math.SQRT2, bonnet[1] - (a + t) / Math.SQRT2, h + z))));
    });
  }

  // the cone's clock: falling (from t0), lifting away (from t0), or still at z
  let mode = "gone", t0 = 0;
  const coneZ = (now) => {
    const t = now - t0;
    if (mode === "fall") {
      if (HL.reducedMotion() || t >= FALL + HOP) return 0;
      if (t < FALL) { const p = t / FALL; return DROP * (1 - p * p); }
      return hop * Math.sin((Math.PI * (t - FALL)) / HOP);
    }
    if (mode === "lift") { const p = HL.reducedMotion() ? 1 : clamp(t / LIFT, 0, 1); return DROP * p * p; }
    return null;
  };
  const B = register(stage, (_dt, now) => {
    const z = coneZ(now);
    drawCone(z === null || (mode === "lift" && z >= DROP) ? null : z);
    drawSmoke(tval(rise, now));
    let moving = !tdone(rise, now);
    if (mode === "fall" && now - t0 < FALL + HOP) moving = true;
    if (mode === "lift") { if (now - t0 < LIFT) moving = true; else mode = "gone"; }
    return moving;
  });
  bag.add(B.unregister);

  let act = null;
  function setActive(a) {
    if (a === act) return;
    act = a;
    const now = performance.now();
    if (a) { mode = "fall"; t0 = now; } else if (mode === "fall") { mode = "lift"; t0 = now; }
    tset(rise, a ? 1 : 0, now, 0);
    carBody.sil.classList.toggle("hi", !a); carCab.sil.classList.toggle("hi", !a); cBody.classList.toggle("hi", a);
    read.textContent = a ? "marked" : "rest";
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

  return { set: (v) => { hop = clamp(v, 0, 4); }, destroy: bag.dispose };
}

hairline({
  name: "traffic-incident",
  means: "A car broken down askew in its lane, smoke off its bonnet: over the road a cone drops in behind it and marks the hazard.",
  rules: [1, 4, 5, 8],
  range: [0.6, 1.5, 3],
  tour: [[160, 150], [230, 185], null],
  mount,
});
