/**
 * Global data: a globe whose land is drawn in fine dots, set evenly over the
 * continents and nowhere on the sea, so the coasts are read from where the
 * dots stop; only the near half's dots are drawn, smaller towards the rim.
 * Dots here and there over the land light, taking the bright fill, the map's
 * data coming in there, most often over the Americas, Europe and Oceania.
 * At rest the globe faces Europe and Africa, a scatter of dots lit. While the pointer is over
 * the globe it turns west, slowly and evenly, to the Americas, Asia and round
 * to Europe again, and dots light and fade here and there over the land in
 * view, one after another. Let go, it turns on the same way until it comes
 * round to its rest turn and slows into it, never back, and the rest's lit dots
 * light again. The slider is the time of one turn, in seconds.
 *
 * The pattern: ambient motion that runs only under the pointer, through
 * register, run on to a full turn and slowed into rest. The land is a test of each dot's longitude
 * and latitude against coarse outlines of the continents, made once; the hit
 * test is the globe's disc on screen, which never moves.
 */
const {
  Cam, clamp, fit, poly, proj, unproj, reducedMotion, disposer, mk, place, pointer, register,
} = HL;
const R = 66, LAT = 22, LONR = 18, SPACING = 2.6, DOT = 0.34 * SPACING, PATCHES = 46, REST_LIT = 20, LIFE = 2.8, BRAKE = 1.6;
// the continents, coarse outlines of longitude and latitude in degrees
const LAND = [
  [[-168, 66], [-162, 70], [-140, 70], [-125, 70], [-95, 72], [-80, 73], [-62, 66], [-56, 52], [-66, 45], [-70, 42], [-76, 35], [-81, 31], [-80, 25], [-83, 29], [-90, 30], [-97, 27], [-97, 21], [-87, 21], [-88, 15], [-83, 9], [-78, 8], [-86, 12], [-92, 15], [-105, 20], [-110, 23], [-115, 30], [-118, 34], [-124, 40], [-124, 48], [-132, 55], [-140, 60], [-152, 59], [-165, 55], [-158, 58], [-165, 62]],
  [[-55, 60], [-44, 60], [-20, 70], [-18, 80], [-35, 83], [-60, 82], [-72, 78], [-58, 75], [-52, 68]],
  [[-24, 64], [-14, 64], [-14, 66.5], [-22, 66.5]],
  [[-80, 8], [-72, 12], [-62, 10], [-50, 0], [-35, -5], [-39, -15], [-48, -26], [-58, -36], [-65, -42], [-68, -52], [-74, -52], [-73, -40], [-71, -30], [-70, -18], [-76, -14], [-81, -5], [-80, 1], [-77, 7]],
  [[-10, 36], [-9, 43], [-2, 44], [-5, 48], [2, 51], [8, 54], [10, 58], [5, 62], [15, 69], [25, 71], [40, 67], [60, 69], [70, 73], [90, 76], [110, 77], [130, 72], [150, 71], [170, 70], [180, 66], [178, 62], [163, 60], [160, 54], [143, 59], [137, 54], [140, 48], [132, 43], [128, 39], [126, 35], [121, 31], [122, 25], [110, 20], [108, 15], [105, 9], [103, 2], [100, 4], [98, 10], [98, 16], [94, 17], [90, 22], [86, 20], [80, 15], [77, 8], [73, 18], [70, 22], [66, 25], [57, 26], [56, 23], [59, 22], [52, 16], [43, 13], [39, 21], [34, 28], [35, 32], [33, 36], [27, 37], [26, 40], [23, 36], [19, 40], [13, 45], [16, 40], [12, 38], [8, 44], [3, 43], [0, 39], [-6, 36]],
  [[-5, 50], [1, 51], [2, 53], [-2, 57], [-3, 59], [-6, 58], [-5, 55], [-3, 54], [-5, 52]],
  [[-17, 21], [-17, 15], [-12, 8], [-8, 4], [0, 5], [9, 4], [9, -1], [13, -10], [12, -17], [15, -27], [18, -34], [25, -34], [33, -28], [35, -20], [40, -15], [40, -10], [39, -4], [43, 0], [51, 11], [44, 11], [43, 12], [38, 18], [34, 28], [32, 31], [20, 32], [10, 37], [0, 36], [-6, 35], [-10, 30], [-14, 26]],
  [[44, -25], [47, -25], [50, -15], [49, -12], [44, -17]],
  [[130, 31], [135, 34], [140, 35], [142, 40], [141, 45], [140, 42], [136, 37], [131, 34]],
  [[95, 5], [98, 4], [106, -6], [104, -6], [100, -2]],
  [[109, 1], [113, -3], [117, -4], [119, 1], [117, 7], [113, 3]],
  [[131, -1], [141, -3], [150, -10], [143, -9], [138, -8]],
  [[114, -22], [114, -34], [118, -35], [123, -34], [131, -31], [138, -35], [140, -38], [146, -39], [150, -37], [153, -28], [153, -25], [146, -19], [145, -15], [142, -11], [141, -17], [136, -12], [131, -11], [126, -14], [122, -18]],
  [[172, -34], [178, -38], [174, -41], [166, -46], [169, -47], [174, -42]],
];
// how often each outline's dots light: North and South America, Australia, New Zealand and New Guinea most
const WEIGHT = { 0: 4, 3: 3, 11: 3, 12: 5, 13: 4 };
const inside = (x, y, q) => {
  let c = false;
  for (let i = 0, j = q.length - 1; i < q.length; j = i++)
    if ((q[i][1] > y) !== (q[j][1] > y) && x < ((q[j][0] - q[i][0]) * (y - q[i][1])) / (q[j][1] - q[i][1]) + q[i][0]) c = !c;
  return c;
};
/** The land's dots, spaced d degrees apart along and across, as [lon, lat] in radians and the outline each falls in. */
const dotsAt = (d) => {
  const out = [];
  for (let lat = -58; lat <= 82; lat += d) {
    const step = d / Math.cos((lat * Math.PI) / 180);
    for (let lon = -180 + (((lat / d) % 2) * step) / 2; lon < 180; lon += step)
      { const k = LAND.findIndex((q) => inside(lon, lat, q)); if (k >= 0) out.push([(lon * Math.PI) / 180, (lat * Math.PI) / 180, k]); }
  }
  return out;
};

