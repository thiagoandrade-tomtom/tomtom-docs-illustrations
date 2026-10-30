/**
 * Search: a magnifying glass held over a patch of town, two streets crossing
 * and seven places marked as dots. The glass is a rim with a hole through it,
 * a short neck and a grip, held low over the ground. The glass follows the
 * pointer, and the place nearest the middle of the lens pops up as a map pin,
 * up through the hole, and takes the bright edge.
 * Over nothing, the rim keeps the bright edge: still looking. At rest the
 * glass sits over one place, its pin up. The slider is the pin's height.
 *
 * The pattern: a position and a choice. Springs for where the glass is,
 * tweens for which pin is up, and the choice read from the springs' targets,
 * never from where the glass is drawn.
 */
const {
  Cam, circ, clamp, facing, fillet, fit, hull, open, poly, prism, proj, ringAt, rings, run, unproj,
  spring, stepS, tdone, tset, tval, tween, disposer, flatDot, mk, place, pointer, put, register, solid,
} = HL;

const PL = [[-50, -30], [-10, -48], [34, -26], [-4, 4], [40, 24], [-42, 30], [12, 48]];
const LZ = 9, R = 26, RT = 4, RB = 3.8, AREA = 50, PIN_R = 9, PIN_T = 4, REST = 3, PIN_MAX = 40;

/** The pin's outline in its own upright plane, h tall: a round head tangent down to a point, (t across, s up). */
function pinShape(h) {
  const cy = h - PIN_R, a0 = Math.acos(PIN_R / cy), pts = [];
  for (let k = 0; k <= 24; k++) {
    const a = a0 + (k / 24) * (2 * Math.PI - 2 * a0);
    pts.push([PIN_R * Math.sin(a), cy - PIN_R * Math.cos(a)]);
  }
  pts.push([0, 0]);
  return fillet(pts, pts.map((_, k) => (k === pts.length - 1 ? 2 : 0.4)), 3);
}

