/**
 * Automotive UI: a tablet lying on the table, landscape, screen up, and the
 * screen's interface built of modules, each a thin plate set into its own
 * slot: a big map on the left, with streets, two places marked, a pin
 * standing at the destination and the route to it from a chevron, where the
 * car is; on the right, lane guidance above, four lanes with the way through
 * each and the one to take drawn strong, and the trip below, a progress line
 * with a button and a chip. At rest the modules lie in their slots, the
 * interface whole, and the route carries the bright edge. When the pointer
 * comes over the tablet the modules lift out of their slots, the one under
 * the pointer first and highest, taking the bright edge, the others after it,
 * and the empty slots show, dashed, on the screen; let go, they come down and
 * settle back into them, one after another. The slider is the lift.
 *
 * The pattern: one of many, a tween each, staggered from the chosen one. The
 * hit test is each module's rest top on screen, and the tablet's, which
 * never move.
 */
const {
  Cam, circ, clamp, facing, fillet, fit, hull, open, poly, prism, proj, rings, rrect,
  tset, tval, tdone, tween, disposer, mk, pointer, put, register, solid,
} = HL;

// the tablet: x along it, y across, the interface's top at -y; TT thick, the screen inset on its top
const TW = 88, TD = 58, TR = 11, TT = 6, MT = 2.4;
const MODS = [
  { name: "map", box: [-79, -49, 21, 49] },
  { name: "lanes", box: [25, -49, 79, -2] },
  { name: "trip", box: [25, 2, 79, 49] },
];
const KW = 4, UP = [-46, -6], ACROSS = [-14, 24];
const ROUTE = fillet([[-46, 36], [-46, -14], [-6, -14], [-6, -32]], [0, 7, 7, 0], 5).filter((p, k, a) => k === 0 || Math.hypot(p[0] - a[k - 1][0], p[1] - a[k - 1][1]) > 0.01);
const CHEV = fillet([[0, -5], [4.2, 3.6], [0, 1.5], [-4.2, 3.6]], [0.8, 0.8, 0.4, 0.8], 3);
const POIS = [[-26, 6], [6, 34]], DEST = [-6, -36], PIN_R = 6, PIN_H = 20, PIN_T = 2.6;
const LANES = 4, TAKE = 2;
const PIN = (() => {
  const cy = PIN_H - PIN_R, a0 = Math.acos(PIN_R / cy), pts = [];
  for (let k = 0; k <= 24; k++) { const a = a0 + (k / 24) * (2 * Math.PI - 2 * a0); pts.push([PIN_R * Math.sin(a), cy - PIN_R * Math.cos(a)]); }
  pts.push([0, 0]);
  return fillet(pts, pts.map((_, k) => (k === pts.length - 1 ? 1.6 : 0.4)), 3);
})();

