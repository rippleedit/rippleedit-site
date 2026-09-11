import { TRUST_PROFILES } from "./data/trust-data.js";
import { LONG_FORM, FEATURED } from "./data/work-data.js";
import { CLIENT_WORDS } from "./data/client-words-data.js";
import { initProcess } from "./process.js";

document.documentElement.classList.add("js");

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const desktopProcess = window.matchMedia("(min-width: 821px)");
const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const lerp = (start, end, amount) => start + (end - start) * amount;
let smoothScroll;

function initSmoothScroll() {
  // Let the browser own wheel and trackpad movement. The native scroll is
  // immediate and predictable; CSS supplies the subtle easing for anchors.
  // These hooks remain for the video dialog without altering page position.
  return { stop: () => {}, start: () => {} };
}

function initHero() {
  const hero = document.querySelector("[data-hero]");
  const stage = document.querySelector("[data-hero-stage]");
  const video = document.querySelector("[data-hero-video]");
  const progress = document.querySelector("[data-clip-progress]");
  if (!hero || !stage || !video) return;

  const cycleDuration = 60_000;
  let visible = true;
  let elapsed = 0;
  let cycleStartedAt = 0;
  let frame;

  const setProgress = () => progress?.style.setProperty("--clip-progress", String(elapsed / cycleDuration));
  const play = () => video.play().catch(() => {});

  const restartCycle = () => {
    elapsed = 0;
    cycleStartedAt = performance.now();
    video.currentTime = 0;
    setProgress();
    play();
  };

  const updateCycle = () => {
    elapsed = Math.min(performance.now() - cycleStartedAt, cycleDuration);
    if (elapsed >= cycleDuration) restartCycle();
    else setProgress();
    frame = requestAnimationFrame(updateCycle);
  };

  const resumeCycle = () => {
    if (reducedMotion.matches) return;
    cycleStartedAt = performance.now() - elapsed;
    play();
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(updateCycle);
  };

  const pauseCycle = () => {
    elapsed = Math.min(performance.now() - cycleStartedAt, cycleDuration);
    video.pause();
    cancelAnimationFrame(frame);
  };

  video.addEventListener("ended", () => {
    if (visible && !reducedMotion.matches) {
      video.currentTime = 0;
      play();
    }
  });

  if (!reducedMotion.matches) {
    stage.addEventListener("pointermove", (event) => {
      const bounds = stage.getBoundingClientRect();
      const x = ((event.clientX - bounds.left) / bounds.width - 0.5) * -5;
      const y = ((event.clientY - bounds.top) / bounds.height - 0.5) * -5;
      stage.style.setProperty("--hero-x", `${x.toFixed(2)}px`);
      stage.style.setProperty("--hero-y", `${y.toFixed(2)}px`);
    });
    stage.addEventListener("pointerleave", () => {
      stage.style.setProperty("--hero-x", "0px");
      stage.style.setProperty("--hero-y", "0px");
    });

    let scrollQueued = false;
    const updateHeroExit = () => {
      const exit = clamp(window.scrollY / Math.max(1, hero.offsetHeight));
      stage.style.setProperty("--hero-scale", (1 - exit * 0.022).toFixed(4));
      stage.style.borderRadius = `${10 + exit * 18}px`;
      scrollQueued = false;
    };
    window.addEventListener("scroll", () => {
      if (scrollQueued) return;
      scrollQueued = true;
      requestAnimationFrame(updateHeroExit);
    }, { passive: true });
    updateHeroExit();
  }

  const observer = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible) resumeCycle();
    else pauseCycle();
  }, { threshold: 0.08 });
  observer.observe(hero);

  setProgress();
}

