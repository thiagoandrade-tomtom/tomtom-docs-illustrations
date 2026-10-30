/**
 * APIs: a map served on request. On the ground, a three-by-three grid of map
 * tiles, roads running across them, and one tile missing: its slot is a
 * dashed outline. Low over the slot hangs the service, a server unit with
 * two lights, a dashed drop from it to the slot, and two smaller services
 * either side of it, joined to it by lines. When the pointer comes over the
 * figure a request, a short bright run, climbs the drop to the service; the
 * service calls the other two, a pulse running out along each line and back;
 * then the missing tile comes down out of the service's underside, its piece
 * of road on it, and lands in its slot, bright: the response. At rest the
 * service carries the bright edge. The slider is the length of the request.
 *
 * The pattern: a request, its calls, then its answer, on tweens in turn. The
 * hit test is the rest pose's box on screen, which never moves.
 */
const {
  Cam, clamp, facing, fit, open, poly, prism, proj, rings, seg,
  tdone, tset, tval, tween, disposer, mk, pointer, put, register, solid,
} = HL;

const TS = 30, GAP = 3, TT = 2.5, MISS = [2, 0], SZ0 = 44, SZ1 = 58, ROADS_Y = [15, 49.5], ROADS_X = [81, 15];
const X = (i) => i * (TS + GAP), MX = X(MISS[0]) + TS / 2, MY = X(MISS[1]) + TS / 2;
// the two services the main one calls: their middles, beside it at its height
const PEERS = [[MX - 6, MY - 84], [MX + 84, MY + 6]];
const PW = 13, PZ0 = SZ0 + 2, PZ1 = SZ1 - 2, CALL = 180, PULSE = 20;

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  let len = value;
  const C = Cam(45, 0.5, 1.6);
  const E = X(2) + TS;
  fit(C, [[0, 0, 0], [E, E, 0], [E, 0, 0], [0, E, 0], [MX - 22, MY - 18, SZ1], [PEERS[0][0] - PW, PEERS[0][1] - PW, PZ1], [PEERS[1][0] + PW, PEERS[1][1] + PW, PZ0]], 200, 166);
  const P = proj(C), front = facing(C);

  /** A tile's roads at height z: every road that crosses it, cut to its edges. */
  const marks = (x0, y0, z) => {
    let d = "";
    for (const y of ROADS_Y) if (y > y0 && y < y0 + TS) d += seg(P(x0 + 2, y, z), P(x0 + TS - 2, y, z));
    for (const x of ROADS_X) if (x > x0 && x < x0 + TS) d += seg(P(x, y0 + 2, z), P(x, y0 + TS - 2, z));
    return d;
  };

  const g = mk("g", {}, svg);
  const [mr] = rings(X(MISS[0]), X(MISS[1]), X(MISS[0]) + TS, X(MISS[1]) + TS, 3, 1);
  mk("path", { class: "dash nf", d: poly(mr.map((q) => P(q.u, q.v, 0))) }, g);
  mk("path", { class: "dash nf", d: seg(P(MX, MY, 0), P(MX, MY, SZ0)) }, g);

  // the tiles, far to near; the missing one is drawn where it is, at any height, in its place in the order
  const cells = [];
  for (let s = 0; s <= 4; s++) for (let i = 0; i < 3; i++) { const j = s - i; if (j >= 0 && j < 3) cells.push([i, j]); }
  let drop = null;
  for (const [i, j] of cells) {
    const grp = mk("g", {}, g), x0 = X(i), y0 = X(j), [ring, inner] = rings(x0, y0, x0 + TS, y0 + TS, 3, 1);
    const s = solid(grp), m = mk("path", { class: "nf" }, grp);
    const draw = (z) => { put(s, prism(P, front, ring, inner, z, z + TT)); m.setAttribute("d", marks(x0, y0, z + TT)); };
    if (i === MISS[0] && j === MISS[1]) drop = { s, m, draw };
    else draw(0);
  }

  const packet = mk("path", { class: "nf hi" }, g);
  // the lines between the services, at their middle height, and the pulses on them
  const ZM = (SZ0 + SZ1) / 2, line = (p) => [P(MX, MY, ZM), P(p[0], p[1], ZM)];
  mk("path", { class: "nf", d: PEERS.map((p) => open(line(p))).join("") }, g);
  const pulses = PEERS.map(() => mk("path", { class: "nf hi" }, g));

  /** A server unit centred on (cx, cy), half-sizes hx, hy, from z0 to z1, with a light on its near face. */
  const unit = (cx, cy, hx, hy, z0, z1) => {
    const [r, i] = rings(cx - hx, cy - hy, cx + hx, cy + hy, 4, 1.4), s = solid(g);
    put(s, prism(P, front, r, i, z0, z1));
    const fy = cy + hy, zm = (z0 + z1) / 2;
    mk("path", { class: "nf lo", d: seg(P(cx - hx + 6, fy, zm - 2), P(cx + 2, fy, zm - 2)) + seg(P(cx - hx + 6, fy, zm + 2), P(cx + 2, fy, zm + 2)) }, g);
    const light = mk("path", { class: "nf lo", d: seg(P(cx + hx - 9, fy, zm), P(cx + hx - 6, fy, zm)) }, g);
    return { s, light };
  };
  // far to near: the peer behind, the main service, the peer in front
  const peer0 = unit(PEERS[0][0], PEERS[0][1], PW, PW - 2, PZ0, PZ1);
  const service = unit(MX, MY, 22, 18, SZ0, SZ1);
  const peer1 = unit(PEERS[1][0], PEERS[1][1], PW, PW - 2, PZ0, PZ1);
  const peers = [peer0, peer1];

  const q = tween(0), calls = PEERS.map(() => tween(0)), h = tween(1);
  let drawn = "", act = false, state = "";
  function paint(st) {
    if (st === state) return;
    state = st;
    service.s.sil.classList.toggle("hi", st === "rest");
    service.light.setAttribute("class", st === "call" || st === "tile" ? "nf" : "nf lo");
    peers.forEach((p) => p.light.setAttribute("class", st === "call" ? "nf" : "nf lo"));
    drop.s.sil.classList.toggle("hi", st === "tile");
    read.textContent = st === "rest" ? "rest" : st === "tile" ? "tile" : st === "call" ? "calling" : "request";
  }

  const B = register(stage, (_dt, now) => {
    const qv = tval(q, now), hv = tval(h, now), cv = calls.map((c) => tval(c, now));
    const key = [qv, hv, ...cv, len].join();
    if (key !== drawn) {
      drawn = key;
      const top = qv * (SZ0 + len);
      packet.setAttribute("d", qv <= 0 || qv >= 1 ? "" : seg(P(MX, MY, clamp(top - len, 0, SZ0)), P(MX, MY, clamp(top, 0, SZ0))));
      // a call runs out to its service and back: out on the first half, home on the second
      cv.forEach((c, i) => {
        if (c <= 0 || c >= 1) { pulses[i].setAttribute("d", ""); return; }
        const [a, b] = line(PEERS[i]), t = c < 0.5 ? c * 2 : 2 - c * 2, L = Math.hypot(b[0] - a[0], b[1] - a[1]);
        const f = (k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k], k1 = clamp(t, 0, 1), k0 = clamp(t - PULSE / L, 0, 1);
        pulses[i].setAttribute("d", open([f(k0), f(k1)]));
      });
      // the tile hangs inside the service while it is not wanted, and is drawn only below it
      if (hv > 0.985) { put(drop.s, { sil: "", crease: "" }); drop.m.setAttribute("d", ""); }
      else drop.draw(hv * (SZ0 - TT - 1));
    }
    const calling = cv.some((c) => c > 0 && c < 1);
    paint(!act ? (hv < 0.985 ? "tile" : "rest") : qv < 0.9 && !calling ? "request" : calling || hv > 0.97 ? "call" : "tile");
    return !tdone(q, now) || !tdone(h, now) || calls.some((c) => !tdone(c, now));
  });
  bag.add(B.unregister);

  function setActive(a) {
    if (a === act) return;
    act = a;
    const now = performance.now();
    if (a) {
      tset(q, 1, now, 0);
      calls.forEach((c, i) => { calls[i] = tween(0); tset(calls[i], 1, now, CALL + i * 90); });
      tset(h, 0, now, CALL + 820);
    } else { tset(h, 1, now, 0); tset(q, 0, now, 0); calls.forEach((c, i) => { calls[i] = tween(0); }); }
    B.wake();
  }
  paint("rest");

  /** Inside the rest pose's box on screen. */
  const box = [P(0, 0, 0), P(E, E, 0), P(E, 0, 0), P(0, E, 0), P(PEERS[0][0], PEERS[0][1] - PW, PZ1), P(PEERS[1][0] + PW, PEERS[1][1], PZ0)];
  const xs = box.map((p) => p[0]), ys = box.map((p) => p[1]);
  const hit = ([x, y]) => x > Math.min(...xs) - 10 && x < Math.max(...xs) + 10 && y > Math.min(...ys) - 10 && y < Math.max(...ys) + 10;

  bag.add(pointer(stage, { move: (p) => setActive(hit(p)), leave: () => setActive(false) }));
  bag.add(() => svg.replaceChildren());

  return { set: (v) => { len = clamp(v, 8, 30); B.wake(); }, destroy: bag.dispose };
}

hairline({
  name: "apis",
  means: "A map grid missing a tile: a request climbs to the service, it calls two others, and the tile comes down into its slot.",
  rules: [1, 4, 5, 6],
  range: [10, 16, 26],
  tour: [[200, 200], [180, 230], null],
  mount,
});
