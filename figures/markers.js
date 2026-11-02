/**
 * Markers: a map marker, a pin extruded into a thick solid with a round hole
 * through its head, standing over a round pad, the spot it marks. At rest the
 * pin hovers low, turned three-quarters, and the pad's ring carries the bright
 * edge. As the pointer comes near, the pin is picked: it rises off the pad,
 * turns to face the pointer and takes the bright edge from the ring, more the
 * nearer the pointer is. The slider is the reach, in viewBox units.
 *
 * Charge Point's figure with the pin in the bolt's place. The pin's outline is
 * swept as the bolt's is: projected twice, back and front, joined where the
 * sweep turns, the front's far-facing edges drawn as silhouette; the hole is a
 * ring on the front face, with its far wall, the back ring, showing through.
 */
const {
  Cam, circ, clamp, facing, fillet, fit, lerp, open, poly, prism, proj, rad, ringAt, seg,
  spring, stepS, disposer, mk, pointer, put, register, solid,
} = HL;

const PR = 70, PH = 8, TK = 14, YAW = -8, SWING = 30, LIFT0 = 8, LIFT1 = 30;
// the pin, upright in its own plane, a across and h up: a round head of radius HR at height HC, drawn in to a
// rounded tip at the bottom along the lines that touch the head; the hole through the head of radius HOLE
const HR = 32, HC = 76, HOLE = 13, BH = HC + HR;
const BOLT = (() => {
  // the head from the right tangent point over the top to the left one; then the tip, rounded
  const b = Math.acos(HR / HC), out = [];
  for (let k = 0; k <= 40; k++) { const t = -Math.PI / 2 + b + ((2 * Math.PI - 2 * b) * k) / 40; out.push([HR * Math.cos(t), HC + HR * Math.sin(t)]); }
  // the tip, rounded by hand: a fillet on the arc too would leave zero-length edges there, and each one a seam
  // two points a little way up the tangent lines and one just above the tip, so the round stays on them
  const [tx, ty] = out[0], l = Math.hypot(tx, ty), d = 4;
  out.push([(-tx * d) / l, (ty * d) / l], [0, 1.2], [(tx * d) / l, (ty * d) / l]);
  return out;
})();