function renderClients() {
  const roster = document.querySelector("[data-client-roster]");
  if (!roster) return;

  const selected = new Set(["ProducerGrind", "MACSHOOTER", "Nile Waves", "TB Digital", "Ayo Sim"]);
  const profiles = TRUST_PROFILES.filter((profile) => selected.has(profile.name));
  roster.dataset.stagger = "70";

  roster.replaceChildren(...profiles.map((profile) => {
    const link = document.createElement("a");
    link.className = "client-link";
    link.href = profile.href;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.setAttribute("aria-label", profile.ariaLabel);
    link.dataset.reveal = "up";

    /* The face leads. A producer recognises the picture before the name. */
    const avatar = document.createElement("img");
    avatar.className = "client-link-avatar";
    avatar.src = profile.avatar;
    avatar.alt = "";
    avatar.width = 54;
    avatar.height = 54;
    avatar.loading = "lazy";

    const name = document.createElement("span");
    name.className = "client-link-name";
    name.textContent = profile.name;

    const socials = document.createElement("span");
    socials.className = "client-socials";
    profile.stats.forEach((stat) => {
      const badge = document.createElement("span");
      badge.className = "client-social-badge";
      badge.title = `${stat.value} ${stat.label} on ${stat.icon === "youtube" ? "YouTube" : "Instagram"}`;
      const icon = document.createElement("img");
      icon.src = `assets/icons/${stat.icon}.svg`;
      icon.alt = "";
      icon.width = 14;
      icon.height = 14;
      const value = document.createElement("span");
      value.textContent = stat.value;
      badge.append(icon, value);
      socials.append(badge);
    });

    const arrow = document.createElement("span");
    arrow.className = "client-link-arrow";
    arrow.setAttribute("aria-hidden", "true");
    arrow.textContent = "\u2192";

    link.append(avatar, name, socials, arrow);
    return link;
  }));
}

function splitWorkTitle(title) {
  const separator = title.indexOf(" – ");
  if (separator === -1) return { client: "RippleEdit", title };
  return { client: title.slice(0, separator), title: title.slice(separator + 3) };
}