const add = (a, b, k = 1) => a.map((v, i) => v + b[i] * k);
const unit = (a) => { const l = Math.hypot(...a); return a.map((v) => v / l); };
const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const sph = (lon, lat) => [Math.cos(lat) * Math.cos(lon), Math.cos(lat) * Math.sin(lon), Math.sin(lat)];

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  const C = Cam(45, 0.5, 1.7);
  // the line of sight, and two directions across the screen: the globe's rim lies in their plane
  const [x0, y0] = unproj(C, 200, 160, 0), [x1, y1] = unproj(C, 200, 160, 1);
  const v = unit([x1 - x0, y1 - y0, 1]), e1 = unit(cross([0, 0, 1], v)), e2 = cross(v, e1);
  const rim = Array.from({ length: 96 }, (_, k) => { const t = (k / 96) * Math.PI * 2; return add(e1.map((c) => c * Math.cos(t) * R), e2, Math.sin(t) * R); });
  fit(C, rim, 200, 166);
  const P = proj(C), on = (u) => P(...u.map((c) => c * R));
  // the longitude that faces the viewer; the globe turned by rho brings longitude L round to rho - L, so east is to the right
  // the facing longitude: at rest the globe faces Europe and Africa, LONR; it turns west, to the Americas, Asia and round
  const deg = Math.PI / 180, LV = Math.atan2(v[1], v[0]), REST = LV + LONR * deg;

  const g = mk("g", {}, svg);
  mk("path", { class: "sil", d: poly(rim.map((p) => P(...p))) }, g);
  // the land's dots, all in one path, so a frame writes one string
  const field = mk("path", { class: "dot m" }, g), lit = mk("g", {}, g);
  const pts = dotsAt(SPACING);
  // the globe leans its north towards the viewer, about the screen's across, so latitude LAT faces us
  const turn = (a) => (u) => { const k = e1, c = Math.cos(a), sn = Math.sin(a), kd = dot3(k, u), kx = cross(k, u); return u.map((x, j) => x * c + kx[j] * sn + k[j] * kd * (1 - c)); };
  const tilts = [1, -1].map((sg) => turn(sg * (LAT * deg - Math.asin(v[2]))));
  const tilt = tilts.reduce((b, t) => (dot3(t(sph(LV, LAT * deg)), v) > dot3(b(sph(LV, LAT * deg)), v) ? t : b));
  const at = (i, rho) => tilt(sph(rho - pts[i][0], pts[i][1]));

  // a seeded draw, so the rest's lit patches are the same every time
  let seed = 11;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  /** A lit dot: a land dot in view, clear of the other lit ones. */
  const patch = (rho, others, seen = 0.3) => {
    // weighted: the Americas, Europe and Oceania light most, the rest of the land now and then
    const cand = [], wts = [];
    pts.forEach(([lo, , k], i) => { if (dot3(at(i, rho), v) > seen) { cand.push(i); wts.push((WEIGHT[k] ?? 1) * (k === 4 && lo < 40 * deg ? 4 : 1)); } });
    const sum = wts.reduce((a, b) => a + b, 0);
    for (let n = 0; ; n++) {
      let x = rnd() * sum, j = 0;
      while (x > wts[j] && j < wts.length - 1) x -= wts[j++];
      const c = cand[j], u = at(c, rho);
      if (others.every((o) => !o.c || o.c === c || dot3(at(o.c, rho), u) < 0.996) || n > 60) return { c };
    }
  };
  // the lit dots, scattered: each lights over the middle of its life and goes back to the field; the first REST_LIT are the rest's
  const patches = [];
  for (let k = 0; k < PATCHES; k++) {
    const p = k < REST_LIT ? patch(REST, patches, 0.45) : { c: 0 };
    patches.push({ c: p.c, rest: k < REST_LIT ? p : null, ph: k < REST_LIT ? 0.5 : 2, el: mk("circle", { r: 0, class: "dot m" }, lit), cls: "" });
  }
  const litAt = (q) => q.ph > 0.12 && q.ph < 0.7;
  // a dot that moves on takes the field's fill there at once, and eases to the bright one
  const fill = (q, p) => { q.c = p.c; q.el.setAttribute("class", (q.cls = "dot m")); };

  let rho = REST, live = false, spinning = false, brake = null, period = value, drawn = "";
  function draw() {
    const key = rho.toFixed(5) + patches.map((q) => q.c + (litAt(q) ? "+" : "-")).join();
    if (key === drawn) return;
    drawn = key;
    let d = "";
    const r0 = (f) => DOT * (0.45 + 0.55 * Math.sqrt(f));
    pts.forEach((_, i) => {
      const u = at(i, rho), f = dot3(u, v);
      if (f <= 0.04) return;
      const r = r0(f), [x, y] = on(u);
      d += `M${(x - r).toFixed(1)} ${y.toFixed(1)}a${r.toFixed(2)} ${r.toFixed(2)} 0 1 0 ${(2 * r).toFixed(2)} 0a${r.toFixed(2)} ${r.toFixed(2)} 0 1 0 ${(-2 * r).toFixed(2)} 0`;
    });
    field.setAttribute("d", d);
    // a lit dot takes the bright fill, a touch larger; the fill eases in and out on its own
    patches.forEach((q) => {
      const cls = litAt(q) ? "dot" : "dot m";
      const u = at(q.c, rho), f = dot3(u, v);
      q.el.setAttribute("r", q.rest || q.ph < 1 ? (f > 0.04 ? (r0(f) * 1.5).toFixed(2) : 0) : 0);
      place(q.el, on(u));
      if (cls !== q.cls) q.el.setAttribute("class", (q.cls = cls));
    });
  }

  const B = register(stage, (dt, now) => {
    let moving = false;
    const w = (Math.PI * 2) / period;
    if (reducedMotion()) { spinning = false; brake = null; rho = REST; }
    else if (live) { rho -= w * dt; spinning = true; brake = null; }
    else if (brake) {
      // the last stretch home, slowing from the turn's own speed to a stop, so nothing jumps
      const f = clamp((now - brake.t0) / brake.T, 0, 1);
      rho = brake.from - brake.d * (1 - (1 - f) ** 3);
      if (f >= 1) { rho = REST; brake = null; spinning = false; }
    } else if (spinning) {
      // let go, it turns on the same way to its rest turn, never back
      const d = (((rho - REST) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
      if (d <= (w * BRAKE) / 3) brake = { from: rho, d, T: Math.max(0.05, (3 * d) / w) * 1000, t0: now };
      else rho -= w * dt;
    }
    if (spinning) moving = true;
    patches.forEach((q, k) => {
      if (spinning) {
        // while it turns each dot lives LIFE, at its own pace, then lights somewhere else in view; an idle one
        // starts after a wait of its own, so they never light together
        q.ph += (dt / LIFE) * (0.8 + 0.4 * ((k * 0.618) % 1));
        if (q.ph >= 1) { q.ph = q.rest || q.ph < 1.5 ? q.ph - 1 : -rnd() * 1.2; fill(q, patch(rho, patches.filter((o) => o !== q))); }
        moving = true;
      } else if (q.rest ? q.c !== q.rest.c || q.ph !== 0.5 : q.ph < 2) {
        // let go, each runs out its life; the rest's lit dots light again where they were
        q.ph = Math.min(1, q.ph + dt / LIFE);
        if (q.ph >= 1) { if (q.rest) { fill(q, q.rest); q.ph = 0.5; } else q.ph = 2; }
        if (reducedMotion()) { if (q.rest) fill(q, q.rest); q.ph = q.rest ? 0.5 : 2; }
        moving = true;
      }
    });
    draw();
    return moving;
  });
  bag.add(B.unregister);

  const mid = P(0, 0, 0), rad = Math.hypot(P(...rim[0])[0] - mid[0], P(...rim[0])[1] - mid[1]);
  function setOn(o) {
    if (o === live) return;
    live = o;
    read.textContent = live ? "live" : "rest";
    B.wake();
  }
  read.textContent = "rest";

  bag.add(pointer(stage, { move: (p) => setOn(Math.hypot(p[0] - mid[0], p[1] - mid[1]) < rad + 14), leave: () => setOn(false) }));
  bag.add(() => svg.replaceChildren());

  return { set: (s) => { period = clamp(s, 10, 60); }, destroy: bag.dispose };
}

hairline({
  name: "global-data",
  means: "A globe whose land is drawn in fine dots: over it the globe turns, a full turn and on, and dots light on the land as data comes in.",
  rules: [1, 4, 5, 7],
  range: [40, 30, 20],
  tour: [[200, 165], [240, 140], [170, 190], null],
  mount,
});
