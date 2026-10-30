/**
 * MCPs: a globe with services all round it, and the AI spark beside it, a
 * large star and a small one. The
 * globe is its outline, an equator and lines of latitude and longitude, only
 * their near halves drawn; nine services sit on it as dots, the ones on the
 * far side hidden. The pointer's place across the globe turns it, on a
 * spring; the service that comes round to face the viewer becomes the hub,
 * the spark twinkles, and arcs leap from the hub over the surface to the
 * other services in view, the nearest first, each one blinking as its link
 * lands. At rest the globe sits turned, its hub's links drawn and bright.
 * The slider is the stagger between links, in ms.
 *
 * The pattern: a position on a spring, and a choice read from its target,
 * never from where the globe is drawn.
 */
const {
  Cam, clamp, fillet, fit, open, poly, proj, unproj, spring, stepS,
  tdone, tset, tval, tween, disposer, mk, place, pointer, register,
} = HL;

const R = 60, LIFT = 0.24, DOT = 3.2, VIS = 0.18, TURN = 1.7;
// the services: longitude and latitude on the globe
const SV = [[0, 0.3], [0.7, -0.25], [1.4, 0.5], [2.1, -0.1], [2.8, 0.38], [3.5, -0.42], [4.2, 0.12], [4.9, -0.3], [5.6, 0.48]];
const REST = 0.66;

const add = (a, b, k = 1) => a.map((v, i) => v + b[i] * k);
const unit = (a) => { const l = Math.hypot(...a); return a.map((v) => v / l); };
const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const sph = (lon, lat) => [Math.cos(lat) * Math.cos(lon), Math.cos(lat) * Math.sin(lon), Math.sin(lat)];