function initRunway() {
  const section = document.querySelector("[data-runway-section]");
  const viewport = document.querySelector("[data-runway-viewport]");
  const track = document.querySelector("[data-runway-track]");
  const progress = document.querySelector("[data-runway-progress]");
  const playhead = document.querySelector("[data-runway-playhead]");
  if (!section || !viewport || !track) return;

  /* The viewer ---------------------------------------------------------
     One dialog for the whole selection. It opens on the card that was
     clicked; the arrows (buttons or keys) and the thumbnail strip move
     through the rest, wrapping at either end, with a short crossfade. */
  const dialog = document.querySelector("[data-work-dialog]");
  const player = document.querySelector("[data-dialog-player]");
  const stage = document.querySelector("[data-dialog-stage]");
  const meta = document.querySelector("[data-dialog-meta]");
  const title = document.querySelector("[data-dialog-title]");
  const client = document.querySelector("[data-dialog-client]");
  const link = document.querySelector("[data-dialog-link]");
  const count = document.querySelector("[data-dialog-count]");
  const strip = document.querySelector("[data-dialog-strip]");
  const prev = document.querySelector("[data-dialog-prev]");
  const next = document.querySelector("[data-dialog-next]");
  let current = -1;
  let swap = 0;

  const thumb = (id) => `https://i.ytimg.com/vi/${id}/mqdefault.jpg`;
  const pad = (n) => String(n).padStart(2, "0");

  const load = (item) => {
    const parsed = splitWorkTitle(item.title);
    const start = item.start ? Math.round(item.start) : 0;
    const iframe = document.createElement("iframe");
    /* start=0 is explicit, so a player never resumes from where someone last
       left off. */
    iframe.src = `https://www.youtube-nocookie.com/embed/${item.ytId}?autoplay=1&rel=0&start=${start}`;
    iframe.title = `${parsed.client}: ${parsed.title}`;
    iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
    iframe.allowFullscreen = true;
    player.replaceChildren(iframe);
    title.textContent = parsed.title;
    client.textContent = parsed.client;
    link.href = `https://www.youtube.com/watch?v=${item.ytId}${start ? `&t=${start}s` : ""}`;
    /* Replay the title's rise. */
    meta.classList.remove("is-fresh");
    void meta.offsetWidth;
    meta.classList.add("is-fresh");
  };

  const show = (index, animate = true) => {
    if (!dialog || !player || !featured.length) return;
    const wrapped = (index + featured.length) % featured.length;
    if (wrapped === current && dialog.open) return;
    current = wrapped;
    const item = featured[current];
    if (count) count.textContent = `${pad(current + 1)} / ${pad(featured.length)}`;
    strip?.querySelectorAll(".dialog-thumb").forEach((button, i) => {
      button.classList.toggle("is-current", i === current);
      button.setAttribute("aria-current", i === current ? "true" : "false");
    });
    clearTimeout(swap);
    if (!animate || reducedMotion.matches) {
      load(item);
      return;
    }
    stage?.classList.add("is-switching");
    swap = setTimeout(() => {
      stage?.classList.remove("is-switching");
      /* Closed mid-crossfade: nothing should start playing behind it. */
      if (dialog.open) load(item);
    }, 220);
  };

  const openWork = (index) => {
    if (!dialog) return;
    current = -1;
    show(index, false);
    smoothScroll?.stop();
    dialog.showModal();
    document.body.classList.add("dialog-open");
  };

  prev?.addEventListener("click", () => show(current - 1));
  next?.addEventListener("click", () => show(current + 1));
  dialog?.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft") { event.preventDefault(); show(current - 1); }
    if (event.key === "ArrowRight") { event.preventDefault(); show(current + 1); }
  });

  /* The curated selection, in order, with titles from the full list. */
  const featured = FEATURED
    .map((pick) => {
      const item = LONG_FORM.find((entry) => entry.ytId === pick.ytId);
      return item ? { ...item, start: pick.start } : null;
    })
    .filter(Boolean);

  featured.forEach((item, index) => {
    if (!strip) return;
    const parsed = splitWorkTitle(item.title);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "dialog-thumb";
    button.setAttribute("aria-label", `${parsed.client}: ${parsed.title}`);
    const image = document.createElement("img");
    image.src = thumb(item.ytId);
    image.alt = "";
    image.loading = "lazy";
    button.append(image);
    button.addEventListener("click", () => show(index));
    strip.append(button);
  });

  featured.forEach((item, index) => {
    const parsed = splitWorkTitle(item.title);
    const card = document.createElement("button");
    card.className = "runway-card";
    card.type = "button";
    card.setAttribute("aria-label", `Play ${parsed.client}: ${parsed.title}`);
    const image = document.createElement("img");
    image.src = `https://i.ytimg.com/vi/${item.ytId}/maxresdefault.jpg`;
    image.alt = "";
    image.loading = index < 2 ? "eager" : "lazy";
    image.addEventListener("error", () => {
      if (!image.src.endsWith("hqdefault.jpg")) image.src = `https://i.ytimg.com/vi/${item.ytId}/hqdefault.jpg`;
    }, { once: true });
    const shade = document.createElement("span");
    shade.className = "runway-card-shade";
    const copy = document.createElement("span");
    copy.className = "runway-card-copy";
    copy.innerHTML = `<small></small><strong></strong>`;
    copy.firstElementChild.textContent = parsed.client;
    copy.lastElementChild.textContent = parsed.title;
    card.append(image, shade, copy);
    card.addEventListener("pointermove", (event) => {
      if (reducedMotion.matches) return;
      const bounds = card.getBoundingClientRect();
      const x = (event.clientX - bounds.left) / bounds.width - 0.5;
      const y = (event.clientY - bounds.top) / bounds.height - 0.5;
      card.style.transform = `perspective(900px) rotateX(${(-y * 4).toFixed(2)}deg) rotateY(${(x * 5).toFixed(2)}deg) translateY(-6px) scale(1.012)`;
    });
    card.addEventListener("pointerleave", () => { card.style.transform = ""; });
    card.addEventListener("click", () => openWork(index));
    track.append(card);
  });

  let queued = false;
  const update = () => {
    const rect = section.getBoundingClientRect();
    const travel = section.offsetHeight - window.innerHeight;
    const amount = reducedMotion.matches ? 0 : travel > 0 ? clamp(-rect.top / travel) : 0;
    const distance = Math.max(0, track.scrollWidth - viewport.clientWidth + 64);
    track.style.setProperty("--runway-x", `${(-amount * distance).toFixed(2)}px`);
    progress?.style.setProperty("--runway-progress", amount.toFixed(4));
    playhead?.style.setProperty("--runway-progress", amount.toFixed(4));
    queued = false;
  };
  const schedule = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(update);
  };
  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", schedule, { passive: true });
  update();
}