/** The share of the full pick at u reaches from the pin: 1 to 40%, .3 at 80%, .06 from 130%. */
const falloff = (u) => (u <= 0.4 ? 1 : u <= 0.8 ? 1 - ((u - 0.4) / 0.4) * 0.7 : u <= 1.3 ? 0.3 - ((u - 0.8) / 0.5) * 0.24 : 0.06);

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  let reach = value, over = null;

  /** The bolt's outline in the world, turned to `yaw`, raised by `lift`, at depth w across its plane. */
  const world = (yaw, lift, w) => {
    const c = Math.cos(rad(yaw)), s = Math.sin(rad(yaw));
    return BOLT.map(([a, h]) => [a * c - w * s, a * s + w * c, h + lift]);
  };

  /** The hole's rim, turned and raised with the pin, at depth w. */
  const worldRing = (yaw, lift, w) => {
    const c = Math.cos(rad(yaw)), s = Math.sin(rad(yaw));
    return circ(HOLE, 40).map((q) => [q.u * c - w * s, q.u * s + w * c, HC + q.v + lift]);
  };
  /** Whether screen point p is inside the closed ring r. */
  const inside = (p, r) => {
    let c = false;
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
      if ((r[i][1] > p[1]) !== (r[j][1] > p[1]) && p[0] < ((r[j][0] - r[i][0]) * (p[1] - r[i][1])) / (r[j][1] - r[i][1]) + r[i][0]) c = !c;
    }
    return c;
  };
  /** The unbroken runs of a closed list where some entries are null, as open lists. */
  const runs = (pts) => {
    const out = [];
    let cur = [];
    const n = pts.length, start = pts.findIndex((p) => !p);
    if (start < 0) return [pts.concat([pts[0]])];
    for (let k = 1; k <= n; k++) {
      const p = pts[(start + k) % n];
      if (p) cur.push(p); else { if (cur.length > 1) out.push(cur); cur = []; }
    }
    return out;
  };

  const C = Cam(45, 0.5, 1.6);
  const ext = [[PR, 0, -PH], [-PR, 0, -PH], [0, PR, -PH], [0, -PR, -PH]];
  for (const y of [YAW - SWING, YAW + SWING]) for (const w of [-TK / 2, TK / 2]) ext.push(...world(y, LIFT1, w));
  fit(C, ext, 200, 156); // the pad's near rim hangs low: centred on the drawn box, not the fitted one
  const P = proj(C), front = facing(C);

  const g = mk("g", {}, svg);
  put(solid(g), prism(P, front, circ(PR, 64), circ(PR - 2, 64), -PH, 0));
  const coil = mk("path", { class: "nf", d: poly(ringAt(P, circ(PR * 0.58, 64), 0)) }, g);

  // back to front: the back face and the side bands as ground only, then the back's lit edges, the joins, the front face
  const back = mk("path", { class: "fo" }, g), sides = mk("path", { class: "fo" }, g);
  const rim = mk("path", { class: "nf sil" }, g);
  // the joins go over the front face: where the outline turns smoothly they are short, and the face would cut them
  const face = mk("path", { class: "lo" }, g), edge = mk("path", { class: "nf sil" }, g), join = mk("path", { class: "nf sil" }, g);
  // the hole: its rim on the front face, and the part of its far rim that shows through it
  const hole = mk("path", { class: "nf sil" }, g), wall = mk("path", { class: "nf lo" }, g);
  const sYaw = spring(YAW, { eps: 0.05 }), sLift = spring(LIFT0, { eps: 0.05 });
  let drawn = "";

  function draw() {
    const key = sYaw.x.toFixed(2) + "," + sLift.x.toFixed(2);
    if (key === drawn) return;
    drawn = key;
    const F = world(sYaw.x, sLift.x, TK / 2).map((p) => P(...p)), Bk = world(sYaw.x, sLift.x, -TK / 2).map((p) => P(...p));
    const t = [Bk[0][0] - F[0][0], Bk[0][1] - F[0][1]], n = F.length;
    let area = 0;
    for (let i = 0; i < n; i++) { const a = F[i], b = F[(i + 1) % n]; area += a[0] * b[1] - b[0] * a[1]; }
    // an edge faces the sweep when its outward normal points along t: its back copy is the silhouette there
    const faces = F.map((a, i) => {
      const b = F[(i + 1) % n], dx = b[0] - a[0], dy = b[1] - a[1];
      return (area > 0 ? dy * t[0] - dx * t[1] : -dy * t[0] + dx * t[1]) > 0;
    });
    let j = "", e = "", r = "", q = "";
    for (let i = 0; i < n; i++) {
      const k = (i + 1) % n;
      if (faces[i] !== faces[(i + n - 1) % n]) j += seg(F[i], Bk[i]);
      if (!faces[i]) { e += seg(F[i], F[k]); continue; }
      r += seg(Bk[i], Bk[k]);
    }
    // the side the sweeping edges cover, one piece per run of them: the pin's outline is a curve of many short
    // edges, and a band per edge would show its seams. Each run is its front edges out and its back ones home
    const s0 = faces.findIndex((f, i) => !f && faces[(i + 1) % n]);
    if (s0 >= 0) for (let k = 1, run = []; k <= n; k++) {
      const i = (s0 + k) % n;
      if (faces[i]) { if (!run.length) run.push(i); run.push((i + 1) % n); }
      else if (run.length) { q += poly(run.map((v) => F[v]).concat(run.map((v) => Bk[v]).reverse())); run = []; }
    }
    back.setAttribute("d", poly(Bk));
    sides.setAttribute("d", q);
    rim.setAttribute("d", r);
    join.setAttribute("d", j);
    face.setAttribute("d", poly(F));
    edge.setAttribute("d", e);
    const ring = (w) => worldRing(sYaw.x, sLift.x, w).map((p) => P(...p)), hf = ring(TK / 2), hb = ring(-TK / 2);
    hole.setAttribute("d", poly(hf));
    wall.setAttribute("d", runs(hb.map((p) => (inside(p, hf) ? p : null))).map(open).join(""));
  }

  const B = register(stage, (dt) => {
    const m = stepS(sYaw, dt) | stepS(sLift, dt);
    draw();
    return !!m;
  });
  bag.add(B.unregister);

  // Hit test on the rest pose, in screen space: the bolt's resting middle never moves.
  const mid = P(0, 0, LIFT0 + BH / 2);
  let lit = null;
  function retarget() {
    let c = 0;
    if (over) {
      const dx = over[0] - mid[0], dy = over[1] - mid[1];
      c = falloff(Math.hypot(dx, dy * 0.5) / reach); // the bolt is tall: reach twice as far up and down
      sYaw.t = YAW + clamp(dx / 90, -1, 1) * SWING * Math.min(1, c * 2);
    } else sYaw.t = YAW;
    sLift.t = lerp(LIFT0, LIFT1, c);
    const on = c > 0.5;
    if (on !== lit) {
      lit = on;
      for (const el of [rim, join, edge, hole]) el.classList.toggle("hi", on);
      coil.classList.toggle("hi", !on);
    }
    read.textContent = on ? "picked" : "rest";
    B.wake();
  }
  retarget();

  bag.add(pointer(stage, {
    move: (p) => { over = p; retarget(); },
    leave: () => { over = null; retarget(); },
  }));
  bag.add(() => svg.replaceChildren());

  return { set: (v) => { reach = v; retarget(); }, destroy: bag.dispose };
}

hairline({
  name: "markers",
  means: "A map marker over the spot it marks: near the pointer it is picked, rising off the pad and turning to face it.",
  rules: [1, 3, 4, 8],
  range: [80, 120, 170],
  tour: [[150, 120], [262, 140], [205, 240], null],
  mount,
});
