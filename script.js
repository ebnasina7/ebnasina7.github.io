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

/* ---------- FootScout mini game: real neighbours from next/tools/build_scout.py ---------- */
(function scoutGame() {
  const START = ["Lionel Messi", "Kylian Mbappé", "Harry Kane", "Kevin De Bruyne", "Lamine Yamal", "Luka Modrić", "Virgil van Dijk"];
  const $ = (id) => document.getElementById(id);
  fetch("assets/data/scout.json").then((r) => r.json()).then(({ players }) => {
    const byName = new Map(players.map((p, i) => [p.n, i]));
    const queue = START.filter((n) => byName.has(n)).map((n) => byName.get(n));
    const shuffle = (a) => a.map((v) => [Math.random(), v]).sort((x, y) => x[0] - y[0]).map((x) => x[1]);
    let turn = 0;

    function pitch(svg, p, colour) {
      let s = "";
      [...p.h].forEach((d, k) => {
        if (d !== "0") s += `<rect x="${(k % 12) * 10}" y="${Math.floor(k / 12) * 10}" width="10" height="10" fill="${colour}" opacity="${(+d / 10 + 0.06).toFixed(2)}"/>`;
      });
      svg.innerHTML = s + '<rect class="l" x=".5" y=".5" width="119" height="79"/><line x1="60" y1="0" x2="60" y2="80"/><circle cx="60" cy="40" r="10"/><rect class="l" x=".5" y="18" width="18" height="44"/><rect class="l" x="101.5" y="18" width="18" height="44"/>';
      svg.setAttribute("aria-label", `Where ${p.n} touches the ball most`);
    }

    function ask() {
      const i = queue[turn], p = players[i], top = p.s[0][0];
      const near = new Set(p.s.map(([j]) => j).concat(i));
      const decoys = shuffle(players.map((_, j) => j).filter((j) => players[j].p === p.p && players[j].f && !near.has(j))).slice(0, 2);
      $("qName").textContent = p.n;
      $("answer").hidden = true;
      const box = $("opts");
      box.innerHTML = "";
      shuffle([top, ...decoys]).forEach((j) => {
        const b = document.createElement("button");
        b.type = "button"; b.className = "scout__opt"; b.textContent = players[j].n;
        if (j === top) b.dataset.top = "1";
        b.addEventListener("click", () => {
          box.querySelectorAll(".scout__opt").forEach((x) => { x.disabled = true; x.classList.toggle("is-model", !!x.dataset.top); });
          $("verdict").textContent = j === top ? `Same as the model: ${players[top].n}.` : `The model picked ${players[top].n}.`;
          pitch($("pitchA"), p, "#c8f560"); $("nameA").textContent = p.n;
          pitch($("pitchB"), players[top], "#5ab4c9"); $("nameB").textContent = players[top].n;
          $("answer").hidden = false;
        });
        box.appendChild(b);
      });
    }

    $("nextPlayer").addEventListener("click", () => { turn = (turn + 1) % queue.length; ask(); });
    ask();
    $("scout").hidden = false;
  }).catch(() => {});
})();