function initWorkDialog() {
  const dialog = document.querySelector("[data-work-dialog]");
  const close = document.querySelector("[data-dialog-close]");
  const player = document.querySelector("[data-dialog-player]");
  if (!dialog || !close || !player) return;

  /* Stops the video and hands the page back. Safe to run more than once: it
     runs on every way out, and again on the dialog's own close event. */
  const clean = () => {
    player.replaceChildren();
    document.body.classList.remove("dialog-open");
    smoothScroll?.start();
  };

  const shut = () => {
    if (dialog.open) dialog.close();
    clean();
  };

  close.addEventListener("click", shut);
  /* A click on the empty frame around the player closes it, as on the
     backdrop of any lightbox. */
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog || event.target.matches("[data-dialog-shell], [data-dialog-stage]")) shut();
  });
  dialog.addEventListener("keydown", (event) => {
    if (event.key === "Escape") clean();
  });
  dialog.addEventListener("close", clean);
}

function initReveal() {
  const items = [...document.querySelectorAll("[data-reveal]")];
  if (!items.length) return;

  items.forEach((item) => {
    if (item.dataset.reveal === "lines") {
      item.querySelectorAll(".line").forEach((line, index) => {
        if (line.dataset.prepared) return;
        line.dataset.prepared = "true";
        line.classList.add("line-mask");
        const inner = document.createElement("span");
        inner.className = "line-inner";
        inner.style.setProperty("--line-delay", `${index * 90}ms`);
        while (line.firstChild) inner.append(line.firstChild);
        line.append(inner);
      });
    }

    const group = item.closest("[data-stagger]");
    if (item.dataset.delay) item.style.setProperty("--reveal-delay", `${item.dataset.delay}ms`);
    else if (group) {
      const step = Number(group.dataset.stagger) || 70;
      const index = [...group.querySelectorAll("[data-reveal]")].indexOf(item);
      item.style.setProperty("--reveal-delay", `${index * step}ms`);
    }
  });

  if (reducedMotion.matches || !("IntersectionObserver" in window)) {
    items.forEach((item) => item.classList.add("is-in"));
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("is-in");
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.13, rootMargin: "0px 0px -6%" });
  items.forEach((item) => observer.observe(item));
}

function initObservedVideos() {
  const videos = [...document.querySelectorAll("[data-observed-video]")];
  if (!videos.length) return;
  if (reducedMotion.matches) {
    videos.forEach((video) => video.pause());
    return;
  }
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) entry.target.play().catch(() => {});
      else entry.target.pause();
    });
  }, { threshold: 0.08 });
  videos.forEach((video) => observer.observe(video));
}

function initWords() {
  const section = document.querySelector("[data-words-section]");
  const track = document.querySelector("[data-words-track]");
  const list = document.querySelector("[data-words-quotes]");
  const ticks = document.querySelector("[data-words-ticks]");
  const current = document.querySelector("[data-words-current]");
  const total = document.querySelector("[data-words-total]");
  if (!section || !track || !list) return;

  const pad = (value) => String(value).padStart(2, "0");

  const quotes = CLIENT_WORDS.map((quote, index) => {
    const item = document.createElement("article");
    item.className = "words-quote";
    if (index === 0) item.classList.add("is-active");

    /* The last word, any emoji after it and the closing quotation mark wrap
       as one, so a lone emoji never ends up on a line of its own. */
    const block = document.createElement("blockquote");
    const words = quote.text.trim().split(/\s+/);
    let cut = words.length - 1;
    while (cut > 0 && !/[\p{L}\p{N}]/u.test(words[cut])) cut -= 1;
    const tail = document.createElement("span");
    tail.className = "words-tail";
    tail.textContent = words.slice(cut).join(" ");
    block.append(`${words.slice(0, cut).join(" ")} `, tail);

    const person = document.createElement("div");
    person.className = "words-person";
    if (quote.avatar) {
      const avatar = document.createElement("img");
      avatar.src = quote.avatar;
      avatar.alt = "";
      avatar.width = 44;
      avatar.height = 44;
      avatar.loading = "lazy";
      person.append(avatar);
    }
    const who = document.createElement("span");
    const name = document.createElement("strong");
    name.textContent = quote.name;
    /* Their audience says more than a job title would: real, established
       channels. Numbers bright, platforms quiet. */
    const role = document.createElement("small");
    const PLATFORM = { youtube: "YouTube", instagram: "Instagram" };
    (quote.stats ?? []).forEach((stat, i) => {
      if (i) role.append(" · ");
      const value = document.createElement("b");
      value.textContent = stat.value;
      role.append(value, ` on ${PLATFORM[stat.icon] ?? stat.label}`);
    });
    if (!role.childNodes.length) role.textContent = "Music producer";
    who.append(name, role);
    person.append(who);

    item.append(block, person);
    list.append(item);
    return item;
  });

  const marks = quotes.map((_, index) => {
    const mark = document.createElement("i");
    if (index === 0) mark.classList.add("is-on");
    ticks?.append(mark);
    return mark;
  });

  if (total) total.textContent = pad(quotes.length);

  let shown = -1;
  const show = (index) => {
    if (index === shown) return;
    shown = index;
    quotes.forEach((quote, i) => quote.classList.toggle("is-active", i === index));
    marks.forEach((mark, i) => mark.classList.toggle("is-on", i === index));
    if (current) current.textContent = pad(index + 1);
  };

  const update = () => {
    const travel = track.offsetHeight - window.innerHeight;
    const p = travel > 0 ? clamp(-track.getBoundingClientRect().top / travel) : 0;
    /* A short hold at each end so the first and last quote are readable
       rather than flashing past at the section boundary. */
    const eased = clamp((p - 0.08) / 0.84);
    show(Math.min(quotes.length - 1, Math.floor(eased * quotes.length)));
  };

  if (reducedMotion.matches) {
    quotes.forEach((quote) => quote.classList.add("is-active"));
    return;
  }

  let queued = false;
  const schedule = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; update(); });
  };
  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", schedule, { passive: true });
  update();
}

