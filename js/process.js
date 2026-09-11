/*
 * The process sequence.
 *
 * One pinned window, four steps and a payoff. The monitor and the timeline
 * persist for the whole run: each step changes their state rather than
 * replacing them, so the transitions are match cuts instead of crossfades.
 *
 * It is opt-in. Until the visitor clicks the invitation, the section is one
 * screen tall and scrolling carries straight past it. Clicking centres the
 * window and opens the scroll runway. From there the visitor's scroll drives
 * everything, the transitions included; nothing takes the scroll away.
 * Scrolling back out above the window leaves.
 */

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");

const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));

/* Normalised 0..1 position of `value` between `start` and `end`. */
const blend = (value, start, end) => clamp((value - start) / (end - start));

/* Smoothstep. Used where a value drives something continuous, so the ends of
   every move settle instead of arriving at full speed. */
const ease = (t) => t * t * (3 - 2 * t);
const eased = (value, start, end) => ease(blend(value, start, end));

/* Smootherstep: zero velocity and zero acceleration at both ends. */
const smoother = (t) => t * t * t * (t * (t * 6 - 15) + 10);

/*
 * The finale plays itself. The moment the visitor's scroll reaches 100%
 * (FINALE_AT), "Your videos are ready." runs on its own clock: the flood,
 * the files closing into their fan, the confetti. The scroll is never taken;
 * keep scrolling and it plays on regardless. Scroll back under 100% and it
 * rewinds, faster, to the export. Keyframes are [ms, shaped position].
 */
const FINALE_AT = 0.910;
const FINALE = [
  [0,    0.910],  /* 100%: the ring and the disc close at once */
  [700,  0.918],
  [2600, 0.946],  /* orange floods out, the files fan          */
  [4000, 0.968],  /* the reward, taken in                      */
];
const FINALE_MS = FINALE[FINALE.length - 1][0];
const FINALE_REWIND = 2.5;

/* Monotone cubic Hermite through keyframes of [x, shaped position].
   Interior slopes are the harmonic mean of the neighbouring secants, which
   can never overshoot and eases the pace from one stretch into the next;
   the end slopes are zero, so it leaves and arrives at rest. */
const monotoneCurve = (keys) => {
  const n = keys.length;
  const secant = keys.slice(1).map(([t, p], i) => (p - keys[i][1]) / (t - keys[i][0]));
  const slope = keys.map((_, i) => {
    if (i === 0 || i === n - 1) return 0;
    const a = secant[i - 1];
    const b = secant[i];
    return a * b <= 0 ? 0 : (2 * a * b) / (a + b);
  });
  const span = keys[n - 1][0];

  /* `t` is 0..1 along the whole curve. */
  return (t) => {
    const x = clamp(t) * span;
    let i = 0;
    while (i < n - 2 && x > keys[i + 1][0]) i += 1;
    const [x0, p0] = keys[i];
    const [x1, p1] = keys[i + 1];
    const h = x1 - x0;
    const s = (x - x0) / h;
    const s2 = s * s;
    const s3 = s2 * s;
    return (2 * s3 - 3 * s2 + 1) * p0 + (s3 - 2 * s2 + s) * h * slope[i]
      + (3 * s2 - 2 * s3) * p1 + (s3 - s2) * h * slope[i + 1];
  };
};

/*
 * The sequence is authored in a "shaped" 0..1 domain; SEQUENCE says how much
 * scroll (raw units) each stretch of it gets. Every transition is a stretch
 * of its own, long enough to be scrolled through deliberately rather than
 * rushing past, and one monotone cubic runs through all of them, so the pace
 * changes gently from stretch to stretch and never jumps. Engaged, the runway
 * starts at step 1 (START); below that is the idle invitation. The track
 * height in process.css is the raw total (253) at 8.72vh a unit.
 */
const START = 0.070;
const SEQUENCE = [
  [0.190, 30],   /* step 1: you upload                     */
  [0.212, 10],   /* 100%: the files start to orbit         */
  [0.236, 8],    /* and dive into the ring, one by one     */
  [0.248, 4],    /* the hit                                */
  [0.284, 8],    /* the timeline docks, the picture lands  */
  [0.580, 30],   /* step 2: one pass, cut, grade, sound    */
  [0.612, 8],    /* the clips tumble out                   */
  [0.640, 6],    /* the frame blurs and darkens            */
  [0.700, 6],    /* the scrubber comes up                  */
  [0.800, 60],   /* step 3: you review                     */
  [0.812, 8],    /* the notes pop                          */
  [0.840, 14],   /* the picture closes into a disc         */
  [0.846, 5],    /* the ring starts                        */
  [0.905, 36],   /* step 4: files come out as it fills     */
  [0.910, 4],    /* 100%                                   */
  [0.910, 16],   /* "Your videos are ready." plays itself  */
];

const RAW_TOTAL = SEQUENCE.reduce((n, [, raw]) => n + raw, 0);
let acc = 0;
const shape = monotoneCurve([[0, START], ...SEQUENCE.map(([p, raw]) => {
  acc += raw;
  return [acc, p];
})]);

/* The inverse, by bisection (shape is monotone): the raw scroll that shows
   a given shaped position. Used for the step buttons. */
const rawFor = (p) => {
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 40; i += 1) {
    const mid = (lo + hi) / 2;
    if (shape(mid) < p) lo = mid;
    else hi = mid;
  }
  return hi;
};

/*
 * Track marks, in the shaped domain. Everything downstream is expressed
 * against these, so the whole sequence retimes from one place.
 */
const T = {
  cue:         [0.020, 0.030],  /* the invitation clears                */
  intakeFill:  [0.073, 0.190],  /* files land; 100% as step 1 ends      */
  spin:        [0.190, 0.236],  /* files orbit the ring, accelerating   */
  dive:        [0.212, 0.236],  /* and dive in, one after another       */
  impact:      [0.232, 0.248],  /* the hit as the last one goes in      */
  lanesUp:     [0.236, 0.270],  /* timeline docks                       */
  monitorUp:   [0.240, 0.284],  /* picture arrives                      */
  edit:        [0.284, 0.580],  /* one pass: cut, grade, sound          */
  clipsFall:   [0.580, 0.612],  /* the clips tumble out                 */
  lanesOut:    [0.600, 0.630],  /* the empty timeline slides away       */
  reviewIn:    [0.596, 0.640],  /* frame blurs and darkens              */
  reviewUI:    [0.650, 0.700],  /* scrubber                             */
  review:      [0.700, 0.800],  /* notes land on the picture            */
  unblur:      [0.701, 0.708],  /* blur clears as the visitor scrolls   */
  iris:        [0.806, 0.840],  /* the picture closes to a disc         */
  exportIn:    [0.830, 0.846],  /* the export ring arrives around it    */
  exportBar:   [0.846, 0.905],  /* ring fills; files come out           */
  readoutOut:  [0.910, 0.920],  /* ring and disc close                  */
  success:     [0.912, 0.932],  /* orange floods out of the ring        */
  burst:       [0.914, 0.946],  /* files fan out under the line         */
  headline:    [0.926, 0.944],  /* "Your videos are ready."             */
  confetti:    [0.914, 0.968],  /* the reward                           */
  hold:        [0.946, 0.968],  /* taken in                             */
};

