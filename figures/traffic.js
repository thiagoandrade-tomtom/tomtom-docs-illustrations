/**
 * Traffic: a lane of three cars stopped nose to tail, the queue's head
 * nearest the viewer, the empty road running on behind them. At rest the gaps
 * are uneven, the way a jam stands, and the lead car carries the bright edge.
 * When the pointer comes over the road a fourth car drives slowly in over the
 * road's far end, takes the bright edge, and brakes in behind the queue: the
 * jam grows. Let go, the jam moves up: every car rolls forward one place,
 * the lead first and the rest after it, and the lead drives off the road's
 * near end. Cars are cut at the road's ends, so only what is on the road is
 * drawn, and not at all while that is a sliver. The slider is the gap the
 * fourth car stops at.
 *
 * The pattern: an arrival, then a move-up staggered from the front. A car
 * rolling up to a jam takes its time, so that tween runs 2.4s, not the
 * kernel's 700ms; the move-up is the kernel's. When it lands the cars are
 * relabelled, the one gone off the end becoming the next to arrive, so rest
 * is the same three. The hit test is the road's rest box on its plane, which
 * never moves.
 */
const {
  Cam, clamp, facing, fit, hull, open, poly, proj, rings, prism, ringAt, rrect, run, unproj,
  tdone, tset, tval, tween, disposer, mk, pointer, put, register, solid,
} = HL;

