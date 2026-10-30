/**
 * Automotive: a car on the map, seen from above. A map tile with two streets
 * crossing on it; a car at the start of one, its body, a cabin with the
 * windscreen sloping to the front, its wheels on the side we see; a pin
 * up the other street, and the way there dashed: along the first street,
 * round the corner and up the second. At rest the car carries the bright
 * edge. When the pointer comes over the map the route lights up, drawing
 * out from the car, and the car drives it, slowly, turning at the corner,
 * until it pulls up short of the pin. The slider is how far along the route
 * it drives.
 *
 * The pattern: a route on one tween, the drive on a slow one: a car takes
 * longer than a highlight, so its tween runs 2.6s, not the kernel's 700ms.
 * The hit test is the tile's rest box on screen, which never moves.
 */
const {
  Cam, circ, clamp, facing, fillet, fit, hull, open, poly, prism, proj, ringAt, rings, rrect, run,
  tdone, tset, tval, tween, disposer, mk, pointer, put, register, solid,
} = HL;

const TILE = [-70, -62, 70, 62], TT = 3, KW = 10, SY = 30, SX = 30;
const CL = 40, CW = 22, Z0 = 3, ZB = 14, ZC = 25, WR = 5.5, DRIVE = 2600;
const PIN_R = 8, PIN_H = 26, PIN_T = 3.4, D = [SX, -50];
const ROUTE = fillet([[-40, SY], [SX, SY], [SX, -34]], [0, 18, 0], 8).filter((p, k, a) => k === 0 || p[0] !== a[k - 1][0] || p[1] !== a[k - 1][1]);
// the streets' kerbs, open where they cross
const KERBS = [
  [[-66, SY - KW], [SX - KW, SY - KW]], [[SX + KW, SY - KW], [66, SY - KW]], [[-66, SY + KW], [SX - KW, SY + KW]], [[SX + KW, SY + KW], [66, SY + KW]],
  [[SX - KW, -58], [SX - KW, SY - KW]], [[SX + KW, -58], [SX + KW, SY - KW]], [[SX - KW, SY + KW], [SX - KW, 58]], [[SX + KW, SY + KW], [SX + KW, 58]],
];
const PIN = (() => {
  const cy = PIN_H - PIN_R, a0 = Math.acos(PIN_R / cy), pts = [];
  for (let k = 0; k <= 24; k++) { const a = a0 + (k / 24) * (2 * Math.PI - 2 * a0); pts.push([PIN_R * Math.sin(a), cy - PIN_R * Math.cos(a)]); }
  pts.push([0, 0]);
  return fillet(pts, pts.map((_, k) => (k === pts.length - 1 ? 2 : 0.4)), 3);
})();

/** The route's running length, a point and heading at length s, and its first share k as points. */
const RUN = ROUTE.reduce((a, p, i) => (i ? [...a, a[i - 1] + Math.hypot(p[0] - ROUTE[i - 1][0], p[1] - ROUTE[i - 1][1])] : [0]), []);
const TOTAL = RUN[RUN.length - 1], ALONG0 = 0.08;
function along(s) {
  s = clamp(s, 0, TOTAL);
  for (let i = 1; i < ROUTE.length; i++) if (s <= RUN[i] || i === ROUTE.length - 1) {
    const p = ROUTE[i - 1], q = ROUTE[i], f = clamp((s - RUN[i - 1]) / (RUN[i] - RUN[i - 1]), 0, 1);
    return { x: p[0] + (q[0] - p[0]) * f, y: p[1] + (q[1] - p[1]) * f, th: Math.atan2(q[1] - p[1], q[0] - p[0]) };
  }
}