const at = (p, key) => blend(p, T[key][0], T[key][1]);
const atEased = (p, key) => eased(p, T[key][0], T[key][1]);

/* A soft overshoot: a file that settles into place rather than stopping. */
const settle = (t) => {
  const c1 = 1.1;
  const c3 = c1 + 1;
  return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
};

/* Small seeded random, so the tumble and the confetti are the same every
   visit, and scrolling back retraces them exactly. */
const seeded = (seed) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

/* Step boundaries in the shaped domain: which title is up. */
const STEPS = [
  { id: 0, until: 0.030 },
  { id: 1, until: 0.232 },
  { id: 2, until: 0.640 },
  { id: 3, until: 0.826 },
  { id: 4, until: 0.912 },
  { id: 5, until: Infinity },
];

/* Where "Next step" and "Previous step" go: a settled moment in each beat. */
const STOPS = [0.071, 0.300, 0.704, 0.850, FINALE_AT];

/*
 * The scroll hint, always in the middle of whatever the visitor is looking
 * at: the verb for each stretch, and the stretches where it steps aside
 * because something is moving through the middle of the frame.
 */
const HINTS = [
  { from: 0.000, to: 0.190, text: "to upload" },
  { from: 0.290, to: 0.580, text: "to edit" },
  { from: 0.655, to: 0.800, text: "to review" },
  { from: 0.848, to: 0.905, text: "to export" },
  { from: 0.946, to: 1.100, text: "to continue" },
];

/*
 * Step 4's files, in percent of the canvas and degrees. `a` is where each
 * lands when it comes out of the ring (loose, clear of the title and the
 * percentage). On the end screen they close into a fan under the line: the
 * long form in the middle, three shorts either side (`fan` offsets).
 */
const EXPORT_POSES = [
  { a: [27, 50, -7],  fan: 0 },   /* the long form */
  { a: [63, 25, 9],   fan: -3 },
  { a: [74, 45, -6],  fan: -2 },
  { a: [69, 70, 12],  fan: -1 },
  { a: [36, 74, -10], fan: 1 },
  { a: [37, 28, -13], fan: 2 },
  { a: [53, 17, 5],   fan: 3 },
];
const fanPose = (off) => [50 + off * 8.8, 70 + off * off * 0.9, off * 7];

/* Phones: the canvas is portrait, so the files come out of the ring to
   places above and either side of it (clear of the percentage and hint in
   the column below it), and the fan spreads wider. */
const phone = window.matchMedia("(max-width: 900px) and (orientation: portrait)");
const EXPORT_POSES_PHONE = [
  [50, 25, -5],   /* the long form, above the ring */
  [22, 39, 8],
  [78, 38, -7],
  [18, 60, -9],
  [82, 61, 10],
  [26, 80, 7],
  [74, 81, -8],
];
const fanPosePhone = (off) => [50 + off * 12.5, 67 + off * off * 1.1, off * 8];

/* Where each review note lands within step 3. Matched by the scrubber ticks
   in the markup. */
const NOTE_STOPS = [0.12, 0.36, 0.60, 0.84];

/* The usable stretch of the plate, in seconds. assets/hero-3.mp4 is already
   trimmed to it: it starts at 13.08s of the original 36.4s clip (the first
   twelve were an empty push-in), so 13.5s there is 0.42s here. The picture
   runs through it once in the edit and again, briskly, in the review,
   wrapping at the end, so scrolling always shows real movement rather than
   frame-by-frame creep. */
const FILM_START = 0.42;
const FILM_END = 20.92;
const FILM_EDIT = 22;     /* seconds of picture across the edit   */
const FILM_REVIEW = 16;   /* seconds of picture across the review */