/* ---------- Photo stories: nothing loads until someone opens one ---------- */
(function photoStories() {
  const BASE = "assets/images/stories/";
  const STORIES = {
    football: ["Football", [
      ["frankfurt-bus", "On the bus to Frankfurt, September 2026", "Selfie with teammates on a coach"],
      ["frankfurt-team", "Frankfurt, before kick-off", "Team photo in white kits"],
      ["frankfurt-runnersup", "Runners-up, Desh Elite Cup 2026", "Ebna Sina with a trophy and a runners-up certificate under floodlights"],
      ["frankfurt-night", "Frankfurt, after the final", "The team on the pitch at night with a certificate"],
      ["darmstadt-trophy", "Champions in Darmstadt, May 2026", "Three players with medals and a large trophy"],
      ["darmstadt-selfie", "Darmstadt, medals on", "Selfie with the team wearing medals"],
      ["darmstadt-team", "Darmstadt", "Team photo in red kits"],
      ["berlin-number4", "Number 4, Berlin", "Ebna Sina in a white kit beside a goal"],
      ["berlin-award", "BFBC Football Excellence Award", "A small award held up in front of a pitch"],
    ]],
    travel: ["Travel", [
      ["berlin-gate", "Berlin, home since May 2025", "Ebna Sina at the Brandenburg Gate"],
      ["potsdam", "Sanssouci, Potsdam", "Ebna Sina by the yellow palace facade"],
      ["leipzig-scarf", "Leipzig, December 2025", "Ebna Sina in a stadium holding up a Bangladesh scarf"],
      ["leipzig-stadium", "Leipzig, under the lights", "A floodlit stadium during a match"],
      ["brest-harbour", "Brest, April 2026", "Ebna Sina by the harbour in a retro Germany shirt"],
      ["brest-green", "Brest", "Ebna Sina sitting on a low wall among trees"],
      ["bamberg-river", "Bamberg, May 2026", "The old town hall standing in the river"],
      ["bamberg-gate", "Bamberg's old town hall", "The painted gate of the old town hall"],
      ["barcelona-cathedral", "Barcelona, October 2026", "Ebna Sina on the steps of the cathedral"],
      ["barcelona-fog", "Tibidabo in the fog", "The temple disappearing into fog"],
      ["barcelona-view", "Above Barcelona", "Ebna Sina on a viewing platform over the city"],
      ["barcelona-sunset", "Above Barcelona, at sunset", "Ebna Sina on a wall above green hills"],
    ]],
    before: ["Before Berlin", [
      ["boat", "Bangladesh", "Ebna Sina on the bow of a painted wooden boat"],
      ["waterfall", "August 2021", "Ebna Sina lying on a fallen tree by a waterfall"],
      ["dhaka-turf", "Dhaka, October 2020", "Ebna Sina beside a floodlit pitch"],
      ["turf-night", "December 2022", "Ebna Sina in an orange kit on a floodlit pitch"],
      ["france-team", "", "A football team in blue kits behind a France sign"],
      ["finals-night", "", "Several teams lined up on a floodlit pitch"],
      ["celebration", "", "Teammates celebrating at the side of a pitch"],
      ["reading", "", "Ebna Sina reading in front of a full bookshelf"],
      ["balcony", "", "Ebna Sina on a balcony above city lights at night"],
    ]],
  };
  const $ = (id) => document.getElementById(id);
  const viewer = $("viewer"), bars = $("viewerBars"), img = $("viewerImg");
  const SECONDS = 5;
  const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let list = [], at = 0, paused = false, timer = 0;

  function reset() {
    clearTimeout(timer);
    document.body.style.overflow = "";
    img.removeAttribute("src");
    bars.innerHTML = "";
  }

  function closeViewer() {
    viewer.close();
    reset();
  }

  function show(n) {
    clearTimeout(timer);
    if (n < 0) n = 0;
    if (n >= list.length) { closeViewer(); return; }
    at = n;
    const [file, cap, alt] = list[at];
    img.src = `${BASE}${file}.jpg`;
    img.alt = alt;
    $("viewerCap").textContent = cap;
    [...bars.children].forEach((b, k) => {
      const fill = b.firstElementChild;
      fill.style.animation = "none";
      fill.style.width = k < at ? "100%" : "0";
      if (k === at) {
        if (paused) { fill.style.width = "100%"; return; }
        void fill.offsetWidth; // restart the animation
        fill.style.animation = `viewer-fill ${SECONDS}s linear forwards`;
      }
    });
    if (!paused) timer = setTimeout(() => show(at + 1), SECONDS * 1000);
    const next = list[at + 1];
    if (next) new Image().src = `${BASE}${next[0]}.jpg`;
  }

  function setPaused(p) {
    paused = p;
    $("viewerPause").textContent = p ? "Play" : "Pause";
    $("viewerPause").setAttribute("aria-label", p ? "Play" : "Pause");
    show(at);
  }

  function open(key) {
    const [title, photos] = STORIES[key];
    list = photos; paused = calm;
    $("viewerTitle").textContent = title;
    $("viewerPause").textContent = paused ? "Play" : "Pause";
    bars.innerHTML = list.map(() => "<i><b></b></i>").join("");
    document.body.style.overflow = "hidden";
    viewer.showModal();
    show(0);
  }

  document.querySelectorAll("[data-story]").forEach((b) => b.addEventListener("click", () => open(b.dataset.story)));
  $("viewerNext").addEventListener("click", () => show(at + 1));
  $("viewerPrev").addEventListener("click", () => show(at - 1));
  $("viewerPause").addEventListener("click", () => setPaused(!paused));
  $("viewerClose").addEventListener("click", closeViewer);
  viewer.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight") show(at + 1);
    if (e.key === "ArrowLeft") show(at - 1);
  });
  viewer.addEventListener("close", reset);
})();