/** Is screen point p inside the polygon q? */
const inside = (p, q) => {
  let c = false;
  for (let i = 0, j = q.length - 1; i < q.length; j = i++)
    if ((q[i][1] > p[1]) !== (q[j][1] > p[1]) && p[0] < ((q[j][0] - q[i][0]) * (p[1] - q[i][1])) / (q[j][1] - q[i][1]) + q[i][0]) c = !c;
  return c;
};

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  let lift = value;
  const C = Cam(45, 0.5, 1.7);
  fit(C, [[-TW, -TD, 0], [TW, TD, 0], [TW, -TD, 0], [-TW, TD, 0], [-79, -49, TT + 24 + MT], [79, -49, TT + 24 + MT], [DEST[0], DEST[1], TT + 24 + MT + PIN_H]], 200, 166);
  const P = proj(C), front = facing(C);
  const box = (b, r, z) => rrect(b[0], b[1], b[2], b[3], r, 6).map((q) => P(q.u, q.v, z));

  let act = null, over = false;
  const g = mk("g", {}, svg);
  // the tablet: a slab, its top face's ring the crease; the screen on it, and the modules' slots, dashed
  put(solid(g), prism(P, front, ...rings(-TW, -TD, TW, TD, TR, 1.6), 0, TT));
  mk("path", { class: "nf", d: poly(box([-TW + 5, -TD + 5, TW - 5, TD - 5], TR - 4, TT)) }, g);
  mk("path", { class: "nf lo", d: poly(circ(1.6, 12).map((q) => P(q.u, -TD + 2.6 + q.v * 0.6, TT))) }, g);
  for (const m of MODS) mk("path", { class: "nf dash lo", d: poly(box(m.box, 5, TT)) }, g);

  // the modules, far to near, each a plate and its contents drawn at its own height
  const mods = MODS.map((m, i) => {
    const grp = mk("g", {}, g);
    return { ...m, i, grp, plate: solid(grp), parts: mk("g", {}, grp), z: tween(0), drawn: "" };
  });

  function contents(m, z) {
    m.parts.replaceChildren();
    const top = TT + z + MT, pt = ([x, y]) => P(x, y, top);
    const line = (pts, cls) => mk("path", { class: cls, d: open(pts.map(pt)) }, m.parts);
    const shape = (pts, cls) => mk("path", { class: cls, d: poly(pts.map(pt)) }, m.parts);
    const [x0, y0, x1, y1] = m.box;
    if (m.name === "map") {
      const cut = (a0, a1, at) => {
        const runs = []; let s = a0;
        for (const c of at) { if (c - KW > s) runs.push([s, c - KW]); s = c + KW; }
        if (s < a1) runs.push([s, a1]);
        return runs;
      };
      const kerbs = [];
      for (const x of UP) for (const e of [-KW, KW]) for (const [a, b] of cut(y0 + 1, y1 - 1, ACROSS)) kerbs.push([[x + e, a], [x + e, b]]);
      for (const y of ACROSS) for (const e of [-KW, KW]) for (const [a, b] of cut(x0 + 1, x1 - 1, UP)) kerbs.push([[a, y + e], [b, y + e]]);
      mk("path", { class: "nf lo", d: kerbs.map((k) => open(k.map(pt))).join("") }, m.parts);
      // the route keeps the bright edge at rest and while its own module is chosen
      line(ROUTE, "nf " + (act === null || act === 0 ? "hi" : "sil"));
      for (const [x, y] of POIS) {
        shape(circ(3.4, 20).map((q) => [x + q.u, y + q.v]), "sil");
        shape(circ(1.3, 12).map((q) => [x + q.u, y + q.v]), "dot m");
      }
      // the car: a disc with the chevron on it, up the route
      const [cx, cy] = ROUTE[0];
      shape(circ(6.2, 28).map((q) => [cx + q.u, cy + q.v]), "sil");
      shape(CHEV.map(([u, v]) => [cx + u, cy + v]), "dot m");
      // the pin, standing on the map at the destination, facing the viewer
      const pw = (t, h, d) => P(DEST[0] + (t + d) / Math.SQRT2, DEST[1] + (d - t) / Math.SQRT2, top + h);
      const fr = PIN.map(([t, h]) => pw(t, h, 0));
      mk("path", { class: "sil", d: poly(hull(fr.concat(PIN.map(([t, h]) => pw(t, h, -PIN_T))))) }, m.parts);
      mk("path", { class: "nf lo", d: poly(fr) }, m.parts);
      mk("path", { class: "nf", d: poly(circ(2.3, 20).map((q) => pw(q.u, PIN_H - PIN_R + q.v, 0))) }, m.parts);
    } else if (m.name === "lanes") {
      const w = (x1 - x0 - 8) / LANES, a = y1 - 5, b = y0 + 8;
      for (let i = 1; i < LANES; i++) line([[x0 + 4 + i * w, y1 - 4], [x0 + 4 + i * w, y0 + 4]], "nf dash lo");
      for (let i = 0; i < LANES; i++) {
        const c = x0 + 4 + (i + 0.5) * w, cls = i === TAKE ? "nf sil" : "nf lo";
        // the way through each lane, up the interface: a stem and its head; the last lane turns off to the right
        if (i === LANES - 1) {
          line(fillet([[c - 1.5, a], [c - 1.5, b + 5], [c + 3, b + 5]], [0, 2.5, 0], 4), cls);
          line([[c + 0.8, b + 2.8], [c + 3, b + 5], [c + 0.8, b + 7.2]], cls);
        } else {
          line([[c, a], [c, b]], cls);
          line([[c - 2.6, b + 3], [c, b], [c + 2.6, b + 3]], cls);
        }
      }
    } else {
      const done = x0 + 6 + (x1 - x0 - 12) * 0.55;
      // the trip: a round button, a chip, and the progress along the way, a dot where the car is
      shape(circ(5, 24).map((q) => [x0 + 11 + q.u, y0 + 12 + q.v]), "nf");
      shape(rrect(x0 + 21, y0 + 8, x1 - 6, y0 + 16, 4, 4).map((q) => [q.u, q.v]), "nf lo");
      line([[done, y1 - 9], [x1 - 6, y1 - 9]], "nf lo");
      line([[x0 + 6, y1 - 9], [done, y1 - 9]], "nf sil");
      shape(circ(1.9, 12).map((q) => [done + q.u, y1 - 9 + q.v]), "dot m");
    }
  }

  function draw(m, z) {
    const key = z + "," + act;
    if (key === m.drawn) return;
    m.drawn = key;
    const [x0, y0, x1, y1] = m.box;
    put(m.plate, prism(P, front, ...rings(x0, y0, x1, y1, 5, 1.2), TT + z, TT + z + MT));
    // a chosen module takes the bright edge on its plate; the map's is its route
    m.plate.sil.classList.toggle("hi", act === m.i && m.i !== 0);
    contents(m, z);
  }

  const B = register(stage, (_dt, now) => {
    let moving = false;
    for (const m of mods) { draw(m, tval(m.z, now)); if (!tdone(m.z, now)) moving = true; }
    return moving;
  });
  bag.add(B.unregister);

  function setActive(o, a, force) {
    if (o === over && a === act && !force) return;
    over = o; act = a;
    const now = performance.now();
    // the chosen one lifts first and highest, the others after it, by how far they are from it
    const from = a === null ? 0 : a;
    mods.forEach((m) => {
      const rank = Math.abs(m.i - from);
      tset(m.z, o ? (m.i === a ? lift : lift * 0.55) : 0, now, o ? rank * 90 : (2 - rank) * 110);
    });
    read.textContent = !o ? "rest" : a === null ? "lifted" : MODS[a].name;
    B.wake();
  }
  setActive(false, null, true);

  const rests = MODS.map((m) => box(m.box, 5, TT + MT));
  const slab = box([-TW, -TD, TW, TD], TR, TT);
  const hit = (p) => {
    const i = rests.findIndex((q) => inside(p, q));
    return i >= 0 ? [true, i] : [inside(p, slab), null];
  };

  bag.add(pointer(stage, { move: (p) => setActive(...hit(p)), leave: () => setActive(false, null) }));
  bag.add(() => svg.replaceChildren());

  return { set: (v) => { lift = clamp(v, 8, 24); if (over) setActive(over, act, true); }, destroy: bag.dispose };
}

hairline({
  name: "automotive-ui",
  means: "A tablet whose interface is built of modules, map, lanes and trip: over it they lift out of their slots and settle back in.",
  rules: [1, 2, 4, 5],
  range: [10, 16, 24],
  tour: [[150, 160], [270, 130], [290, 185], null],
  mount,
});
