(function () {
  "use strict";

  const VIDEO_ID = "a1Iu90A8vqU";
  const BEATS = window.BEATS;            // [[time, count 1-8], ...]
  const TIMES = BEATS.map((b) => b[0]);
  const params = new URLSearchParams(location.search);
  const STILL = params.has("t");         // ?t=12.5 draws one frame without the video (for testing)
  const $ = (id) => document.getElementById(id);

  const store = {
    get(key, fallback) { try { const v = localStorage.getItem(key); return v === null ? fallback : v; } catch (e) { return fallback; } },
    set(key, value) { try { localStorage.setItem(key, value); } catch (e) { /* storage blocked */ } },
  };

  // ───────────────────────── settings ─────────────────────────
  const SYNC_MS = -95;                   // ms the video runs behind the annotated beats
  const settings = {
    music: Number(store.get("music", 100)),
    click: Number(store.get("click", 70)),
    mode: store.get("mode", "steps") === "ones" ? "ones" : "steps",
  };

  // ───────────────────────── video clock ─────────────────────────
  // The YouTube API only reports the position now and then, so between reports it is extended with
  // the system clock and pulled towards each fresh report.
  let player = null, ready = false;
  const clock = { playing: false, anchorT: 0, anchorPerf: 0, lastYt: null, rate: 1 };

  function videoTime() {
    if (STILL) return Number(params.get("t"));
    if (!ready) return 0;
    const now = performance.now();
    const yt = player.getCurrentTime();
    if (player.getPlayerState() !== 1) {          // not playing
      clock.playing = false;
      return yt;
    }
    if (!clock.playing) {                          // just started or sought
      Object.assign(clock, { playing: true, anchorT: yt, anchorPerf: now, lastYt: yt, rate: player.getPlaybackRate() });
    }
    const est = clock.anchorT + ((now - clock.anchorPerf) / 1000) * clock.rate;
    if (Math.abs(yt - est) > 0.25) {               // jumped
      Object.assign(clock, { anchorT: yt, anchorPerf: now, lastYt: yt });
      return yt;
    }
    if (yt !== clock.lastYt) {                     // a fresh report: correct gently
      clock.lastYt = yt;
      clock.anchorT += 0.12 * (yt - est);
    }
    return clock.anchorT + ((now - clock.anchorPerf) / 1000) * clock.rate;
  }
  const songTime = () => videoTime() - SYNC_MS / 1000;

  // ───────────────────────── click track ─────────────────────────
  let ctx = null, master = null, horizon = null;

  function ensureAudio() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC({ latencyHint: "interactive" });
      master = ctx.createGain();
      master.gain.value = settings.click / 100;
      master.connect(ctx.destination);
    }
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    return ctx;
  }

  function wanted(count) {
    if (settings.mode === "ones") return count === 1 || count === 5;
    return count !== 4 && count !== 8;
  }

  function click(when, count) {
    const osc = ctx.createOscillator(), env = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.value = count === 1 ? 1700 : 1150;
    const peak = count === 1 ? 1 : 0.65;
    env.gain.setValueAtTime(0.0001, when);
    env.gain.linearRampToValueAtTime(peak, when + 0.002);
    env.gain.exponentialRampToValueAtTime(0.0001, when + 0.06);
    osc.connect(env).connect(master);
    osc.start(when);
    osc.stop(when + 0.08);
  }

  function lowerBound(arr, x) {
    let lo = 0, hi = arr.length;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (arr[mid] < x) lo = mid + 1; else hi = mid; }
    return lo;
  }

  // Clicks are handed to the audio clock slightly ahead, so they land on the beat to the sample
  // instead of on the next tick of this timer.
  function tick() {
    if (STILL) return;
    const t = songTime();
    if (!ready || !clock.playing) { horizon = null; return; }
    const ac = ensureAudio();
    if (!ac) return;
    const until = t + 0.15;
    if (horizon === null || horizon > until || t - horizon > 0.5) horizon = t;   // start or seek
    for (let k = lowerBound(TIMES, horizon); k < TIMES.length && TIMES[k] < until; k++) {
      const delay = (TIMES[k] - t) / clock.rate;
      if (delay > -0.03 && wanted(BEATS[k][1]) && settings.click > 0) click(ac.currentTime + Math.max(delay, 0), BEATS[k][1]);
    }
    horizon = until;
    $("audioStatus").textContent = ac.state === "running" ? ""
      : "The browser is holding back the click sound until you click anywhere on this page once.";
  }
  setInterval(tick, 25);
  for (const type of ["pointerdown", "keydown"]) window.addEventListener(type, () => { if (!STILL) ensureAudio(); }, { passive: true });

  // ───────────────────────── drawing ─────────────────────────
  const W = 640, H = 610, S = 80;            // logical canvas size and pixels per step
  const SHOE = 1.2;                          // shoe size relative to the drawn shapes
  const canvas = $("stage"), g = canvas.getContext("2d");
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = W * dpr;
  canvas.height = H * dpr;

  // The dancer nearest to the viewer faces up the screen (dir +1), the other faces down (dir -1).
  // "View as follower" swaps the two places, so the follower's steps are seen from behind.
  const KINDS = { leader: { kind: "shoe", label: "Leader" }, follower: { kind: "heel", label: "Follower" } };
  const SPOTS = {
    near: { cx: W / 2, base: 395, dir: 1, labelY: H - 16 },
    far: { cx: W / 2, base: 165, dir: -1, labelY: 28 },
  };
  let followerView = store.get("view", "leader") === "follower";
  const dancerOf = (role) => ({ ...KINDS[role], ...SPOTS[(role === "follower") === followerView ? "near" : "far"] });

  function drawFloor() {
    const grad = g.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, "#5a3b27"); grad.addColorStop(1, "#47301f");
    g.fillStyle = grad;
    g.fillRect(0, 0, W, H);
    g.strokeStyle = "rgba(0,0,0,0.18)"; g.lineWidth = 1;
    for (let x = 40; x < W; x += 80) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); }
    g.setLineDash([6, 8]); g.strokeStyle = "rgba(255,255,255,0.12)";
    g.beginPath(); g.moveTo(W / 2, 0); g.lineTo(W / 2, H); g.stroke();
    for (const y of [SPOTS.near.base, SPOTS.far.base]) {      // each dancer's central position
      g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke();
    }
    g.setLineDash([]);
  }

  // men's black patent leather dance shoe (oxford), shining
  function shoePath() {                  // slim oxford: rounded toe, narrow waist, rounded heel
    g.beginPath();
    g.moveTo(0, -39);
    g.bezierCurveTo(7, -39, 11.8, -28, 12.4, -12);
    g.bezierCurveTo(12.8, 4, 11.5, 22, 7, 32);
    g.bezierCurveTo(4.5, 35.8, -4.5, 35.8, -7, 32);
    g.bezierCurveTo(-11.5, 22, -12.8, 4, -12.4, -12);
    g.bezierCurveTo(-11.8, -28, -7, -39, 0, -39);
    g.closePath();
  }

  function drawDanceShoe() {
    g.save(); g.scale(1.1, 1.03); shoePath(); g.fillStyle = "#4a4743"; g.fill(); g.restore();            // sole edge
    const gloss = g.createLinearGradient(-13, 0, 13, 0);                                                  // lacquered upper
    gloss.addColorStop(0, "#050506"); gloss.addColorStop(0.3, "#2b2c31");
    gloss.addColorStop(0.5, "#0c0c0e"); gloss.addColorStop(1, "#050506");
    shoePath(); g.fillStyle = gloss; g.fill();
    g.strokeStyle = "#000"; g.lineWidth = 1.2; g.stroke();
    g.strokeStyle = "rgba(255,255,255,0.13)"; g.lineWidth = 1; g.lineCap = "round";                      // toe cap seam
    g.beginPath(); g.moveTo(-11.2, -20); g.quadraticCurveTo(0, -13.5, 11.2, -20); g.stroke();
    g.strokeStyle = "rgba(255,255,255,0.22)"; g.lineWidth = 1;                                            // laces
    for (let i = 0; i < 4; i++) { const y = -8 + i * 4.6; g.beginPath(); g.moveTo(-5.6, y); g.lineTo(5.6, y); g.stroke(); }
    g.beginPath(); g.ellipse(0, 22.5, 6.8, 8, 0, 0, Math.PI * 2); g.fillStyle = "#020203"; g.fill();        // ankle opening
    g.strokeStyle = "rgba(255,255,255,0.18)"; g.lineWidth = 1; g.stroke();
    g.strokeStyle = "rgba(255,255,255,0.75)"; g.lineWidth = 2.2;                                          // shine on the toe
    g.beginPath(); g.moveTo(-6.6, -30.5); g.quadraticCurveTo(-4.4, -36, 2, -36.4); g.stroke();
    g.strokeStyle = "rgba(255,255,255,0.28)"; g.lineWidth = 3;                                            // long reflection
    g.beginPath(); g.moveTo(-7.8, -14); g.quadraticCurveTo(-9.2, 2, -7, 15); g.stroke();
    g.strokeStyle = "rgba(255,255,255,0.14)"; g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(8.8, -16); g.quadraticCurveTo(10, 0, 8.2, 13); g.stroke();
  }

  function heelPath() {
    g.beginPath();
    g.moveTo(0, -39);
    g.bezierCurveTo(7, -31, 11, -14, 10, 0);
    g.bezierCurveTo(10, 14, 8, 26, 0, 31);
    g.bezierCurveTo(-8, 26, -10, 14, -10, 0);
    g.bezierCurveTo(-11, -14, -7, -31, 0, -39);
    g.closePath();
  }

  function drawHeel() {
    g.beginPath(); g.arc(0, 35, 3.6, 0, Math.PI * 2); g.fillStyle = "#1d1b19"; g.fill();               // stiletto
    heelPath(); g.fillStyle = "#cc2142"; g.fill(); g.strokeStyle = "#6e0d20"; g.lineWidth = 1.3; g.stroke();
    g.beginPath(); g.moveTo(0, -37); g.bezierCurveTo(4, -30, 6, -20, 6, -12);                            // shine
    g.strokeStyle = "rgba(255,255,255,0.45)"; g.lineWidth = 2; g.lineCap = "round"; g.stroke();
    g.beginPath(); g.ellipse(0, 12, 6.2, 15, 0, 0, Math.PI * 2); g.fillStyle = "#f3cfd6"; g.fill();      // opening
    g.strokeStyle = "#6e0d20"; g.lineWidth = 1; g.stroke();
    g.beginPath(); g.moveTo(-9.5, 20); g.lineTo(9.5, 20);                                                // ankle strap
    g.strokeStyle = "#6e0d20"; g.lineWidth = 3; g.stroke();
  }

  function drawFoot(dancer, role, foot, state, glowAmount) {
    const [sx, sy] = [dancer.cx + dancer.dir * state.x * S, dancer.base - dancer.dir * state.y * S];
    const angle = (dancer.dir === 1 ? 0 : Math.PI) + (foot === "R" ? 0.08 : -0.08);
    const shape = dancer.kind === "shoe" ? shoePath : heelPath;
    const lift = state.lift;

    g.save();                                           // shadow
    g.translate(sx + 3 + 9 * lift, sy + 5 + 12 * lift);
    g.rotate(angle); g.scale(SHOE * (1 + 0.04 * lift), SHOE * (1 + 0.04 * lift));
    shape(); g.fillStyle = `rgba(0,0,0,${0.33 - 0.12 * lift})`; g.fill();
    g.restore();

    g.save();
    g.translate(sx, sy); g.rotate(angle);
    const scale = SHOE * (1 + 0.14 * lift);
    g.scale(scale, scale);
    if (dancer.kind === "shoe") drawDanceShoe(); else drawHeel();
    g.restore();

    if (glowAmount > 0) {                               // ring on the foot that takes the weight
      g.beginPath(); g.arc(sx, sy, 30 + 26 * (1 - glowAmount), 0, Math.PI * 2);
      g.strokeStyle = `rgba(255,214,102,${0.9 * glowAmount})`; g.lineWidth = 3.5; g.stroke();
    }
  }

  function drawDancer(role, f) {
    const dancer = dancerOf(role), pose = f[role];
    const order = pose.L.lift > pose.R.lift ? ["R", "L"] : ["L", "R"];     // moving foot on top
    for (const foot of order) {
      drawFoot(dancer, role, foot, pose[foot], f.landing[role] === foot ? f.glow : 0);
    }
    g.font = "600 15px system-ui, sans-serif"; g.fillStyle = "rgba(255,240,225,0.8)"; g.textAlign = "left";
    g.fillText(dancer.label, 16, dancer.labelY);
  }

  // count ribbon
  const ribbon = $("counts");
  const cells = [];
  const SHOWN = [1, 2, 3, 5, 6, 7];          // 4 and 8 are not stepped on
  for (const c of SHOWN) {
    const el = document.createElement("span");
    el.textContent = String(c);
    ribbon.appendChild(el); cells.push(el);
  }
  let shownCount = null;

  function render() {
    const t = songTime();
    const f = SalsaDance.frame(BEATS, t);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawFloor();
    drawDancer("follower", f);
    drawDancer("leader", f);
    const count = f.count !== null && f.k < BEATS.length - 1 && (STILL || ready) ? f.count : null;
    if (count !== shownCount) {
      cells.forEach((el, i) => el.classList.toggle("now", count === SHOWN[i]));
      shownCount = count;
    }
  }

  function loop() { render(); requestAnimationFrame(loop); }
  requestAnimationFrame(loop);

  // ───────────────────────── controls ─────────────────────────
  function bind(id, valueId, key, format, apply) {
    const input = $(id), label = $(valueId);
    input.value = settings[key];
    const update = () => {
      settings[key] = Number(input.value);
      label.textContent = format(settings[key]);
      store.set(key, settings[key]);
      if (apply) apply();
    };
    input.addEventListener("input", update);
    label.textContent = format(settings[key]);
  }
  bind("music", "musicVal", "music", (v) => v + "%", () => { if (ready) player.setVolume(settings.music); });
  bind("click", "clickVal", "click", (v) => v + "%", () => { ensureAudio(); if (master) master.gain.value = settings.click / 100; });
  $("mode").value = settings.mode;
  $("mode").addEventListener("change", () => { settings.mode = $("mode").value; store.set("mode", settings.mode); });

  const swap = $("swapView");
  const showView = () => { swap.textContent = followerView ? "View as leader" : "View as follower"; };
  showView();
  swap.addEventListener("click", () => {
    followerView = !followerView;
    store.set("view", followerView ? "follower" : "leader");
    showView();
  });

  // ───────────────────────── YouTube ─────────────────────────
  if (STILL) {
    document.querySelector(".video").hidden = true;
  } else {
    window.onYouTubeIframeAPIReady = function () {
      player = new YT.Player("player", {
        videoId: VIDEO_ID,
        width: "100%", height: "100%",
        playerVars: { playsinline: 1, rel: 0 },
        events: {
          onReady() { ready = true; player.setVolume(settings.music); },
          onStateChange() { clock.playing = false; },
          onPlaybackRateChange() { clock.playing = false; },
          onError() {
            $("audioStatus").innerHTML = 'The video cannot be embedded here. <a href="https://www.youtube.com/watch?v='
              + VIDEO_ID + '">Open it on YouTube</a>.';
          },
        },
      });
    };
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(script);
  }
})();
