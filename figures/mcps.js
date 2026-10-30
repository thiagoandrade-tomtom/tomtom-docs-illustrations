/**
 * MCPs: a plug and a wall socket. The socket is a square plate standing on
 * the ground, a round recess in its face with two holes in it. The plug is a
 * round body with two prongs in front and a cable out of its back that runs
 * down to the floor. The pointer pulls the plug along its axis: away, it
 * backs off; near the socket, within the snap, it slides home. When it lands
 * a spark bursts round the joint and the socket's recess takes the bright
 * edge: connected. At rest the plug waits a little way out, bright. The
 * slider is the snap, how near the plug must come before it slides in.
 *
 * The pattern: one position on a spring, and a state when it lands. The
 * target is read from the pointer on a fixed plane, never from the plug.
 */
const {
  Cam, circ, clamp, fit, hull, open, poly, proj, rings, unproj,
  spring, stepS, tdone, tset, tval, tween, disposer, mk, pointer, put, register, solid,
} = HL;

const FX = -36, AZ = 38, BR = 15, BL = 30, NR = 7, NL = 9, PR = 2.4, PL = 15, PY = 8;
const T_IN = FX, T_OUT = 34, T_REST = 6, END = [96, 64, 0], RAYS = 8;

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  let snap = value;
  const C = Cam(45, 0.5, 1.75);
  fit(C, [[-50, -38, 0], [-50, 38, 0], [FX, 38, 0], [-50, -38, 78], [T_OUT + BL + NL, BR, AZ + BR], END, [FX, -40, AZ + 30]], 200, 166);
  const P = proj(C);
  /** A point of the plane x, (y across, z up) in it. */
  const at = (x) => (q) => P(x, q[0], q[1]);
  const disc = (r, cy = 0, n = 40) => circ(r, n).map((q) => [cy + q.u, AZ + q.v]);

  const g = mk("g", {}, svg);
  // the socket: a plate standing on the ground, its face at x = FX, a recess and two holes in it
  const plate = solid(g);
  const face = (r, cls) => mk("path", { class: cls, d: poly(disc(r).map(at(FX))) }, g);
  {
    // the plate stands on its edge: its outline in the y–z plane, extruded along x
    const [sq, inset] = rings(-38, 0, 38, 76, 10, 2);
    const back = sq.map((q) => P(-50, q.u, q.v)), fr = sq.map((q) => P(FX, q.u, q.v));
    put(plate, { sil: poly(hull(back.concat(fr))), crease: poly(inset.map((q) => P(FX, q.u, q.v))) });
  }
  const recess = face(23, "nf sil"), recessIn = face(20.5, "nf lo");
  for (const y of [-PY, PY]) mk("path", { class: "nf", d: poly(disc(3.2, y, 20).map(at(FX))) }, g);

  const rays = mk("path", { class: "nf hi" }, g);
  const prongs = [-PY, PY].map(() => mk("path", { class: "sil" }, g));
  const cable = mk("path", { class: "nf sil" }, g);
  const body = mk("path", { class: "sil" }, g), cap = mk("path", { class: "nf" }, g);
  const neck = mk("path", { class: "sil" }, g), neckCap = mk("path", { class: "nf lo" }, g);

  /** A round solid lying along x from x0 to x1, radius r on the axis: its silhouette and its back cap. */
  const lying = (x0, x1, r, y = 0) => {
    const ring = disc(r, y, 32);
    return { sil: poly(hull(ring.map(at(x0)).concat(ring.map(at(x1))))), back: ring.map(at(x1)) };
  };

  let drawn = NaN;
  function draw(t) {
    if (t === drawn) return;
    drawn = t;
    // the prongs, only what is still out of the socket
    [-PY, PY].forEach((y, k) => {
      const x0 = Math.max(t - PL, FX), on = t - x0 > 0.3;
      prongs[k].setAttribute("d", on ? lying(x0, t, PR, y).sil : "");
    });
    const b = lying(t, t + BL, BR), n = lying(t + BL, t + BL + NL, NR);
    body.setAttribute("d", b.sil);
    cap.setAttribute("d", poly(disc(BR - 2, 0, 32).map(at(t + BL))));
    neck.setAttribute("d", n.sil);
    neckCap.setAttribute("d", poly(n.back));
    // the cable: out of the neck, down to a fixed point on the floor
    const a = [t + BL + NL, 0, AZ], c1 = [t + BL + NL + 26, 0, AZ], c2 = [END[0], END[1] - 46, 0];
    const pts = [];
    for (let k = 0; k <= 24; k++) {
      const s = k / 24, u = 1 - s;
      pts.push(P(...[0, 1, 2].map((i) => u * u * u * a[i] + 3 * u * u * s * c1[i] + 3 * u * s * s * c2[i] + s * s * s * END[i])));
    }
    cable.setAttribute("d", open(pts));
  }

  const spark = tween(0, 420);
  let sDrawn = NaN;
  function drawSpark(s) {
    if (s === sDrawn) return;
    sDrawn = s;
    if (s < 0.02) { rays.setAttribute("d", ""); return; }
    let d = "";
    for (let k = 0; k < RAYS; k++) {
      const a = (k / RAYS) * Math.PI * 2 + 0.2, r0 = 26 + 4 * s, r1 = 28 + 12 * s;
      d += open([[r0 * Math.cos(a), AZ + r0 * Math.sin(a)], [r1 * Math.cos(a), AZ + r1 * Math.sin(a)]].map(at(FX)));
    }
    rays.setAttribute("d", d);
  }

  const sp = spring(T_REST);
  let home = false;
  const Bk = register(stage, (dt, now) => {
    const m = stepS(sp, dt);
    draw(sp.x);
    // landing: the spark goes out, then back; leaving puts it out
    const landed = sp.t === T_IN && Math.abs(sp.x - T_IN) < 0.6;
    if (landed !== home) {
      home = landed;
      recess.classList.toggle("hi", landed);
      body.classList.toggle("hi", !landed);
      tset(spark, landed ? 1 : 0, now, 0);
    }
    if (home && tdone(spark, now) && tval(spark, now) === 1) tset(spark, 0, now, 0);
    drawSpark(tval(spark, now));
    return m || !tdone(spark, now);
  });
  bag.add(Bk.unregister);
  body.classList.add("hi");

  /** The pointer's x on the axis's plane, taken as the middle of the plug's body; inside the snap it slides home. */
  function aim(p) {
    if (!p) { sp.t = T_REST; read.textContent = "rest"; Bk.wake(); return; }
    const [x] = unproj(C, p[0], p[1], AZ);
    let t = clamp(x - BL / 2, T_IN, T_OUT);
    if (t - PL - FX < snap) t = T_IN;
    sp.t = t;
    read.textContent = t === T_IN ? "connected" : `gap ${Math.round(t - PL - FX)}`;
    Bk.wake();
  }
  aim(null);

  bag.add(pointer(stage, { move: aim, leave: () => aim(null) }));
  bag.add(() => svg.replaceChildren());

  return { set: (v) => { snap = clamp(v, 4, 30); }, destroy: bag.dispose };
}

hairline({
  name: "mcps",
  means: "A plug and a wall socket: the pointer draws the plug along; near the socket it slides home and a spark marks the connection.",
  rules: [1, 4, 5, 8],
  range: [6, 16, 26],
  tour: [[300, 190], [250, 160], [193, 132], null],
  mount,
});
