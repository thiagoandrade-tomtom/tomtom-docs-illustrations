/**
 * Traffic incident: a short stretch of two-lane road, its lanes split by a
 * dashed line, and in the near lane a car broken down askew. Behind it stands
 * one traffic cone, bright: the hazard is marked. When the pointer comes over
 * the road two more cones rise from the road behind the first, one after the
 * other, out from the car, and the three make the taper that closes the lane:
 * from the road's edge upstream to the lane line beside the car. Let go, the
 * two sink back, the last one first. The slider is the stagger between cones,
 * in ms.
 *
 * The pattern: a few parts on tweens, staggered by distance from the car. The
 * hit test is the road's rest box on its plane, which never moves.
 */
const {
  Cam, circ, clamp, facing, fit, hull, open, poly, prism, proj, ringAt, rings, rrect, run, unproj,
  tdone, tset, tval, tween, disposer, mk, pointer, put, register, solid,
} = HL;

const RX0 = -78, RX1 = 78, LW = 22, PAD = 4, PB = 4;
const L = 36, WD = 19, Z0 = 3, ZB = 14, ZC = 26, WR = 6;
const CAR = [24, LW / 2 + 1, 0.34];
// the taper, nearest the car first: the first stands at rest, the others rise
const CONES = [[-8, LW - 3], [-30, LW / 2], [-52, 4]], CB = 5, CH = 17;

/** A ring of car samples, in the car's frame (u along, v across, the front at +u), turned by th and set down at (x, y). */
const place2 = (ring, x, y, th) => {
  const c = Math.cos(th), s = Math.sin(th);
  return ring.map((q) => ({ ...q, u: x + q.u * c - q.v * s, v: y + q.u * s + q.v * c, nu: q.nu * c - q.nv * s, nv: q.nu * s + q.nv * c }));
};

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  let stag = value;
  const C = Cam(45, 0.5, 2.15);
  fit(C, [[RX0, -PAD, -PB], [RX1, 2 * LW + PAD, -PB], [RX1, -PAD, 0], [RX0, 2 * LW + PAD, -PB], [CAR[0], CAR[1], ZC], [CONES[2][0], CONES[2][1], CH]], 200, 166);
  const P = proj(C), front = facing(C);

  const g = mk("g", {}, svg);
  put(solid(g), prism(P, front, ...rings(RX0, -PAD, RX1, 2 * LW + PAD, 8, 2), -PB, 0));
  mk("path", { class: "dash nf", d: open([P(RX0 + 6, LW, 0), P(RX1 - 6, LW, 0)]) }, g);

  // the cones, far to near, so a nearer one covers a farther: each a square foot, a body tapering to its tip, a band round it
  const order = CONES.map((_, i) => i).sort((a, b) => CONES[a][0] + CONES[a][1] - CONES[b][0] - CONES[b][1]);
  const cones = [];
  for (const i of order) {
    const grp = mk("g", {}, g);
    cones[i] = { foot: solid(grp), body: mk("path", { class: "sil" }, grp), band: mk("path", { class: "nf lo" }, grp), k: tween(i === 0 ? 1 : 0), drawn: NaN };
  }
  /** Cone i grown to k from its foot. */
  function drawCone(i, k) {
    const cn = cones[i];
    if (k === cn.drawn) return;
    cn.drawn = k;
    if (k < 0.04) { put(cn.foot, { sil: "", crease: "" }); cn.body.setAttribute("d", ""); cn.band.setAttribute("d", ""); return; }
    const [x, y] = CONES[i], at = (r) => circ(r * k, 24).map((q) => ({ ...q, u: q.u + x, v: q.v + y }));
    const [fr, fi] = rings(x - (CB + 1.5) * k, y - (CB + 1.5) * k, x + (CB + 1.5) * k, y + (CB + 1.5) * k, 2 * k, 0.8 * k);
    put(cn.foot, prism(P, front, fr, fi, 0, 1.6 * k));
    cn.body.setAttribute("d", poly(hull(ringAt(P, at(CB), 1.6 * k).concat([P(x, y, CH * k)]))));
    cn.band.setAttribute("d", open(ringAt(P, run(at(CB * 0.55), front), CH * 0.45 * k)));
  }

  // the broken-down car, askew in its lane: a body, a cabin whose top is shorter than its foot, wheels on the side we see
  const H = L / 2, W2 = WD / 2, [cx, cy, th] = CAR, cs = Math.cos(th), sn = Math.sin(th), pl = (ring) => place2(ring, cx, cy, th);
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

  const B = register(stage, (_dt, now) => {
    let moving = false;
    cones.forEach((cn, i) => { drawCone(i, tval(cn.k, now)); if (!tdone(cn.k, now)) moving = true; });
    return moving;
  });
  bag.add(B.unregister);

  let act = null;
  function setActive(a) {
    if (a === act) return;
    act = a;
    const now = performance.now();
    // out from the car on the way up, and back in on the way down: the last one placed is the first lifted
    cones.forEach((cn, i) => { if (i) tset(cn.k, a ? 1 : 0, now, (a ? i - 1 : CONES.length - 1 - i) * stag); });
    cones.forEach((cn) => cn.body.classList.toggle("hi", true));
    read.textContent = a ? "lane closed" : "rest";
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

  return { set: (v) => { stag = clamp(v, 40, 300); }, destroy: bag.dispose };
}

hairline({
  name: "traffic-incident",
  means: "A car broken down askew in its lane, a cone behind it: over the road two more cones rise and close the lane.",
  rules: [1, 2, 4, 5],
  range: [80, 160, 260],
  tour: [[160, 150], [230, 185], null],
  mount,
});
