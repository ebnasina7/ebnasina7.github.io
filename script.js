/* =========================================================
   Ebna Sina · Portfolio scripts
   ========================================================= */

/* ---------- Year in footer ---------- */
document.getElementById("year").textContent = new Date().getFullYear();

/* ---------- Nav: background on scroll + mobile menu ---------- */
const nav = document.getElementById("nav");
const toggle = document.getElementById("navToggle");
const links = document.getElementById("navLinks");

const onScroll = () => nav.classList.toggle("is-scrolled", window.scrollY > 30);
onScroll();
window.addEventListener("scroll", onScroll, { passive: true });

toggle.addEventListener("click", () => {
  const open = links.classList.toggle("is-open");
  toggle.setAttribute("aria-expanded", open);
  document.body.style.overflow = open ? "hidden" : "";
});
links.querySelectorAll("a").forEach((a) =>
  a.addEventListener("click", () => {
    links.classList.remove("is-open");
    toggle.setAttribute("aria-expanded", "false");
    document.body.style.overflow = "";
  })
);

/* ---------- Reveal on scroll ---------- */
const io = new IntersectionObserver(
  (entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) {
        e.target.classList.add("is-visible");
        io.unobserve(e.target);
      }
    });
  },
  { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
);
document.querySelectorAll(".reveal").forEach((el) => io.observe(el));

/* ---------- Nav: highlight the section in view ---------- */
const navLinks = [...links.querySelectorAll('a[href^="#"]')];
const spy = new IntersectionObserver(
  (entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      navLinks.forEach((a) => a.classList.toggle("is-active", a.getAttribute("href") === `#${e.target.id}`));
    });
  },
  { rootMargin: "-45% 0px -50% 0px" }
);
navLinks.forEach((a) => {
  const target = document.querySelector(a.getAttribute("href"));
  if (target) spy.observe(target);
});

/* ---------- Card spotlight follows the mouse ---------- */
document.querySelectorAll(".card").forEach((card) => {
  card.addEventListener("pointermove", (e) => {
    const r = card.getBoundingClientRect();
    card.style.setProperty("--mx", `${e.clientX - r.left}px`);
    card.style.setProperty("--my", `${e.clientY - r.top}px`);
  });
});

/* ---------- Hero: drifting data graph ----------
   Nodes drift around fixed anchors; nearby nodes are linked like a graph.
   A signal hops from node to node; the cursor lights up the nearest node.
   (The anchors happen to form a 4-3-3. Old habits.) */