function initProcess() {
  const section = document.querySelector(".process-sequence");
  const track = document.querySelector("[data-process-track]");
  if (!section || !track) return;

  const html = document.documentElement;
  const canvas = document.querySelector(".window-canvas");
  const chassis = document.querySelector("[data-chassis]");
  const windowEl = document.querySelector("[data-window]");

  const monitor = document.querySelector("[data-monitor]");
  const video = document.querySelector("[data-monitor-video]");
  const logVideo = document.querySelector("[data-monitor-log]");

  const cue = document.querySelector("[data-cue]");
  const startButton = document.querySelector("[data-process-start]");
  const startLabel = document.querySelector("[data-process-start-label]");
  const skipButton = document.querySelector("[data-process-skip]");
  const prevButton = document.querySelector("[data-process-prev]");
  const nextButton = document.querySelector("[data-process-next]");
  const railItems = [...document.querySelectorAll("[data-rail-step]")];
  const deliverablesHead = section.querySelector(".deliverables-head");
  const afterTrack = section.querySelector(".process-deliverables");
  const header = document.querySelector("[data-header]");
  const hint = document.querySelector(".monitor-hint");
  const hintText = document.querySelector("[data-hint-text]");

  const scrubTicks = [...document.querySelectorAll("[data-scrub-tick]")];
  const notes = [...document.querySelectorAll("[data-note]")];

  const intake = document.querySelector("[data-intake]");
  const intakeFiles = [...document.querySelectorAll("[data-intake-file]")].map((element) => ({
    element,
    angle: (Number(element.dataset.angle) * Math.PI) / 180,
    /* Each file lands as the ring's arc sweeps past it. */
    landsAt: Number(element.dataset.angle) / 360,
  }));
  const intakeRing = document.querySelector("[data-intake-ring]");
  const intakePct = document.querySelector("[data-intake-pct]");

  /* Read once: where each clip sits in its lane, in percent, plus its place
     in the tumble at the end of the edit and which way it spins. */
  const tumble = seeded(11);
  const clips = [...document.querySelectorAll(".clip")].map((element) => ({
    element,
    start: parseFloat(element.style.getPropertyValue("--clip-start")) || 0,
    width: parseFloat(element.style.getPropertyValue("--clip-width")) || 1,
    order: tumble(),
    spin: (tumble() - 0.5) * 50,
  }));
  clips.forEach(({ element, spin }) => element.style.setProperty("--spin", `${spin.toFixed(1)}deg`));

  const exportPct = document.querySelector("[data-export-pct]");
  const exportRing = document.querySelector("[data-export-ring]");
  const exportFiles = [...document.querySelectorAll("[data-export-file]")];

  /* Confetti for the end screen: thrown up and out from the middle, falling
     under gravity. Seeded, so it is the same every time. */
  const confettiLayer = document.querySelector("[data-confetti]");
  const toss = seeded(29);
  const TONES = ["#ffffff", "#ffffff", "#fff1e8", "#1a0703", "#ffd2c2"];
  const confetti = confettiLayer ? Array.from({ length: 26 }, () => {
    const piece = document.createElement("i");
    const angle = -Math.PI / 2 + (toss() - 0.5) * Math.PI * 1.1;
    const speed = 0.4 + toss() * 0.55;
    const round = toss() < 0.3;
    piece.style.setProperty("--tone", TONES[Math.floor(toss() * TONES.length)]);
    piece.style.setProperty("--w", `${round ? 7 : 5 + toss() * 4}px`);
    piece.style.setProperty("--h", `${round ? 7 : 8 + toss() * 6}px`);
    piece.style.setProperty("--round", round ? "50%" : "2px");
    confettiLayer.append(piece);
    return {
      piece,
      vx: Math.cos(angle) * speed * 0.5,
      vy: Math.sin(angle) * speed,
      spin: (toss() - 0.5) * 420,
      delay: toss() * 0.18,
    };
  }) : [];
  let confettiShown = false;

  const setVar = (name, value) => canvas?.style.setProperty(name, value);
  const toggle = (element, className, on) => element?.classList.toggle(className, on);

  /* Entrance ------------------------------------------------------------- */

  const entrance = new IntersectionObserver(([entry]) => {
    if (!entry.isIntersecting) return;
    section.classList.add("is-entered");
    entrance.disconnect();
  }, { threshold: 0.1 });
  entrance.observe(section);

  /* Pointer tilt ---------------------------------------------------------
     The window leans towards the cursor. Small angles: the point is that the
     frame sits in space rather than flat on the page. */

  if (chassis && windowEl && finePointer.matches && !reducedMotion.matches) {
    let raf = 0;
    let tx = 0;
    let ty = 0;

    const write = () => {
      raf = 0;
      windowEl.style.setProperty("--tilt-x", `${ty.toFixed(2)}deg`);
      windowEl.style.setProperty("--tilt-y", `${tx.toFixed(2)}deg`);
    };

    chassis.addEventListener("pointermove", (event) => {
      const rect = windowEl.getBoundingClientRect();
      tx = ((event.clientX - rect.left) / rect.width - 0.5) * 3.6;
      ty = -((event.clientY - rect.top) / rect.height - 0.5) * 2.6;
      windowEl.classList.add("is-tilting");
      if (!raf) raf = requestAnimationFrame(write);
    }, { passive: true });

    chassis.addEventListener("pointerleave", () => {
      tx = 0;
      ty = 0;
      windowEl.classList.remove("is-tilting");
      if (!raf) raf = requestAnimationFrame(write);
    }, { passive: true });
  }

  /* Grade wipe -----------------------------------------------------------
     The wipe edge is the playhead. It is not draggable: one line runs the full
     height of the frame, through the picture and the timeline alike, and both
     the colour and the cut sit on the same side of it. */

  /* The lane-label gutter, measured: it is narrower on phones, and the line
     has to sit exactly on the clips' playhead. */
  const laneLabel = document.querySelector(".lane-label");
  let LANE = laneLabel?.offsetWidth || 44;
  window.addEventListener("resize", () => { LANE = laneLabel?.offsetWidth || LANE; }, { passive: true });

  const setGrade = (value) =>
    setVar("--grade-pos", `calc(${LANE}px + (100% - ${LANE}px) * ${clamp(value).toFixed(4)})`);

  /* Playback ------------------------------------------------------------- */

  /* A new seek issued before the last one lands aborts it, so asking for a
     frame every 16ms could starve the picture entirely. Each plate seeks
     only when idle, and catches up to the latest ask when it lands. */
  const wanted = new Map();

  const seek = (element, time) => {
    if (!element?.duration || Number.isNaN(element.duration)) return;
    if (!element.paused) element.pause();
    wanted.set(element, time);
    if (!element.seeking) element.currentTime = time;
  };

  [video, logVideo].forEach((element) => element?.addEventListener("seeked", () => {
    const time = wanted.get(element);
    if (time !== undefined && Math.abs(element.currentTime - time) > 0.02) element.currentTime = time;
  }));

  const filmAt = (p) => {
    const seconds = FILM_EDIT * blend(p, T.monitorUp[0], T.reviewIn[1]) + FILM_REVIEW * blend(p, T.review[0], T.review[1]);
    return FILM_START + (seconds % (FILM_END - FILM_START));
  };

  const scrub = (p) => {
    const t = filmAt(p);
    seek(video, t);
    seek(logVideo, t);
  };

  /* -1 so the first pass actually applies step 0, which clears the step title
     the markup ships with. */
  let currentStep = -1;
  let currentHint = "";
  let watched = false;

  /* Frame ---------------------------------------------------------------- */

  const render = (p) => {
    windowEl?.style.setProperty("--sequence-progress", clamp(p / T.hold[1]).toFixed(4));
    if (p >= T.hold[0]) watched = true;

    /* The invitation --------------------------------------------------- */
    const cueShown = 1 - atEased(p, "cue");
    setVar("--cue", cueShown.toFixed(3));
    toggle(cue, "is-gone", cueShown < 0.5);

    /* Step 1 - intake ---------------------------------------------------- */
    const filled = at(p, "intakeFill");
    const percent = Math.round(filled * 100);

    if (intakePct) intakePct.textContent = `${percent}%`;
    intakeRing?.style.setProperty("--ring", filled.toFixed(4));

    /* Anticipation: the landed files get restless from about 70%, then
       settle as the orbit takes them. */
    const spinning = blend(p, T.spin[0], T.spin[1]);
    setVar("--wiggle", (eased(filled, 0.7, 1) * (1 - eased(p, T.spin[0], T.spin[0] + 0.012))).toFixed(3));

    /* The handoff. At 100% the whole ring of files begins, slowly, to orbit
       the meter, pulled a little inwards; the orbit accelerates (angle goes
       with the square of progress), and then one after another they dive
       into the centre, winding tighter as they fall, and the last one in
       sets off the impact. */
    const orbit = spinning * spinning * Math.PI * 1.15;
    const pull = 1 - 0.1 * ease(spinning);
    const [diveFrom, diveTo] = T.dive;
    const each = 0.012;
    const gap = (diveTo - diveFrom - each) / Math.max(1, intakeFiles.length - 1);

    intakeFiles.forEach(({ element, angle, landsAt }, index) => {
      toggle(element, "is-in", filled >= landsAt);
      toggle(element, "is-handing-off", p > T.spin[0]);
      const k = eased(p, diveFrom + index * gap, diveFrom + index * gap + each);
      const swirl = angle + orbit + k * 1.8;
      const radius = pull * (1 - k);
      element.style.setProperty("--ox", (Math.sin(swirl) * radius).toFixed(4));
      element.style.setProperty("--oy", (-Math.cos(swirl) * radius).toFixed(4));
      element.style.setProperty("--handoff", k.toFixed(3));
      element.style.setProperty("--vanish", eased(k, 0.62, 1).toFixed(3));
    });

    /* The tremor swells through the dive and dies in the hit. A few slow
       swings read as a rumble; more than that reads as a buzz. */
    const u = blend(p, diveFrom - 0.006, T.impact[1]);
    const build = blend(p, diveFrom - 0.006, T.impact[0] + 0.006);
    const shake = build * build * (1 - eased(p, T.impact[0] + 0.006, T.impact[1]));
    const impact = eased(p, T.impact[0], T.impact[0] + 0.006) * (1 - eased(p, T.impact[0] + 0.006, T.impact[1]));
    setVar("--impact-x", `${(Math.sin(u * Math.PI * 14) * shake * 1.6).toFixed(2)}px`);
    setVar("--impact-y", `${(Math.cos(u * Math.PI * 10) * shake * 1.0).toFixed(2)}px`);
    setVar("--impact-scale", (1 + shake * 0.004 + impact * 0.016).toFixed(4));
    setVar("--impact-flash", (impact * 0.42).toFixed(3));

    /* The ring and its percentage are up for the whole of step 1, and gone
       in the flash. */
    if (intake) {
      const inOut = (p >= START - 0.001 ? 1 : 0) * (1 - eased(p, T.impact[0], T.impact[0] + 0.006));
      intake.style.opacity = inOut.toFixed(3);
    }

    /* Step 2 - one pass. Cut, grade and sound design happen together, which
       is how it actually feels to watch an edit come together. */
    const editingRaw = at(p, "edit");
    const reviewing = atEased(p, "review");
    const exporting = at(p, "exportBar");
    const exportIn = atEased(p, "exportIn");
    const success = atEased(p, "success");
    const monitorUp = atEased(p, "monitorUp");
    const falling = eased(p, T.clipsFall[0], T.clipsFall[0] + 0.010);
    const lanes = atEased(p, "lanesUp") * (1 - atEased(p, "lanesOut"));

    setVar("--monitor-alpha", monitorUp.toFixed(3));
    setVar("--scrim", monitorUp.toFixed(3));
    setVar("--grade-alpha", (monitorUp * (1 - falling)).toFixed(3));
    setVar("--lanes-alpha", lanes.toFixed(3));
    setVar("--playhead-alpha", (monitorUp * (1 - falling)).toFixed(3));

    /* One sweep across the edit, then held at the head of the review. */
    const head = p < T.edit[1] ? editingRaw : reviewing;
    setVar("--playhead", head.toFixed(4));

    /* Colour and cut share the playhead, so the line reads as one edge. */
    setGrade(head);

    /* The playhead lays each clip down as it passes over it. When the edit
       is done they tumble out of the timeline, one after another in a
       shuffled order, before the empty panel slides off. */
    const headPct = editingRaw * 100;
    const [fallFrom, fallTo] = T.clipsFall;
    clips.forEach(({ element, start, width, order }) => {
      const reveal = clamp((headPct - start) / width);
      element.style.setProperty("--reveal", reveal.toFixed(4));
      toggle(element, "is-locked", reveal >= 0.999);
      const drop = fallFrom + order * (fallTo - fallFrom - 0.012);
      const fall = blend(p, drop, drop + 0.012);
      element.style.setProperty("--fall", (fall * fall).toFixed(4));
    });

    toggle(monitor, "is-live", p > T.monitorUp[1] && p < T.iris[0]);

    /* Step 3 - the picture goes full frame and dark. It arrives blurred, and
       the blur clears as the visitor starts scrolling; the darkness stays so
       the notes carry. */
    const reviewOn = atEased(p, "reviewIn");
    setVar("--scrubber-alpha", (atEased(p, "reviewUI") * (1 - eased(p, 0.800, 0.810))).toFixed(3));
    setVar("--scrubber-pos", `${(reviewing * 100).toFixed(2)}%`);

    NOTE_STOPS.forEach((stop, index) => {
      const shown = p >= T.review[0] - 0.002 && p < 0.818 && reviewing >= stop;
      toggle(notes[index], "is-in", shown);
      toggle(notes[index], "is-popped", p >= 0.800 + index * 0.0025);
      toggle(scrubTicks[index], "is-in", shown && p < 0.800);
    });

    /* Step 4 - the export. The picture closes into a slowly turning disc the
       size of the inside of the ring and carries on playing there, sharp and
       in full colour, while the ring fills around it and the files come out
       of it. */
    const iris = atEased(p, "iris");
    const irisOut = atEased(p, "readoutOut");
    const reviewBlur = reviewOn * (1 - atEased(p, "unblur"));
    setVar("--iris", iris.toFixed(4));
    setVar("--iris-out", irisOut.toFixed(4));
    setVar("--iris-spin", (blend(p, T.exportIn[0], T.readoutOut[1]) * -70).toFixed(2));
    setVar("--monitor-blur", `${(reviewBlur * (1 - iris) * 14).toFixed(2)}px`);
    setVar("--monitor-desat", (reviewOn * 0.55 * (1 - iris)).toFixed(3));
    setVar("--monitor-dim", (reviewOn * 0.5 * (1 - iris)).toFixed(3));
    setVar("--veil-alpha", (Math.max(monitorUp * 0.85, reviewOn) * (1 - iris)).toFixed(3));

    const exported = Math.round(exporting * 100);
    if (exportPct) exportPct.textContent = `${exported}%`;
    exportRing?.style.setProperty("--ring", exporting.toFixed(4));

    setVar("--export-alpha", exportIn.toFixed(3));
    setVar("--readout-out", irisOut.toFixed(3));
    setVar("--success", success.toFixed(3));
    setVar("--headline", atEased(p, "headline").toFixed(3));
    setVar("--hold", atEased(p, "hold").toFixed(3));

    /* Each file comes out of the disc as its share of the ring completes:
       from the centre, small and turning, out to its place, settling there.
       On the end screen they close into a fan under the line. */
    const [burstFrom, burstTo] = T.burst;
    const flight = 0.016;
    const stagger = (burstTo - burstFrom - flight) / Math.max(1, exportFiles.length - 1);

    exportFiles.forEach((file, index) => {
      const pose = EXPORT_POSES[index];
      if (!pose) return;
      const stop = Number(file.dataset.exportAt);
      const out = blend(exporting, stop - 0.12, stop);
      const thrown = out > 0 ? settle(out) : 0;
      const side = index % 2 ? 1 : -1;
      const [ax, ay, ar] = phone.matches ? EXPORT_POSES_PHONE[index] : pose.a;
      const [bx, by, br] = (phone.matches ? fanPosePhone : fanPose)(pose.fan);
      const k = blend(p, burstFrom + index * stagger, burstFrom + index * stagger + flight);
      const travel = settle(ease(k));
      const arc = Math.sin(Math.PI * k);
      /* Out of the disc: centre to pose `a`. */
      const x0 = 50 + (ax - 50) * thrown;
      const y0 = 50 + (ay - 50) * thrown;
      const r0 = ar * thrown + (1 - out) * 60 * side;
      /* Then into the fan. */
      const x = x0 + (bx - x0) * travel;
      const y = y0 + (by - y0) * travel - arc * 2.5;
      const r = r0 + (br - r0) * ease(k) + arc * 6 * side;
      const size = index === 0 ? 1.3 : 1.08;
      const s = (0.35 + 0.65 * thrown) * (1 + (size - 1) * ease(k));
      file.style.setProperty("--x", x.toFixed(2));
      file.style.setProperty("--y", y.toFixed(2));
      file.style.setProperty("--r", r.toFixed(2));
      file.style.setProperty("--s", s.toFixed(3));
      file.style.setProperty("--o", Math.min(1, out * 3).toFixed(3));
      file.style.setProperty("--label", (1 - ease(k)).toFixed(3));
    });

    /* Confetti, thrown from the middle as the orange arrives. Its clock is
       the visitor's scroll, so scrolling back gathers it up again. */
    const throwing = blend(p, T.confetti[0], T.confetti[1]);
    if (throwing > 0 || confettiShown) {
      confettiShown = throwing > 0;
      const w = monitor?.offsetWidth || 1;
      const h = monitor?.offsetHeight || 1;
      confetti.forEach(({ piece, vx, vy, spin, delay }) => {
        const t = Math.max(0, throwing * 2.6 - delay);
        const x = w * (0.5 + vx * t);
        const y = h * (0.4 + vy * t + 0.5 * t * t);
        piece.style.setProperty("--x", `${x.toFixed(1)}px`);
        piece.style.setProperty("--y", `${y.toFixed(1)}px`);
        piece.style.setProperty("--r", `${(spin * t).toFixed(1)}deg`);
        piece.style.setProperty("--o", (t > 0 ? 1 - eased(t, 1.8, 2.5) : 0).toFixed(3));
      });
    }

    /* Video: scrubbed while the work happens, played once it is finished. */
    if (p >= T.iris[0]) {
      wanted.clear();
      if (video?.paused && !reducedMotion.matches) video.play().catch(() => {});
      if (logVideo && !logVideo.paused) logVideo.pause();
    } else if (p > T.monitorUp[0]) {
      scrub(p);
    } else {
      if (video && !video.paused) video.pause();
      if (logVideo && !logVideo.paused) logVideo.pause();
    }

    /* Scroll hint. Always there once the visitor is in: centred on what they
       are looking at, saying what their scroll does next. It steps aside only
       while something is moving through the middle of the frame. Above the
       timeline in the edit, under the ring in the export, in white on the
       orange end screen. */
    const band = HINTS.find((h) => p >= h.from && p < h.to);
    let hintAlpha = 0;
    if (band && p >= START - 0.001) {
      hintAlpha = eased(p, band.from, band.from + 0.006) * (1 - eased(p, band.to - 0.006, band.to));
      if (band === HINTS[0]) hintAlpha = 1 - eased(p, 0.184, 0.190);
      if (band.text !== currentHint && hintText) {
        currentHint = band.text;
        hintText.textContent = band.text;
      }
    }
    setVar("--hint", hintAlpha.toFixed(3));
    setVar("--hint-lift", lanes.toFixed(3));
    setVar("--hint-drop", (exportIn * (1 - irisOut)).toFixed(3));
    setVar("--hint-backdrop", (monitorUp * (1 - success)).toFixed(3));
    toggle(hint, "is-light", p >= T.success[0]);

    /* Step label ---------------------------------------------------------- */

    const step = STEPS.find((candidate) => p < candidate.until) ?? STEPS[STEPS.length - 1];
    if (step.id !== currentStep) {
      currentStep = step.id;
      railItems.forEach((item) => {
        item.classList.toggle("is-active", Number(item.dataset.railStep) === step.id);
      });
    }

    updateControls();
  };

  /* Scroll -----------------------------------------------------------------
     Engaged, the rendered position chases the scroll position, so every
     beat and every transition is the visitor's to drive, and the smoothing
     takes the edge off. A glide is the page moving on its own, and only ever
     because the visitor asked (a click): centring the window after the
     invitation, the step buttons, skip. Any scroll during a step-button or
     skip glide takes over from it.

     Navigation passes through. An anchor link (or Home/End) that travels
     through the section is left alone. */

  const rawAt = () => {
    const travel = track.offsetHeight - window.innerHeight;
    return travel > 0 ? clamp(-track.getBoundingClientRect().top / travel) : 0;
  };

  const rawTop = () => track.getBoundingClientRect().top + window.scrollY;
  const scrollFor = (raw) => rawTop() + raw * (track.offsetHeight - window.innerHeight);

  /* Where the page glides to on the way out: "Every edit includes", clear
     of the fixed header. */
  const deliverablesScroll = () => {
    if (!deliverablesHead) return rawTop() + track.offsetHeight;
    const offset = (header?.offsetHeight ?? 76) + 44;
    return deliverablesHead.getBoundingClientRect().top + window.scrollY - offset;
  };

  /* Longer trips take a little longer, within limits. */
  const glideMs = (distance) =>
    reducedMotion.matches ? 1 : clamp(700 + Math.abs(distance) * 0.18, 900, 2600);

  let engaged = false;
  const view = (raw) => (engaged ? shape(raw) : 0);
  let target = rawAt();
  let current = target;
  let looping = false;
  let auto = null;        /* a glide in progress                          */
  let touchY = null;

  /* Scroll-behaviour is smooth on html; every programmatic move here must
     be instant, so it is always wrapped in the takeover class. */
  const jumpTo = (y) => {
    const wasHeld = html.classList.contains("process-auto-scrolling");
    html.classList.add("process-auto-scrolling");
    window.scrollTo(0, y);
    if (!wasHeld) html.classList.remove("process-auto-scrolling");
  };

  const run = () => {
    if (looping) return;
    looping = true;
    requestAnimationFrame(step);
  };

  const release = () => {
    auto = null;
    html.classList.remove("process-auto-scrolling");
    updateControls();
  };

  /* Leaves the loop running: its next frame simply falls back to chasing. */
  const cancelAuto = () => {
    if (auto) release();
  };

  /* A soft glide yields to any input instead of swallowing it. */
  const glide = (toScroll, ms, then = null, delay = 0, soft = false, v0 = 0) => {
    auto = {
      kind: "glide",
      from: null,          /* taken on the first frame, after any delay */
      to: toScroll,
      started: performance.now() + delay,
      ms: Math.max(1, ms),
      then,
      soft,
      v0,
    };
    html.classList.add("process-auto-scrolling");
    run();
  };

  /* Step buttons: on whenever there is somewhere to go. Only written when
     something changes. */
  const setButton = (button, on) => {
    if (!button || button.disabled === !on) return;
    button.disabled = !on;
    button.tabIndex = on ? 0 : -1;
  };

  const updateControls = () => {
    if (skipButton) skipButton.tabIndex = engaged ? 0 : -1;
    const busy = Boolean(auto) && !auto.soft;
    const p = shape(rawAt());
    setButton(nextButton, engaged && !busy);
    setButton(prevButton, engaged && !busy && STOPS.some((stop) => stop < p - 0.004));
  };

  /* Close the runway. If the viewport is below the track's top, what it is
     looking at moves up when the runway goes, so the page is put back by
     however far the content after the track actually moved. Measured, not
     computed: the browser's own scroll anchoring may already have corrected
     some or all of it, and two corrections stack. */
  const disengage = () => {
    if (!engaged) return;
    const top = track.getBoundingClientRect().top;
    const before = afterTrack?.getBoundingClientRect().top ?? 0;
    engaged = false;
    section.classList.remove("is-engaged");
    if (top < 0 && afterTrack) jumpTo(window.scrollY + (afterTrack.getBoundingClientRect().top - before));
    target = rawAt();
    current = target;
    if (watched && startLabel) startLabel.textContent = "Watch it again";
    watched = false;
    finaleTime = 0;
    catchArmed = false;
    rearmBeyond = 1.4;
    updateControls();
    paint();
  };

  /* The invitation, clicked. First the window is brought smoothly to the
     middle of the screen from wherever it was, with the runway still
     closed, so nothing can jump; only then is the runway opened (the window
     is already where the pin holds it), with step 1 ready to scroll. */
  const engage = () => {
    cancelAuto();
    const begin = () => {
      engaged = true;
      section.classList.add("is-engaged");
      /* The plate only downloads once someone has actually clicked in. */
      [video, logVideo].forEach((element) => {
        if (element && element.preload !== "auto") element.preload = "auto";
      });
      target = rawAt();
      current = target;
      paint();
    };
    const distance = rawTop() - window.scrollY;
    if (!engaged && Math.abs(distance) > 1) {
      glide(rawTop(), reducedMotion.matches ? 1 : clamp(500 + Math.abs(distance) * 0.8, 700, 1300), begin);
    } else {
      begin();
    }
  };

  const skip = () => {
    if (!engaged) return;
    cancelAuto();
    const to = deliverablesScroll();
    glide(to, glideMs(to - window.scrollY), () => disengage(), 0, true);
  };

  /* Next / previous step: glide to the settled moment of the neighbouring
     beat, playing whatever lies between. The visitor can take over at any
     point just by scrolling. */
  const goTo = (p) => {
    cancelAuto();
    const to = scrollFor(rawFor(p));
    glide(to, glideMs(to - window.scrollY), null, 0, true);
  };

  const next = () => {
    if (!engaged) return;
    const p = shape(rawAt());
    const stop = STOPS.find((candidate) => candidate > p + 0.004);
    if (stop === undefined) skip();
    else goTo(stop);
  };

  const prev = () => {
    if (!engaged) return;
    const p = shape(rawAt());
    const stop = [...STOPS].reverse().find((candidate) => candidate < p - 0.004);
    if (stop !== undefined) goTo(stop);
  };

  /* One frame. Up to 100% the picture is wherever the scroll is; from there
     the finale's clock takes it. Returns whether the finale is still moving,
     so the loop keeps running while it plays. */
  const finaleCurve = monotoneCurve(FINALE);
  let finaleTime = 0;
  let finaleClock = 0;

  const paint = (now = performance.now()) => {
    const p = view(current);
    const want = engaged && p >= FINALE_AT - 1e-6;
    const dt = finaleClock ? Math.min(64, Math.max(0, now - finaleClock)) : 0;
    finaleClock = now;
    const before = finaleTime;
    if (reducedMotion.matches) finaleTime = want ? FINALE_MS : 0;
    else if (want) finaleTime = Math.min(FINALE_MS, finaleTime + dt);
    else finaleTime = Math.max(0, finaleTime - dt * FINALE_REWIND);
    /* Just finished: whatever momentum is still coasting from the flick that
       brought the visitor here is absorbed, so the reveal is not undone by
       its own tail. The next deliberate scroll moves on. */
    if (before < FINALE_MS && finaleTime >= FINALE_MS && lastInput === "wheel" && now - lastWheelAt < 200) {
      swallowing = true;
      swallowUntil = now + 900;
    }
    render(finaleTime > 0 ? finaleCurve(finaleTime / FINALE_MS) : p);
    return want ? finaleTime < FINALE_MS : finaleTime > 0;
  };

  const step = (now) => {
    if (auto) {
      if (auto.from === null) {
        if (now < auto.started) {
          requestAnimationFrame(step);
          return;
        }
        auto.from = window.scrollY;
      }
      const t = clamp((now - auto.started) / auto.ms);
      /* Quintic Hermite: leaves at v0, arrives at rest with no jolt. */
      const carry = t - 6 * t ** 3 + 8 * t ** 4 - 3 * t ** 5;
      window.scrollTo(0, auto.from + (auto.to - auto.from) * smoother(t) + auto.v0 * auto.ms * carry);
      target = rawAt();
      current = target;
      paint(now);

      if (t >= 1) {
        const { then } = auto;
        release();
        looping = false;
        then?.();
        return;
      }

      requestAnimationFrame(step);
      return;
    }

    const delta = target - current;
    if (Math.abs(delta) < 0.00002) {
      current = target;
      if (paint(now)) {
        requestAnimationFrame(step);
        return;
      }
      looping = false;
      return;
    }

    /* A soft glide after the hand, so every stretch is ridden rather than
       jumped through. */
    current += delta * 0.085;
    paint(now);
    requestAnimationFrame(step);
  };

  /* Once the page is still: if the visitor has scrolled out of the runway
     downwards, close it. (Upwards closes at once, in onScroll.) */
  let idleTimer = 0;
  const checkExit = () => {
    if (!engaged || auto || passing) return;
    const rect = track.getBoundingClientRect();
    if (rect.top > 1 || rect.bottom < 0) disengage();
  };

  /* Navigation passes through. Cleared once the page has been still. */
  let passing = false;
  let passTimer = 0;

  const passThrough = () => {
    passing = true;
    clearTimeout(passTimer);
    passTimer = setTimeout(() => {
      passing = false;
      checkExit();
    }, 240);
  };

  /* Focus. The window is a little smaller on the way past and grows to full
     size as its stage reaches the viewport, then shrinks again as it leaves.
     Pinned, the stage sits at 0 and the window is full size throughout. */
  const stage = track.querySelector(".process-stage");
  let focusQueued = false;

  const writeFocus = () => {
    focusQueued = false;
    if (!stage || !chassis) return;
    const top = stage.getBoundingClientRect().top;
    const focus = reducedMotion.matches ? 1 : 1 - ease(clamp(Math.abs(top) / (window.innerHeight * 0.6)));
    chassis.style.setProperty("--focus", focus.toFixed(3));
    /* Anchored at the top edge while the window is below you (arriving from
       above, or backing away upwards), at the bottom edge once it is above
       you, so the gap to the heading or to the section after never opens
       up. The switch happens at 0, where the scale is 1 and nothing moves. */
    chassis.style.setProperty("--focus-anchor", top >= 0 ? "0%" : "100%");
  };

  const scheduleFocus = () => {
    if (focusQueued) return;
    focusQueued = true;
    requestAnimationFrame(writeFocus);
  };

  /* Catch ---------------------------------------------------------------
     While the section is idle, the window invites you to stop. Scrolling
     towards it, once it is within CAPTURE of centre (from above or below),
     the page takes the scroll: it carries on at the speed you were moving
     and eases into the window, arriving at rest. The rest of that gesture's
     momentum is absorbed, so you really do stop there.

     Then it is yours again. A new gesture goes wherever you send it, and
     nothing catches you until you have properly left (REARM). A fresh
     gesture during the catch cancels it; so does any key, touch or click.
     No CSS scroll-snap: see the handover. */
  const CAPTURE = 0.8;
  const REARM = 0.9;

  let catchArmed = true;
  let rearmBeyond = REARM;
  let swallowing = false;     /* absorbing the tail of the caught gesture */
  let swallowUntil = 0;       /* ...but never for longer than this          */
  let lastWheelSign = 0;
  const wheelSizes = [];      /* |delta| of the current gesture, recent last */
  let touching = false;
  let lastInput = null;
  let lastWheelAt = 0;
  let lastScrollAt = 0;
  let lastScrollY = window.scrollY;
  let scrollVelocity = 0;     /* px per ms, from scroll events (touch fling) */
  const wheelSamples = [];    /* [time, px] over the last 120ms */

  const offset = (y) => (rawTop() - y) / window.innerHeight;
  const magnetOff = () => engaged || passing || reducedMotion.matches || (auto && !auto.soft);

  const wheelVelocity = (now) => {
    while (wheelSamples.length && now - wheelSamples[0][0] > 120) wheelSamples.shift();
    if (!wheelSamples.length) return 0;
    const sum = wheelSamples.reduce((n, [, px]) => n + px, 0);
    return sum / Math.max(16, now - wheelSamples[0][0] + 16);
  };

  const startCatch = (velocity) => {
    catchArmed = false;
    const to = rawTop();
    const distance = to - window.scrollY;
    const ms = clamp(600 + Math.abs(distance) * 0.9, 800, 1400);
    /* Carry the visitor's own speed into the move, capped where the curve
       would otherwise overshoot the window. */
    const cap = (2.2 * distance) / ms;
    const v0 = Math.sign(velocity) !== Math.sign(distance) ? 0
      : distance > 0 ? Math.min(velocity, cap) : Math.max(velocity, cap);
    glide(to, ms, () => {
      const landed = performance.now();
      swallowing = lastInput === "wheel" && landed - lastWheelAt < 200;
      swallowUntil = landed + 700;
    }, 0, true, v0);
    auto.catching = true;
  };

  /* Momentum decays; a hand on the trackpad (or a wheel still turning) does
     not. Over the last six events of the gesture, if the latest three are
     not clearly smaller than the three before, someone is scrolling. */
  const activelyScrolling = () => {
    if (wheelSizes.length < 6) return false;
    const [a, b, c, x, y, z] = wheelSizes.slice(-6);
    const before = (a + b + c) / 3;
    const after = (x + y + z) / 3;
    return after > 3 && after >= before * 0.95;
  };

  const deltaPixels = (event) => {
    if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) return event.deltaY * 16;
    if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) return event.deltaY * window.innerHeight;
    return event.deltaY;
  };

  const catchWheel = (event, fresh, now) => {
    if (auto?.catching) {
      /* A new gesture, or one still being driven once the catch is under
         way: they want to move on. Let it through. */
      if (fresh || (activelyScrolling() && now - auto.started > 450)) {
        cancelAuto();
        return false;
      }
      event.preventDefault();
      return true;
    }
    if (swallowing) {
      /* Only the coasting tail of the caught gesture is absorbed. Anything
         that looks like intent ends it, and it never outlasts its cap. */
      if (fresh || activelyScrolling() || now > swallowUntil) {
        swallowing = false;
        return false;
      }
      event.preventDefault();
      return true;
    }
    if (magnetOff() || !catchArmed || event.ctrlKey || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return false;
    if (event.target instanceof Element && event.target.closest("dialog")) return false;
    const d = offset(window.scrollY);
    const dy = deltaPixels(event);
    const toward = (d > 0.01 && dy > 0) || (d < -0.01 && dy < 0);
    /* Judged on where this movement would take the page, so a single big
       mouse-wheel notch into the zone (or clean through it) is caught too. */
    const nextD = d - dy / window.innerHeight;
    const reaches = Math.abs(d) <= CAPTURE || Math.abs(nextD) <= CAPTURE || Math.sign(nextD) !== Math.sign(d);
    if (!toward || !reaches) return false;
    event.preventDefault();
    startCatch(wheelVelocity(now));
    return true;
  };

  /* Touch keeps its native fling; the catch takes it from scroll events. */
  const catchScroll = () => {
    if (lastInput !== "touch" || magnetOff() || auto || !catchArmed) return;
    const d = offset(window.scrollY);
    const toward = (d > 0.01 && scrollVelocity > 0) || (d < -0.01 && scrollVelocity < 0);
    if (toward && Math.abs(d) <= CAPTURE) startCatch(touching ? 0 : scrollVelocity);
  };

  /* Any deliberate input takes the page back from a soft glide. */
  const yieldSoft = () => {
    if (auto?.soft) cancelAuto();
  };

  const onScroll = () => {
    scheduleFocus();
    const now = performance.now();
    const y = window.scrollY;
    if (now > lastScrollAt) scrollVelocity = (y - lastScrollY) / Math.max(8, now - lastScrollAt);
    lastScrollAt = now;
    lastScrollY = y;
    if (!catchArmed && !engaged && Math.abs(offset(y)) > rearmBeyond) {
      catchArmed = true;
      rearmBeyond = REARM;
    }
    if (!touching) catchScroll();
    /* Leaving upwards is immediate: scroll above the pinned window and you
       are out, so coming back down later does not drop you back in. */
    if (engaged && !auto && !passing && track.getBoundingClientRect().top > 1) disengage();

    if (passing) passThrough();

    clearTimeout(idleTimer);
    idleTimer = setTimeout(checkExit, 180);

    if (auto) return;

    target = rawAt();

    if (reducedMotion.matches) {
      current = target;
      paint();
      return;
    }
    run();
  };

  /* The reveal is not scrolled past. From the moment the scroll reaches 100%
     until "Your videos are ready." has played, scrolling down is held at
     exactly 100% (a movement that would carry past it lands on it instead).
     Scrolling up stays free: it rewinds. */
  const FINALE_RAW = rawFor(FINALE_AT);
  const holdFinale = (event, pixels) => {
    if (!engaged || reducedMotion.matches || finaleTime >= FINALE_MS || !(pixels > 0)) return false;
    const raw = rawAt();
    const travel = track.offsetHeight - window.innerHeight;
    if (travel <= 0 || raw + pixels / travel < FINALE_RAW) return false;
    event.preventDefault();
    if (raw < FINALE_RAW) jumpTo(scrollFor(FINALE_RAW));
    return true;
  };

  const onWheel = (event) => {
    lastInput = "wheel";
    /* A pause of a fifth of a second or more starts a new gesture;
       momentum arrives as an unbroken stream. So does a change of
       direction. */
    const now = performance.now();
    const dy = deltaPixels(event);
    const sign = Math.sign(dy);
    const fresh = now - lastWheelAt > 200 || (sign !== 0 && lastWheelSign !== 0 && sign !== lastWheelSign);
    lastWheelAt = now;
    if (sign) lastWheelSign = sign;
    if (fresh) {
      wheelSamples.length = 0;
      wheelSizes.length = 0;
    }
    wheelSamples.push([now, dy]);
    wheelSizes.push(Math.abs(dy));
    if (wheelSizes.length > 6) wheelSizes.shift();
    if (catchWheel(event, fresh, now)) return;
    if (holdFinale(event, dy)) return;
    /* A soft glide gives way; the short centring glide after a click does
       not, so it always lands. */
    if (auto?.soft) cancelAuto();
    else if (auto) event.preventDefault();
  };

  const onTouchStart = (event) => {
    lastInput = "touch";
    touching = true;
    swallowing = false;
    yieldSoft();
    touchY = event.touches[0]?.clientY ?? null;
  };

  const onTouchMove = (event) => {
    if (auto && !auto.soft) {
      event.preventDefault();
      return;
    }
    const nextY = event.touches[0]?.clientY;
    if (touchY === null || nextY === undefined) return;
    holdFinale(event, touchY - nextY);
    touchY = nextY;
  };

  const scrollKeys = new Set(["ArrowDown", "ArrowUp", "PageDown", "PageUp", "Home", "End", " "]);
  const onKeyDown = (event) => {
    if (!scrollKeys.has(event.key)) return;
    lastInput = "key";
    swallowing = false;
    yieldSoft();
    if (auto) {
      event.preventDefault();
      return;
    }
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement) return;
    /* Space on a focused button belongs to the button. */
    if (event.key === " " && event.target instanceof HTMLButtonElement) return;
    const keyPixels = {
      ArrowDown: 40,
      PageDown: window.innerHeight * 0.88,
      " ": event.shiftKey ? 0 : window.innerHeight * 0.88,
      End: document.documentElement.scrollHeight,
    };
    if (holdFinale(event, keyPixels[event.key])) return;
    if (event.key === "Home" || event.key === "End") passThrough();
  };

  startButton?.addEventListener("click", engage);
  skipButton?.addEventListener("click", skip);
  prevButton?.addEventListener("click", prev);
  nextButton?.addEventListener("click", next);

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll, { passive: true });
  window.addEventListener("wheel", onWheel, { passive: false });
  window.addEventListener("touchstart", onTouchStart, { passive: true });
  window.addEventListener("touchmove", onTouchMove, { passive: false });
  window.addEventListener("touchend", () => {
    touchY = null;
    touching = false;
    /* Released inside the zone, moving towards the window: catch it. A fling
       is picked up by the scroll events that follow. */
    catchScroll();
  }, { passive: true });
  /* Grabbing the scrollbar is input too. */
  window.addEventListener("mousedown", () => {
    lastInput = "pointer";
    swallowing = false;
    yieldSoft();
  }, { passive: true });
  window.addEventListener("keydown", onKeyDown);
  /* Capture phase, so a glide is released before the browser starts the
     anchor scroll. */
  document.addEventListener("click", (event) => {
    if (!event.target.closest?.("a[href^='#']")) return;
    cancelAuto();
    passThrough();
  }, true);
  video?.addEventListener("loadedmetadata", onScroll);
  logVideo?.addEventListener("loadedmetadata", onScroll);
  updateControls();
  writeFocus();
  paint();
}

export { initProcess };