function initContactForm() {
  const form = document.querySelector("[data-contact-form]");
  if (!form) return;
  const status = form.querySelector("[data-form-status]");
  const submit = form.querySelector("[data-submit]");
  const defaultLabel = submit?.innerHTML || "Send inquiry";

  form.querySelectorAll("input, select, textarea").forEach((field) => {
    field.addEventListener("input", () => field.removeAttribute("aria-invalid"));
    field.addEventListener("change", () => field.removeAttribute("aria-invalid"));
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!form.checkValidity()) {
      [...form.elements].forEach((field) => {
        if ("validity" in field && !field.validity.valid) field.setAttribute("aria-invalid", "true");
      });
      form.reportValidity();
      if (status) status.textContent = "Check the highlighted fields.";
      return;
    }

    if (submit) {
      submit.disabled = true;
      submit.textContent = "Sending…";
    }
    if (status) status.textContent = "";

    try {
      const response = await fetch(form.action, { method: "POST", body: new FormData(form) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result.success === false) throw new Error("Submission failed");
      form.reset();
      if (status) status.textContent = "Received. We'll be in touch within 48 hours.";
    } catch {
      if (status) status.textContent = "That didn't send. Email info@ripple-edit.com instead.";
    } finally {
      if (submit) {
        submit.disabled = false;
        submit.innerHTML = defaultLabel;
      }
    }
  });
}

function initPageChrome() {
  const header = document.querySelector("[data-header]");
  const progress = document.querySelector("[data-page-progress]");
  const navEntries = [...document.querySelectorAll(".site-nav a[href^='#']")]
    .map((link) => ({ link, section: document.querySelector(link.getAttribute("href")) }))
    .filter((entry) => entry.section);
  let queued = false;

  const update = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const amount = max > 0 ? clamp(window.scrollY / max) : 0;
    header?.style.setProperty("--header-progress", clamp(window.scrollY / 160).toFixed(3));
    progress?.style.setProperty("--page-progress", amount.toFixed(4));
    const marker = window.scrollY + window.innerHeight * 0.46;
    let current = null;
    navEntries.forEach((entry) => {
      if (entry.section.offsetTop <= marker) current = entry;
    });
    navEntries.forEach((entry) => entry.link.classList.toggle("is-active", entry === current));
    queued = false;
  };

  const schedule = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(update);
  };
  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", schedule, { passive: true });
  update();
}

function start() {
  smoothScroll = initSmoothScroll();
  renderClients();
  initHero();
  initRunway();
  initWorkDialog();
  initReveal();
  initProcess();
  initObservedVideos();
  initWords();
  initContactForm();
  initPageChrome();
  requestAnimationFrame(() => document.body.classList.replace("is-loading", "is-ready"));
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", start, { once: true });
} else {
  start();
}