/** Twice the signed area of a screen polygon: its winding. */
const wind = (pts) => pts.reduce((a, p, i) => { const q = pts[(i + 1) % pts.length]; return a + p[0] * q[1] - q[0] * p[1]; }, 0);

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  let ph = value, shape = pinShape(ph);
  const C = Cam(45, 0.5, 1.95);
  fit(C, [[-74, -74, 0], [74, 74, 0], [AREA + R + 40, -AREA, LZ], [-74, 74, 0], [-AREA, -AREA, PIN_MAX]], 200, 166);
  const P = proj(C), front = facing(C);

  const g = mk("g", {}, svg);
  // the ground: two streets, each a pair of kerbs, and the places on them
  const street = (a, b) => open(a.map((p) => P(p[0], p[1], 0))) + open(b.map((p) => P(p[0], p[1], 0)));
  mk("path", { class: "nf lo", d: street([[-74, -16], [74, -16]], [[-74, -8], [74, -8]]) + street([[16, -74], [16, 10], [24, 74]], [[24, -74], [24, 10], [32, 74]]) }, g);
  PL.forEach((p) => place(flatDot(g, C, 2.6, "dot off"), P(p[0], p[1], 0)));
  // the glass's far half goes under the pins, its near half over them, so a pin stands up through the hole
  const band = mk("path", { class: "fo" }, g), inWall = mk("path", { class: "nf lo" }, g), rim = mk("path", { class: "nf sil" }, g);
  const lip = mk("path", { class: "nf" }, g), glint = mk("path", { class: "nf lo" }, g);
  const order = PL.map((_, i) => i).sort((a, b) => PL[a][0] + PL[a][1] - PL[b][0] - PL[b][1]);
  const pins = [];
  for (const i of order) {
    const grp = mk("g", {}, g);
    pins[i] = { sil: mk("path", { class: "sil" }, grp), face: mk("path", { class: "nf lo" }, grp), hole: mk("path", { class: "nf" }, grp), s: tween(i === REST ? 1 : 0), drawn: NaN };
  }
  const nearBand = mk("path", { class: "fo" }, g), nearRim = mk("path", { class: "nf sil" }, g), nearLip = mk("path", { class: "nf" }, g);
  const neck = solid(g), grip = solid(g);

  function drawPin(i, s) {
    const pin = pins[i];
    if (s === pin.drawn) return;
    pin.drawn = s;
    if (s < 0.02) { for (const k of ["sil", "face", "hole"]) pin[k].setAttribute("d", ""); return; }
    // the pin's plate faces the viewer: across it is world (1, -1), through it (1, 1); it grows from its point
    const [px, py] = PL[i], at = (t, h, d) => P(px + (t * s + d) / Math.SQRT2, py + (d - t * s) / Math.SQRT2, h * s);
    const fr = shape.map(([t, h]) => at(t, h, 0));
    pin.sil.setAttribute("d", poly(hull(fr.concat(shape.map(([t, h]) => at(t, h, -PIN_T))))));
    pin.face.setAttribute("d", poly(fr));
    pin.hole.setAttribute("d", poly(circ(2.6, 20).map((q) => at(q.u, ph - PIN_R + q.v, 0))));
  }

  const ring = (r) => circ(r, 48);
  const shift = (rg, x, y) => rg.map((q) => ({ ...q, u: q.u + x, v: q.v + y }));
  let gDrawn = "";
  function drawGlass(x, y) {
    const key = x.toFixed(2) + "," + y.toFixed(2);
    if (key === gDrawn) return;
    gDrawn = key;
    const out = shift(ring(R), x, y), inn = shift(ring(R - RB), x, y);
    const sil = hull(ringAt(P, out, LZ).concat(ringAt(P, out, LZ + RT)));
    let hole = ringAt(P, inn, LZ + RT);
    if (Math.sign(wind(hole)) === Math.sign(wind(sil))) hole = hole.reverse();
    band.setAttribute("d", poly(sil) + poly(hole));
    rim.setAttribute("d", poly(sil));
    lip.setAttribute("d", poly(ringAt(P, inn, LZ + RT)));
    inWall.setAttribute("d", open(ringAt(P, run(inn, (q) => !front(q)), LZ)));
    glint.setAttribute("d", open(Array.from({ length: 9 }, (_, k) => { const a = 3.5 + k * 0.1; return P(x + (R - 9) * Math.cos(a), y + (R - 9) * Math.sin(a), LZ + RT); })));
    // the near half: the band between the lip's near arc and the rim's lower edge, painted over the pin
    const lr = (pts) => (pts[0][0] <= pts[pts.length - 1][0] ? pts : pts.slice().reverse());
    const oB = lr(ringAt(P, run(out, front), LZ)), iT = lr(ringAt(P, run(inn, front), LZ + RT));
    nearBand.setAttribute("d", poly(iT.concat(oB.slice().reverse())));
    nearRim.setAttribute("d", open(oB));
    nearLip.setAttribute("d", open(iT));
    const [nr, ni] = rings(x + R - 2, y - 2.6, x + R + 8, y + 2.6, 2.4, 0.8);
    put(neck, prism(P, front, nr, ni, LZ + 0.8, LZ + RT - 0.8));
    const [gr, gi] = rings(x + R + 7, y - 5, x + R + 40, y + 5, 4.8, 1.4);
    put(grip, prism(P, front, gr, gi, LZ - 1.5, LZ + RT + 1.5));
  }

  const sx = spring(PL[REST][0]), sy = spring(PL[REST][1]);
  const Bk = register(stage, (dt, now) => {
    let moving = stepS(sx, dt) | stepS(sy, dt);
    drawGlass(sx.x, sy.x);
    PL.forEach((_, i) => { drawPin(i, tval(pins[i].s, now)); if (!tdone(pins[i].s, now)) moving = true; });
    return !!moving;
  });
  bag.add(Bk.unregister);

  let act = null;
  /** Pops pin a (-1: none under the lens); the bright edge goes to it, or back to the rim. */
  function setActive(a, label) {
    read.textContent = label;
    if (a === act) return;
    const now = performance.now();
    act = a;
    pins.forEach((pin, i) => { tset(pin.s, i === a ? 1 : 0, now, 0); pin.sil.classList.toggle("hi", i === a); });
    rim.classList.toggle("hi", a < 0); nearRim.classList.toggle("hi", a < 0);
    Bk.wake();
  }

  /** The place nearest the glass's target, within the lens, or -1. */
  function pick() {
    let best = -1, bd = (R - RB) * 0.7;
    PL.forEach((p, i) => { const d = Math.hypot(p[0] - sx.t, p[1] - sy.t); if (d < bd) { bd = d; best = i; } });
    return best;
  }

  function aim(p) {
    if (!p) { sx.t = PL[REST][0]; sy.t = PL[REST][1]; setActive(REST, "rest"); Bk.wake(); return; }
    const [x, y] = unproj(C, p[0], p[1], LZ);
    sx.t = clamp(x, -AREA, AREA); sy.t = clamp(y, -AREA, AREA);
    const a = pick();
    setActive(a, a < 0 ? "empty" : `place ${a + 1}`);
    Bk.wake();
  }
  aim(null);

  bag.add(pointer(stage, { move: aim, leave: () => aim(null) }));
  bag.add(() => svg.replaceChildren());

  return { set: (v) => { ph = clamp(v, 28, PIN_MAX); shape = pinShape(ph); pins.forEach((pin) => { pin.drawn = NaN; }); Bk.wake(); }, destroy: bag.dispose };
}

hairline({
  name: "search",
  means: "A magnifying glass over a patch of town: it follows the pointer, and the place under the lens pops up through it as a pin.",
  rules: [1, 4, 5, 8],
  range: [28, 34, 40],
  tour: [[270, 174], [165, 200], [88, 160], null],
  mount,
});
