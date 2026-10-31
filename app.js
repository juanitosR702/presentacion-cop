/* ============================================================
   EL VIAJERO INVISIBLE · COP
   Lógica de presentación, interacción y animación
   ============================================================ */

(function () {
  "use strict";

  const NS = "http://www.w3.org/2000/svg";
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let animations = [];
  const timers = new Map();
  let currentScene = null;
  let solarTransitionRunning = false;
  let lastFocus = null;
  let helpTimer = null;

  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  function later(fn, ms, scope = "scene") {
    const id = window.setTimeout(() => {
      timers.delete(id);
      fn();
    }, ms);
    timers.set(id, scope);
    return id;
  }

  function cancelTimer(id) {
    if (id === null || id === undefined) return;
    window.clearTimeout(id);
    timers.delete(id);
  }

  function clearTimers(scope = "scene") {
    timers.forEach((timerScope, id) => {
      if (scope === "all" || timerScope === scope) {
        window.clearTimeout(id);
        timers.delete(id);
      }
    });
  }

  function track(animation) {
    if (animation) animations.push(animation);
    return animation;
  }

  function stopMotion() {
    clearTimers("scene");
    animations.forEach((animation) => {
      try { animation.pause(); } catch (error) { /* noop */ }
    });
    animations = [];
  }

  function svgEl(tag, attrs) {
    const el = document.createElementNS(NS, tag);
    if (attrs) {
      Object.keys(attrs).forEach((key) => el.setAttribute(key, attrs[key]));
    }
    return el;
  }

  function formatNumber(value) {
    return Math.round(value).toLocaleString("es-ES");
  }

  function pad(number) {
    return String(number).padStart(2, "0");
  }

  function isTypingTarget(target) {
    if (!target) return false;
    const tag = target.tagName;
    if (tag === "TEXTAREA" || tag === "SELECT") return true;
    if (tag === "INPUT") {
      const type = (target.type || "text").toLowerCase();
      return ["text", "search", "email", "number", "password", "tel", "url"].indexOf(type) !== -1;
    }
    return target.isContentEditable;
  }

  /* ------------------------------------------------------------
     Reveal.js
     ------------------------------------------------------------ */

  const sceneReset = {};
  const sceneExit = {};

  function onReady() {
    document.body.classList.add("is-ready");

    $$(".slides > section.slide").forEach((slide) => {
      $$(".reveal-item", slide).forEach((el, index) => {
        el.style.setProperty("--i", index);
      });
    });

    const total = Reveal.getTotalSlides();
    const totalEl = $("#slideTotal");
    if (totalEl) totalEl.textContent = pad(total);

    enterScene(Reveal.getCurrentSlide());

    later(() => {
      const toast = $("#helpToast");
      if (toast) toast.classList.add("is-visible");
      later(() => toast && toast.classList.remove("is-visible"), 7000, "ui");
    }, 1400, "ui");
  }

  function onSlideChanged(event) {
    const next = event && event.currentSlide ? event.currentSlide : Reveal.getCurrentSlide();
    const previous = event && event.previousSlide ? event.previousSlide : null;
    const solarZoom = Boolean(previous && next && previous.getAttribute("data-scene") === "hero" && next.getAttribute("data-scene") === "map");
    const earthNode = solarZoom ? $(".solar-planet--earth", previous) : null;
    const earthRect = earthNode ? earthNode.getBoundingClientRect() : null;
    if (previous && previous !== next) exitScene(previous);
    enterScene(next, { silentIntro: solarZoom });
    if (solarZoom) {
      playPresentationSound("solarZoom");
      startSolarEarthTransition(earthRect, next);
    }
  }

  function startSolarEarthTransition(sourceRect, targetSlide) {
    const overlay = $("#solarTransition");
    const earth = $("#solarTransitionEarth", overlay);
    if (!overlay || !earth) return;
    const viewportW = window.innerWidth || 1280;
    const viewportH = window.innerHeight || 720;
    const size = sourceRect && sourceRect.width ? Math.max(32, sourceRect.width) : 52;
    const x = sourceRect && sourceRect.width ? sourceRect.left + sourceRect.width / 2 : viewportW * .65;
    const y = sourceRect && sourceRect.height ? sourceRect.top + sourceRect.height / 2 : viewportH * .5;
    const mapStage = $(".map-stage", targetSlide);
    const mapCanvas = $(".map-globe-canvas", targetSlide);
    const canvasRect = mapCanvas ? mapCanvas.getBoundingClientRect() : null;
    const canvasH = mapCanvas && mapCanvas.clientHeight ? mapCanvas.clientHeight : (mapStage ? mapStage.clientHeight : (canvasRect ? canvasRect.height : 0));
    const endSize = canvasH ? canvasH * ((globe.radius * 2) / globe.h) : 260;
    overlay.style.setProperty("--solar-x", `${x}px`);
    overlay.style.setProperty("--solar-y", `${y}px`);
    overlay.style.setProperty("--solar-x-center", `${viewportW / 2}px`);
    overlay.style.setProperty("--solar-y-center", `${viewportH / 2}px`);
    overlay.style.setProperty("--solar-size", `${size}px`);
    overlay.style.setProperty("--solar-size-end", `${endSize}px`);
    overlay.style.setProperty("--solar-zoom-scale", String(endSize / size));
    targetSlide.classList.add("is-solar-transitioning");
    overlay.classList.toggle("is-reduced", reduceMotion);
    overlay.classList.remove("is-active");
    void overlay.offsetWidth;
    overlay.classList.add("is-active");
    solarTransitionRunning = true;

    ensureGlobe(targetSlide).then((ready) => {
      if (!ready || !solarTransitionRunning || currentScene !== "map") return;
      drawSphere(30 * Math.PI / 180, -95 * Math.PI / 180, performance.now());
      try {
        const globeTexture = globe.sphereCanvas.toDataURL("image/png");
        earth.style.setProperty("--solar-earth-texture", `url("${globeTexture}")`);
      } catch (error) {
        // Keep the CSS-shaded Earth if the browser blocks canvas serialization.
      }
    });

    later(() => {
      if (!solarTransitionRunning || currentScene !== "map") return;
      const settledCanvas = mapCanvas ? mapCanvas.getBoundingClientRect() : null;
      const settledX = settledCanvas && settledCanvas.width ? settledCanvas.left + settledCanvas.width * (globe.cx / globe.w) : viewportW * .73;
      const settledY = settledCanvas && settledCanvas.height ? settledCanvas.top + settledCanvas.height * (globe.cy / globe.h) : viewportH * .5;
      overlay.style.setProperty("--solar-x-end", `${settledX}px`);
      overlay.style.setProperty("--solar-y-end", `${settledY}px`);
      overlay.classList.add("is-docking");
      later(() => {
        if (!solarTransitionRunning || currentScene !== "map") return;
        overlay.classList.add("is-releasing");
        later(() => {
          overlay.classList.remove("is-active", "is-reduced", "is-docking", "is-releasing");
          targetSlide.classList.remove("is-solar-transitioning");
          solarTransitionRunning = false;
          if (currentScene === "map") later(playAllMapRoutes, 420);
        }, 260);
      }, reduceMotion ? 360 : 900);
    }, reduceMotion ? 60 : 2380);
  }

  function clearSolarEarthTransition() {
    const overlay = $("#solarTransition");
    if (overlay) overlay.classList.remove("is-active", "is-reduced", "is-docking", "is-releasing");
    $$(".slide--map.is-solar-transitioning").forEach((slide) => slide.classList.remove("is-solar-transitioning"));
    solarTransitionRunning = false;
  }

  function exitScene(slide) {
    if (!slide) return;

    const scene = slide.getAttribute("data-scene");
    stopMotion();
    stopTraitAuto(false);

    const sceneCleanup = sceneExit[scene];
    if (typeof sceneCleanup === "function") {
      try { sceneCleanup(slide); } catch (error) { /* noop */ }
    }

    slide.classList.remove("is-entered");
  }

  function enterScene(slide, { silentIntro = false } = {}) {
    if (!slide) return;

    stopMotion();
    stopTraitAuto(false);

    $$(".slides > section.slide").forEach((item) => {
      if (item !== slide) item.classList.remove("is-entered");
    });

    const scene = slide.getAttribute("data-scene");
    currentScene = scene;

    if (sceneReset[scene]) {
      try { sceneReset[scene](); } catch (error) { /* noop */ }
    }

    updateHUD(slide);

    const sceneSoundCues = {
      definition: "definitionEnter",
      traits: "traitsEnter",
      dirty: "dirtyEnter",
      biomag: "bioEnter",
      treaty: "treatyEnter",
      close: "closeEnter"
    };
    if (!silentIntro && sceneSoundCues[scene]) {
      later(() => {
        playPresentationSound(sceneSoundCues[scene]);
        if (scene === "traits") {
          later(() => {
            if (currentScene === "traits" && activeTraitKey === "persistence") {
              playPresentationSound("trait-persistence");
            }
          }, 420);
        }
      }, 150);
    }

    if ($("#notesPanel") && $("#notesPanel").classList.contains("is-open")) {
      renderNotes(slide);
    }

    // Reinicia la animación de entrada de los elementos de esta escena.
    slide.classList.remove("is-entered");
    void slide.offsetWidth;
    slide.classList.add("is-entered");

    const sceneEnter = sceneReset[scene + ":enter"];
    if (typeof sceneEnter === "function") {
      later(sceneEnter, 260);
    }
  }

  function updateHUD(slide) {
    const block = slide.getAttribute("data-block") || "01";
    const blockTitle = slide.getAttribute("data-block-title") || "";
    const sceneTitle = slide.getAttribute("data-scene-title") || "";

    const hudBlock = $("#hudBlock");
    const hudScene = $("#hudScene");
    if (hudBlock) hudBlock.textContent = `BLOQUE ${block} / ${blockTitle}`;
    if (hudScene) hudScene.textContent = sceneTitle;

    const index = Reveal.getIndices().h;
    const total = Reveal.getTotalSlides();
    const currentEl = $("#slideCurrent");
    if (currentEl) currentEl.textContent = pad(index + 1);

    const fill = $("#progressFill");
    if (fill) fill.style.width = `${((index + 1) / total) * 100}%`;

    $$(".progress__labels span").forEach((label, i) => {
      label.classList.toggle("is-active", i === Number(block) - 1);
    });
  }

  /* ------------------------------------------------------------
     Navegación, guion y mapa de escenas
     ------------------------------------------------------------ */

  function showToastOnce() {
    const toast = $("#helpToast");
    if (toast) toast.classList.remove("is-visible");
  }

  function openNotes() {
    const panel = $("#notesPanel");
    if (!panel) return;
    playPresentationSound("panelOpen");
    const slide = Reveal.getCurrentSlide();
    renderNotes(slide);
    panel.classList.add("is-open");
    panel.setAttribute("aria-hidden", "false");
    showToastOnce();
    const close = $("#notesClose");
    if (close) close.focus();
  }

  function closeNotes(silent = false) {
    const panel = $("#notesPanel");
    if (!panel) return;
    const wasOpen = panel.classList.contains("is-open");
    panel.classList.remove("is-open");
    panel.setAttribute("aria-hidden", "true");
    if (wasOpen && !silent) playPresentationSound("panelClose");
  }

  function renderNotes(slide) {
    const title = $("#notesTitle");
    const body = $("#notesBody");
    if (!title || !body) return;
    title.textContent = slide.getAttribute("data-scene-title") || "GUION";
    const notes = $(".notes", slide);
    body.innerHTML = notes ? notes.innerHTML : "<p>Sin notas para esta escena.</p>";
    body.scrollTop = 0;
  }

  function openMap() {
    const modal = $("#mapModal");
    if (!modal) return;
    playPresentationSound("panelOpen");
    lastFocus = document.activeElement;
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    showToastOnce();
    const close = $("#mapClose");
    if (close) close.focus();
  }

  function closeMap(silent = false) {
    const modal = $("#mapModal");
    if (!modal) return;
    const wasOpen = modal.classList.contains("is-open");
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    if (lastFocus && lastFocus.focus) lastFocus.focus();
    if (wasOpen && !silent) playPresentationSound("panelClose");
  }

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      const root = document.documentElement;
      const request = root.requestFullscreen || root.webkitRequestFullscreen;
      if (request) {
        request.call(root).catch(() => { /* noop */ });
      }
    } else if (document.exitFullscreen) {
      document.exitFullscreen().catch(() => { /* noop */ });
    }
  }

  function playNavigationSound(direction = 0, targetIndex = null) {
    const currentIndex = Reveal.getIndices().h;
    const destination = targetIndex === null ? currentIndex + direction : targetIndex;
    const solarZoom = currentScene === "hero" && destination === 1;
    playPresentationSound(solarZoom ? "journey" : "navigate");
  }

  function bindChrome() {
    document.addEventListener("pointerdown", primePresentationAudio, { capture: true });
    document.addEventListener("keydown", primePresentationAudio, { capture: true });

    const soundToggle = $("[data-sound-toggle]");
    if (soundToggle) {
      soundToggle.addEventListener("click", () => {
        presentationSoundEnabled = !presentationSoundEnabled;
        soundToggle.setAttribute("aria-pressed", presentationSoundEnabled ? "true" : "false");
        const label = presentationSoundEnabled ? "Silenciar sonidos" : "Activar sonidos";
        soundToggle.setAttribute("aria-label", label);
        soundToggle.setAttribute("title", label);
        if (presentationSoundEnabled) playPresentationSound("soundOn");
        else stopPresentationSound();
      });
    }

    $$("[data-open]").forEach((button) => {
      button.addEventListener("click", () => {
        if (button.getAttribute("data-open") === "notes") openNotes();
        if (button.getAttribute("data-open") === "map") openMap();
      });
    });

    const notesClose = $("#notesClose");
    if (notesClose) notesClose.addEventListener("click", closeNotes);

    const mapClose = $("#mapClose");
    if (mapClose) mapClose.addEventListener("click", closeMap);

    const mapModal = $("#mapModal");
    if (mapModal) {
      mapModal.addEventListener("click", (event) => {
        if (event.target === mapModal) closeMap();
      });
      $$(".map-block", mapModal).forEach((button) => {
        button.addEventListener("click", () => {
          const index = Number(button.getAttribute("data-slide"));
          closeMap(true);
          playNavigationSound(index > Reveal.getIndices().h ? 1 : -1, index);
          Reveal.slide(index);
        });
      });
    }

    const prev = $("#prevSlide");
    const next = $("#nextSlide");
    if (prev) prev.addEventListener("click", () => { playNavigationSound(-1); Reveal.prev(); });
    if (next) next.addEventListener("click", () => { playNavigationSound(1); Reveal.next(); });

    const fullscreenBtn = $("#fullscreenBtn");
    if (fullscreenBtn) fullscreenBtn.addEventListener("click", toggleFullscreen);

    document.addEventListener("keydown", (event) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTypingTarget(event.target)) return;

      const key = event.key.toLowerCase();
      const notesPanel = $("#notesPanel");
      const modal = $("#mapModal");

      if (["arrowright", "arrowleft", "arrowdown", "arrowup", "pagedown", "pageup"].includes(key)) {
        const forward = ["arrowright", "arrowdown", "pagedown"].includes(key);
        playNavigationSound(forward ? 1 : -1);
      }

      if (key === "s") {
        event.preventDefault();
        if (notesPanel && notesPanel.classList.contains("is-open")) closeNotes();
        else openNotes();
      } else if (key === "m") {
        event.preventDefault();
        if (modal && modal.classList.contains("is-open")) closeMap();
        else openMap();
      } else if (key === "escape") {
        closeNotes();
        closeMap();
      }
    });

    document.addEventListener("fullscreenchange", updateFullscreenLabel);
  }

  function updateFullscreenLabel() {
    const button = $("#fullscreenBtn");
    if (!button) return;
    button.setAttribute(
      "aria-label",
      document.fullscreenElement ? "Salir de pantalla completa" : "Pantalla completa"
    );
  }

  /* ------------------------------------------------------------
     Utilidades SVG · partículas sobre rutas
     ------------------------------------------------------------ */

  function emitRouteParticles(options) {
    const group = options.group;
    const paths = options.paths || (options.path ? [options.path] : []);
    if (!group || !paths.length) return;

    let lengths;
    try { lengths = paths.map((path) => path.getTotalLength()); } catch (error) { return; }
    if (lengths.some((length) => !length)) return;
    const totalLength = lengths.reduce((sum, length) => sum + length, 0);

    const count = options.count ?? 12;
    const duration = options.duration || 3000;
    const delayStep = options.delayStep || 110;
    const className = options.className || "hero-particle";

    for (let i = 0; i < count; i += 1) {
      const dot = svgEl("circle", {
        r: (2 + (i % 3) * 0.7).toFixed(2),
        cx: "-20",
        cy: "-20",
        opacity: "0",
        class: i % 7 === 3 ? "hero-particle--coral" : className
      });
      group.appendChild(dot);

      const state = { t: 0 };
      const animation = anime.animate(state, {
        t: 1,
        duration: duration + (i % 5) * 170,
        ease: "inOutSine",
        delay: (options.delay || 0) + i * delayStep,
        onUpdate: function () {
          let distance = state.t * totalLength;
          let pathIndex = 0;
          while (pathIndex < lengths.length - 1 && distance > lengths[pathIndex]) {
            distance -= lengths[pathIndex];
            pathIndex += 1;
          }
          const point = paths[pathIndex].getPointAtLength(Math.min(lengths[pathIndex], distance));
          dot.setAttribute("cx", point.x.toFixed(2));
          dot.setAttribute("cy", point.y.toFixed(2));
          let opacity = 1;
          if (state.t < 0.06) opacity = state.t / 0.06;
          else if (state.t > 0.9) opacity = (1 - state.t) / 0.1;
          dot.setAttribute("opacity", Math.max(0, opacity).toFixed(2));
        },
        onComplete: function () {
          dot.remove();
          if (i === count - 1 && typeof options.onDone === "function") {
            options.onDone();
          }
        }
      });
      track(animation);
    }
  }

  function clearGroup(group) {
    if (!group) return;
    while (group.firstChild) group.removeChild(group.firstChild);
  }

  /* ------------------------------------------------------------
     Escena 01 · Hero
     ------------------------------------------------------------ */

  function resetHero() {
    const slide = $('.slide[data-scene="hero"]');
    if (!slide) return;
    clearGroup($("#heroParticles", slide));
    $$(".route-path", slide).forEach((path) => path.classList.remove("is-live"));
    const readout = $("#heroReadout", slide);
    if (readout) readout.classList.remove("is-live");
    $$(".marker", slide).forEach((marker) => marker.classList.add("is-pulsing"));
    const button = $("#heroPlay", slide);
    if (button) button.querySelector("span").textContent = "Activar el viaje";
  }

  function exitHero() {
    const slide = $('.slide[data-scene="hero"]');
    if (!slide) return;
    clearGroup($("#heroParticles", slide));
    $$(".route-path", slide).forEach((path) => path.classList.remove("is-live"));
    const readout = $("#heroReadout", slide);
    if (readout) readout.classList.remove("is-live");
    $$(".marker", slide).forEach((marker) => marker.classList.remove("is-pulsing"));
  }

  function playHeroJourney() {
    if (currentScene === "hero") Reveal.next();
  }

  /* ------------------------------------------------------------
     Escena 02 · Mapa de transporte
     ------------------------------------------------------------ */

  const globe = { raf: 0, texture: null, imageData: null, ready: false, w: 1000, h: 500, cx: 510, cy: 250, radius: 211, segments: 420, active: null, startedAt: 0, duration: 5100, holdUntil: 0, sequence: [], sequenceIndex: 0, paused: false };

  function globeRoutes(slide) {
    const result = {};
    ["gulf", "ruhr", "pearl"].forEach((key) => {
      const paths = $$(`.route-path[data-route="${key}"]`, slide);
      if (!paths.length) return;
      const lengths = paths.map((path) => {
        try { return path.getTotalLength(); } catch (error) { return 0; }
      });
      const total = lengths.reduce((sum, value) => sum + value, 0);
      if (!total) return;
      const count = 240;
      const points = [];
      let previousLongitude = null;
      for (let i = 0; i <= count; i += 1) {
        let distance = (i / count) * total;
        let index = 0;
        while (index < lengths.length - 1 && distance > lengths[index]) {
          distance -= lengths[index];
          index += 1;
        }
        const point = paths[index].getPointAtLength(Math.min(lengths[index], distance));
        let longitude = (point.x / 1000) * Math.PI * 2 - Math.PI;
        if (previousLongitude !== null) {
          while (longitude - previousLongitude > Math.PI) longitude -= Math.PI * 2;
          while (longitude - previousLongitude < -Math.PI) longitude += Math.PI * 2;
        }
        previousLongitude = longitude;
        points.push({ lon: longitude, lat: Math.PI / 2 - (point.y / 500) * Math.PI });
      }
      result[key] = points;
    });
    return result;
  }

  function ensureGlobe(slide) {
    const stage = $(".map-stage", slide);
    const canvas = $("#mapGlobeCanvas", slide);
    const image = $(".world-map", stage);
    if (!stage || !canvas || !image) return Promise.resolve(false);
    if (globe.ready) return Promise.resolve(true);
    if (globe.loading) return globe.loading;
    globe.loading = new Promise((resolve) => {
      const prepare = () => {
        try {
          const textureCanvas = document.createElement("canvas");
          textureCanvas.width = 1000;
          textureCanvas.height = 500;
          const textureContext = textureCanvas.getContext("2d", { willReadFrequently: true });
          textureContext.clearRect(0, 0, 1000, 500);
          textureContext.drawImage(image, 0, 0, 1000, 500);
          globe.texture = textureContext.getImageData(0, 0, 1000, 500);
          globe.canvas = canvas;
          // The drawing coordinates below use the map's 1000 × 500 viewBox.
          // Keep the backing bitmap aligned with that space; CSS only scales it.
          canvas.width = globe.w;
          canvas.height = globe.h;
          globe.context = canvas.getContext("2d", { alpha: false });
          globe.sphereCanvas = document.createElement("canvas");
          globe.sphereCanvas.width = globe.segments;
          globe.sphereCanvas.height = globe.segments;
          globe.sphereContext = globe.sphereCanvas.getContext("2d", { alpha: true });
          globe.spherePixels = globe.sphereContext.createImageData(globe.segments, globe.segments);
          globe.routes = globeRoutes(slide);
          globe.ready = Boolean(globe.context && globe.texture && Object.keys(globe.routes).length);
          if (globe.ready) stage.classList.add("is-globe-ready");
          resolve(globe.ready);
        } catch (error) {
          globe.loading = null;
          resolve(false);
        }
      };
      if (image.complete && image.naturalWidth) prepare();
      else {
        image.addEventListener("load", prepare, { once: true });
        image.addEventListener("error", () => { globe.loading = null; resolve(false); }, { once: true });
      }
    });
    return globe.loading;
  }

  function spherePoint(lat, lon, centerLat, centerLon) {
    let delta = lon - centerLon;
    while (delta > Math.PI) delta -= Math.PI * 2;
    while (delta < -Math.PI) delta += Math.PI * 2;
    const x = Math.cos(lat) * Math.sin(delta);
    const y = Math.sin(lat) * Math.cos(centerLat) - Math.cos(lat) * Math.cos(delta) * Math.sin(centerLat);
    const z = Math.sin(lat) * Math.sin(centerLat) + Math.cos(lat) * Math.cos(delta) * Math.cos(centerLat);
    return { x: globe.cx + x * globe.radius, y: globe.cy - y * globe.radius, z };
  }

  function drawSphere(centerLat, centerLon, time) {
    const ctx = globe.context;
    const image = globe.texture;
    const size = globe.segments;
    const radius = (size - 2) / 2;
    const data = globe.spherePixels.data;
    const texture = image.data;
    const lightX = -0.42, lightY = 0.48, lightZ = 0.77;
    for (let py = 0; py < size; py += 1) {
      const sy = (radius - py) / radius;
      for (let px = 0; px < size; px += 1) {
        const sx = (px - radius) / radius;
        const r2 = sx * sx + sy * sy;
        const out = (py * size + px) * 4;
        if (r2 > 1) { data[out + 3] = 0; continue; }
        const sz = Math.sqrt(1 - r2);
        const lat = Math.asin(sy * Math.cos(centerLat) + sz * Math.sin(centerLat));
        const delta = Math.atan2(sx, sz * Math.cos(centerLat) - sy * Math.sin(centerLat));
        const lon = centerLon + delta;
        const tx = ((lon / (Math.PI * 2) + 0.5) * 1000 + 1000) % 1000;
        const ty = Math.max(0, Math.min(499, Math.floor((0.5 - lat / Math.PI) * 500)));
        const ti = (ty * 1000 + Math.floor(tx)) * 4;
        const a = texture[ti + 3] / 255;
        const diffuse = Math.max(0, sx * lightX + sy * lightY + sz * lightZ);
        const shade = 0.26 + diffuse * 0.75;
        const ocean = [5, 18, 35];
        data[out] = Math.min(255, (ocean[0] * (1 - a) + texture[ti] * a) * shade);
        data[out + 1] = Math.min(255, (ocean[1] * (1 - a) + texture[ti + 1] * a) * shade);
        data[out + 2] = Math.min(255, (ocean[2] * (1 - a) + texture[ti + 2] * a) * shade);
        data[out + 3] = 255;
      }
    }
    globe.sphereContext.putImageData(globe.spherePixels, 0, 0);

    ctx.clearRect(0, 0, globe.w, globe.h);
    const backdrop = ctx.createRadialGradient(globe.cx, globe.cy, 20, globe.cx, globe.cy, 440);
    backdrop.addColorStop(0, "rgba(37,103,166,.22)");
    backdrop.addColorStop(.5, "rgba(12,37,67,.15)");
    backdrop.addColorStop(1, "rgba(2,8,17,0)");
    ctx.fillStyle = backdrop;
    ctx.fillRect(0, 0, globe.w, globe.h);
    for (let i = 0; i < 34; i += 1) {
      const x = (i * 179 + 43) % globe.w;
      const y = (i * 97 + 19) % globe.h;
      ctx.fillStyle = `rgba(171,206,241,${0.18 + ((i * 13) % 10) / 100})`;
      ctx.beginPath(); ctx.arc(x, y, i % 9 === 0 ? 1.25 : .7, 0, Math.PI * 2); ctx.fill();
    }
    const halo = ctx.createRadialGradient(globe.cx, globe.cy, globe.radius * .88, globe.cx, globe.cy, globe.radius * 1.13);
    halo.addColorStop(0, "rgba(73,158,237,0)");
    halo.addColorStop(.72, "rgba(82,169,241,.08)");
    halo.addColorStop(1, "rgba(133,202,255,.32)");
    ctx.fillStyle = halo;
    ctx.beginPath(); ctx.arc(globe.cx, globe.cy, globe.radius * 1.13, 0, Math.PI * 2); ctx.fill();
    ctx.drawImage(globe.sphereCanvas, globe.cx - globe.radius, globe.cy - globe.radius, globe.radius * 2, globe.radius * 2);
    ctx.save();
    ctx.beginPath(); ctx.arc(globe.cx, globe.cy, globe.radius, 0, Math.PI * 2); ctx.clip();
    drawGlobeGraticule(ctx, centerLat, centerLon);
    if (globe.active) drawGlobeRoute(ctx, globe.active.points, centerLat, centerLon, globe.active.progress);
    drawDestination(ctx, centerLat, centerLon);
    ctx.restore();
    ctx.beginPath(); ctx.arc(globe.cx, globe.cy, globe.radius, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(164,216,255,.72)"; ctx.lineWidth = 1.35; ctx.stroke();
    ctx.beginPath(); ctx.arc(globe.cx, globe.cy, globe.radius + 4, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(112,190,255,${.18 + Math.sin(time / 900) * .035})`; ctx.lineWidth = 5; ctx.stroke();
  }

  function drawGlobeGraticule(ctx, lat0, lon0) {
    ctx.lineWidth = 0.8;
    ctx.strokeStyle = "rgba(167,205,238,.18)";
    for (let lat = -60; lat <= 60; lat += 30) {
      let open = false;
      ctx.beginPath();
      for (let i = 0; i <= 120; i += 1) {
        const p = spherePoint(lat * Math.PI / 180, -Math.PI + i / 120 * Math.PI * 2, lat0, lon0);
        if (p.z > 0) { if (!open) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); open = true; }
        else open = false;
      }
      ctx.stroke();
    }
    for (let lon = -150; lon <= 180; lon += 30) {
      let open = false;
      ctx.beginPath();
      for (let i = 0; i <= 90; i += 1) {
        const p = spherePoint((-Math.PI / 2) + (i / 90) * Math.PI, lon * Math.PI / 180, lat0, lon0);
        if (p.z > 0) { if (!open) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); open = true; }
        else open = false;
      }
      ctx.stroke();
    }
  }

  function drawGlobeRoute(ctx, points, lat0, lon0, progress) {
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.beginPath();
    let connected = false;
    points.forEach((point, index) => {
      if (index / (points.length - 1) > progress) return;
      const p = spherePoint(point.lat, point.lon, lat0, lon0);
      if (p.z > 0) { if (!connected) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); connected = true; }
      else connected = false;
    });
    ctx.strokeStyle = "rgba(112,224,202,.92)"; ctx.lineWidth = 2.5;
    ctx.shadowColor = "rgba(112,224,202,.86)"; ctx.shadowBlur = 10; ctx.stroke(); ctx.shadowBlur = 0;
    const particleIndex = Math.min(points.length - 1, Math.floor(progress * (points.length - 1)));
    const particle = spherePoint(points[particleIndex].lat, points[particleIndex].lon, lat0, lon0);
    if (particle.z > 0) {
      const tailStart = Math.max(0, particleIndex - 12);
      const tail = ctx.createLinearGradient(particle.x - 24, particle.y + 8, particle.x, particle.y);
      tail.addColorStop(0, "rgba(112,224,202,0)"); tail.addColorStop(1, "rgba(188,255,240,.82)");
      ctx.beginPath();
      for (let i = tailStart; i <= particleIndex; i += 1) {
        const p = spherePoint(points[i].lat, points[i].lon, lat0, lon0);
        if (p.z > 0) { if (i === tailStart) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); }
      }
      ctx.strokeStyle = tail; ctx.lineWidth = 3.3; ctx.stroke();
      ctx.beginPath(); ctx.arc(particle.x, particle.y, 7.5, 0, Math.PI * 2); ctx.fillStyle = "rgba(112,224,202,.18)"; ctx.fill();
      ctx.beginPath(); ctx.arc(particle.x, particle.y, 3.4, 0, Math.PI * 2); ctx.fillStyle = "#D8FFF5"; ctx.shadowColor = "#74E0C8"; ctx.shadowBlur = 14; ctx.fill(); ctx.shadowBlur = 0;
    }
  }

  function drawDestination(ctx, lat0, lon0) {
    const p = spherePoint(Math.PI / 2 - (33.3 / 500) * Math.PI, (388.9 / 1000) * Math.PI * 2 - Math.PI, lat0, lon0);
    if (p.z <= 0) return;
    ctx.beginPath(); ctx.arc(p.x, p.y, 5.5, 0, Math.PI * 2); ctx.strokeStyle = "rgba(149,220,255,.8)"; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.beginPath(); ctx.arc(p.x, p.y, 1.8, 0, Math.PI * 2); ctx.fillStyle = "#C6E7FF"; ctx.fill();
  }

  function globeFrame(time) {
    if (!globe.ready || !globe.active || globe.paused) return;
    const elapsed = Math.max(0, time - globe.startedAt);
    const progress = Math.min(1, elapsed / globe.duration);
    globe.active.progress = progress;
    const index = Math.min(globe.active.points.length - 1, Math.floor(progress * (globe.active.points.length - 1)));
    const focus = globe.active.points[index];
    const centerLat = focus.lat * .68 + (Math.PI / 2 - .18) * .32;
    drawSphere(centerLat, focus.lon, time);
    if (progress >= 1) {
      if (!globe.holdUntil) globe.holdUntil = time + 900;
      if (time >= globe.holdUntil) {
        globe.sequenceIndex += 1;
        globe.holdUntil = 0;
        if (globe.sequenceIndex < globe.sequence.length) {
          startGlobeRoute(globe.sequence[globe.sequenceIndex]);
          return;
        }
        else { globe.active = null; globeFrame(time); return; }
      }
    }
    globe.raf = window.requestAnimationFrame(globeFrame);
  }

  function startGlobeRoute(key) {
    const route = globe.routes && globe.routes[key];
    if (!route) return;
    playPresentationSound("route");
    const slide = $('.slide[data-scene="map"]');
    $$(".route-card", slide).forEach((card) => card.classList.toggle("is-active", card.getAttribute("data-route") === key));
    $$(".route-path", slide).forEach((path) => path.classList.toggle("is-live", path.getAttribute("data-route") === key));
    globe.active = { key, points: route, progress: 0 };
    globe.startedAt = performance.now();
    globe.duration = reduceMotion ? 1 : 5100;
    globe.holdUntil = 0;
    if (globe.raf) cancelAnimationFrame(globe.raf);
    if (reduceMotion) { const end = route[route.length - 1]; globe.active.progress = 1; drawSphere(end.lat, end.lon, performance.now()); }
    else globe.raf = requestAnimationFrame(globeFrame);
  }

  function resetMapScene() {
    const slide = $('.slide[data-scene="map"]');
    if (!slide) return;
    if (globe.raf) cancelAnimationFrame(globe.raf);
    globe.raf = 0; globe.active = null; globe.sequence = []; globe.sequenceIndex = 0; globe.holdUntil = 0;
    clearGroup($("#mapSlideParticles", slide));
    $$(".route-path", slide).forEach((path) => path.classList.remove("is-live"));
    $$(".route-card", slide).forEach((card) => card.classList.remove("is-active"));
    const stage = $(".map-stage", slide);
    if (stage) stage.classList.remove("is-scanning");
  }

  function playMapRoute(key) {
    if (!key) return;
    const slide = $('.slide[data-scene="map"]');
    if (!slide) return;

    stopMotion();
    resetMapScene();

    const stage = $(".map-stage", slide);
    if (stage) stage.classList.add("is-scanning");
    ensureGlobe(slide).then((ready) => {
      if (!ready || currentScene !== "map") return;
      globe.sequence = [key]; globe.sequenceIndex = 0; startGlobeRoute(key);
    });
  }

  function playAllMapRoutes() {
    const slide = $('.slide[data-scene="map"]');
    if (!slide) return;

    stopMotion();
    resetMapScene();
    const stage = $(".map-stage", slide);
    if (stage) stage.classList.add("is-scanning");
    ensureGlobe(slide).then((ready) => {
      if (!ready || currentScene !== "map") return;
      globe.sequence = ["gulf", "ruhr", "pearl"]; globe.sequenceIndex = 0;
      startGlobeRoute(globe.sequence[0]);
    });
  }

  sceneReset.hero = resetHero;
  sceneReset.map = resetMapScene;
  sceneReset["map:enter"] = () => {
    if (!solarTransitionRunning) playAllMapRoutes();
  };

  /* ------------------------------------------------------------
     Escena 03 · Definición y prueba de resistencia
     ------------------------------------------------------------ */

  let presentationAudioContext = null;
  let presentationSoundEnabled = true;
  let presentationSoundSequence = 0;
  let activePresentationCue = "";
  const presentationAudioNodes = new Set();
  let eggWearNoiseBuffer = null;
  let presentationNoiseBuffer = null;
  const resistanceFlightSound = [
    { at: 0.12, from: 180, to: 520, duration: 0.58, volume: 0.044, wave: "sine" },
    { at: 0.24, from: 680, to: 1180, duration: 0.42, volume: 0.025, wave: "triangle" }
  ];
  const resistanceBounceSound = [
    { at: 0.91, from: 112, to: 62, duration: 0.34, volume: 0.11, wave: "sine" },
    { at: 0.92, from: 920, to: 1540, duration: 0.075, volume: 0.065, wave: "triangle" },
    { at: 1.0, from: 1320, to: 620, duration: 0.34, volume: 0.08, wave: "sine" },
    { at: 1.14, from: 580, to: 250, duration: 0.28, volume: 0.052, wave: "triangle" },
    { at: 1.34, from: 260, to: 135, duration: 0.2, volume: 0.035, wave: "sine" }
  ];
  const resistanceUVRebound = [
    { at: 0.96, from: 1780, to: 740, duration: 0.22, volume: 0.045, wave: "triangle" },
    { at: 1.12, from: 840, to: 390, duration: 0.25, volume: 0.032, wave: "sine" }
  ];
  const resistanceWaterRebound = [
    { at: 0.94, from: 560, to: 170, duration: 0.25, volume: 0.05, wave: "sine" },
    { at: 1.16, from: 310, to: 115, duration: 0.22, volume: 0.036, wave: "triangle" }
  ];
  const resistanceMicrobeRebound = [
    { at: 0.93, from: 320, to: 105, duration: 0.2, volume: 0.052, wave: "triangle" },
    { at: 1.1, from: 190, to: 82, duration: 0.24, volume: 0.04, wave: "sine" }
  ];

  const presentationSoundCues = {
    tap: [{ at: 0, from: 680, to: 500, duration: 0.07, volume: 0.012 }],
    panelOpen: [
      { at: 0, from: 460, to: 690, duration: 0.14, volume: 0.022 },
      { at: 0.08, from: 690, to: 910, duration: 0.11, volume: 0.012 }
    ],
    panelClose: [{ at: 0, from: 700, to: 440, duration: 0.12, volume: 0.016 }],
    navigate: [{ at: 0, from: 500, to: 670, duration: 0.11, volume: 0.018 }],
    journey: [
      { at: 0, from: 230, to: 470, duration: 0.32, volume: 0.025, wave: "triangle" },
      { at: 0.14, from: 440, to: 730, duration: 0.24, volume: 0.012 }
    ],
    route: [
      { at: 0, from: 330, to: 440, duration: 0.13, volume: 0.034, wave: "triangle" },
      { at: 0.11, from: 520, to: 790, duration: 0.16, volume: 0.026 }
    ],
    solarZoom: [
      { at: 0, from: 110, to: 210, duration: 2.2, volume: 0.065, wave: "sine" },
      { at: 0.32, from: 180, to: 360, duration: 1.55, volume: 0.038, wave: "triangle" },
      { at: 1.1, from: 480, to: 1120, duration: 0.72, volume: 0.028, wave: "sine" },
      { at: 2.2, from: 960, to: 620, duration: 0.48, volume: 0.022, wave: "triangle" }
    ],
    traitsEnter: [
      { at: 0, from: 145, to: 220, duration: 0.48, volume: 0.075, wave: "sine" },
      { at: 0.12, from: 420, to: 760, duration: 0.42, volume: 0.046, wave: "triangle" },
      { at: 0.25, from: 1180, to: 360, duration: 0.38, volume: 0.038, wave: "noise" }
    ],
    definitionEnter: [
      { at: 0, from: 150, to: 205, duration: 0.42, volume: 0.045, wave: "sine" },
      { at: 0.1, from: 520, to: 760, duration: 0.24, volume: 0.024, wave: "triangle" }
    ],
    traitStep: [
      { at: 0, from: 520, to: 690, duration: 0.13, volume: 0.035 },
      { at: 0.09, from: 780, to: 920, duration: 0.12, volume: 0.022 }
    ],
    dirtyEnter: [
      { at: 0, from: 310, to: 430, duration: 0.18, volume: 0.035, wave: "triangle" },
      { at: 0.15, from: 470, to: 620, duration: 0.16, volume: 0.026 },
      { at: 0.3, from: 690, to: 830, duration: 0.13, volume: 0.016 }
    ],
    bioEnter: [
      { at: 0, from: 260, to: 380, duration: 0.3, volume: 0.045 },
      { at: 0.2, from: 410, to: 560, duration: 0.24, volume: 0.03 },
      { at: 0.4, from: 600, to: 760, duration: 0.18, volume: 0.018 }
    ],
    bioStep: [
      { at: 0, from: 350, to: 480, duration: 0.18, volume: 0.04 },
      { at: 0.1, from: 520, to: 720, duration: 0.18, volume: 0.027 },
      { at: 0.2, from: 780, to: 920, duration: 0.12, volume: 0.016 }
    ],
    bioEat: [
      { at: 0, from: 720, to: 260, duration: 0.13, volume: 0.055, wave: "noise" },
      { at: 0.03, from: 210, to: 135, duration: 0.2, volume: 0.092, wave: "sine" },
      { at: 0.16, from: 155, to: 88, duration: 0.26, volume: 0.074, wave: "triangle" }
    ],
    treatyEnter: [
      { at: 0, from: 220, to: 220, duration: 0.62, volume: 0.038 },
      { at: 0, from: 330, to: 330, duration: 0.62, volume: 0.03, wave: "triangle" },
      { at: 0, from: 440, to: 440, duration: 0.62, volume: 0.022 },
      { at: 0.38, from: 660, to: 880, duration: 0.22, volume: 0.02 }
    ],
    closeEnter: [
      { at: 0, from: 523, to: 523, duration: 0.72, volume: 0.035 },
      { at: 0, from: 659, to: 659, duration: 0.72, volume: 0.028 },
      { at: 0, from: 784, to: 784, duration: 0.72, volume: 0.022 },
      { at: 0.4, from: 1046, to: 880, duration: 0.3, volume: 0.018 }
    ],
    category: [{ at: 0, from: 460, to: 650, duration: 0.13, volume: 0.019 }],
    substance: [{ at: 0, from: 770, to: 1020, duration: 0.1, volume: 0.018 }],
    back: [{ at: 0, from: 620, to: 420, duration: 0.11, volume: 0.016 }],
    trait: [{ at: 0, from: 560, to: 760, duration: 0.1, volume: 0.018 }],
    "trait-persistence": [
      { at: 0, from: 1180, to: 510, duration: 0.18, volume: 0.075, wave: "noise" },
      { at: 0.06, from: 190, to: 112, duration: 0.32, volume: 0.095, wave: "sine" },
      { at: 0.28, from: 1480, to: 620, duration: 0.16, volume: 0.064, wave: "noise" },
      { at: 0.34, from: 260, to: 155, duration: 0.3, volume: 0.078, wave: "triangle" },
      { at: 0.62, from: 1040, to: 430, duration: 0.15, volume: 0.052, wave: "noise" },
      { at: 0.68, from: 520, to: 255, duration: 0.4, volume: 0.068, wave: "sine" }
    ],
    "trait-bioaccumulation": [
      { at: 0, from: 310, to: 390, duration: 0.2, volume: 0.072, wave: "sine" },
      { at: 0.14, from: 390, to: 510, duration: 0.2, volume: 0.066, wave: "sine" },
      { at: 0.28, from: 510, to: 710, duration: 0.22, volume: 0.06, wave: "sine" },
      { at: 0.42, from: 165, to: 105, duration: 0.4, volume: 0.078, wave: "triangle" }
    ],
    "trait-toxicity": [
      { at: 0, from: 760, to: 1040, duration: 0.17, volume: 0.064, wave: "triangle" },
      { at: 0.12, from: 260, to: 122, duration: 0.24, volume: 0.084, wave: "sine" },
      { at: 0.14, from: 1480, to: 330, duration: 0.26, volume: 0.068, wave: "noise" },
      { at: 0.38, from: 210, to: 78, duration: 0.34, volume: 0.072, wave: "sine" }
    ],
    "trait-mobility": [
      { at: 0, from: 180, to: 1700, duration: 1.02, volume: 0.092, wave: "noise" },
      { at: 0.05, from: 145, to: 520, duration: 0.82, volume: 0.068, wave: "sine" },
      { at: 0.28, from: 520, to: 1220, duration: 0.42, volume: 0.044, wave: "triangle" }
    ],
    "trait-persistence-loop": [
      { at: 0, from: 1120, to: 500, duration: 0.2, volume: 0.11, wave: "noise" },
      { at: 0.08, from: 180, to: 105, duration: 0.38, volume: 0.14, wave: "sine" },
      { at: 0.18, from: 760, to: 340, duration: 0.3, volume: 0.075, wave: "triangle" }
    ],
    "trait-toxicity-loop": [
      { at: 0, from: 720, to: 1040, duration: 0.13, volume: 0.09, wave: "triangle" },
      { at: 0.1, from: 1320, to: 360, duration: 0.22, volume: 0.12, wave: "noise" },
      { at: 0.15, from: 170, to: 82, duration: 0.36, volume: 0.13, wave: "sine" }
    ],
    "trait-mobility-loop": [
      { at: 0, from: 170, to: 1600, duration: 0.86, volume: 0.14, wave: "noise" },
      { at: 0.06, from: 150, to: 520, duration: 0.7, volume: 0.095, wave: "sine" },
      { at: 0.3, from: 540, to: 1220, duration: 0.42, volume: 0.07, wave: "triangle" }
    ],
    auto: [{ at: 0, from: 420, to: 600, duration: 0.12, volume: 0.014 }],
    ddt: [
      { at: 0, from: 520, to: 300, duration: 0.18, volume: 0.022, wave: "triangle" },
      { at: 0.1, from: 290, to: 440, duration: 0.12, volume: 0.013 }
    ],
    scrub: [{ at: 0, from: 930, to: 720, duration: 0.045, volume: 0.009 }],
    levelUp: [{ at: 0, from: 390, to: 650, duration: 0.15, volume: 0.02 }],
    levelDown: [{ at: 0, from: 650, to: 390, duration: 0.15, volume: 0.02 }],
    checked: [{ at: 0, from: 920, to: 1240, duration: 0.08, volume: 0.016 }],
    unchecked: [{ at: 0, from: 650, to: 430, duration: 0.08, volume: 0.012 }],
    reset: [{ at: 0, from: 500, to: 280, duration: 0.15, volume: 0.018 }],
    soundOn: [{ at: 0, from: 760, to: 1000, duration: 0.09, volume: 0.012 }],
    "attack-uv": [
      { at: 0, from: 1120, to: 470, duration: 0.17, volume: 0.045, wave: "triangle" },
      { at: 0.035, from: 1640, to: 960, duration: 0.085, volume: 0.014 },
      ...resistanceFlightSound,
      ...resistanceBounceSound,
      ...resistanceUVRebound
    ],
    "attack-water": [
      { at: 0, from: 760, to: 547, duration: 0.095, volume: 0.04 },
      { at: 0.085, from: 590, to: 425, duration: 0.095, volume: 0.04 },
      { at: 0.17, from: 450, to: 324, duration: 0.095, volume: 0.04 },
      ...resistanceFlightSound,
      ...resistanceBounceSound,
      ...resistanceWaterRebound
    ],
    "attack-microbes": [
      { at: 0, from: 310, to: 235, duration: 0.12, volume: 0.034 },
      { at: 0.14, from: 370, to: 260, duration: 0.11, volume: 0.028, wave: "triangle" },
      ...resistanceFlightSound,
      ...resistanceBounceSound,
      ...resistanceMicrobeRebound
    ]
  };

  function stopPresentationSound() {
    presentationSoundSequence += 1;
    activePresentationCue = "";
    if (!presentationAudioContext) return;
    const now = presentationAudioContext.currentTime;
    presentationAudioNodes.forEach((oscillator) => {
      try { oscillator.stop(now); } catch (_) { /* El tono pudo terminar justo antes. */ }
    });
    presentationAudioNodes.clear();
  }

  function stopResistanceSound() {
    if (activePresentationCue.indexOf("attack-") === 0) stopPresentationSound();
  }

  function primePresentationAudio() {
    if (!presentationSoundEnabled) return;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    try {
      if (!presentationAudioContext) presentationAudioContext = new AudioContextClass();
      if (presentationAudioContext.state !== "running") presentationAudioContext.resume().catch(() => {});
    } catch (_) {
      presentationAudioContext = null;
    }
  }

  function schedulePresentationTone(context, startAt, frequency, endFrequency, duration, volume, waveform = "sine") {
    let source;
    let filter = null;
    const envelope = context.createGain();
    if (waveform === "noise") {
      if (!presentationNoiseBuffer) {
        presentationNoiseBuffer = context.createBuffer(1, Math.ceil(context.sampleRate * 1.1), context.sampleRate);
        const noise = presentationNoiseBuffer.getChannelData(0);
        for (let index = 0; index < noise.length; index += 1) noise[index] = Math.random() * 2 - 1;
      }
      source = context.createBufferSource();
      source.buffer = presentationNoiseBuffer;
      filter = context.createBiquadFilter();
      filter.type = "bandpass";
      filter.Q.setValueAtTime(0.65, startAt);
      filter.frequency.setValueAtTime(Math.max(80, frequency), startAt);
      filter.frequency.exponentialRampToValueAtTime(Math.max(80, endFrequency), startAt + duration);
      source.connect(filter);
      filter.connect(envelope);
    } else {
      source = context.createOscillator();
      source.type = waveform;
      source.frequency.setValueAtTime(frequency, startAt);
      source.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), startAt + duration);
      source.connect(envelope);
    }
    envelope.gain.setValueAtTime(0.0001, startAt);
    envelope.gain.exponentialRampToValueAtTime(volume, startAt + Math.min(0.012, duration / 4));
    envelope.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
    envelope.connect(context.destination);
    presentationAudioNodes.add(source);
    source.addEventListener("ended", () => {
      presentationAudioNodes.delete(source);
      source.disconnect();
      if (filter) filter.disconnect();
      envelope.disconnect();
    }, { once: true });
    source.start(startAt);
    source.stop(startAt + duration + 0.01);
  }

  function playPresentationSound(cue) {
    if (!presentationSoundEnabled) return;
    const notes = presentationSoundCues[cue];
    if (!notes) return;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;

    stopPresentationSound();
    activePresentationCue = cue;
    const sequence = presentationSoundSequence;
    try {
      if (!presentationAudioContext) presentationAudioContext = new AudioContextClass();
      const context = presentationAudioContext;
      const schedule = () => {
        if (sequence !== presentationSoundSequence || !presentationSoundEnabled || context.state !== "running") return;
        const now = context.currentTime + 0.025;
        notes.forEach((note) => schedulePresentationTone(
          context,
          now + note.at,
          note.from,
          note.to,
          note.duration,
          note.volume,
          note.wave || "sine"
        ));
      };

      if (context.state === "running") schedule();
      else context.resume().then(schedule).catch(() => {});
    } catch (_) {
      /* El audio es opcional: la interacción visual sigue funcionando si no está disponible. */
    }
  }

  function playEggWearSound(progress) {
    if (!presentationSoundEnabled) return;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;

    try {
      if (!presentationAudioContext) presentationAudioContext = new AudioContextClass();
      const context = presentationAudioContext;
      const sequence = presentationSoundSequence;
      const schedule = () => {
        if (sequence !== presentationSoundSequence || !presentationSoundEnabled || context.state !== "running") return;
        if (!eggWearNoiseBuffer) {
          eggWearNoiseBuffer = context.createBuffer(1, Math.ceil(context.sampleRate * 0.28), context.sampleRate);
          const noise = eggWearNoiseBuffer.getChannelData(0);
          for (let index = 0; index < noise.length; index += 1) noise[index] = Math.random() * 2 - 1;
        }

        const now = context.currentTime + 0.012;
        const duration = 0.21 + progress * 0.09;
        const source = context.createBufferSource();
        const filter = context.createBiquadFilter();
        const envelope = context.createGain();
        const peak = 0.032 + progress * 0.018;
        source.buffer = eggWearNoiseBuffer;
        filter.type = "bandpass";
        filter.frequency.setValueAtTime(720 + progress * 500, now);
        filter.Q.setValueAtTime(0.9, now);
        envelope.gain.setValueAtTime(0.0001, now);
        envelope.gain.linearRampToValueAtTime(peak, now + 0.04);
        envelope.gain.setValueAtTime(peak * 0.3, now + 0.095);
        envelope.gain.linearRampToValueAtTime(peak * 0.82, now + 0.17);
        envelope.gain.exponentialRampToValueAtTime(0.0001, now + duration);
        source.connect(filter);
        filter.connect(envelope);
        envelope.connect(context.destination);
        presentationAudioNodes.add(source);
        source.addEventListener("ended", () => {
          presentationAudioNodes.delete(source);
          source.disconnect();
          filter.disconnect();
          envelope.disconnect();
        }, { once: true });
        source.start(now);
        source.stop(now + duration + 0.01);
      };

      if (context.state === "running") schedule();
      else context.resume().then(schedule).catch(() => {});
    } catch (_) {
      /* El raspado acompaña la animación, pero nunca debe impedirla. */
    }
  }

  let definitionDemoTimer = null;
  let definitionImpactTimer = null;
  const testedAttacks = new Set();
  const resistanceFlightDuration = 1350;
  const resistanceImpactAt = 0.68;
  const resistanceParticleCount = 8;
  const resistanceParticleStagger = 42;

  const attackMessages = {
    uv: "La radiación UV apenas altera la molécula. El enlace C–Cl resiste.",
    water: "El agua no la disuelve: la repele. La molécula sigue intacta.",
    microbes: "Las bacterias no encuentran una ruta metabólica para degradarla."
  };

  const attackLaunchMessages = {
    uv: "Ataque de luz UV en curso…",
    water: "Ataque de agua en curso…",
    microbes: "Ataque de bacterias en curso…"
  };

  const attackLabels = {
    uv: "LUZ UV",
    water: "AGUA",
    microbes: "BACTERIAS"
  };

  function clearResistanceAttack() {
    const layer = $("#resistanceFlight");
    if (!layer) return;
    $$(".resistance-particle, .resistance-attack-label", layer).forEach((node) => {
      node.getAnimations().forEach((animation) => animation.cancel());
      node.remove();
    });
    const glyph = $("#resistanceOriginGlyph", layer);
    const trajectoryPath = $("#resistanceTrajectoryPath", layer);
    if (trajectoryPath) trajectoryPath.removeAttribute("d");
    if (glyph) {
      glyph.getAnimations().forEach((animation) => animation.cancel());
      glyph.style.opacity = "0";
      glyph.style.transform = "none";
      glyph.removeAttribute("data-type");
    }
    layer.style.visibility = "hidden";
    layer.removeAttribute("data-type");
  }

  function finishResistanceAttackVisual(layer) {
    if ($(".resistance-particle, .resistance-attack-label", layer)) return;
    layer.style.visibility = "hidden";
    layer.removeAttribute("data-type");
    const trajectoryPath = $("#resistanceTrajectoryPath", layer);
    if (trajectoryPath) trajectoryPath.removeAttribute("d");
    const glyph = $("#resistanceOriginGlyph", layer);
    if (glyph) {
      glyph.style.opacity = "0";
      glyph.removeAttribute("data-type");
    }
  }

  function launchResistanceAttack(type) {
    if (reduceMotion) return null;
    const slide = $('.slide[data-scene="definition"]');
    const inner = $(".slide__inner", slide);
    const layer = $("#resistanceFlight", slide);
    const glyph = $("#resistanceOriginGlyph", layer);
    const trajectory = $("#resistanceTrajectory", layer);
    const trajectoryPath = $("#resistanceTrajectoryPath", layer);
    const shield = $("#moleculeShield", slide);
    const svg = $(".molecule", slide);
    if (!inner || !layer || !glyph || !trajectory || !trajectoryPath || !shield || !svg) return null;

    clearResistanceAttack();
    layer.style.visibility = "visible";
    layer.setAttribute("data-type", type);

    const innerRect = inner.getBoundingClientRect();
    const scaleX = innerRect.width / (inner.offsetWidth || innerRect.width || 1);
    const scaleY = innerRect.height / (inner.offsetHeight || innerRect.height || 1);
    const shieldRect = shield.getBoundingClientRect();
    const centerX = shieldRect.left + shieldRect.width / 2;
    const centerY = shieldRect.top + shieldRect.height / 2;
    const shieldRadius = Math.min(shieldRect.width, shieldRect.height) / 2;
    const sourceVectors = {
      uv: { x: -0.12, y: -1 },
      water: { x: -1, y: 0.36 },
      microbes: { x: 0.82, y: -0.57 }
    };
    const sourceVector = sourceVectors[type] || { x: -1, y: 0 };
    const vectorLength = Math.hypot(sourceVector.x, sourceVector.y) || 1;
    const sourceDistance = shieldRadius + 66 * (scaleX + scaleY) / 2;
    const startViewX = centerX + sourceVector.x / vectorLength * sourceDistance;
    const startViewY = centerY + sourceVector.y / vectorLength * sourceDistance;
    const startX = (startViewX - innerRect.left) / scaleX;
    const startY = (startViewY - innerRect.top) / scaleY;
    glyph.setAttribute("data-type", type);
    glyph.style.left = `${startX - 38}px`;
    glyph.style.top = `${startY - 38}px`;
    glyph.style.opacity = "1";
    trajectory.setAttribute("viewBox", `0 0 ${inner.offsetWidth || innerRect.width} ${inner.offsetHeight || innerRect.height}`);
    const towardX = centerX - startViewX;
    const towardY = centerY - startViewY;
    const towardLength = Math.hypot(towardX, towardY) || 1;
    const directionX = towardX / towardLength;
    const directionY = towardY / towardLength;
    const particleRadius = 8 * (scaleX + scaleY) / 2;
    const contactDistance = shieldRadius + particleRadius;
    const baseImpactX = centerX - directionX * contactDistance;
    const baseImpactY = centerY - directionY * contactDistance;
    const impactViewX = baseImpactX;
    const impactViewY = baseImpactY;
    const tangentX = -directionY;
    const tangentY = directionX;
    const trajectoryStartX = startX + directionX * 40;
    const trajectoryStartY = startY + directionY * 40;
    const trajectoryEndX = (baseImpactX - innerRect.left) / scaleX;
    const trajectoryEndY = (baseImpactY - innerRect.top) / scaleY;
    trajectoryPath.setAttribute("d", `M ${trajectoryStartX} ${trajectoryStartY} L ${trajectoryEndX} ${trajectoryEndY}`);

    const label = document.createElement("span");
    label.className = "resistance-attack-label";
    label.textContent = attackLabels[type] || "ORIGEN";
    const labelOffsets = {
      uv: { x: -46, y: -62 },
      water: { x: 42, y: -12 },
      microbes: { x: -148, y: -12 }
    };
    const labelOffset = labelOffsets[type] || { x: 42, y: -12 };
    label.style.left = `${startX + labelOffset.x}px`;
    label.style.top = `${startY + labelOffset.y}px`;
    layer.appendChild(label);
    const labelDuration = resistanceFlightDuration + (resistanceParticleCount - 1) * resistanceParticleStagger + 700;
    const labelAnimation = label.animate([
      { transform: "translateY(5px)", opacity: 0, offset: 0 },
      { transform: "translateY(0px)", opacity: 1, offset: 0.06 },
      { transform: "translateY(0px)", opacity: 1, offset: 0.86 },
      { transform: "translateY(-5px)", opacity: 0, offset: 1 }
    ], { duration: labelDuration, easing: "linear", fill: "none" });
    track(labelAnimation);
    labelAnimation.onfinish = () => {
      label.remove();
      finishResistanceAttackVisual(layer);
    };

    for (let index = 0; index < resistanceParticleCount; index += 1) {
      const centeredIndex = index - (resistanceParticleCount - 1) / 2;
      const startSpread = centeredIndex * 15;
      const hitSpread = centeredIndex * 8;
      const startOffset = (index % 3 - 1) * 7;
      const particleStartX = startViewX + tangentX * startSpread - directionX * startOffset;
      const particleStartY = startViewY + tangentY * startSpread - directionY * startOffset;
      const particleImpactX = baseImpactX + tangentX * hitSpread;
      const particleImpactY = baseImpactY + tangentY * hitSpread;
      const startX = (particleStartX - innerRect.left) / scaleX;
      const startY = (particleStartY - innerRect.top) / scaleY;
      const impactX = (particleImpactX - innerRect.left) / scaleX;
      const impactY = (particleImpactY - innerRect.top) / scaleY;
      const travelX = impactX - startX;
      const travelY = impactY - startY;
      const particleLength = Math.hypot(travelX, travelY) || 1;
      const particleDirectionX = travelX / particleLength;
      const particleDirectionY = travelY / particleLength;
      const directionAngle = Math.atan2(travelY, travelX) * 180 / Math.PI;
      const bounceDistance = 94 + (index % 4) * 19;
      const bounceX = particleDirectionX * bounceDistance;
      const bounceY = particleDirectionY * bounceDistance;
      const disperse = centeredIndex * 7;
      const size = 14 + (index % 3) * 3;
      const shape = type === "uv" ? "is-photon" : type === "water" ? "is-droplet" : "is-bacillus";
      const particle = document.createElement("span");
      particle.className = `resistance-particle ${shape}${index % 3 === 0 ? " is-fragment" : ""}${index === 0 ? " is-core" : ""}`;
      const shapeWidth = type === "water" ? size * 0.9 : type === "microbes" ? size * 1.7 : size * 1.35;
      const shapeHeight = type === "water" ? size * 1.35 : type === "microbes" ? size * 0.78 : size * 0.76;
      particle.style.width = `${shapeWidth}px`;
      particle.style.height = `${shapeHeight}px`;
      particle.style.left = `${(particleStartX - innerRect.left) / scaleX}px`;
      particle.style.top = `${(particleStartY - innerRect.top) / scaleY}px`;
      layer.appendChild(particle);

      const animation = particle.animate([
        { transform: "translate(0px, 0px) scale(.38)", opacity: 0, offset: 0 },
        { transform: "translate(0px, 0px) scale(1)", opacity: 0.92, offset: 0.08, easing: "ease-out" },
        { transform: `translate(${travelX}px, ${travelY}px) rotate(${directionAngle}deg) scale(1)`, opacity: 1, filter: "brightness(1.25)", offset: resistanceImpactAt, easing: "cubic-bezier(.38, 0, .2, 1)" },
        { transform: `translate(${travelX}px, ${travelY}px) rotate(${directionAngle}deg) scale(1.65, .52)`, opacity: 1, filter: "brightness(2.1)", offset: 0.72, easing: "ease-in" },
        { transform: `translate(${travelX - bounceX * 0.35}px, ${travelY - bounceY * 0.35}px) rotate(${directionAngle + 180}deg) scale(.82)`, opacity: 1, filter: "brightness(1.7)", offset: 0.8, easing: "cubic-bezier(.12, .74, .25, 1)" },
        { transform: `translate(${travelX - bounceX * 0.95}px, ${travelY - bounceY * 0.95}px) rotate(${directionAngle + 180}deg) scale(1)`, opacity: 0.94, filter: "brightness(1.25)", offset: 0.9, easing: "ease-out" },
        { transform: `translate(${travelX - bounceX * 1.4 + tangentX * disperse}px, ${travelY - bounceY * 1.4 + tangentY * disperse}px) rotate(${directionAngle + 180}deg) scale(.58)`, opacity: 0.68, filter: "brightness(1)", offset: 0.97 },
        { transform: `translate(${travelX - bounceX * 1.7 + tangentX * disperse * 1.5}px, ${travelY - bounceY * 1.7 + tangentY * disperse * 1.5}px) rotate(${directionAngle + 180}deg) scale(.22)`, opacity: 0, filter: "brightness(.85)", offset: 1 }
      ], {
        duration: resistanceFlightDuration,
        delay: index * resistanceParticleStagger,
        easing: "linear",
        fill: "none"
      });
      track(animation);
      animation.onfinish = () => {
        particle.remove();
        finishResistanceAttackVisual(layer);
      };
    }

    const svgRect = svg.getBoundingClientRect();
    const viewBox = svg.viewBox.baseVal;
    const svgScale = Math.min(svgRect.width / viewBox.width, svgRect.height / viewBox.height);
    const svgOffsetX = (svgRect.width - viewBox.width * svgScale) / 2;
    const svgOffsetY = (svgRect.height - viewBox.height * svgScale) / 2;
    const impactSvgX = (impactViewX - svgRect.left - svgOffsetX) / svgScale + viewBox.x;
    const impactSvgY = (impactViewY - svgRect.top - svgOffsetY) / svgScale + viewBox.y;
    const rippleCircle = $(".attack-ripple circle", svg);
    if (rippleCircle) {
      rippleCircle.setAttribute("cx", impactSvgX);
      rippleCircle.setAttribute("cy", impactSvgY);
    }
    return { x: impactSvgX, y: impactSvgY, delay: resistanceFlightDuration * resistanceImpactAt };
  }

  function resetDefinition() {
    stopResistanceSound();
    cancelTimer(definitionDemoTimer);
    definitionDemoTimer = null;
    cancelTimer(definitionImpactTimer);
    definitionImpactTimer = null;
    clearResistanceAttack();
    const status = $("#resistStatus");
    if (status) {
      status.textContent = "Estructura estable. La prueba comienza automáticamente.";
      status.classList.remove("is-warn", "is-ok", "is-resistant");
    }
    testedAttacks.clear();
    const count = $("#resistCount");
    if (count) count.textContent = "0";
    const shield = $("#moleculeShield");
    if (shield) shield.classList.remove("is-hit");
    const ripple = $("#attackRipple");
    if (ripple) {
      ripple.style.opacity = "0";
      ripple.style.transform = "none";
      ripple.style.transformOrigin = "310px 310px";
    }
    const rippleCircle = $(".attack-ripple circle");
    if (rippleCircle) {
      rippleCircle.setAttribute("cx", "310");
      rippleCircle.setAttribute("cy", "310");
    }
  }

  function attackMolecule(type, { withSound = false } = {}) {
    if (withSound) playPresentationSound(`attack-${type}`);
    const status = $("#resistStatus");
    const shield = $("#moleculeShield");
    const ripple = $("#attackRipple");

    if (status) {
      status.textContent = attackLaunchMessages[type] || "Ataque en curso…";
      status.classList.remove("is-ok");
      status.classList.add("is-resistant");
    }

    const impact = launchResistanceAttack(type);
    const resolveImpact = () => {
      definitionImpactTimer = null;
      if (shield) {
        shield.classList.remove("is-hit");
        void shield.getBoundingClientRect();
        shield.classList.add("is-hit");
      }

      if (ripple && !reduceMotion) {
        const point = impact || { x: 310, y: 310 };
        ripple.style.transformOrigin = `${point.x}px ${point.y}px`;
        ripple.style.opacity = "0.85";
        ripple.style.transform = "scale(0.45)";
        track(anime.animate(ripple, {
          scale: 1.9,
          opacity: 0,
          duration: 540,
          ease: "outQuad",
          onComplete: () => {
            ripple.style.opacity = "0";
            ripple.style.transform = "none";
          }
        }));
      }

      if (status) {
        status.textContent = attackMessages[type] || "Ataque sin efecto apreciable.";
        status.classList.remove("is-ok");
        status.classList.add("is-resistant");
      }

      testedAttacks.add(type);
      const tested = testedAttacks.size;
      const count = $("#resistCount");
      if (count) count.textContent = `${tested}`;
      if (tested >= 3 && status) {
        status.textContent = "Tres ataques. Cero degradación significativa. Eso es persistencia.";
        status.classList.remove("is-warn", "is-resistant");
        status.classList.add("is-ok");
      }
    };

    cancelTimer(definitionImpactTimer);
    definitionImpactTimer = impact
      ? later(resolveImpact, impact.delay)
      : (resolveImpact(), null);
  }

  function bindDefinition() {
    $$('[data-attack]').forEach((button) => {
      button.addEventListener("click", () => {
        cancelTimer(definitionDemoTimer);
        definitionDemoTimer = null;
        attackMolecule(button.getAttribute("data-attack"), { withSound: true });
      });
    });
  }

  function playDefinitionDemo() {
    const attacks = ["uv", "water", "microbes"];
    let index = 0;
    const next = () => {
      attackMolecule(attacks[index], { withSound: true });
      index += 1;
      if (index < attacks.length) definitionDemoTimer = later(next, 2500);
      else definitionDemoTimer = null;
    };
    definitionDemoTimer = later(next, 650);
  }

  /* ------------------------------------------------------------
     Escena 04 · Cuatro características
     ------------------------------------------------------------ */

  const traitKeys = ["persistence", "bioaccumulation", "toxicity", "mobility"];
  const TRAIT_AUTO_MS = 7000;

  let activeTraitKey = "persistence";
  let traitAutoTimer = null;
  let traitAutoActive = false;
  let traitAutoDone = false;
  let bioPreyAnimation = null;
  let traitSoundTimer = null;

  function scheduleTraitSoundLoop(key) {
    cancelTimer(traitSoundTimer);
    traitSoundTimer = null;
    const cue = {
      persistence: { name: "trait-persistence-loop", interval: 3000 },
      toxicity: { name: "trait-toxicity-loop", interval: 3000 },
      mobility: { name: "trait-mobility-loop", interval: 3600 }
    }[key];
    if (!cue || reduceMotion) return;

    traitSoundTimer = later(() => {
      traitSoundTimer = null;
      if (currentScene !== "traits" || activeTraitKey !== key) return;
      playPresentationSound(cue.name);
      scheduleTraitSoundLoop(key);
    }, cue.interval, "scene");
  }

  function resetBioPrey() {
    if (bioPreyAnimation) {
      try { bioPreyAnimation.pause(); } catch (_) { /* La animación pudo terminar. */ }
      bioPreyAnimation = null;
    }
    const panel = $("#trait-panel-bioaccumulation");
    const prey = $(".b-prey", panel);
    const fish = $(".b-fish", panel);
    const jaw = $(".b-jaw", panel);
    if (prey) {
      prey.setAttribute("transform", "translate(0 0)");
      prey.style.opacity = "1";
      prey.classList.remove("is-near-mouth");
    }
    if (fish) fish.classList.remove("is-eating");
    if (jaw) jaw.removeAttribute("transform");
  }

  function playBioPreySwallow() {
    resetBioPrey();
    if (reduceMotion) return;

    const panel = $("#trait-panel-bioaccumulation");
    const prey = $(".b-prey", panel);
    const fish = $(".b-fish", panel);
    const jaw = $(".b-jaw", panel);
    if (!prey || !fish || !jaw) return;

    const state = { progress: 0 };
    let swallowSoundPlayed = false;
    bioPreyAnimation = track(anime.animate(state, {
      progress: 1,
      duration: 4200,
      ease: "linear",
      onUpdate: () => {
        const progress = state.progress;
        const approach = Math.min(1, progress / 0.72);
        const easedApproach = approach * approach * (3 - 2 * approach);
        const dx = 34 * easedApproach;
        const dy = 96 * easedApproach;
        const swallow = Math.max(0, Math.min(1, (progress - 0.72) / 0.23));
        const scale = 1 - swallow * 0.86;
        prey.setAttribute("transform", `translate(${dx.toFixed(2)} ${dy.toFixed(2)}) translate(58 158) scale(${scale.toFixed(3)}) translate(-58 -158)`);
        prey.style.opacity = String((1 - swallow).toFixed(3));
        prey.classList.toggle("is-near-mouth", progress >= 0.38 && progress <= 0.88);

        const bite = Math.max(0, Math.min(1, (progress - 0.48) / 0.36));
        jaw.setAttribute("transform", `rotate(${(12 * Math.sin(Math.PI * bite)).toFixed(2)} 80 252)`);
        fish.classList.toggle("is-eating", progress >= 0.48 && progress <= 0.88);

        if (progress >= 0.88 && !swallowSoundPlayed) {
          swallowSoundPlayed = true;
          playPresentationSound("bioEat");
        }
      },
      onComplete: () => {
        prey.style.opacity = "0";
        prey.classList.remove("is-near-mouth");
        fish.classList.remove("is-eating");
        jaw.removeAttribute("transform");
        bioPreyAnimation = null;
      }
    }));
  }

  function updateTraitAutoButton() {
    const button = $("#traitAutoToggle");
    if (!button) return;
    const label = $(".trait-auto-toggle__label", button);
    let text = "Reanudar";
    if (traitAutoActive) text = "Pausar";
    else if (traitAutoDone) text = "Repetir";
    button.classList.toggle("is-paused", !traitAutoActive);
    button.setAttribute("aria-pressed", traitAutoActive ? "true" : "false");
    button.setAttribute("aria-label", `${text} la secuencia automática`);
    if (label) label.textContent = text;
  }

  function clearTraitAutoTimer() {
    if (traitAutoTimer !== null) {
      cancelTimer(traitAutoTimer);
      traitAutoTimer = null;
    }
  }

  function stopTraitAuto(done) {
    traitAutoActive = false;
    traitAutoDone = Boolean(done);
    clearTraitAutoTimer();
    const cards = $(".trait-cards");
    if (cards) cards.classList.remove("is-auto");
    updateTraitAutoButton();
  }

  function scheduleTraitAuto() {
    clearTraitAutoTimer();
    if (!traitAutoActive) return;
    traitAutoTimer = later(() => {
      traitAutoTimer = null;
      if (!traitAutoActive) return;
      const index = traitKeys.indexOf(activeTraitKey);
      if (index >= traitKeys.length - 1) {
        stopTraitAuto(true);
        return;
      }
      activateTrait(traitKeys[index + 1], false, true);
      playPresentationSound(`trait-${activeTraitKey}`);
      if (index + 1 >= traitKeys.length - 1) {
        stopTraitAuto(true);
      } else {
        scheduleTraitAuto();
      }
    }, TRAIT_AUTO_MS);
  }

  function startTraitAuto(resetToFirst) {
    if (reduceMotion) {
      updateTraitAutoButton();
      return;
    }
    traitAutoDone = false;
    traitAutoActive = true;
    if (resetToFirst) activateTrait(traitKeys[0], false, true);
    const cards = $(".trait-cards");
    if (cards) cards.classList.add("is-auto");
    updateTraitAutoButton();
    scheduleTraitAuto();
  }

  function activateTrait(key, moveFocus, fromAuto) {
    activeTraitKey = key;
    if (!fromAuto) {
      stopTraitAuto(false);
      playPresentationSound(`trait-${key}`);
    }
    scheduleTraitSoundLoop(key);

    const cards = $$(".trait-card");
    const panels = $$(".trait-panel");

    cards.forEach((card) => {
      const active = card.getAttribute("data-trait") === key;
      card.classList.toggle("is-active", active);
      card.setAttribute("aria-selected", active ? "true" : "false");
      card.setAttribute("tabindex", active ? "0" : "-1");
      if (active && moveFocus) card.focus();
    });

    panels.forEach((panel) => {
      const active = panel.getAttribute("data-trait-panel") === key;
      panel.hidden = !active;
      if (active) {
        // Reinicia las animaciones de la ilustración al entrar en el panel.
        panel.classList.remove("is-active");
        void panel.offsetWidth;
        panel.classList.add("is-active");
      } else {
        panel.classList.remove("is-active");
      }
    });

    $$(".slide--traits [data-trait-summary]").forEach((term) => {
      term.classList.toggle("is-active", term.getAttribute("data-trait-summary") === key);
    });

    if (key === "bioaccumulation") playBioPreySwallow();
    else resetBioPrey();
  }

  function resetTraits() {
    stopTraitAuto(false);
    activateTrait(traitKeys[0], false, true);
    startTraitAuto(false);
  }

  function exitTraits() {
    stopTraitAuto(false);
    resetBioPrey();
    $$(".trait-panel").forEach((panel) => panel.classList.remove("is-active"));
  }

  function bindTraits() {
    const cards = $$(".trait-card");
    cards.forEach((card) => {
      card.addEventListener("click", () => activateTrait(card.getAttribute("data-trait"), false));

      card.addEventListener("keydown", (event) => {
        const current = traitKeys.indexOf(card.getAttribute("data-trait"));
        let next = null;
        if (event.key === "ArrowDown" || event.key === "ArrowRight") next = (current + 1) % traitKeys.length;
        if (event.key === "ArrowUp" || event.key === "ArrowLeft") next = (current - 1 + traitKeys.length) % traitKeys.length;
        if (next === null) return;
        event.preventDefault();
        event.stopPropagation();
        activateTrait(traitKeys[next], true);
      });
    });
  }

  function bindTraitAuto() {
    const button = $("#traitAutoToggle");
    if (!button) return;
    if (reduceMotion) {
      button.hidden = true;
      return;
    }
    button.addEventListener("click", () => {
      playPresentationSound("auto");
      if (traitAutoActive) {
        stopTraitAuto(false);
        return;
      }
      if (traitAutoDone || traitKeys.indexOf(activeTraitKey) >= traitKeys.length - 1) {
        startTraitAuto(true);
      } else {
        startTraitAuto(false);
      }
    });
  }

  /* ------------------------------------------------------------
     Escena 05 · Docena Sucia
     ------------------------------------------------------------ */

  const dirtyCategoryLabels = {
    pesticide: "Plaguicidas",
    industrial: "Industriales",
    accidental: "Subproductos no intencionales"
  };
  const dirtyCategoryCounts = { pesticide: 8, industrial: 2, accidental: 2 };
  let dirtyLastSubstance = null;
  let dirtyLastCategory = null;

  function resetDirty(returnFocus = false) {
    const categories = $("#dirtyCategoryView");
    const substances = $("#dirtySubstanceView");
    const originDetail = $("#originDetail");
    const substanceDetail = $("#dirtySubstanceDetail");
    const substanceList = $("#dirtySubstanceList");
    if (!categories || !substances) return;

    categories.hidden = false;
    substances.hidden = true;
    if (originDetail) originDetail.hidden = true;
    if (substanceDetail) substanceDetail.hidden = true;
    substanceList?.classList.remove("is-revealing");
    $("#dirtySpiderMap")?.removeAttribute("data-active-branch");
    $$("[data-origin-category]").forEach((button) => { button.setAttribute("aria-expanded", "false"); });
    $$(".origin-detail__panel").forEach((panel) => { panel.hidden = true; });
    $$(".dirty-substance-list li").forEach((row) => {
      row.hidden = false;
      const button = $(".dirty-substance", row);
      if (!button) return;
      button.hidden = false;
      button.setAttribute("aria-pressed", "false");
      button.classList.remove("is-highlight");
    });
    dirtyLastSubstance = null;
    if (returnFocus) dirtyLastCategory?.focus({ preventScroll: true });
  }

  function showOrigin(key, trigger) {
    const label = dirtyCategoryLabels[key];
    const categories = $("#dirtyCategoryView");
    const substances = $("#dirtySubstanceView");
    const originDetail = $("#originDetail");
    const substanceDetail = $("#dirtySubstanceDetail");
    const substanceList = $("#dirtySubstanceList");
    if (!label || !categories || !substances || !originDetail || !substanceDetail) return;

    categories.hidden = true;
    substances.hidden = false;
    originDetail.hidden = false;
    substanceDetail.hidden = true;
    $("#dirtyCurrentGroupName").textContent = label;
    $("#dirtyCurrentGroupCount").textContent = `${String(dirtyCategoryCounts[key]).padStart(2, "0")} SUSTANCIAS`;
    if (substanceList) substanceList.dataset.groupSize = String(dirtyCategoryCounts[key]);
    $$("[data-origin-category]").forEach((button) => {
      button.setAttribute("aria-expanded", String(button === trigger));
    });
    $$(".origin-detail__panel").forEach((panel) => {
      panel.hidden = panel.getAttribute("data-origin-panel") !== key;
    });
    let visibleIndex = 0;
    const visibleRows = [];
    $$(".dirty-substance-list li").forEach((row) => {
      const button = $(".dirty-substance", row);
      if (!button) return;
      const matchesCategory = button.getAttribute("data-origin") === key;
      row.hidden = !matchesCategory;
      button.hidden = !matchesCategory;
      if (matchesCategory) {
        row.style.setProperty("--dirty-order", String(visibleIndex));
        visibleRows.push(row);
        visibleIndex += 1;
      }
      button.setAttribute("aria-pressed", "false");
      button.classList.remove("is-highlight");
    });
    if (substanceList) {
      substanceList.classList.remove("is-revealing");
      void substanceList.offsetWidth;
      const listBounds = substanceList.getBoundingClientRect();
      const sourceX = listBounds.width / 2;
      const sourceY = 24;
      visibleRows.forEach((row) => {
        const rowBounds = row.getBoundingClientRect();
        const rowCenterX = rowBounds.left - listBounds.left + rowBounds.width / 2;
        const rowCenterY = rowBounds.top - listBounds.top + rowBounds.height / 2;
        row.style.setProperty("--dirty-origin-x", `${Math.round(sourceX - rowCenterX)}px`);
        row.style.setProperty("--dirty-origin-y", `${Math.round(sourceY - rowCenterY)}px`);
      });
      void substanceList.offsetWidth;
      substanceList.classList.add("is-revealing");
    }
    dirtyLastSubstance = null;
    dirtyLastCategory = trigger || null;
    $("#dirtyCurrentGroupName").focus({ preventScroll: true });
  }

  function showDirtySubstance(button) {
    const detail = $("#dirtySubstanceDetail");
    const context = $("#originDetail");
    if (!detail || !context) return;
    if (dirtyLastSubstance === button && !detail.hidden) return;
    dirtyLastSubstance = button;
    $("#dirtySubstanceName").textContent = button.dataset.name || "";
    $("#dirtySubstanceAlias").textContent = button.dataset.alias || "";
    $("#dirtySubstanceCategory").textContent = dirtyCategoryLabels[button.dataset.origin] || "";
    const ddtLink = $("#dirtyDdtLink");
    if (ddtLink) ddtLink.hidden = button.dataset.name !== "DDT";
    renderDirtySubstanceArt(button);
    context.hidden = true;
    detail.hidden = false;
    detail.classList.remove("is-changing");
    void detail.offsetWidth;
    detail.classList.add("is-changing");
    $$(".dirty-substance").forEach((item) => {
      const selected = item === button;
      item.setAttribute("aria-pressed", String(selected));
      item.classList.toggle("is-highlight", selected);
    });
  }

  function renderDirtySubstanceArt(button) {
    const art = $("#dirtySubstanceArt");
    const particleLayer = $("#dirtyArtParticles");
    if (!art || !particleLayer) return;

    const index = $$(".dirty-substance").indexOf(button);
    const orbitSizes = [
      [116, 42], [158, 66], [194, 86]
    ];
    ["#dirtyArtOrbitOne", "#dirtyArtOrbitTwo", "#dirtyArtOrbitThree"].forEach((selector, ringIndex) => {
      const ring = $(selector);
      if (!ring) return;
      const [rx, ry] = orbitSizes[ringIndex];
      ring.setAttribute("rx", String(rx + ((index + ringIndex) % 3) * 7));
      ring.setAttribute("ry", String(ry + ((index * 2 + ringIndex) % 4) * 4));
      ring.setAttribute("transform", `rotate(${(index * 23 + ringIndex * 17) % 70 - 35} 260 118)`);
    });
    art.dataset.origin = button.dataset.origin || "pesticide";
    particleLayer.replaceChildren();

    const particleCount = 4 + (index % 5);
    for (let i = 0; i < particleCount; i += 1) {
      const angle = ((i / particleCount) * 360 + index * 31) * Math.PI / 180;
      const radius = 78 + ((index * 13 + i * 19) % 94);
      const particle = document.createElementNS(NS, "circle");
      particle.setAttribute("class", "dirty-art-particle");
      particle.setAttribute("cx", String((260 + Math.cos(angle) * radius).toFixed(1)));
      particle.setAttribute("cy", String((118 + Math.sin(angle) * radius * .52).toFixed(1)));
      particle.setAttribute("r", String(4 + ((index + i) % 5)));
      particle.style.setProperty("--particle-delay", `${i * -0.42}s`);
      particleLayer.appendChild(particle);
    }
  }

  function bindDirty() {
    $$("[data-origin-category]").forEach((button) => {
      const spiderMap = $("#dirtySpiderMap");
      const activateBranch = () => {
        if (spiderMap) spiderMap.dataset.activeBranch = button.dataset.originCategory || "";
      };
      const clearBranch = () => {
        if (document.activeElement !== button) spiderMap?.removeAttribute("data-active-branch");
      };
      button.addEventListener("pointerenter", activateBranch);
      button.addEventListener("pointerleave", clearBranch);
      button.addEventListener("focus", activateBranch);
      button.addEventListener("blur", clearBranch);
      button.addEventListener("click", () => {
        playPresentationSound("category");
        showOrigin(button.dataset.originCategory, button);
      });
    });
    $$(".dirty-substance").forEach((button) => {
      button.addEventListener("mouseenter", () => showDirtySubstance(button));
      button.addEventListener("click", () => {
        playPresentationSound("substance");
        showDirtySubstance(button);
      });
    });
    $("#dirtyBackCategories")?.addEventListener("click", () => {
      playPresentationSound("back");
      resetDirty(true);
    });
    $("#dirtyBackGroup")?.addEventListener("click", () => {
      playPresentationSound("back");
      const detail = $("#dirtySubstanceDetail");
      const context = $("#originDetail");
      if (detail) detail.hidden = true;
      if (context) context.hidden = false;
      if (dirtyLastSubstance) dirtyLastSubstance.focus({ preventScroll: true });
    });

    $$('[data-goto="ddt"]').forEach((button) => {
      button.addEventListener("click", () => {
        const index = $$(".slides > section.slide").findIndex((slide) => slide.getAttribute("data-scene") === "ddt");
        if (index >= 0) {
          playPresentationSound("navigate");
          Reveal.slide(index);
        }
      });
    });
  }

  /* ------------------------------------------------------------
     Escena 06 · Caso DDT
     ------------------------------------------------------------ */

  let ddtAnimation = null;
  let lastDDTWearYear = 1947;

  function setDDTYear(rawYear) {
    const visualYear = Math.max(1947, Math.min(1972, Number(rawYear)));
    const year = Math.round(visualYear);
    const progress = (visualYear - 1947) / (1972 - 1947);
    const thickness = Math.round(100 - 40 * progress);

    const yearEl = $("#ddtYear");
    const rangeEl = $("#ddtRange");
    const rangeLabel = $("#ddtRangeLabel");
    const thicknessEl = $("#ddtThickness");
    const shell = $(".egg-shell");
    const cracks = $(".egg-cracks");
    const egg = $(".egg-svg");
    const caption = $(".egg-caption");
    const macro = $("#eggMacro");
    const macroShell = $("#eggMacroShell");
    const macroThickness = $("#eggMacroThickness");

    if (yearEl) yearEl.textContent = String(year);
    if (rangeEl && Number(rangeEl.value) !== year) rangeEl.value = String(year);
    if (rangeLabel) rangeLabel.textContent = String(year);
    if (thicknessEl) thicknessEl.textContent = String(thickness);
    if (macroThickness) macroThickness.textContent = String(thickness);
    if (shell) shell.style.strokeWidth = (30 * thickness / 100).toFixed(1);
    if (cracks) cracks.style.opacity = String(Math.max(0, (progress - 0.55) / 0.45).toFixed(2));
    const macroFocus = Math.max(0, Math.min(1, (progress - 0.18) / 0.42));
    if (egg) {
      egg.style.opacity = String((1 - macroFocus).toFixed(3));
      egg.style.transform = `translate(-50%, -50%) scale(${(1 + macroFocus * 0.2).toFixed(3)})`;
    }
    if (caption) caption.style.opacity = String((1 - macroFocus).toFixed(3));
    if (macro) {
      macro.style.setProperty("--wear", progress.toFixed(3));
      macro.style.setProperty("--fracture", Math.max(0, (progress - 0.58) / 0.42).toFixed(2));
      macro.style.opacity = macroFocus.toFixed(3);
      macro.style.transform = `scale(${(0.84 + macroFocus * 0.16).toFixed(3)})`;
    }
    if (macroShell) macroShell.style.strokeWidth = (22 * thickness / 100).toFixed(1);

    const previousBand = Math.floor((lastDDTWearYear - 1947) / 5);
    const currentBand = Math.floor((year - 1947) / 5);
    if (year > lastDDTWearYear && currentBand > previousBand) playEggWearSound(progress);
    lastDDTWearYear = year;
  }

  function resetDDT() {
    if (ddtAnimation) {
      try { ddtAnimation.pause(); } catch (error) { /* noop */ }
      ddtAnimation = null;
    }
    lastDDTWearYear = 1947;
    setDDTYear(1947);
  }

  function playDDT() {
    if (ddtAnimation) {
      try { ddtAnimation.pause(); } catch (error) { /* noop */ }
    }

    const range = $("#ddtRange");
    if (!range) return;
    if (Number(range.value) >= 1972) setDDTYear(1947);

    const state = { year: Number(range.value) };
    ddtAnimation = track(anime.animate(state, {
      year: 1972,
      duration: reduceMotion ? 1 : 4200,
      ease: "linear",
      onUpdate: () => setDDTYear(state.year)
    }));
  }

  function bindDDT() {
    const range = $("#ddtRange");
    if (range) {
      range.addEventListener("input", () => {
        if (ddtAnimation) {
          try { ddtAnimation.pause(); } catch (error) { /* noop */ }
          ddtAnimation = null;
        }
        setDDTYear(Number(range.value));
      });
    }

    const play = $("#ddtPlay");
    if (play) play.addEventListener("click", () => { playPresentationSound("ddt"); playDDT(); });
  }

  sceneReset.definition = resetDefinition;
  sceneReset["definition:enter"] = playDefinitionDemo;
  sceneReset.traits = resetTraits;
  sceneReset.dirty = resetDirty;
  sceneReset.ddt = resetDDT;
  sceneReset["ddt:enter"] = () => {
    playPresentationSound("ddt");
    playDDT();
  };

  /* ------------------------------------------------------------
     Escena 07 · Simulador de biomagnificación
     ------------------------------------------------------------ */

  const bioLevels = [
    {
      name: "AGUA",
      factor: 1,
      count: 4,
      copy: "El COP llega al agua en concentraciones mínimas. Tan bajas que los instrumentos apenas las detectan."
    },
    {
      name: "PLANCTON",
      factor: 10,
      count: 14,
      copy: "El plancton absorbe el COP del agua y lo concentra en su grasa. La dosis sube unas diez veces."
    },
    {
      name: "PEZ PEQUEÑO",
      factor: 100,
      count: 32,
      copy: "El pez pequeño come plancton contaminado. No elimina el COP: lo guarda en su tejido graso."
    },
    {
      name: "ATÚN",
      factor: 1000,
      count: 60,
      copy: "El atún es longevo y come muchos peces pequeños. Su carga se acumula durante años."
    },
    {
      name: "HUMANO",
      factor: 10000,
      count: 96,
      copy: "En la cima de la cadena, la dosis es máxima. Nosotros recibimos todo el impacto."
    }
  ];

  let bioLevel = 0;
  let bioCurrentFactor = 1;
  let bioFactorAnimation = null;
  let bioAutoPlaying = false;
  let bioAutoTimer = null;

  function formatFactor(value) {
    return `${formatNumber(value)}×`;
  }

  function fillTierDots(level) {
    $$(".tier").forEach((tier) => {
      const index = Number(tier.getAttribute("data-tier"));
      const field = $(".tier__field", tier);
      if (!field) return;

      if (index > level) {
        field.innerHTML = "";
        field.setAttribute("data-count", "0");
        return;
      }

      const target = bioLevels[index].count;
      const existing = Number(field.getAttribute("data-count") || "0");
      for (let i = existing; i < target; i += 1) {
        const dot = document.createElement("i");
        dot.className = "bio-dot is-in";
        dot.style.animationDelay = `${Math.min((i - existing) * 11, 520)}ms`;
        field.appendChild(dot);
      }
      field.setAttribute("data-count", String(target));
    });
  }

  function setBioLevel(level, animate) {
    const next = Math.max(0, Math.min(bioLevels.length - 1, Number(level)));
    bioLevel = next;
    const data = bioLevels[next];

    const levelNum = $("#bioLevelNum");
    const levelName = $("#bioLevelName");
    const factorEl = $("#bioFactor");
    const marker = $("#bioMarker");
    const copy = $("#bioCopy");
    const particlesEl = $("#bioParticles");
    const doseEl = $("#bioDose");
    const prev = $("#bioPrev");
    const nextBtn = $("#bioNext");

    if (levelNum) levelNum.textContent = pad(next + 1);
    if (levelName) levelName.textContent = data.name;
    if (copy) copy.textContent = data.copy;
    if (particlesEl) particlesEl.textContent = formatNumber(data.count);
    if (doseEl) doseEl.textContent = formatFactor(data.factor);
    if (marker) {
      marker.style.left = `${(Math.log10(data.factor) / 4) * 100}%`;
      marker.style.background = next === 4 ? "var(--coral)" : "var(--teal)";
      marker.style.boxShadow = next === 4
        ? "0 0 0 1px rgba(255, 107, 107, 0.55)"
        : "0 0 0 1px rgba(100, 255, 218, 0.5)";
    }
    if (prev) prev.disabled = next === 0;
    if (nextBtn) {
      nextBtn.disabled = next === bioLevels.length - 1;
      nextBtn.textContent = next === bioLevels.length - 1 ? "Nivel máximo" : "Siguiente nivel →";
    }

    $$(".tier").forEach((tier) => {
      const active = Number(tier.getAttribute("data-tier")) === next;
      tier.classList.toggle("is-active", active);
      tier.setAttribute("aria-pressed", String(active));
    });

    fillTierDots(next);

    if (factorEl) {
      if (bioFactorAnimation) {
        try { bioFactorAnimation.pause(); } catch (error) { /* noop */ }
      }
      if (!animate || reduceMotion) {
        factorEl.textContent = formatFactor(data.factor);
        bioCurrentFactor = data.factor;
      } else {
        const state = { value: bioCurrentFactor };
        bioFactorAnimation = track(anime.animate(state, {
          value: data.factor,
          duration: 700,
          ease: "outQuad",
          onUpdate: () => {
            factorEl.textContent = formatFactor(state.value);
          },
          onComplete: () => {
            factorEl.textContent = formatFactor(data.factor);
            bioCurrentFactor = data.factor;
          }
        }));
        bioCurrentFactor = data.factor;
      }
    }
  }

  function stopBioAuto() {
    bioAutoPlaying = false;
    cancelTimer(bioAutoTimer);
    bioAutoTimer = null;
    const auto = $("#bioAuto");
    if (auto) auto.textContent = "Reproducir automáticamente";
  }

  function resetBiomag() {
    stopBioAuto();
    if (bioFactorAnimation) {
      try { bioFactorAnimation.pause(); } catch (error) { /* noop */ }
      bioFactorAnimation = null;
    }
    bioCurrentFactor = 1;
    $$(".tier__field").forEach((field) => {
      field.innerHTML = "";
      field.setAttribute("data-count", "0");
    });
    setBioLevel(0, false);
  }

  function advanceBio() {
    if (bioLevel < bioLevels.length - 1) {
      setBioLevel(bioLevel + 1, true);
    }
  }

  function runBioAuto() {
    if (reduceMotion) return;

    if (bioAutoPlaying) {
      stopBioAuto();
      return;
    }

    stopBioAuto();

    if (bioLevel >= bioLevels.length - 1) setBioLevel(0, false);
    bioAutoPlaying = true;
    const auto = $("#bioAuto");
    if (auto) auto.textContent = "Detener";

    function tick() {
      bioAutoTimer = null;
      if (!bioAutoPlaying) return;
      if (bioLevel >= bioLevels.length - 1) {
        stopBioAuto();
        return;
      }
      playPresentationSound("bioStep");
      advanceBio();
      if (bioLevel >= bioLevels.length - 1) {
        stopBioAuto();
        return;
      }
      bioAutoTimer = later(tick, 2600);
    }

    bioAutoTimer = later(tick, 900);
  }

  function bindBiomag() {
    const next = $("#bioNext");
    const prev = $("#bioPrev");
    const reset = $("#bioReset");
    const auto = $("#bioAuto");

    if (next) next.addEventListener("click", () => { playPresentationSound("levelUp"); stopBioAuto(); advanceBio(); });
    if (prev) prev.addEventListener("click", () => { playPresentationSound("levelDown"); stopBioAuto(); setBioLevel(bioLevel - 1, true); });
    if (reset) reset.addEventListener("click", () => { playPresentationSound("reset"); resetBiomag(); });
    if (auto) {
      if (reduceMotion) {
        auto.hidden = true;
        auto.style.display = "none";
        auto.disabled = true;
      } else {
        auto.addEventListener("click", () => { playPresentationSound("auto"); runBioAuto(); });
      }
    }

    $$(".tier").forEach((tier) => {
      const selectTier = () => {
        const nextLevel = Number(tier.getAttribute("data-tier"));
        playPresentationSound(nextLevel > bioLevel ? "levelUp" : nextLevel < bioLevel ? "levelDown" : "tap");
        stopBioAuto();
        setBioLevel(nextLevel, true);
      };
      tier.addEventListener("click", selectTier);
      tier.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        event.stopPropagation();
        selectTier();
      });
    });
  }

  /* ------------------------------------------------------------
     Escena 08 · Convenio de Estocolmo
     ------------------------------------------------------------ */

  const treatyGlobe = {
    raf: 0,
    ready: false,
    loading: null,
    texture: null,
    sphereCanvas: null,
    sphereContext: null,
    spherePixels: null,
    segments: 340,
    w: 1000,
    h: 500,
    cx: 500,
    cy: 250,
    radius: 218,
    startedAt: 0,
    lastFrame: 0,
    centerLon: -0.2,
    centerLat: 0.22
  };

  function treatySpherePoint(lat, lon, lat0, lon0) {
    let delta = lon - lon0;
    while (delta > Math.PI) delta -= Math.PI * 2;
    while (delta < -Math.PI) delta += Math.PI * 2;
    const x = Math.cos(lat) * Math.sin(delta);
    const y = Math.sin(lat) * Math.cos(lat0) - Math.cos(lat) * Math.cos(delta) * Math.sin(lat0);
    const z = Math.sin(lat) * Math.sin(lat0) + Math.cos(lat) * Math.cos(lat0) * Math.cos(delta);
    return { x: treatyGlobe.cx + x * treatyGlobe.radius, y: treatyGlobe.cy - y * treatyGlobe.radius, z };
  }

  function ensureTreatyGlobe() {
    const stage = $(".treaty-map");
    const canvas = $("#treatyGlobeCanvas");
    const world = $(".treaty-map .world-map");
    const overlay = $(".treaty-map .ratify-overlay");
    if (!stage || !canvas || !world || !overlay) return Promise.resolve(false);
    if (treatyGlobe.ready) return Promise.resolve(true);
    if (treatyGlobe.loading) return treatyGlobe.loading;

    treatyGlobe.loading = new Promise((resolve) => {
      let settled = false;
      const finish = (ready) => {
        if (settled) return;
        settled = true;
        treatyGlobe.loading = null;
        if (ready) {
          stage.classList.remove("is-globe-fallback");
          stage.classList.add("is-globe-ready");
        } else {
          stage.classList.remove("is-globe-ready");
          stage.classList.add("is-globe-fallback");
        }
        resolve(ready);
      };

      const buildTexture = () => {
        try {
          const textureCanvas = document.createElement("canvas");
          textureCanvas.width = treatyGlobe.w;
          textureCanvas.height = treatyGlobe.h;
          const textureContext = textureCanvas.getContext("2d", { willReadFrequently: true });
          if (!textureContext) return finish(false);
          textureContext.fillStyle = "#07182D";
          textureContext.fillRect(0, 0, treatyGlobe.w, treatyGlobe.h);
          textureContext.drawImage(world, 0, 0, treatyGlobe.w, treatyGlobe.h);
          textureContext.save();
          textureContext.globalCompositeOperation = "screen";
          textureContext.globalAlpha = 0.94;
          textureContext.drawImage(overlay, 0, 0, treatyGlobe.w, treatyGlobe.h);
          textureContext.restore();
          treatyGlobe.texture = textureContext.getImageData(0, 0, treatyGlobe.w, treatyGlobe.h);
          const mainContext = canvas.getContext("2d", { alpha: false });
          if (!mainContext) return finish(false);
          canvas.width = treatyGlobe.w;
          canvas.height = treatyGlobe.h;
          treatyGlobe.context = mainContext;
          treatyGlobe.sphereCanvas = document.createElement("canvas");
          treatyGlobe.sphereCanvas.width = treatyGlobe.segments;
          treatyGlobe.sphereCanvas.height = treatyGlobe.segments;
          treatyGlobe.sphereContext = treatyGlobe.sphereCanvas.getContext("2d", { alpha: true });
          if (!treatyGlobe.sphereContext) return finish(false);
          treatyGlobe.spherePixels = treatyGlobe.sphereContext.createImageData(treatyGlobe.segments, treatyGlobe.segments);
          treatyGlobe.ready = true;
          finish(true);
        } catch (_) {
          finish(false);
        }
      };

      const sources = [world, overlay];
      if (sources.every((image) => image.complete && image.naturalWidth)) {
        buildTexture();
        return;
      }
      let waiting = sources.filter((image) => !(image.complete && image.naturalWidth)).length;
      const onLoad = () => {
        waiting -= 1;
        if (waiting <= 0) buildTexture();
      };
      sources.forEach((image) => {
        if (image.complete && image.naturalWidth) return;
        image.addEventListener("load", onLoad, { once: true });
        image.addEventListener("error", () => finish(false), { once: true });
      });
    });
    return treatyGlobe.loading;
  }

  function drawTreatyGraticule(ctx, lat0, lon0) {
    ctx.lineWidth = 0.9;
    ctx.strokeStyle = "rgba(181, 216, 248, 0.24)";
    for (let latitude = -60; latitude <= 60; latitude += 30) {
      let open = false;
      ctx.beginPath();
      for (let i = 0; i <= 100; i += 1) {
        const point = treatySpherePoint(latitude * Math.PI / 180, -Math.PI + i / 100 * Math.PI * 2, lat0, lon0);
        if (point.z > 0) {
          if (!open) ctx.moveTo(point.x, point.y);
          else ctx.lineTo(point.x, point.y);
          open = true;
        } else open = false;
      }
      ctx.stroke();
    }
    for (let longitude = -150; longitude <= 180; longitude += 30) {
      let open = false;
      ctx.beginPath();
      for (let i = 0; i <= 80; i += 1) {
        const point = treatySpherePoint(-Math.PI / 2 + i / 80 * Math.PI, longitude * Math.PI / 180, lat0, lon0);
        if (point.z > 0) {
          if (!open) ctx.moveTo(point.x, point.y);
          else ctx.lineTo(point.x, point.y);
          open = true;
        } else open = false;
      }
      ctx.stroke();
    }
  }

  function drawTreatyGlobe(time) {
    if (!treatyGlobe.ready || currentScene !== "treaty") return;
    if (!reduceMotion && time - treatyGlobe.lastFrame < 32) {
      treatyGlobe.raf = requestAnimationFrame(drawTreatyGlobe);
      return;
    }
    treatyGlobe.lastFrame = time;
    const elapsed = Math.max(0, time - treatyGlobe.startedAt) / 1000;
    const centerLon = treatyGlobe.centerLon + elapsed * 0.14;
    const centerLat = treatyGlobe.centerLat + Math.sin(elapsed / 13) * 0.025;
    const size = treatyGlobe.segments;
    const pixelRadius = (size - 2) / 2;
    const texture = treatyGlobe.texture.data;
    const pixels = treatyGlobe.spherePixels.data;
    const lightX = -0.4, lightY = 0.5, lightZ = 0.77;

    for (let py = 0; py < size; py += 1) {
      const sy = (pixelRadius - py) / pixelRadius;
      for (let px = 0; px < size; px += 1) {
        const sx = (px - pixelRadius) / pixelRadius;
        const radiusSquared = sx * sx + sy * sy;
        const target = (py * size + px) * 4;
        if (radiusSquared > 1) { pixels[target + 3] = 0; continue; }
        const sz = Math.sqrt(1 - radiusSquared);
        const latitude = Math.asin(sy * Math.cos(centerLat) + sz * Math.sin(centerLat));
        const delta = Math.atan2(sx, sz * Math.cos(centerLat) - sy * Math.sin(centerLat));
        const longitude = centerLon + delta;
        const tx = ((longitude / (Math.PI * 2) + 0.5) * treatyGlobe.w + treatyGlobe.w) % treatyGlobe.w;
        const ty = Math.max(0, Math.min(treatyGlobe.h - 1, Math.floor((0.5 - latitude / Math.PI) * treatyGlobe.h)));
        const source = (ty * treatyGlobe.w + Math.floor(tx)) * 4;
        const illumination = 0.28 + Math.max(0, sx * lightX + sy * lightY + sz * lightZ) * 0.78;
        pixels[target] = Math.min(255, texture[source] * illumination);
        pixels[target + 1] = Math.min(255, texture[source + 1] * illumination);
        pixels[target + 2] = Math.min(255, texture[source + 2] * illumination);
        pixels[target + 3] = 255;
      }
    }

    treatyGlobe.sphereContext.putImageData(treatyGlobe.spherePixels, 0, 0);
    const ctx = treatyGlobe.context;
    ctx.clearRect(0, 0, treatyGlobe.w, treatyGlobe.h);
    ctx.fillStyle = "#030A14";
    ctx.fillRect(0, 0, treatyGlobe.w, treatyGlobe.h);
    for (let i = 0; i < 34; i += 1) {
      const x = (i * 179 + 43) % treatyGlobe.w;
      const y = (i * 97 + 19) % treatyGlobe.h;
      const twinkle = 0.14 + ((i * 13) % 10) / 100 + (i % 5 === 0 ? Math.sin(time / 650 + i) * 0.05 : 0);
      ctx.fillStyle = `rgba(178, 215, 250, ${Math.max(0.05, twinkle)})`;
      ctx.beginPath();
      ctx.arc(x, y, i % 9 === 0 ? 1.25 : 0.7, 0, Math.PI * 2);
      ctx.fill();
    }
    const atmosphere = ctx.createRadialGradient(treatyGlobe.cx, treatyGlobe.cy, treatyGlobe.radius * 0.88, treatyGlobe.cx, treatyGlobe.cy, treatyGlobe.radius * 1.18);
    atmosphere.addColorStop(0, "rgba(60, 145, 230, 0)");
    atmosphere.addColorStop(0.74, "rgba(72, 155, 236, 0.09)");
    atmosphere.addColorStop(1, "rgba(132, 201, 255, 0.36)");
    ctx.fillStyle = atmosphere;
    ctx.beginPath();
    ctx.arc(treatyGlobe.cx, treatyGlobe.cy, treatyGlobe.radius * 1.18, 0, Math.PI * 2);
    ctx.fill();
    ctx.drawImage(treatyGlobe.sphereCanvas, treatyGlobe.cx - treatyGlobe.radius, treatyGlobe.cy - treatyGlobe.radius, treatyGlobe.radius * 2, treatyGlobe.radius * 2);
    ctx.save();
    ctx.beginPath();
    ctx.arc(treatyGlobe.cx, treatyGlobe.cy, treatyGlobe.radius, 0, Math.PI * 2);
    ctx.clip();
    drawTreatyGraticule(ctx, centerLat, centerLon);
    ctx.restore();
    ctx.beginPath();
    ctx.arc(treatyGlobe.cx, treatyGlobe.cy, treatyGlobe.radius, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(177, 218, 255, 0.88)";
    ctx.lineWidth = 1.55;
    ctx.shadowColor = "rgba(90, 162, 255, 0.78)";
    ctx.shadowBlur = 13;
    ctx.stroke();
    ctx.shadowBlur = 0;

    if (!reduceMotion) treatyGlobe.raf = requestAnimationFrame(drawTreatyGlobe);
  }

  function startTreatyGlobe() {
    stopTreatyGlobe();
    ensureTreatyGlobe().then((ready) => {
      if (!ready || currentScene !== "treaty") return;
      treatyGlobe.startedAt = performance.now();
      treatyGlobe.lastFrame = 0;
      drawTreatyGlobe(treatyGlobe.startedAt);
    });
  }

  function stopTreatyGlobe() {
    if (treatyGlobe.raf) cancelAnimationFrame(treatyGlobe.raf);
    treatyGlobe.raf = 0;
  }

  function resetTreaty() {
    const stage = $(".treaty-map");
    if (stage) stage.classList.remove("is-globe-revealed");
    selectActionRoute($(".action-node--burn"), false);
    startTreatyGlobe();
  }

  function selectActionRoute(button, withSound = true) {
    if (!button) return;
    const nodes = $$(".action-node");
    const previous = nodes.find((node) => node.classList.contains("is-active"));
    nodes.forEach((node) => {
      const selected = node === button;
      node.classList.toggle("is-active", selected);
      node.setAttribute("aria-pressed", selected ? "true" : "false");
    });

    const index = nodes.indexOf(button);
    const step = $("#actionDetailStep");
    const source = $("#actionDetailSource");
    const recommendation = $("#actionDetailRecommendation");
    const effect = $("#actionDetailEffect");
    if (step) step.textContent = `RUTA ${String(index + 1).padStart(2, "0")} / 04`;
    if (source) source.textContent = button.dataset.source || "";
    if (recommendation) recommendation.textContent = button.dataset.recommendation || "";
    if (effect) effect.textContent = button.dataset.effect || "";

    const stepsList = $("#actionDetailSteps ol");
    if (stepsList) {
      const steps = (button.dataset.steps || "").split("|").filter(Boolean);
      stepsList.innerHTML = steps
        .map((text, i) => `<li><span>${String(i + 1).padStart(2, "0")}</span><p>${text}</p></li>`)
        .join("");
    }

    const detail = $("#actionDetail");
    if (detail) {
      detail.classList.remove("is-revealing");
      void detail.offsetWidth;
      detail.classList.add("is-revealing");
    }
    if (withSound && previous !== button) playPresentationSound("route");
  }

  function bindTreaty() {
    $$(".action-node").forEach((button) => {
      button.addEventListener("click", () => selectActionRoute(button));
    });
    selectActionRoute($(".action-node--burn"), false);
  }

  function animateTreaty() {
    const stage = $(".treaty-map");
    const badge = $(".treaty-map__badge strong");
    if (stage) stage.classList.add("is-globe-revealed");
    if (badge && !reduceMotion) {
      const state = { value: 0 };
      track(anime.animate(state, {
        value: 186,
        duration: 900,
        ease: "outQuad",
        onUpdate: () => { badge.textContent = String(Math.round(state.value)); },
        onComplete: () => { badge.textContent = "186"; }
      }));
    }
  }

  /* ------------------------------------------------------------
     Escena 09 · Cierre
     ------------------------------------------------------------ */

  function buildCloseParticles() {
    const group = $("#closeParticles");
    if (!group) return;

    while (group.firstChild) group.removeChild(group.firstChild);
    if (reduceMotion) return;

    const count = 28;
    for (let i = 0; i < count; i += 1) {
      const angle = (i / count) * Math.PI * 2 + (i % 3) * 0.16;
      const radius = 118 + ((i * 37) % 118);
      const cx = 280 + Math.cos(angle) * radius;
      const cy = 300 + Math.sin(angle) * radius;
      const dot = svgEl("circle", {
        cx: cx.toFixed(1),
        cy: cy.toFixed(1),
        r: (1.6 + (i % 3) * 0.9).toFixed(1),
        class: i % 5 === 0 ? "is-coral" : ""
      });
      dot.style.transformBox = "fill-box";
      dot.style.transformOrigin = "center";
      group.appendChild(dot);

      track(anime.animate(dot, {
        translateY: [0, -8, 0],
        opacity: [0.3, 1],
        duration: 2100 + (i % 6) * 260,
        delay: (i % 9) * 90,
        loop: true,
        alternate: true,
        ease: "inOutSine"
      }));
    }
  }

  function resetClose() {
    buildCloseParticles();
  }

  function bindClose() {
    const restart = $("#restartBtn");
    if (restart) {
      restart.addEventListener("click", () => {
        playPresentationSound("reset");
        closeNotes(true);
        closeMap(true);
        Reveal.slide(0);
      });
    }
  }

  sceneReset.biomag = resetBiomag;
  sceneReset["biomag:enter"] = runBioAuto;
  sceneReset.treaty = resetTreaty;
  sceneReset["treaty:enter"] = animateTreaty;
  sceneReset.close = resetClose;

  sceneExit.hero = exitHero;
  sceneExit.definition = stopResistanceSound;
  sceneExit.map = () => {
    resetMapScene();
    clearSolarEarthTransition();
  };
  sceneExit.traits = exitTraits;
  sceneExit.biomag = stopBioAuto;
  sceneExit.treaty = stopTreatyGlobe;

  /* ------------------------------------------------------------
     Arranque
     ------------------------------------------------------------ */

  function bindSceneControls() {
    const heroButton = $("#heroPlay");
    if (heroButton) heroButton.addEventListener("click", playHeroJourney);

    const playAll = $("#playAllRoutes");
    if (playAll) playAll.addEventListener("click", playAllMapRoutes);

    $$(".route-card").forEach((card) => {
      card.addEventListener("click", () => playMapRoute(card.getAttribute("data-route")));
    });

    bindDefinition();
    bindTraits();
    bindTraitAuto();
    bindDirty();
    bindDDT();
    bindBiomag();
    bindTreaty();
    bindClose();
  }

  bindChrome();
  bindSceneControls();

  Reveal.on("ready", onReady);
  Reveal.on("slidechanged", onSlideChanged);

  Reveal.initialize({
    width: 1920,
    height: 1080,
    margin: 0,
    minScale: 0.15,
    maxScale: 1.4,
    controls: false,
    progress: false,
    slideNumber: false,
    hash: false,
    history: false,
    keyboard: true,
    touch: true,
    overview: false,
    center: false,
    transition: "fade",
    transitionSpeed: "fast",
    backgroundTransition: "none",
    autoAnimate: false,
    viewDistance: 3,
    mobileViewDistance: 2,
    respondToHashChanges: false
  });
})();
