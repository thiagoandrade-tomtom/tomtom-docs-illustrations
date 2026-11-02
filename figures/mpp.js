/**
 * Most Probable Path: a car in the middle lane of a three-lane road, the lanes
 * dashed, its front corners' sensors drawn dim as short fans of arcs, and ahead of it the
 * way it will most likely take, picked out: its lane's two edges ruled fine along
 * it, and down its middle a row of small chevrons pointing on, the bright edge. At
 * rest all is still. Under the pointer the chevrons drift on along the lane, the
 * ones coming in by the car and going out at the far end a step dimmer, so none
 * pops, and the sensors' arcs come on one by one from the car out and go
 * together, over and over. The slider is the time a chevron takes to drift on to the next, in seconds.
 *
 * The pattern: an ambient drift that runs only under the pointer, over a rest
 * that is the picture itself. The hit test is the road's plane, which never moves.
 */
const {
  Cam, clamp, facing, fit, hull, open, poly, prism, proj, ringAt, rings, rrect, run, unproj,
  disposer, mk, pointer, put, register, solid,
} = HL;

// the road, x along it from X0 to X1, the car's front at +x; three lanes LANE wide, the middle one at y 0
const X0 = -62, X1 = 92, TY = 50, TT = 3, LANE = 23, BAND = 15;
// the car, as Free Bay's: a body, a cabin whose top is shorter than its foot, wheels on the side we see; set
// back at CX so the road ahead is long
const L = 36, WD = 19, Z0 = 3, ZB = 14, ZC = 26, WR = 6, H = L / 2, W2 = WD / 2, CX = -26;
// the two ways on, as middle lines from the car's nose: straight down the middle lane, the likely one, or one
// smooth bend off across the right lane and out to the road's edge, the exit
const NOSE = CX + H + 2;
const STRAIGHT = [[NOSE, 0], [X1 - 8, 0]];
const CHEVRONS = 5;
// the car's sensors, quiet: a short fan of three arcs at each front corner, looking out to its side and a little
// ahead, clear of the lane; where each springs from, its bearing and half spread in degrees. Under the pointer
// the arcs come on in turn from the car out and go together, every SCAN seconds
const SENSORS = [
  { at: [NOSE - 9, W2 + 1], dir: 68, half: 28 },
  { at: [NOSE - 9, -W2 - 1], dir: -68, half: 28 },
];
const ARCS = [6, 12, 18], SCAN = 1.6;

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  let drift = value;
  const C = Cam(45, 0.5, 2.25);
  fit(C, [[X0, -TY, -TT], [X1, TY, -TT], [X1, -TY, -TT], [X0, TY, -TT], [CX, 0, ZC]], 200, 166);
  const P = proj(C), front = facing(C), at = ([x, y]) => P(x, y, 0);

  const g = mk("g", {}, svg);
  // the road and its two lane lines, dashed
  put(solid(g), prism(P, front, ...rings(X0, -TY, X1, TY, 10, 1.8), -TT, 0));
  const lanes = [-LANE / 2, LANE / 2].map((y) => open([at([X0 + 10, y]), at([X1 - 10, y])]));
  mk("path", { class: "nf dash lo", d: lanes.join("") }, g);

  // the sensors' fans, dim, under everything else
  const fan = (f, r) => {
    const out = [];
    for (let j = 0; j <= 16; j++) { const a = ((f.dir - f.half + (2 * f.half * j) / 16) * Math.PI) / 180; out.push(at([f.at[0] + r * Math.cos(a), f.at[1] + r * Math.sin(a)])); }
    return out;
  };
  const arcs = ARCS.map(() => mk("path", { class: "nf lo" }, g));

  // the likely way: its lane's two edges, open at both ends so the lane reads as picked out of the road, and a
  // row of chevrons down its middle
  const [, end] = STRAIGHT;
  // the lane begins a little ahead of the nose, clear of the sensors
  mk("path", { class: "nf", d: [-BAND / 2, BAND / 2].map((y) => open([at([NOSE + 8, y]), at([end[0], y])])).join("") }, g);
  const marks = mk("path", { class: "nf hi" }, g), fading = mk("path", { class: "nf lo" }, g);

  // the car over the road: a body, a cabin, wheels, the far ones under the body and the near ones over it
  const car = mk("g", {}, g);
  const sh = (r) => r.map((q) => ({ ...q, u: q.u + CX }));
  const [body, bodyIn] = rings(-H, -W2, H, W2, 6.5, 1.4).map(sh);
  const foot = sh(rrect(-H + 6, -W2 + 1.8, H - 7, W2 - 1.8, 4, 4)), top = sh(rrect(-H + 9, -W2 + 3.4, H - 15, W2 - 3.4, 2, 4)), topIn = sh(rrect(-H + 10.2, -W2 + 4.6, H - 16.2, W2 - 4.6, 1.2, 4));
  const wheels = (y) => [-H + 8.5, H - 8.5].map((u) => poly(Array.from({ length: 20 }, (_, j) => { const t = (j / 20) * Math.PI * 2; return P(CX + u + WR * Math.cos(t), y, WR + WR * Math.sin(t)); }))).join("");
  mk("path", { class: "sil", d: wheels(-W2 - 0.4) }, car);
  put(solid(car), prism(P, front, body, bodyIn, Z0, ZB));
  put(solid(car), { sil: poly(hull(ringAt(P, foot, ZB).concat(ringAt(P, top, ZC)))), crease: open(ringAt(P, run(topIn, front), ZC)) });
  mk("path", { class: "sil", d: wheels(W2 + 0.4) }, car);

  /** A chevron at x down the lane, pointing on. */
  const chevron = (x) => { const w = BAND * 0.28, k = 2.6; return open([[x - k, -w], [x + k, 0], [x - k, w]].map(at)); };
  let on = false, flow = 0, scan = 0, drawn = "";
  function draw() {
    const f = on ? flow : 0, key = f + "," + (on ? scan : -1);
    if (key === drawn) return;
    drawn = key;
    // the sensors: at rest their arcs stand still; under the pointer they come on one by one from the car out,
    // hold, and all go before they start again, so no arc is ever drawn over another
    arcs.forEach((el, j) => {
      const show = !on || (scan >= j * 0.22 && scan < 0.8);
      el.setAttribute("d", show ? SENSORS.map((o) => open(fan(o, ARCS[j]))).join("") : "");
    });
    let m = "", d = "";
    for (let c = 0; c < CHEVRONS; c++) {
      const u = (c + f) / CHEVRONS, x = NOSE + (end[0] - NOSE) * (0.12 + 0.82 * u);
      if (on && (u < 0.15 || u > 0.85)) d += chevron(x); else m += chevron(x);
    }
    marks.setAttribute("d", m);
    fading.setAttribute("d", d);
  }

  const B = register(stage, (dt) => {
    if (!on || HL.reducedMotion()) { draw(); return false; }
    flow = (flow + dt / drift) % 1;
    scan = (scan + dt / SCAN) % 1;
    draw();
    return true;
  });
  bag.add(B.unregister);

  /** On the road's plane: anywhere on it. */
  function hit(p) {
    const [x, y] = unproj(C, p[0], p[1], 0);
    return x > X0 - 8 && x < X1 + 8 && Math.abs(y) < TY + 8;
  }
  function aim(o) {
    if (o === on) return;
    on = o;
    read.textContent = on ? "path ahead" : "rest";
    B.wake();
  }
  read.textContent = "rest";

  bag.add(pointer(stage, { move: (p) => aim(hit(p)), leave: () => aim(false) }));
  bag.add(() => svg.replaceChildren());

  return { set: (v) => { drift = clamp(v, 0.4, 2); }, destroy: bag.dispose };
}

hairline({
  name: "mpp",
  means: "A car with the way it will most likely take picked out in its lane: under the pointer, chevrons drift on along it.",
  rules: [1, 4, 5, 7],
  range: [1.2, 0.9, 0.6],
  tour: [[256, 188], [200, 214], null],
  mount,
});