const L = 36, WD = 22, PAD = 4, PB = 4, Z0 = 3, ZB = 14, ZC = 26, WR = 6;
const QUEUE = [0, 46, 85], RX0 = -110, RX1 = QUEUE[2] + L + PAD, EDGE = RX0 + 3, HOME = EDGE - L - 1, ROLL = 2400, STEP = 90, SLIVER = 14;
const NEAR = RX1 - 3, GONE = NEAR + 4;

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  let gap = value;
  const C = Cam(45, 0.5, 1.68);
  fit(C, [[RX0, -PAD, -PB], [RX1, WD + PAD, -PB], [RX1, -PAD, 0], [RX0, WD + PAD, -PB], [EDGE, 0, ZC], [QUEUE[2] + L, WD, ZC]], 200, 166);
  const P = proj(C), front = facing(C);

  const g = mk("g", {}, svg);
  const [rr, ri] = rings(RX0, -PAD, RX1, WD + PAD, 8, 2);
  put(solid(g), prism(P, front, rr, ri, -PB, 0));
  // the lane's middle, dashed, from the road's far end to the head of the queue
  mk("path", { class: "dash nf", d: open([P(RX0 + 6, WD / 2, 0), P(RX1 - 6, WD / 2, 0)]) }, g);

  // One car at x: a body, a cabin whose top is shorter than its foot (the windscreen slopes to the front, +x),
  // two wheels. Everything off the road, x < EDGE or x > NEAR, is cut off.
  const cut = (x0, x1) => [Math.max(x0, EDGE), Math.min(x1, NEAR)];
  const wheel = (cx) => { const pts = []; for (let k = 0; k < 20; k++) { const t = (k / 20) * Math.PI * 2; pts.push(P(cx + WR * Math.cos(t), WD + 0.4, WR + WR * Math.sin(t))); } return poly(pts); };
  function carPaths(x) {
    if (Math.min(x + L, NEAR) - Math.max(x, EDGE) < SLIVER) return null;
    const [b0, b1] = cut(x, x + L), [body, bodyIn] = rings(b0, 0, b1, WD, Math.min(7, (b1 - b0) / 2 - 0.1), 1.4);
    const out = { body: prism(P, front, body, bodyIn, Z0, ZB), cabin: null, wheels: [] };
    const [f0, f1] = cut(x + 7, x + L - 8), [t0, t1] = cut(x + 10, x + L - 17);
    if (t1 - t0 > 4) {
      const foot = rrect(f0, 2, f1, WD - 2, 4, 4), top = rrect(t0, 3.6, t1, WD - 3.6, 2, 4), topIn = rrect(t0 + 1.2, 4.8, t1 - 1.2, WD - 4.8, 1.2, 4);
      out.cabin = { sil: poly(hull(ringAt(P, foot, ZB).concat(ringAt(P, top, ZC)))), crease: open(ringAt(P, run(topIn, front), ZC)) };
    }
    for (const cx of [x + 8.5, x + L - 8.5]) if (cx - WR > EDGE && cx + WR < NEAR) out.wheels.push(wheel(cx));
    return out;
  }

  // back to front: cars[0] is the one that arrives, cars[3] the lead
  let cars = [HOME, ...QUEUE].map((x) => {
    const grp = mk("g", {}, g);
    return { grp, b: solid(grp), c: solid(grp), w: [0, 1].map(() => mk("path", { class: "sil" }, grp)), x: tween(x), drawn: NaN };
  });
  function draw(car, x) {
    if (x === car.drawn) return;
    car.drawn = x;
    const p = carPaths(x);
    put(car.b, p ? p.body : { sil: "", crease: "" });
    put(car.c, p && p.cabin ? p.cabin : { sil: "", crease: "" });
    car.w.forEach((el, k) => el.setAttribute("d", p ? p.wheels[k] ?? "" : ""));
  }

  const paint = (lit) => cars.forEach((car, i) => { car.b.sil.classList.toggle("hi", i === lit); car.c.sil.classList.toggle("hi", i === lit); });

  /** The move-up has landed: the car gone off the near end goes round to wait behind the far end. */
  let moving = false;
  function relabel() {
    moving = false;
    const gone = cars[3];
    gone.x = tween(HOME);
    cars[0].grp.before(gone.grp);
    cars = [gone, cars[0], cars[1], cars[2]];
    paint(3);
  }

  const B = register(stage, (_dt, now) => {
    let busy = false;
    for (const car of cars) { draw(car, tval(car.x, now)); if (!tdone(car.x, now)) busy = true; }
    if (moving && !busy) relabel();
    return busy;
  });
  bag.add(B.unregister);

  let act = null;
  function setActive(a) {
    if (a === act) return;
    act = a;
    if (moving) relabel();
    const now = performance.now();
    if (a) {
      // arriving: the fourth car rolls slowly in over the far end
      const car = cars[0];
      car.x = tween(tval(car.x, now), ROLL);
      tset(car.x, QUEUE[0] - L - gap, now, 0);
      paint(0);
    } else if (tval(cars[0].x, now) > HOME + 1) {
      // let go: everyone moves up a place, the lead first, and the lead drives off the near end
      moving = true;
      const to = [QUEUE[0], QUEUE[1], QUEUE[2], GONE];
      cars.forEach((car, i) => { car.x = tween(tval(car.x, now)); tset(car.x, to[i], now, (3 - i) * STEP); });
      paint(2);
    }
    read.textContent = a ? "queue 4" : "rest";
    B.wake();
  }
  paint(3);
  setActive(false);

  /** On the road's plane: anywhere along the lane, end to head. */
  function hit(p) {
    const [x, y] = unproj(C, p[0], p[1], ZB);
    return y > -PAD - 14 && y < WD + PAD + 14 && x > RX0 - 6 && x < RX1 + 6;
  }

  bag.add(pointer(stage, { move: (p) => setActive(hit(p)), leave: () => setActive(false) }));
  bag.add(() => svg.replaceChildren());

  return { set: (v) => { gap = clamp(v, 1.5, 12); if (act) { act = null; setActive(true); } }, destroy: bag.dispose };
}

hairline({
  name: "traffic",
  means: "Three cars stopped in a queue: a fourth rolls in behind them, then the jam moves up and the lead drives off.",
  rules: [1, 2, 4, 5],
  range: [2, 5, 10],
  tour: [[150, 150], [250, 195], null],
  mount,
});
