/**
 * Traffic incident: a short stretch of two-lane road, its lanes split by a
 * dashed line, and in the near lane a car broken down askew, a traffic cone
 * on the road behind it, one small cloud of smoke over its bonnet. At rest
 * the car carries the bright edge. When the pointer comes over the road the
 * bright edge goes to the cone, the hazard marked, and the smoke breathes:
 * puff after puff starts small on the bonnet, grows as it rises and drifts
 * aside, dims and is gone. Let go, the smoke runs on to its rest and stops.
 * The slider is the smoke's period, in seconds.
 *
 * The pattern: a gentle ambient loop that runs only under the pointer,
 * through register, like the fleet's sonar. The hit test
 * is the road's rest box on its plane, which never moves.
 */
const {
  Cam, circ, clamp, facing, fit, hull, open, poly, prism, proj, ringAt, rings, rrect, run, unproj,
  disposer, mk, pointer, put, register, solid,
} = HL;

const RX0 = -78, RX1 = 78, LW = 22, PAD = 4, PB = 4;
const L = 36, WD = 19, Z0 = 3, ZB = 14, ZC = 26, WR = 6;
const CAR = [24, LW / 2 + 1, 0.34], CONE = [-14, LW / 2 + 2], CB = 5.5, CH = 19;
// the smoke: puffs over the bonnet, each a cluster of round blobs; a puff's life runs from the bonnet up RISE and aside SIDE
const PUFFS = [[0, 0, 4], [4.2, 1.6, 3.2], [-3.8, 1.3, 3], [0.6, 3.6, 3]], N = 2, RISE = 24, SIDE = 12, REST = 0.42;

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
  let period = value;
  const C = Cam(45, 0.5, 2.15);
  const H = L / 2, W2 = WD / 2, [cx, cy, th] = CAR, cs = Math.cos(th), sn = Math.sin(th);
  const bonnet = [cx + (H - 2.5) * cs, cy + (H - 2.5) * sn];
  fit(C, [[RX0, -PAD, -PB], [RX1, 2 * LW + PAD, -PB], [RX1, -PAD, 0], [RX0, 2 * LW + PAD, -PB], [cx, cy, ZC], [bonnet[0] + SIDE + 6, bonnet[1] - SIDE - 6, ZB + 3 + RISE + 8]], 200, 166);
  const P = proj(C), front = facing(C);

  const g = mk("g", {}, svg);
  put(solid(g), prism(P, front, ...rings(RX0, -PAD, RX1, 2 * LW + PAD, 8, 2), -PB, 0));
  mk("path", { class: "dash nf", d: open([P(RX0 + 6, LW, 0), P(RX1 - 6, LW, 0)]) }, g);

  // the cone, behind the car: a square foot, a body tapering to its tip, a band round it
  const [x, y] = CONE, ringOf = (r) => circ(r, 24).map((q) => ({ ...q, u: q.u + x, v: q.v + y }));
  const coneG = mk("g", {}, g);
  put(solid(coneG), prism(P, front, ...rings(x - CB - 1.6, y - CB - 1.6, x + CB + 1.6, y + CB + 1.6, 2, 0.8), 0, 1.6));
  const cBody = mk("path", { class: "sil", d: poly(hull(ringAt(P, ringOf(CB), 1.6).concat([P(x, y, CH)]))) }, coneG);
  mk("path", { class: "nf lo", d: open(ringAt(P, run(ringOf(CB * 0.55), front), CH * 0.45)) }, coneG);

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

  // the smoke: puffs in the plane that faces the viewer, opaque like smoke; each grows from nothing and shrinks away
  const puffs = Array.from({ length: N }, () => mk("path", { class: "lo" }, g));
  let ph = REST, smokeDrawn = NaN;
  function drawSmoke() {
    if (ph === smokeDrawn) return;
    smokeDrawn = ph;
    // the oldest puff is painted last, so it sits in front as it rises
    const lives = puffs.map((_, i) => (ph + i / N) % 1);
    const order = lives.map((_, i) => i).sort((a, b) => lives[a] - lives[b]);
    order.forEach((i) => {
      const p = lives[i], size = Math.sin(Math.PI * Math.min(1, p * 1.15)) * (0.55 + 0.5 * p), el = puffs[i];
      g.appendChild(el);
      if (size < 0.12) { el.setAttribute("d", ""); return; }
      const a = SIDE * p * p, h = ZB + 3 + RISE * p;
      el.setAttribute("d", poly(cloud(size).map(([t, z]) => P(bonnet[0] + (a + t) / Math.SQRT2, bonnet[1] - (a + t) / Math.SQRT2, h + z))));
      // young puffs are drawn at the medium stroke, old ones dim as they go
      el.setAttribute("class", p < 0.5 ? "" : "lo");
    });
  }

  let on = false;
  const B = register(stage, (dt) => {
    let moving = false;
    if (on && !HL.reducedMotion()) { ph = (ph + dt / period) % 1; moving = true; }
    else {
      // run on to the rest phase, then hold: the still frame keeps one puff mid-way
      const goal = REST % (1 / N), left = (goal - (ph % (1 / N)) + 1 / N) % (1 / N);
      if (left > 1e-4) { const step = Math.min(left, dt / period); ph = (ph + step) % 1; if (left - step > 1e-4) moving = true; else ph = REST; }
    }
    drawSmoke();
    return moving;
  });
  bag.add(B.unregister);

  let act = null;
  function setActive(a) {
    if (a === act) return;
    act = a;
    on = !!a;
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

  return { set: (v) => { period = clamp(v, 1, 5); }, destroy: bag.dispose };
}

hairline({
  name: "traffic-incident",
  means: "A car broken down askew in its lane, a cone behind it: over the road the cone lights and the smoke off its bonnet breathes.",
  rules: [1, 4, 5, 7],
  range: [3.4, 2.4, 1.6],
  tour: [[160, 150], [230, 185], null],
  mount,
});