/** A ring of local car samples turned by th and set down at (x, y), its normals turned with it. */
const place2 = (ring, x, y, th) => {
  const c = Math.cos(th), s = Math.sin(th);
  return ring.map((q) => ({ ...q, u: x + q.u * c - q.v * s, v: y + q.u * s + q.v * c, nu: q.nu * c - q.nv * s, nv: q.nu * s + q.nv * c }));
};

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  let reach = value;
  const C = Cam(45, 0.5, 1.75);
  fit(C, [[TILE[0], TILE[1], -TT], [TILE[2], TILE[3], -TT], [TILE[2], TILE[1], -TT], [TILE[0], TILE[3], -TT], [D[0], D[1], PIN_H]], 200, 166);
  const P = proj(C), front = facing(C), at = (p) => P(p[0], p[1], 0);

  const g = mk("g", {}, svg);
  put(solid(g), prism(P, front, ...rings(TILE[0], TILE[1], TILE[2], TILE[3], 8, 2), -TT, 0));
  mk("path", { class: "nf", d: KERBS.map((k) => open(k.map(at))).join("") }, g);
  mk("path", { class: "dash nf", d: open(ROUTE.map(at)) }, g);
  const route = mk("path", { class: "nf hi" }, g);

  // the pin, up the second street, facing the viewer
  const pw = (t, h, d) => P(D[0] + (t + d) / Math.SQRT2, D[1] + (d - t) / Math.SQRT2, h);
  const fr = PIN.map(([t, h]) => pw(t, h, 0));
  mk("path", { class: "sil", d: poly(hull(fr.concat(PIN.map(([t, h]) => pw(t, h, -PIN_T))))) }, g);
  mk("path", { class: "nf lo", d: poly(fr) }, g);
  mk("path", { class: "nf", d: poly(circ(3, 20).map((q) => pw(q.u, PIN_H - PIN_R + q.v, 0))) }, g);

  // the car, in its own frame: u along it, the front at +u; v across
  const H = CL / 2, W2 = CW / 2;
  const [body, bodyIn] = rings(-H, -W2, H, W2, 7, 1.4);
  const foot = rrect(-H + 7, -W2 + 2, H - 8, W2 - 2, 4, 4), top = rrect(-H + 10, -W2 + 3.6, H - 17, W2 - 3.6, 2, 4), topIn = rrect(-H + 11.2, -W2 + 4.8, H - 18.2, W2 - 4.8, 1.2, 4);
  const cg = mk("g", {}, g);
  const bodyS = solid(cg), cabS = solid(cg), wheels = [0, 1].map(() => mk("path", { class: "sil" }, cg));

  const k = tween(0), drive = tween(0, DRIVE);
  let drawn = "";
  function draw(kv, dv) {
    const key = kv + "," + dv + "," + reach;
    if (key === drawn) return;
    drawn = key;
    const s = (ALONG0 + dv * (reach - ALONG0)) * TOTAL, c = along(s);
    const s0 = ALONG0 * TOTAL;
    route.setAttribute("d", kv < 0.01 ? "" : open(Array.from({ length: 41 }, (_, i) => { const a = along(s0 + (i / 40) * (TOTAL - s0) * kv); return at([a.x, a.y]); })));
    const pl = (ring) => place2(ring, c.x, c.y, c.th), cs = Math.cos(c.th), sn = Math.sin(c.th);
    put(bodyS, prism(P, front, pl(body), pl(bodyIn), Z0, ZB));
    put(cabS, { sil: poly(hull(ringAt(P, pl(foot), ZB).concat(ringAt(P, pl(top), ZC)))), crease: open(ringAt(P, run(pl(topIn), front), ZC)) });
    // the wheels on the side that faces the viewer, (1, 1) on the ground
    const side = cs - sn > 0 ? W2 + 0.4 : -W2 - 0.4;
    [-H + 8.5, H - 8.5].forEach((cu, i) => {
      const pts = Array.from({ length: 20 }, (_, j) => { const t = (j / 20) * Math.PI * 2, u = cu + WR * Math.cos(t); return P(c.x + u * cs - side * sn, c.y + u * sn + side * cs, WR + WR * Math.sin(t)); });
      wheels[i].setAttribute("d", poly(pts));
    });
  }

  const B = register(stage, (_dt, now) => { draw(tval(k, now), tval(drive, now)); return !tdone(k, now) || !tdone(drive, now); });
  bag.add(B.unregister);

  let act = null;
  function setActive(a) {
    if (a === act) return;
    act = a;
    const now = performance.now();
    tset(k, a ? 1 : 0, now, 0);
    tset(drive, a ? 1 : 0, now, a ? 450 : 0);
    bodyS.sil.classList.toggle("hi", !a); cabS.sil.classList.toggle("hi", !a);
    read.textContent = a ? "driving" : "rest";
    B.wake();
  }
  setActive(false);

  const box = [TILE.slice(0, 2), TILE.slice(2), [TILE[0], TILE[3]], [TILE[2], TILE[1]]].map(at);
  const xs = box.map((p) => p[0]), ys = box.map((p) => p[1]);
  const hit = ([x, y]) => x > Math.min(...xs) && x < Math.max(...xs) && y > Math.min(...ys) - 20 && y < Math.max(...ys);

  bag.add(pointer(stage, { move: (p) => setActive(hit(p)), leave: () => setActive(false) }));
  bag.add(() => svg.replaceChildren());

  return { set: (v) => { reach = clamp(v, 0.4, 0.9); B.wake(); }, destroy: bag.dispose };
}

hairline({
  name: "automotive",
  means: "A car on the map, seen from above: over the map its route lights up and the car drives it, round the corner.",
  rules: [1, 4, 5, 8],
  range: [0.5, 0.8, 0.9],
  tour: [[200, 170], [230, 200], null],
  mount,
});