/** A four-pointed star, an astroid, of radius r turned by th, its tips rounded: (x, y) points. */
const star = (r, th) => fillet(Array.from({ length: 48 }, (_, k) => {
  const u = (k / 48) * Math.PI * 2, x = r * Math.cos(u) ** 3, y = r * Math.sin(u) ** 3;
  return [x * Math.cos(th) - y * Math.sin(th), x * Math.sin(th) + y * Math.cos(th)];
}), Array(48).fill(0.5), 2);

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  let stag = value;
  const C = Cam(45, 0.5, 1.7);
  // the line of sight, and two directions across the screen: the plane the spark stands in
  const [x0, y0] = unproj(C, 200, 160, 0), [x1, y1] = unproj(C, 200, 160, 1);
  const v = unit([x1 - x0, y1 - y0, 1]), e1 = unit(cross([0, 0, 1], v)), e2 = cross(v, e1);
  const rim = Array.from({ length: 72 }, (_, k) => { const t = (k / 72) * Math.PI * 2; return add(e1.map((c) => c * Math.cos(t) * R), e2, Math.sin(t) * R); });
  const SC = add(e1.map((c) => -c * R * 1.02), e2, R * 0.92);
  fit(C, rim.map((p) => p.map((c) => c * (1 + LIFT))).concat([add(SC, e1, -28), add(SC, e2, 16), add(SC, e2, -24)]), 210, 170);
  const P = proj(C), on = (u, r = R) => P(...u.map((c) => c * r));

  /** The near half of a circle of the globe: runs of samples facing the viewer, as open paths. */
  const near = (pts) => {
    let d = "", run = [];
    pts.forEach((u) => { if (dot3(u, v) > 0.02) run.push(on(u)); else { if (run.length > 1) d += open(run); run = []; } });
    return d + (run.length > 1 ? open(run) : "");
  };
  const ring = (f, n = 96) => Array.from({ length: n + 1 }, (_, k) => f((k / n) * Math.PI * 2));

  const g = mk("g", {}, svg);
  mk("path", { class: "sil", d: poly(rim.map((p) => P(...p))) }, g);
  mk("path", { class: "nf lo", d: [-0.75, -0.4, 0.4, 0.75].map((l) => near(ring((t) => sph(t, l)))).join("") }, g);
  const merids = mk("path", { class: "nf lo" }, g);
  mk("path", { class: "nf", d: near(ring((t) => sph(t, 0))) }, g);
  const arcs = SV.map(() => mk("path", { class: "nf hi" }, g));
  const dots = SV.map(() => ({ el: mk("circle", { r: DOT, class: "dot m" }, g), p: tween(1), landed: true }));
  // the sparks: offset from SC across the screen (e1 runs left, e2 up), size, and which way they swell
  const SPARKS = [[0, 0, 13, 1], [-19, -15, 6, -1]];
  const sparks = SPARKS.map(() => [mk("path", { class: "lo" }, g), mk("path", { class: "sil" }, g)]);
  let spin = tween(0);

  const at = (i, rho) => sph(SV[i][0] + rho, SV[i][1]);
  const seen = (i, rho) => dot3(at(i, rho), v) > VIS;
  /** The service most squarely facing the viewer with the globe turned to rho. */
  const facing = (rho) => SV.reduce((b, _, i) => (dot3(at(i, rho), v) > dot3(at(b, rho), v) ? i : b), 0);

  /** The arc from a to b, drawn to share k: over the surface, lifted in the middle. */
  const arc = (ua, ub, k) => {
    const om = Math.acos(clamp(dot3(ua, ub), -1, 1)), pts = [];
    for (let i = 0; i <= 28; i++) {
      const t = (i / 28) * k, w0 = Math.sin((1 - t) * om) / Math.sin(om), w1 = Math.sin(t * om) / Math.sin(om);
      pts.push(on(add(ua.map((c) => c * w0), ub, w1), R * (1 + LIFT * Math.sin(Math.PI * t))));
    }
    return open(pts);
  };

  const sp = spring(REST);
  let hub = facing(REST), links = SV.map((_, j) => tween(j !== hub && seen(j, REST) ? 1 : 0)), drawn = "";
  const B = register(stage, (dt, now) => {
    let moving = stepS(sp, dt);
    const rho = sp.x;
    const ks = links.map((l) => { if (!tdone(l, now)) moving = true; return tval(l, now); });
    const sk = tval(spin, now);
    if (!tdone(spin, now)) moving = true;
    const key = rho.toFixed(4) + ks.map((k) => k.toFixed(3)).join() + sk.toFixed(3) + dots.map((d) => tval(d.p, now).toFixed(3)).join();
    if (key !== drawn) {
      drawn = key;
      merids.setAttribute("d", [0, 1, 2, 3].map((m) => near(ring((t) => sph(rho + (m * Math.PI) / 4, t)))).join(""));
      SV.forEach((_, j) => {
        const u = at(j, rho), vis = dot3(u, v) > VIS, d = dots[j];
        place(d.el, on(u));
        // the service blinks as its link lands
        if (j !== hub && ks[j] >= 1 && !d.landed) { d.landed = true; d.p = tween(0); tset(d.p, 1, now, 0); }
        const p = tval(d.p, now);
        d.el.setAttribute("r", vis ? DOT + 2.6 * Math.sin(Math.PI * p) : 0);
        d.el.setAttribute("class", j === hub || (p > 0 && p < 1) ? "dot" : "dot m");
        arcs[j].setAttribute("d", j === hub || !vis || !seen(hub, rho) || ks[j] < 0.01 ? "" : arc(at(hub, rho), u, ks[j]));
      });
      SPARKS.forEach(([ox, oy, r, way], i) => {
        const pts = star(r * (1 + way * 0.35 * Math.sin(Math.PI * sk)), (sk * Math.PI) / 2), pt = (x, y, d) => P(...add(add(add(SC, e1, ox + x), e2, oy + y), v, d));
        sparks[i][0].setAttribute("d", poly(pts.map(([x, y]) => pt(x, y, -3))));
        sparks[i][1].setAttribute("d", poly(pts.map(([x, y]) => pt(x, y, 0))));
      });
    }
    dots.forEach((d) => { if (!tdone(d.p, now)) moving = true; });
    return moving;
  });
  bag.add(B.unregister);

  function setHub(h) {
    if (h === hub) return;
    const now = performance.now(), rho = sp.t;
    hub = h;
    // the nearest services in view are linked first
    const order = SV.map((_, j) => j).filter((j) => j !== h && seen(j, rho)).sort((a, b) => dot3(at(b, rho), at(h, rho)) - dot3(at(a, rho), at(h, rho)));
    links = SV.map(() => tween(0));
    order.forEach((j, rank) => tset(links[j], 1, now, rank * stag));
    dots.forEach((d) => { d.landed = false; });
    spin = tween(0); tset(spin, 1, now, 0);
  }

  const mid = P(0, 0, 0), rad = Math.hypot(P(...rim[0])[0] - mid[0], P(...rim[0])[1] - mid[1]);
  function aim(p) {
    const inside = p && Math.hypot(p[0] - mid[0], p[1] - mid[1]) < rad + 14;
    sp.t = inside ? REST + clamp((p[0] - mid[0]) / rad, -1, 1) * TURN : REST;
    setHub(facing(sp.t));
    read.textContent = inside ? `service ${hub + 1}` : "rest";
    B.wake();
  }
  aim(null);

  bag.add(pointer(stage, { move: aim, leave: () => aim(null) }));
  bag.add(() => svg.replaceChildren());

  return { set: (s) => { stag = clamp(s, 40, 260); }, destroy: bag.dispose };
}

hairline({
  name: "mcps",
  means: "A globe of services with the AI spark beside it: the pointer turns it, and links leap from the service facing you.",
  rules: [1, 2, 4, 5],
  range: [60, 120, 200],
  tour: [[120, 170], [290, 170], [205, 170], null],
  mount,
});