(function dataGraph() {
  const canvas = document.getElementById("graph");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const LIME = "200, 245, 96";
  const CHALK = "238, 240, 242";
  const TEAL = "90, 180, 201";

  let w, h, dpr, players = [], mouse = { x: -9999, y: -9999 };
  let ball = { from: 0, to: 1, t: 0 };

  // Anchor points (x,y in 0..1), plus a few secondary nodes for texture.
  const shape = [
    [0.08, 0.5],
    [0.24, 0.18], [0.22, 0.4], [0.22, 0.6], [0.24, 0.82],
    [0.42, 0.3], [0.38, 0.5], [0.42, 0.7],
    [0.62, 0.2], [0.66, 0.5], [0.62, 0.8],
  ];
  const opp = [[0.55, 0.38], [0.52, 0.62], [0.76, 0.32], [0.78, 0.68], [0.9, 0.5]];

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = canvas.clientWidth;
    h = canvas.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Graph area: on narrow screens push it down so it sits behind/below text.
    const mobile = w < 760;
    const pad = mobile ? 0.04 : 0.06;
    const px = w * pad, pw = w * (1 - pad * 2);
    const py = mobile ? h * 0.52 : h * 0.12;
    const ph = mobile ? h * 0.44 : h * 0.76;
    pitchBox = { x: px, y: py, w: pw, h: ph };

    // On wide screens, squeeze the graph into the right side so the
    // network stays clear of the name and text on the left.
    const sx = (x) => (mobile ? x : 0.56 + x * 0.42);
    players = shape.map(([x, y], i) => makeDot(sx(x), y, true, i));
    opp.forEach(([x, y], i) => players.push(makeDot(sx(x), y, false, 100 + i)));
  }

  let pitchBox = { x: 0, y: 0, w: 0, h: 0 };
  function makeDot(x, y, team, seed) {
    return {
      bx: x, by: y, team,
      phase: seed * 1.7,
      speed: 0.25 + ((seed * 37) % 10) / 40,
      x: 0, y: 0,
    };
  }
  const toScreen = (x, y) => [pitchBox.x + x * pitchBox.w, pitchBox.y + y * pitchBox.h];

  function nextTarget(from) {
    // hop to another primary node, preferring ones further right
    const team = players.map((p, i) => i).filter((i) => players[i].team && i !== from);
    const fwd = team.filter((i) => players[i].bx >= players[from].bx - 0.03);
    const pool = fwd.length && Math.random() < 0.75 ? fwd : team;
    // occasionally restart from the leftmost node
    if (from >= 8 && Math.random() < 0.5) return 0;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  let last = performance.now();
  function frame(now) {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    const time = now / 1000;
    ctx.clearRect(0, 0, w, h);

    // positions
    players.forEach((p) => {
      const drift = reduceMotion ? 0 : 0.018;
      const nx = p.bx + Math.sin(time * p.speed + p.phase) * drift;
      const ny = p.by + Math.cos(time * p.speed * 0.8 + p.phase) * drift * 1.4;
      [p.x, p.y] = toScreen(nx, ny);
    });

    // nearest primary node to the cursor
    let hot = -1, best = 140 * 140;
    players.forEach((p, i) => {
      if (!p.team) return;
      const d = (p.x - mouse.x) ** 2 + (p.y - mouse.y) ** 2;
      if (d < best) { best = d; hot = i; }
    });

    // edges between nearby primary nodes
    const maxD = Math.min(pitchBox.w, pitchBox.h * 2) * 0.32;
    for (let i = 0; i < players.length; i++) {
      const a = players[i];
      if (!a.team) continue;
      for (let j = i + 1; j < players.length; j++) {
        const b = players[j];
        if (!b.team) continue;
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (d > maxD) continue;
        const lit = i === hot || j === hot;
        const alpha = (1 - d / maxD) * (lit ? 0.6 : 0.18);
        ctx.strokeStyle = `rgba(${lit ? LIME : CHALK}, ${alpha})`;
        ctx.lineWidth = lit ? 1.4 : 1;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
    }

    // dots
    players.forEach((p, i) => {
      const r = p.team ? (i === hot ? 7 : 4.5) : 3.5;
      if (p.team && i === hot) {
        ctx.fillStyle = `rgba(${LIME}, 0.15)`;
        ctx.beginPath(); ctx.arc(p.x, p.y, 18, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = p.team ? `rgba(${LIME}, ${i === hot ? 1 : 0.75})` : `rgba(${TEAL}, 0.55)`;
      ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
    });

    // signal
    if (!reduceMotion) {
      ball.t += dt / 1.1;
      if (ball.t >= 1) { ball.from = ball.to; ball.to = nextTarget(ball.from); ball.t = 0; }
    }
    const A = players[ball.from], B = players[ball.to];
    const e = ball.t < 0.5 ? 2 * ball.t * ball.t : 1 - Math.pow(-2 * ball.t + 2, 2) / 2;
    const bx = A.x + (B.x - A.x) * e, by = A.y + (B.y - A.y) * e;
    // signal trail
    ctx.strokeStyle = `rgba(${LIME}, 0.35)`;
    ctx.setLineDash([4, 6]);
    ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.lineTo(bx, by); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = `rgb(${CHALK})`;
    ctx.beginPath(); ctx.arc(bx, by, 3.5, 0, Math.PI * 2); ctx.fill();

    if (!reduceMotion) requestAnimationFrame(frame);
  }

  window.addEventListener("resize", resize);
  window.addEventListener("pointermove", (e) => {
    const r = canvas.getBoundingClientRect();
    mouse.x = e.clientX - r.left;
    mouse.y = e.clientY - r.top;
  });
  window.addEventListener("pointerleave", () => { mouse.x = mouse.y = -9999; });

  resize();
  requestAnimationFrame(frame);
})();
