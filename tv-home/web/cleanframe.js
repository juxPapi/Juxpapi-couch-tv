// CleanFrame-inspired skin for couch-tv's Fire TV WebView.
// Adapted from nthnclrk/CleanFrame (MIT): photographic background, quiet utilities,
// frosted dock, monochrome brand marks, and a settings sheet in the same visual language.
// See cleanframe/CLEANFRAME-LICENSE.txt. This build is Fire TV only.
(function (global) {
  "use strict";

  var VERSION = "0.4";
  var W = 1920, H = 1080;
  var HOME_COUNT = 5;
  var HOLD_MS = 650;
  var DEFAULT_WALL = "cove.jpg";
  var WALL_KEY = "tvhome.cleanframe.wall";
  var BG_KEY = "tvhome.cleanframe.bg";       // { mode: photo|light|dark, rotation: fixed|open|5|15|60 }
  var LAYOUT_KEY = "tvhome.cleanframe.layout"; // { apps: text|icons|both, controls: text|icons|both }
  var TYPE_KEY = "tvhome.cleanframe.type";    // font name
  var FOCUS_KEY = "tvhome.cleanframe.focus";  // { type: type|glass, tint: soft|frost|clear }
  var FONTS = ["Manrope", "Neue Montreal", "Mori", "Pangram Sans", "Geist", "Newsreader"];
  var ICONS = {
    "com.amazon.firetv.youtube": "youtube",
    "com.google.android.youtube.tv": "youtube",
    "com.google.android.youtube.tvmusic": "youtube",
    "com.netflix.ninja": "netflix",
    "com.disney.disneyplus": "disneyplus",
    "com.amazon.amazonvideo.livingroom": "primevideo",
    "com.apple.atve.androidtv.appletv": "appletv",
    "au.net.abc.iview": "abciview",
    "com.sbs.ondemand.tv": "sbs",
    "com.spotify.tv.android": "spotify"
  };
  var QUICK_SVG = {
    bluetooth: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 7.5l11 9L12 21V3l5.5 4.5-11 9"/></svg>',
    network: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 9a14 14 0 0 1 19 0M5.7 12.5a9.5 9.5 0 0 1 12.6 0M8.9 16a4.8 4.8 0 0 1 6.2 0"/><circle cx="12" cy="19.3" r="1"/></svg>',
    art: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2.5" y="4" width="19" height="16" rx="2"/><circle cx="8.7" cy="10" r="1.5"/><path d="m4 17.5 5.2-5.2 4.2 4.2 2.7-2.7 7.6 5.7"/></svg>',
    home: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 11.2 12 4.5l8 6.7v8.3a1.6 1.6 0 0 1-1.6 1.6h-4.1v-5.4h-4.6v5.4H5.6A1.6 1.6 0 0 1 4 19.5Z"/></svg>',
    // A real gear, not the sun that used to sit at the end of the row.
    settings: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3.1"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06a2.05 2.05 0 1 1-2.9 2.9l-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1.02 1.56V21a2.05 2.05 0 1 1-4.1 0v-.09A1.7 1.7 0 0 0 8.85 19.4a1.7 1.7 0 0 0-1.87.34l-.06.06a2.05 2.05 0 1 1-2.9-2.9l.06-.06A1.7 1.7 0 0 0 4.42 15a1.7 1.7 0 0 0-1.56-1.02H2.8a2.05 2.05 0 1 1 0-4.1h.09A1.7 1.7 0 0 0 4.42 8.85a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2.05 2.05 0 1 1 2.9-2.9l.06.06A1.7 1.7 0 0 0 8.85 4.42 1.7 1.7 0 0 0 9.87 2.86V2.8a2.05 2.05 0 1 1 4.1 0v.09A1.7 1.7 0 0 0 15 4.42a1.7 1.7 0 0 0 1.88-.34l.06-.06a2.05 2.05 0 1 1 2.9 2.9l-.06.06A1.7 1.7 0 0 0 19.42 8.85c.12.63.6 1.14 1.24 1.33H21a2.05 2.05 0 1 1 0 4.1h-.09A1.7 1.7 0 0 0 19.4 15Z"/></svg>',
    sleep: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z"/></svg>',
    picture: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4.5" width="18" height="15" rx="2.5"/><path d="m7 15 3.2-4 2.6 3.2 2-2.4L17 15"/></svg>',
    connections: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 14a4 4 0 0 0 5.7 0l3-3A4 4 0 0 0 13 5.3l-1.2 1.2"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3A4 4 0 0 0 11 18.7l1.2-1.2"/></svg>',
    screensaver: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="13" rx="2"/><path d="M9 21h6"/></svg>'
  };
  var QUICK_LABELS = {
    sleep: "Sleep timer", picture: "Picture mode", connections: "Connections",
    bluetooth: "Bluetooth", network: "Network", screensaver: "Screensaver"
  };
  var SVG = {
    chevron: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9.5 5.5 16 12l-6.5 6.5"/></svg>',
    check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    back: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14.5 5-7 7 7 7"/></svg>',
    updown: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7.5 9.5 4.5-4.5 4.5 4.5M7.5 14.5l4.5 4.5 4.5-4.5"/></svg>'
  };
  var QUICK_IDS = ["bluetooth", "network"];

  var wallpaperFiles = [DEFAULT_WALL];

  var state = {
    mounted: false,
    focusRow: "dock",
    focus: 0,
    utility: 0,
    artFocus: false,
    controls: [],
    gridFocus: 0,
    artOpen: false,
    artIndex: 0,
    artTimer: null,
    statusTimer: null,
    rotationTimer: null,
    hooks: null,
    order: [],
    lift: -1,
    liftOrigin: null,
    liftPkg: null,
    okDown: false,
    okHeld: false,
    okTimer: null,
    settingsOpen: false,
    settingsView: "home",
    settingsFocus: 0,
    detail: null,
    detailTitle: "",
    detailSections: [],
    detailRows: [],
    detailFocus: 0
  };

  // ---------------- saved values ----------------
  function prefix() { return /[?&](mock|preview)=/.test(global.location.search) ? "mock:" : ""; }
  function settingsRecordKey() { return prefix() + "tvhome.settings"; }
  function readKept(key) {
    var raw = null;
    try { if (global.TVOS && global.TVOS.kept) raw = global.TVOS.kept(key); } catch (e) {}
    if (raw == null) try { raw = global.localStorage.getItem(key); } catch (e) {}
    if (raw == null) return null;
    try { return JSON.parse(raw); } catch (e) { return raw; }
  }
  function writeKept(key, value) {
    var raw = JSON.stringify(value);
    try { global.localStorage.setItem(key, raw); } catch (e) {}
    try { if (global.TVOS && global.TVOS.keep) global.TVOS.keep(key, raw); } catch (e) {}
  }
  function savedLook() {
    var rec = readKept(settingsRecordKey());
    var look = rec && rec.s && rec.s.look;
    return typeof look === "string" ? look.toLowerCase() : null;
  }
  function currentLook() {
    var match = /[?&]theme=(cleanframe|night)\b/.exec(global.location.search);
    if (match) return match[1];
    var saved = savedLook();
    if (saved === "cleanframe" || saved === "night") return saved;
    var cfg = global.COUCH_CONFIG || {};
    return String((cfg.home && cfg.home.look) || "night").toLowerCase() === "cleanframe" ? "cleanframe" : "night";
  }
  function requested() { return currentLook() === "cleanframe"; }

  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function validWall(file) {
    return /^[a-z0-9_-][a-z0-9_.-]*\.(jpe?g|webp|png|avif)$/i.test(file || "");
  }
  function wallLabel(file) {
    return String(file || DEFAULT_WALL).replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").replace(/\b\w/g, function (s) { return s.toUpperCase(); });
  }
  function savedWall() {
    var file = readKept(prefix() + WALL_KEY);
    return typeof file === "string" && validWall(file) ? file : null;
  }
  function savedBg() {
    var r = readKept(prefix() + BG_KEY);
    return (r && typeof r === "object") ? r : { mode: "photo", rotation: "fixed" };
  }
  function savedLayout() {
    var r = readKept(prefix() + LAYOUT_KEY);
    return (r && typeof r === "object") ? r : { apps: "both", controls: "both" };
  }
  function savedFont() {
    var f = readKept(prefix() + TYPE_KEY);
    return (typeof f === "string" && FONTS.indexOf(f) >= 0) ? f : "Manrope";
  }
  function savedFocus() {
    var r = readKept(prefix() + FOCUS_KEY);
    return (r && typeof r === "object") ? r : { type: "glass", tint: "frost" };
  }
  function layoutLabel() {
    var l = savedLayout();
    return (l.apps === l.controls) ? (l.apps.charAt(0).toUpperCase() + l.apps.slice(1)) : "Mixed";
  }
  function fontLabel() { return savedFont(); }
  function focusLabel() {
    var f = savedFocus();
    return f.type.charAt(0).toUpperCase() + f.type.slice(1) + " \u00b7 " + f.tint.charAt(0).toUpperCase() + f.tint.slice(1);
  }
  function currentWall() {
    var photo = document.getElementById("cleanframe-photo");
    var src = photo ? String(photo.getAttribute("src") || "") : "";
    return src.split("/").pop() || DEFAULT_WALL;
  }

  // ---------------- apps ----------------
  function nativeApps() {
    try {
      if (global.TVOS && global.TVOS.apps) return JSON.parse(global.TVOS.apps()) || [];
    } catch (e) {}
    return [];
  }
  function baseApps() {
    var list = nativeApps().map(function (a) {
      return { name: a.label || a.name || a.package, package: a.package };
    });
    if (!list.length && global.MOCK_APPS) list = global.MOCK_APPS.slice();
    return list.filter(function (a) { return a.package && a.package !== "com.android.tv.settings"; });
  }
  // Night (and the phone's Arrange apps) keep the order in tvhome.order.tv. CleanFrame reads
  // the same list, so a move on either home is not lost when the skin changes.
  function savedPackages() {
    var rec = readKept(prefix() + "tvhome.order.tv");
    if (rec && Array.isArray(rec.packages)) return rec.packages.slice();
    var cache = readKept(prefix() + "tvhome.cache.v2");
    if (cache && cache.order && Array.isArray(cache.order.packages)) return cache.order.packages.slice();
    return [];
  }
  function apps() {
    var list = baseApps();
    var order = state.order && state.order.length ? state.order : savedPackages();
    if (!order.length) return list;
    var at = {};
    order.forEach(function (pkg, i) { at[pkg] = i; });
    var known = list.filter(function (a) { return at[a.package] !== undefined; })
      .sort(function (a, b) { return at[a.package] - at[b.package]; });
    var rest = list.filter(function (a) { return at[a.package] === undefined; });
    return known.concat(rest);
  }
  function homeApps() { return apps().slice(0, HOME_COUNT); }
  function toggleHomeApp(pkg) {
    var ordered = savedPackages().slice();
    if (!ordered.length) ordered = apps().map(function (a) { return a.package; });
    var idx = ordered.indexOf(pkg);
    if (idx >= 0) {
      ordered.splice(idx, 1);
    } else {
      if (ordered.length >= HOME_COUNT) { setStatus("Home is full (max " + HOME_COUNT + ")"); return; }
      ordered.push(pkg);
    }
    writeKept(prefix() + "tvhome.order.tv", { line: ordered.length, packages: ordered, pending: true });
    state.order = ordered.slice();
    if (state.hooks && state.hooks.saveAppOrder) state.hooks.saveAppOrder(ordered.slice(), ordered.length);
    renderDock();
    buildDetail();
    renderSettingsPanel();
  }

  function iconSrc(pkg) {
    var brand = ICONS[pkg];
    if (brand) return "cleanframe/icons/" + brand + ".svg";
    try {
      if (global.MOCK_ICON) {
        var mock = global.MOCK_ICON(pkg);
        if (mock) return mock;
      }
      if (global.TVOS) return "http://tvos.invalid/icon/" + encodeURIComponent(pkg);
    } catch (e) {}
    return null;
  }
  function markHtml(a) {
    var src = iconSrc(a.package);
    var words = String(a.name || "?").trim().split(/\s+/);
    var letters = (words[0] || "?").charAt(0) + (words.length > 1 ? words[1].charAt(0) : "");
    if (src) {
      return '<img class="icon-mark" alt="" crossorigin="anonymous" data-mono="' + esc(letters.toUpperCase()) + '" src="' + esc(src) + '">';
    }
    return '<span class="monogram" aria-hidden="true">' + esc(letters.toUpperCase()) + '</span>';
  }
  function wireIconFallbacks(rootElement) {
    Array.prototype.forEach.call((rootElement || document).querySelectorAll("img.icon-mark"), function (img) {
      if (img.dataset.fallbackWired) return;
      img.dataset.fallbackWired = "1";
      img.addEventListener("error", function () {
        var mono = img.getAttribute("data-mono");
        if (!mono || !img.parentNode) return;
        var span = document.createElement("span");
        span.className = "monogram";
        span.setAttribute("aria-hidden", "true");
        span.textContent = mono;
        img.parentNode.replaceChild(span, img);
      }, { once: true });
    });
  }

  function quickAllIds() {
    if (state.hooks && state.hooks.quickAll) {
      var all = state.hooks.quickAll();
      if (Array.isArray(all) && all.length) return all.filter(function (q) { return !!QUICK_LABELS[q]; });
    }
    return ["sleep", "picture", "connections", "bluetooth", "network", "screensaver"];
  }
  function quickOnIds() {
    if (state.hooks && state.hooks.quickOn) {
      var on = state.hooks.quickOn();
      if (Array.isArray(on)) return on.filter(function (q) { return !!QUICK_LABELS[q]; });
    }
    var cfg = global.COUCH_CONFIG || {};
    var tvs = Array.isArray(cfg.tvs) ? cfg.tvs : [];
    var id = cfg.default_tv;
    var tv = tvs.filter(function (x) { return x.id === id; })[0] || tvs[0] || {};
    if (!Array.isArray(tv.quick)) return QUICK_IDS.slice();
    return tv.quick.filter(function (q) { return !!QUICK_LABELS[q]; });
  }
  function quickIds() { return quickOnIds(); }

  // The skin is shared with the Night home. Night keeps it in the same settings record; the
  // preview (?theme=) is the fallback when no bridge hooks are present.
  function currentSkin() {
    if (state.hooks && state.hooks.getSkin) return state.hooks.getSkin();
    var m = /[?&]theme=(cleanframe|night)\b/.exec(global.location.search);
    return m ? m[1] : "night";
  }
  function chooseSkin(look) {
    if (currentSkin() === look) return;
    if (state.hooks && state.hooks.setSkin) { state.hooks.setSkin(look); return; }
    var parts = global.location.href.split("#"), path = parts[0], hash = parts[1] || "";
    var q = (path.split("?")[1] || "").split("&").filter(function (p) {
      return p && p.indexOf("theme=") !== 0 && p.indexOf("reset=") !== 0;
    });
    q.push("theme=" + look);
    global.location.replace(path.split("?")[0] + "?" + q.join("&") + (hash ? "#" + hash : ""));
  }
  function buildControls() {
    var quick = quickIds().map(function (id) {
      return { id: "q:" + id, quick: id, label: QUICK_LABELS[id] || id };
    });
    return quick.concat([
      { id: "home", label: "Home settings" },
      { id: "settings", label: "TV settings" }
    ]);
  }
  function renderUtilities() {
    state.controls = buildControls();
    var nav = document.querySelector(".cleanframe-utils");
    if (nav) nav.innerHTML = state.controls.map(utilityHtml).join("");
    state.utility = Math.max(0, Math.min(state.utility, state.controls.length - 1));
  }
  function controlIcon(control) {
    return QUICK_SVG[control.quick || control.id] || QUICK_SVG.settings;
  }
  function utilityHtml(control) {
    return '<button class="cleanframe-utility" type="button" data-utility="' + esc(control.id) + '" title="' + esc(control.label) + '" aria-label="' + esc(control.label) + '">'
      + controlIcon(control) + '</button>';
  }

  function setStatus(text, sticky) {
    var el = document.getElementById("cleanframe-status");
    if (!el) return;
    if (state.statusTimer) clearTimeout(state.statusTimer);
    el.textContent = text || "";
    el.classList.toggle("is-on", !!text);
    if (text && !sticky) {
      state.statusTimer = setTimeout(function () { el.classList.remove("is-on"); }, 3000);
    }
  }
  function fit() {
    var s = Math.min(global.innerWidth / W, global.innerHeight / H);
    var stage = document.getElementById("cleanframe-stage");
    if (stage) stage.style.transform = "translate(" + ((global.innerWidth - W * s) / 2) + "px, " + ((global.innerHeight - H * s) / 2) + "px) scale(" + s + ")";
  }
  function updateClock() {
    var now = new Date();
    var el = document.getElementById("cleanframe-time");
    if (el) el.textContent = (now.getHours() % 12 || 12) + ":" + String(now.getMinutes()).padStart(2, "0");
  }

  // ---------------- dock and grid ----------------
  function renderDock() {
    var track = document.getElementById("cleanframe-track");
    track.innerHTML = homeApps().map(function (a, i) {
      return '<button class="cleanframe-tile" type="button" data-index="' + i + '"><span class="cleanframe-mark">' + markHtml(a) + '</span><span class="cleanframe-name">' + esc(a.name) + '</span><span class="cleanframe-move" aria-hidden="true">' + SVG.updown + '</span></button>';
    }).join("");
    if (window.CleanFrameIcons) window.CleanFrameIcons.prepare(track);
    wireIconFallbacks(track);
    state.focus = Math.max(0, Math.min(state.focus, homeApps().length - 1));
    focusDock();
  }
  function renderGrid() {
    var body = document.getElementById("cleanframe-grid-body");
    body.innerHTML = apps().map(function (a, i) {
      return '<button class="cleanframe-grid-item" type="button" data-index="' + i + '"><span class="cleanframe-mark">' + markHtml(a) + '</span><span class="cleanframe-name">' + esc(a.name) + '</span></button>';
    }).join("");
    if (window.CleanFrameIcons) window.CleanFrameIcons.prepare(body);
    wireIconFallbacks(body);
  }
  function focusMiddleDock() {
    var n = homeApps().length;
    state.focus = n ? Math.floor(n / 2) : 0;
    focusDock();
  }
  function focusArt() {
    state.focusRow = "utility";
    state.artFocus = true;
    Array.prototype.forEach.call(document.querySelectorAll(".cleanframe-utility"), function (el) { el.classList.remove("is-focus"); });
    Array.prototype.forEach.call(document.querySelectorAll(".cleanframe-tile"), function (el) { el.classList.remove("is-focus"); });
    var art = document.getElementById("cleanframe-art-btn");
    if (art) art.classList.add("is-focus");
    var arrow = document.getElementById("cleanframe-down-arrow");
    if (arrow) arrow.classList.remove("is-on");
  }
  function focusUtility(index) {
    if (typeof index === "number") state.utility = Math.max(0, Math.min(index, state.controls.length - 1));
    state.focusRow = "utility";
    state.artFocus = false;
    var art = document.getElementById("cleanframe-art-btn");
    if (art) art.classList.remove("is-focus");
    Array.prototype.forEach.call(document.querySelectorAll(".cleanframe-utility"), function (el, i) {
      el.classList.toggle("is-focus", i === state.utility);
    });
    Array.prototype.forEach.call(document.querySelectorAll(".cleanframe-tile"), function (el) { el.classList.remove("is-focus"); });
    var arrow = document.getElementById("cleanframe-down-arrow");
    if (arrow) arrow.classList.remove("is-on");
  }
  function focusDock() {
    state.focusRow = "dock";
    state.artFocus = false;
    var art = document.getElementById("cleanframe-art-btn");
    if (art) art.classList.remove("is-focus");
    Array.prototype.forEach.call(document.querySelectorAll(".cleanframe-utility"), function (el) { el.classList.remove("is-focus"); });
    var tiles = document.querySelectorAll(".cleanframe-tile");
    state.focus = Math.max(0, Math.min(state.focus, tiles.length - 1));
    Array.prototype.forEach.call(tiles, function (el, i) {
      el.classList.toggle("is-focus", i === state.focus);
      el.classList.toggle("is-lifted", state.lift === i);
    });
    var track = document.getElementById("cleanframe-track"), dock = document.querySelector(".cleanframe-dock");
    if (track && dock && tiles.length) {
      var pitch = tiles.length > 1 ? tiles[1].offsetLeft - tiles[0].offsetLeft : 300;
      var max = Math.max(0, track.scrollWidth - dock.clientWidth);
      if (max === 0) {
        track.style.transform = "translateX(" + ((dock.clientWidth - track.scrollWidth) / 2) + "px)";
      } else {
        var offset = state.focus * pitch;
        var tileWidth = tiles[0].offsetWidth || 288;
        var centerOffset = offset - (dock.clientWidth - tileWidth) / 2;
        centerOffset = Math.max(0, Math.min(centerOffset, max));
        track.style.transform = "translateX(-" + centerOffset + "px)";
      }
    }
    var arrow = document.getElementById("cleanframe-down-arrow");
    if (arrow) arrow.classList.toggle("is-on", dockVisible() && tiles.length > 0);
  }
  function focusGrid() {
    Array.prototype.forEach.call(document.querySelectorAll(".cleanframe-grid-item"), function (el, i) {
      el.classList.toggle("is-focus", i === state.gridFocus);
    });
  }
  function launch(a) {
    if (!a) return false;
    try {
      if (global.TVOS && global.TVOS.launch) return !!global.TVOS.launch(a.package);
    } catch (e) {}
    setStatus("Would open " + a.name);
    return true;
  }
  function openGrid() {
    if (state.settingsOpen) return;
    state.gridFocus = 0;
    renderGrid();
    document.getElementById("cleanframe-grid").classList.add("is-open");
    document.getElementById("cleanframe-stage").classList.add("is-grid");
    var arrow = document.getElementById("cleanframe-down-arrow");
    if (arrow) arrow.classList.remove("is-on");
    focusGrid();
  }
  function closeGrid() {
    document.getElementById("cleanframe-grid").classList.remove("is-open");
    document.getElementById("cleanframe-stage").classList.remove("is-grid");
    var arrow = document.getElementById("cleanframe-down-arrow");
    if (arrow && dockVisible()) arrow.classList.add("is-on");
    focusDock();
  }
  function dockVisible() {
    var grid = document.getElementById("cleanframe-grid");
    return !!grid && !grid.classList.contains("is-open") && !state.artOpen && !state.settingsOpen;
  }

  // ---------------- Art Mode ----------------
  function setArtImage(file) {
    if (wallpaperFiles.indexOf(file) < 0 || !validWall(file)) return;
    state.artIndex = wallpaperFiles.indexOf(file);
    var img = document.getElementById("cleanframe-art-photo");
    img.src = "cleanframe/wallpapers/" + file;
    img.alt = wallLabel(file);
    document.getElementById("cleanframe-art-caption").textContent = wallLabel(file);
  }
  function cycleArt(step) {
    if (!wallpaperFiles.length) return;
    state.artIndex = (state.artIndex + step + wallpaperFiles.length) % wallpaperFiles.length;
    setArtImage(wallpaperFiles[state.artIndex]);
  }
  function setKeepScreenAwake(on) {
    try {
      if (global.TVOS && global.TVOS.setKeepScreenOn) global.TVOS.setKeepScreenOn(!!on);
    } catch (e) {}
  }
  function openArt() {
    if (state.settingsOpen) return;
    state.artOpen = true;
    document.getElementById("cleanframe-stage").classList.add("is-art");
    document.getElementById("cleanframe-art").setAttribute("aria-hidden", "false");
    var file = wallpaperFiles[Math.floor(Math.random() * wallpaperFiles.length)] || DEFAULT_WALL;
    setArtImage(file);
    if (state.artTimer) clearInterval(state.artTimer);
    state.artTimer = setInterval(function () { cycleArt(1); }, 30000);
    setKeepScreenAwake(true);
  }
  function closeArt() {
    if (!state.artOpen) return false;
    state.artOpen = false;
    document.getElementById("cleanframe-stage").classList.remove("is-art");
    document.getElementById("cleanframe-art").setAttribute("aria-hidden", "true");
    if (state.artTimer) clearInterval(state.artTimer);
    state.artTimer = null;
    setKeepScreenAwake(false);
    focusDock();
    return true;
  }
  function pause() {
    if (state.artOpen) closeArt();
    okReset();
  }

  // ---------------- CleanFrame settings sheet ----------------
  var WEATHER_TYPES = [["auto", "Auto"], ["rain", "Rain"], ["snow", "Snow"], ["fog", "Fog"], ["storm", "Storm"], ["clear", "Clear"]];
  function weatherState() {
    var st = state.hooks && state.hooks.weatherState ? state.hooks.weatherState() : null;
    if (!st) return { show: true, effects: false, type: "auto", sun: false, f: false, every: 15 };
    var every = Number(st.every);
    return {
      show: !!st.show, effects: !!st.effects,
      type: weatherTypeLabel(st.type) ? st.type : "auto",
      sun: !!st.sun, f: !!st.f,
      every: [15, 30, 60].indexOf(every) >= 0 ? every : 30
    };
  }
  function weatherTypeLabel(type) {
    for (var i = 0; i < WEATHER_TYPES.length; i++) if (WEATHER_TYPES[i][0] === type) return WEATHER_TYPES[i][1];
    return "";
  }
  function weatherSet(patch) { if (state.hooks && state.hooks.weatherSet) state.hooks.weatherSet(patch); }
  function cycleWeather(key, d) {
    var st = weatherState();
    if (key === "type") {
      var cur = 0;
      for (var i = 0; i < WEATHER_TYPES.length; i++) if (WEATHER_TYPES[i][0] === st.type) cur = i;
      weatherSet({ type: WEATHER_TYPES[(cur + d + WEATHER_TYPES.length) % WEATHER_TYPES.length][0] });
      return;
    }
    if (key === "every") {
      var opts = [15, 30, 60], cur2 = opts.indexOf(st.every);
      if (cur2 < 0) cur2 = 0;
      weatherSet({ every: opts[(cur2 + d + opts.length) % opts.length] });
    }
  }
  function toggleQuick(q) {
    if (state.hooks && state.hooks.quickToggle) state.hooks.quickToggle(q);
    renderUtilities();
  }
  function moveQuick(q, d) {
    if (state.hooks && state.hooks.quickMove) state.hooks.quickMove(q, d);
    renderUtilities();
  }
  function settingsGroups() {
    var count = homeApps().length;
    var wx = weatherState();
    var on = quickOnIds();
    return [
      { id: "skin", label: "Skin", value: currentSkin() === "cleanframe" ? "CleanFrame" : "Night scenes", run: function () { openSettingsDetail("skin"); } },
      { id: "background", label: "Background", value: savedWall() ? wallLabel(savedWall()) : "Shuffle at each start", run: function () { openSettingsDetail("background"); } },
      { id: "layout", label: "Layout", value: layoutLabel(), run: function () { openSettingsDetail("layout"); } },
      { id: "typography", label: "Typography", value: fontLabel(), run: function () { openSettingsDetail("typography"); } },
      { id: "focus", label: "Focus", value: focusLabel(), run: function () { openSettingsDetail("focus"); } },
      { id: "apps", label: "Apps on Home", value: count + (count === 1 ? " app" : " apps"), run: function () { openSettingsDetail("apps"); } },
      { id: "quick", label: "Quick settings", value: on.length + (on.length === 1 ? " button" : " buttons"), run: function () { openSettingsDetail("quick"); } },
      { id: "weather", label: "Weather effects", value: wx.effects ? weatherTypeLabel(wx.type) : "Off", run: function () { openSettingsDetail("weather"); } },
      { id: "about", label: "About", value: "CleanFrame for couch-tv", run: function () { openSettingsDetail("about"); } }
    ];
  }
  function detailData(id) {
    if (id === "skin") {
      var skin = currentSkin();
      var opts = [
        { key: "cleanframe", label: "CleanFrame", desc: "Quiet photo home with the frosted dock" },
        { key: "night", label: "Night scenes", desc: "Moving scenes with cards and the clock" }
      ];
      var items = opts.map(function (o) {
        return { label: o.label, desc: o.desc, checked: skin === o.key, run: function () { chooseSkin(o.key); } };
      });
      return { title: "Skin", sections: [
        { title: "Home skin", items: [
          { label: "Changing the skin restarts the home screen.", info: true }
        ].concat(items) }
      ] };
    }
    if (id === "quick") {
      var on = quickOnIds();
      var items = [];
      quickAllIds().forEach(function (q) {
        var enabled = on.indexOf(q) >= 0;
        items.push({
          label: QUICK_LABELS[q] || q,
          desc: state.hooks && state.hooks.quickNeeds ? state.hooks.quickNeeds(q) : "",
          kind: "check", checked: enabled,
          move: enabled ? function (d) { moveQuick(q, d); } : null,
          run: function () { toggleQuick(q); }
        });
      });
      return { title: "Quick settings", sections: [{ title: "Quick buttons on the home", items: items }] };
    }
    if (id === "weather") {
      var wx = weatherState();
      var items = [
        { label: "Show weather", desc: "Hide the weather text in the clock", kind: "check", checked: wx.show, run: function () { weatherSet({ show: !wx.show }); } },
        { label: "Weather effects", desc: "Rain, snow and fog over the wallpaper", kind: "check", checked: wx.effects, run: function () { weatherSet({ effects: !wx.effects }); } },
        { label: "Sunlight grading", desc: "Warm the photo as the sun moves", kind: "check", checked: wx.sun, run: function () { weatherSet({ sun: !wx.sun }); } },
        { label: "Effect", value: weatherTypeLabel(wx.type), kind: "cycle", adjust: function (d) { cycleWeather("type", d); } },
        { label: "Units", value: wx.f ? "Fahrenheit" : "Celsius", kind: "cycle", adjust: function () { weatherSet({ f: !wx.f }); } },
        { label: "Update every", value: wx.every + " minutes", kind: "cycle", adjust: function (d) { cycleWeather("every", d); } }
      ];
      return { title: "Weather effects", sections: [{ title: "On the wallpaper", items: items }] };
    }
    if (id === "background") {
      var bg = savedBg();
      var modes = ["photo", "light", "dark"];
      var modeItems = modes.map(function (m) {
        return { label: m.charAt(0).toUpperCase() + m.slice(1), desc: m === "photo" ? "Bundled or chosen wallpaper" : (m === "light" ? "Light flat background" : "Dark flat background"),
          checked: bg.mode === m, run: function () { writeKept(prefix() + BG_KEY, { mode: m, rotation: bg.rotation }); applyBg(); buildDetail(); renderSettingsPanel(); } };
      });
      var rotOpts = ["fixed", "open", "5", "15", "60"];
      var rotLabels = { fixed: "Fixed", open: "Each time Home opens", "5": "Every 5 minutes", "15": "Every 15 minutes", "60": "Every hour" };
      var rotItems = rotOpts.map(function (r) {
        return { label: rotLabels[r], checked: bg.rotation === r, run: function () { writeKept(prefix() + BG_KEY, { mode: bg.mode, rotation: r }); applyRotation(); settingsHome(); } };
      });
      var chosen = savedWall();
      var wallItems = [{ label: "Shuffle at each start", desc: "A different bundled photo each time the home opens", checked: !chosen, run: function () {
        writeKept(prefix() + WALL_KEY, null);
        shuffleWallpaper();
        settingsHome();
      } }];
      wallpaperFiles.forEach(function (file) {
        wallItems.push({ label: wallLabel(file), desc: file === DEFAULT_WALL ? "Bundled with couch-tv" : "Bundled photo", swatch: "cleanframe/wallpapers/" + file,
          checked: chosen === file, run: function () {
            setWallpaper(file, true);
            settingsHome();
          } });
      });
      var sections = [{ title: "Background mode", items: modeItems }];
      if (bg.mode === "photo") {
        sections.push({ title: "Wallpaper rotation", items: rotItems });
        sections.push({ title: "Home wallpaper", items: wallItems });
      }
      return { title: "Background", sections: sections };
    }
    if (id === "layout") {
      var l = savedLayout();
      var styleOpts = ["text", "icons", "both"];
      var styleLabels = { text: "Text", icons: "Icons", both: "Both" };
      var appsItems = styleOpts.map(function (s) {
        return { label: styleLabels[s], checked: l.apps === s, run: function () { writeKept(prefix() + LAYOUT_KEY, { apps: s, controls: l.controls }); applyLayout(); buildDetail(); renderSettingsPanel(); } };
      });
      var ctrlItems = styleOpts.map(function (s) {
        return { label: styleLabels[s], checked: l.controls === s, run: function () { writeKept(prefix() + LAYOUT_KEY, { apps: l.apps, controls: s }); applyLayout(); buildDetail(); renderSettingsPanel(); } };
      });
      return { title: "Layout", sections: [
        { title: "Layout", items: [{ label: "Dock", desc: "Apps in a row at the bottom", info: true }] },
        { title: "Apps", items: appsItems },
        { title: "Home controls", items: ctrlItems }
      ] };
    }
    if (id === "typography") {
      var f = savedFont();
      var items = FONTS.map(function (name) {
        return { label: name, desc: "Font for app names, clock and controls", checked: f === name, run: function () { writeKept(prefix() + TYPE_KEY, name); applyFont(); buildDetail(); renderSettingsPanel(); } };
      });
      return { title: "Typography", sections: [{ title: "Font", items: items }] };
    }
    if (id === "focus") {
      var fc = savedFocus();
      var typeItems = ["type", "glass"].map(function (t) {
        return { label: t.charAt(0).toUpperCase() + t.slice(1), desc: t === "type" ? "Solid focus plate" : "Translucent focus plate", checked: fc.type === t, run: function () { writeKept(prefix() + FOCUS_KEY, { type: t, tint: fc.tint }); applyFocus(); buildDetail(); renderSettingsPanel(); } };
      });
      var tintItems = ["soft", "frost", "clear"].map(function (t) {
        return { label: t.charAt(0).toUpperCase() + t.slice(1), desc: "Tint material", checked: fc.tint === t, run: function () { writeKept(prefix() + FOCUS_KEY, { type: fc.type, tint: t }); applyFocus(); buildDetail(); renderSettingsPanel(); } };
      });
      return { title: "Focus", sections: [{ title: "Focus style", items: typeItems }, { title: "Tint material", items: tintItems }] };
    }
    if (id === "apps") {
      var homeSet = {};
      homeApps().forEach(function (a) { homeSet[a.package] = true; });
      var items = apps().map(function (a) {
        var onHome = !!homeSet[a.package];
        return { label: a.name, desc: onHome ? "On Home" : "Not on Home", checked: onHome,
          run: function () { toggleHomeApp(a.package); } };
      });
      items.push({ label: "Arrange apps", desc: "Long press OK on an app, then Left or Right to move it.", kind: "action", run: function () { closeCleanFrameSettings(); startLift(); } });
      items.push({ label: "All apps", desc: apps().length + " installed apps in the full-screen grid", kind: "action", run: function () { closeCleanFrameSettings(); openGrid(); } });
      return { title: "Apps on Home", sections: [{ title: "Membership", items: items }] };
    }
    return {
      title: "About",
      sections: [{ title: "CleanFrame", items: [
        { label: "CleanFrame", desc: "Version " + VERSION + " for couch-tv, adapted from nthnclrk/CleanFrame (MIT)", info: true },
        { label: "couch-tv", desc: "github.com/Seagey/couch-tv", info: true }
      ] }]
    };
  }
  function firstDetailFocus() {
    for (var i = 0; i < state.detailRows.length; i++) if (!state.detailRows[i].info) return i;
    return -1;
  }
  function stepDetailFocus(current, dir) {
    var rows = state.detailRows, count = rows.length;
    if (!count) return current;
    for (var n = 0; n < count; n++) {
      current = (current + dir + count) % count;
      if (!rows[current].info) return current;
    }
    return current;
  }
  function buildDetail() {
    var data = detailData(state.detail);
    state.detailTitle = data.title;
    state.detailSections = data.sections;
    state.detailRows = [];
    data.sections.forEach(function (section) {
      section.items.forEach(function (item) {
        item.i = state.detailRows.length;
        state.detailRows.push(item);
      });
    });
    // keep the row the remote is on when the list rebuilds (toggling, cycling), and only move
    // the focus when that row is gone or is an info-only line.
    var focus = state.detailFocus;
    if (focus < 0 || focus >= state.detailRows.length || state.detailRows[focus].info) {
      var first = firstDetailFocus();
      focus = first >= 0 ? first : 0;
    }
    state.detailFocus = Math.max(0, Math.min(focus, state.detailRows.length - 1));
  }
  function openSettingsDetail(id) {
    state.detail = id;
    state.settingsView = "detail";
    state.detailFocus = 0;
    buildDetail();
    renderSettingsPanel();
  }
  function settingsHome() {
    state.settingsView = "home";
    state.detail = null;
    renderSettingsPanel();
  }
  function renderSettingsPanel() {
    var sheet = document.getElementById("cleanframe-settings");
    if (!sheet) return;
    sheet.classList.toggle("is-open", state.settingsOpen);
    sheet.setAttribute("aria-hidden", state.settingsOpen ? "false" : "true");
    var home = document.getElementById("cfs-home");
    var detail = document.getElementById("cfs-detail");
    if (!state.settingsOpen) return;
    if (state.settingsView === "detail") {
      home.hidden = true;
      detail.hidden = false;
      document.getElementById("cfs-detail-title").textContent = state.detailTitle;
      document.getElementById("cfs-detail-list").innerHTML = state.detailSections.map(function (section) {
        return '<section class="cfs-section">' +
          (section.title ? '<h3 class="cfs-sec-title">' + esc(section.title) + '</h3>' : "") +
          '<div class="cfs-options">' + section.items.map(function (item) {
            var cls = "cfs-choice" + (item.desc ? " has-description" : "") +
              (!item.info && item.i === state.detailFocus ? " is-focus" : "") + (item.info ? " is-info" : "");
            var lead = item.swatch ? '<img class="cfs-swatch" src="' + esc(item.swatch) + '" alt="">' : "";
            var tail = "";
            if (!item.info) {
              if (item.kind === "cycle") tail = '<span class="cfs-value">' + esc(item.value || "") + '</span>';
              else if (item.kind === "action") tail = '<span class="cfs-tick is-forward">' + SVG.chevron + '</span>';
              else tail = item.checked ? '<span class="cfs-tick">' + SVG.check + '</span>' : '<span class="cfs-tick is-off"></span>';
            }
            return '<button type="button" class="' + cls + '" data-i="' + item.i + '">' + lead +
              '<span class="cfs-copy"><span class="cfs-name">' + esc(item.label) + '</span>' +
              (item.desc ? '<span class="cfs-desc">' + esc(item.desc) + '</span>' : "") + '</span>' + tail + '</button>';
          }).join("") + '</div></section>';
      }).join("");
      document.getElementById("cfs-detail-hint").innerHTML = '<span class="cfs-key">OK</span><span>Apply &middot; &larr;&rarr; adjust &middot; Back returns</span>';
      var focused = document.querySelector(".cfs-choice.is-focus");
      if (focused) try { focused.scrollIntoView({ block: "center" }); } catch (e) {}
    } else {
      home.hidden = false;
      detail.hidden = true;
      document.getElementById("cfs-list").innerHTML = settingsGroups().map(function (group, i) {
        return '<button type="button" class="cfs-group' + (i === state.settingsFocus ? " is-focus" : "") + '" data-i="' + i + '">' +
          '<span class="cfs-copy"><span class="cfs-name">' + esc(group.label) + '</span><span class="cfs-value">' + esc(group.value) + '</span></span>' +
          SVG.chevron + '</button>';
      }).join("");
      document.getElementById("cfs-hint").innerHTML = '<span class="cfs-key">OK</span><span>Open selected group &middot; Back closes</span>';
    }
  }
  function openCleanFrameSettings() {
    if (state.settingsOpen) return;
    if (state.lift >= 0) cancelLift();
    state.settingsOpen = true;
    state.settingsView = "home";
    state.detail = null;
    state.settingsFocus = 0;
    var photo = document.getElementById("cleanframe-photo");
    var bg = document.getElementById("cleanframe-settings-photo");
    if (photo && bg) bg.src = photo.getAttribute("src");
    document.getElementById("cleanframe-stage").classList.add("is-settings");
    var arrow = document.getElementById("cleanframe-down-arrow");
    if (arrow) arrow.classList.remove("is-on");
    setStatus("");
    renderSettingsPanel();
  }
  function closeCleanFrameSettings() {
    if (!state.settingsOpen) return false;
    state.settingsOpen = false;
    document.getElementById("cleanframe-stage").classList.remove("is-settings");
    renderSettingsPanel();
    focusDock();
    return true;
  }
  function settingsBack() {
    if (state.settingsView === "detail") {
      settingsHome();
      return;
    }
    closeCleanFrameSettings();
  }
  function activateSettingsGroup() {
    var group = settingsGroups()[state.settingsFocus];
    if (group && group.run) group.run();
  }
  function activateDetailRow() {
    var row = state.detailRows[state.detailFocus];
    if (!row || row.info) return;
    // cycle rows (Effect, Units, Update every) have no action: OK steps the value forward
    if (!row.run && row.adjust) { row.adjust(1); buildDetail(); renderSettingsPanel(); return; }
    if (!row.run) return;
    row.run();
    if (state.settingsOpen && state.settingsView === "detail") { buildDetail(); renderSettingsPanel(); }
  }
  function openTvSettings() {
    closeCleanFrameSettings();
    if (state.hooks && state.hooks.openTvSettings) return state.hooks.openTvSettings();
    try {
      if (global.TVOS && global.TVOS.openTvSettings) return !!global.TVOS.openTvSettings();
    } catch (e) {}
    setStatus("TV settings are not available in this preview");
  }
  function homeSettingsShield() {
    var el = document.getElementById("settings");
    return !!(el && el.classList.contains("on")) || document.documentElement.classList.contains("setting");
  }
  // The Night home's own floating menus (Sleep timer choices, Connections list, the clock drawer)
  // live above the CleanFrame stage when one is opened from the quick buttons. While any is open,
  // CleanFrame does not touch the keys and lets app.js handle them.
  function nightMenuOpen() {
    var sleep = document.getElementById("sleep-menu");
    var pop = document.getElementById("inputs-pop");
    var ck = document.getElementById("ckbar");
    return !!((sleep && sleep.classList.contains("on")) ||
              (pop && pop.classList.contains("on")) ||
              (ck && ck.classList.contains("on")));
  }
  function overlayOpen() { return homeSettingsShield() || nightMenuOpen(); }

  // ---------------- moving apps with the remote ----------------
  function okReset() {
    state.okDown = false;
    state.okHeld = false;
    if (state.okTimer) clearTimeout(state.okTimer);
    state.okTimer = null;
  }
  function startLift() {
    state.okTimer = null;
    if (state.focusRow !== "dock" || state.lift >= 0) return false;
    var items = homeApps();
    if (!items.length) return false;
    if (!state.order.length) state.order = apps().map(function (a) { return a.package; });
    state.liftOrigin = state.order.slice();
    state.lift = state.focus;
    state.liftPkg = items[state.focus].package;
    focusDock();
    setStatus("Moving " + items[state.focus].name + ". Left or Right to move, OK to place, Back to cancel.", true);
    return true;
  }
  function moveLift(direction) {
    if (state.lift < 0 || !state.liftPkg) return;
    var limit = Math.min(HOME_COUNT, state.order.length);
    var i = state.order.indexOf(state.liftPkg), j = i + direction;
    if (i < 0 || j < 0 || j >= limit) return;
    var swapped = state.order[i];
    state.order[i] = state.order[j];
    state.order[j] = swapped;
    var track = document.getElementById("cleanframe-track"), tiles = track ? track.children : null;
    if (tiles && tiles[i] && tiles[j]) {
      if (direction > 0) track.insertBefore(tiles[j], tiles[i]);
      else track.insertBefore(tiles[i], tiles[j]);
      Array.prototype.forEach.call(track.children, function (el, index) { el.dataset.index = index; });
    }
    state.focus = j;
    state.lift = j;
    focusDock();
  }
  function dropLift() {
    if (state.lift < 0) return false;
    var item = homeApps()[state.focus] || {};
    var place = state.focus + 1;
    state.lift = -1;
    state.liftOrigin = null;
    state.liftPkg = null;
    if (state.hooks && state.hooks.saveAppOrder) {
      state.hooks.saveAppOrder(state.order.slice(), Math.min(HOME_COUNT, state.order.length));
    } else {
      writeKept(prefix() + "tvhome.order.tv", { line: Math.min(HOME_COUNT, state.order.length), packages: state.order.slice(), pending: true });
    }
    focusDock();
    setStatus((item.name || "App") + " moved to position " + place + ".", false);
    return true;
  }
  function cancelLift() {
    if (state.lift < 0) return false;
    state.order = state.liftOrigin && state.liftOrigin.length ? state.liftOrigin.slice() : [];
    state.lift = -1;
    state.liftOrigin = null;
    state.liftPkg = null;
    renderDock();
    setStatus("Move cancelled.", false);
    return true;
  }

  function backIntent() {
    if (homeSettingsShield()) {
      if (state.hooks && state.hooks.closeHomeSettings) state.hooks.closeHomeSettings();
      return true;
    }
    // A Night overlay (clock drawer, sleep menu, Connections list) owns the keys while it is open:
    // Back belongs to it. Without this, hardware Back fell through to focusDock() and the overlay
    // stayed stuck above the dock forever.
    if (overlayOpen()) {
      if (state.hooks && state.hooks.nightBack) { state.hooks.nightBack(); return true; }
      return true;
    }
    // Back steps inside the sheet (detail -> groups -> closed), the way the hint promises;
    // closing the whole sheet from a detail row would drop the remote onto the dock instead.
    if (state.settingsOpen) { settingsBack(); return true; }
    if (state.lift >= 0) return cancelLift();
    if (state.artOpen) { closeArt(); return true; }
    var grid = document.getElementById("cleanframe-grid");
    if (grid && grid.classList.contains("is-open")) { closeGrid(); return true; }
    focusDock();
    return true;
  }
  function homeIntent() {
    if (homeSettingsShield()) {
      if (state.hooks && state.hooks.closeHomeSettings) state.hooks.closeHomeSettings();
      return true;
    }
    if (overlayOpen()) {
      if (state.hooks && state.hooks.nightBack) { state.hooks.nightBack(); return true; }
      return true;
    }
    if (state.settingsOpen) return closeCleanFrameSettings();
    if (state.lift >= 0) return cancelLift();
    if (closeArt()) return true;
    var grid = document.getElementById("cleanframe-grid");
    if (grid && grid.classList.contains("is-open")) { closeGrid(); return true; }
    focusMiddleDock();
    return true;
  }

  function activateUtility() {
    var control = state.controls[state.utility];
    if (!control) return;
    if (control.quick) {
      if (state.hooks && state.hooks.quickActivate) { state.hooks.quickActivate(control.quick); return; }
      try {
        if (global.TVOS && global.TVOS.openSettingsScreen && global.TVOS.openSettingsScreen(control.quick)) return;
      } catch (e) {}
      setStatus("Unable to open " + control.label);
      return;
    }
    if (control.id === "home") return openCleanFrameSettings();
    if (control.id === "settings") return openTvSettings();
  }

  function moveGrid(dx, dy) {
    var items = apps().length, cols = 6;
    var next = state.gridFocus + dx + dy * cols;
    if (next < 0 || next >= items || (dy && Math.abs(next - state.gridFocus) !== cols)) return;
    state.gridFocus = next;
    focusGrid();
  }

  // ---------------- keys ----------------
  function keyName(event) {
    var k = event.key || "", code = event.keyCode;
    if (code === 4 || code === 461 || k === "GoBack" || k === "BrowserBack" || k === "Backspace" || k === "Escape") return "Escape";
    if (code === 3 || k === "Home") return "Home";
    if (code === 13 || code === 23 || k === "Enter" || k === "Select") return "Enter";
    if (code === 19 || k === "ArrowUp") return "ArrowUp";
    if (code === 20 || k === "ArrowDown") return "ArrowDown";
    if (code === 21 || k === "ArrowLeft") return "ArrowLeft";
    if (code === 22 || k === "ArrowRight") return "ArrowRight";
    return k;
  }
  function settingsKey(key) {
    if (key === "Home") { closeCleanFrameSettings(); return; }
    if (key === "Escape") { settingsBack(); return; }
    if (state.settingsView === "detail") {
      var row = state.detailRows[state.detailFocus];
      if (key === "ArrowLeft" || key === "ArrowRight") {
        var d = key === "ArrowRight" ? 1 : -1;
        if (row && row.adjust) { row.adjust(d); buildDetail(); renderSettingsPanel(); return; }
        if (row && row.move) { row.move(d); buildDetail(); renderSettingsPanel(); return; }
        if (key === "ArrowLeft") settingsHome();
        return;
      }
      if (key === "ArrowUp" || key === "ArrowDown") {
        if (!state.detailRows.length) return;
        state.detailFocus = stepDetailFocus(state.detailFocus, key === "ArrowDown" ? 1 : -1);
        renderSettingsPanel();
        return;
      }
      if (key === "Enter") activateDetailRow();
      return;
    }
    if (key === "ArrowLeft") { closeCleanFrameSettings(); return; }
    if (key === "ArrowUp" || key === "ArrowDown") {
      var n = settingsGroups().length;
      if (!n) return;
      state.settingsFocus = (state.settingsFocus + (key === "ArrowDown" ? 1 : -1) + n) % n;
      renderSettingsPanel();
      return;
    }
    if (key === "Enter") activateSettingsGroup();
  }
  function onKey(event) {
    var key = keyName(event);
    if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Enter", "Escape", "Home"].indexOf(key) < 0) return;
    // couch-tv's own Home settings dialog and the Night home's floating menus sit above the skin.
    // While one is open the keys belong to app.js, not to the dock underneath.
    if (overlayOpen()) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (state.settingsOpen) { settingsKey(key); return; }
    if (state.artOpen) {
      if (key === "ArrowLeft") cycleArt(-1);
      else if (key === "ArrowRight") cycleArt(1);
      else if (key === "Enter") {
        var caption = document.getElementById("cleanframe-art-controls");
        if (caption) caption.classList.toggle("is-on");
      } else closeArt();
      return;
    }
    if (state.lift >= 0) {
      if (key === "ArrowLeft") moveLift(-1);
      else if (key === "ArrowRight") moveLift(1);
      else if (key === "Enter") { if (!event.repeat) dropLift(); }
      else if (key === "Escape" || key === "Home") cancelLift();
      return;
    }
    if (key === "Home") { homeIntent(); return; }
    var gridOpen = document.getElementById("cleanframe-grid").classList.contains("is-open");
    if (gridOpen) {
      if (key === "ArrowLeft") moveGrid(-1, 0);
      else if (key === "ArrowRight") moveGrid(1, 0);
      else if (key === "ArrowUp") moveGrid(0, -1);
      else if (key === "ArrowDown") moveGrid(0, 1);
      else if (key === "Enter") launch(apps()[state.gridFocus]);
      else closeGrid();
      return;
    }
    if (state.artFocus) {
      if (key === "ArrowRight") focusUtility(0);
      else if (key === "ArrowDown" || key === "Escape") focusDock();
      else if (key === "Enter") openArt();
      return;
    }
    if (state.focusRow === "utility") {
      if (key === "ArrowLeft") {
        if (state.utility > 0) focusUtility(state.utility - 1);
        else focusArt();
      } else if (key === "ArrowRight") focusUtility(state.utility + 1);
      else if (key === "ArrowDown") focusDock();
      else if (key === "Enter") activateUtility();
      else if (key === "Escape") focusDock();
      return;
    }
    if (key === "ArrowLeft") state.focus = Math.max(0, state.focus - 1);
    else if (key === "ArrowRight") state.focus = Math.min(homeApps().length - 1, state.focus + 1);
    else if (key === "ArrowUp") { focusUtility(Math.max(0, Math.min(state.utility, state.controls.length - 1))); return; }
    else if (key === "ArrowDown") { openGrid(); return; }
    else if (key === "Enter") {
      if (event.repeat || state.okDown) return;
      state.okDown = true;
      state.okHeld = false;
      state.okTimer = setTimeout(function () {
        state.okTimer = null;
        if (state.lift < 0 && state.focusRow === "dock" && !state.settingsOpen && !overlayOpen()) {
          state.okHeld = true;
          startLift();
        }
      }, HOLD_MS);
      return;
    }
    else if (key === "Escape") { backIntent(); return; }
    if (key === "ArrowLeft" || key === "ArrowRight") focusDock();
  }
  function onKeyUp(event) {
    if (keyName(event) !== "Enter") return;
    if (overlayOpen()) { okReset(); return; }
    if (!state.okDown) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    var held = state.okHeld;
    okReset();
    if (!held && !state.artOpen && !state.settingsOpen && state.focusRow === "dock" && state.lift < 0) {
      launch(homeApps()[state.focus]);
    }
  }

  // ---------------- wallpaper ----------------
  function setWallpaper(file, remember) {
    if (!validWall(file)) file = DEFAULT_WALL;
    var photo = document.getElementById("cleanframe-photo");
    var main = document.getElementById("cleanframe-stage");
    photo.src = "cleanframe/wallpapers/" + file;
    photo.alt = wallLabel(file);
    main.classList.toggle("cleanframe-custom-wall", file !== DEFAULT_WALL);
    if (remember) writeKept(prefix() + WALL_KEY, file);
  }
  function shuffleWallpaper() {
    var file = wallpaperFiles[Math.floor(Math.random() * wallpaperFiles.length)] || DEFAULT_WALL;
    setWallpaper(file, false);
  }
  function applyBg() {
    var bg = savedBg();
    var stage = document.getElementById("cleanframe-stage");
    if (stage) {
      stage.classList.remove("cf-bg-photo", "cf-bg-light", "cf-bg-dark");
      stage.classList.add("cf-bg-" + (bg.mode || "photo"));
    }
    if (bg.mode === "photo" && !savedWall()) shuffleWallpaper();
  }
  function applyLayout() {
    var l = savedLayout();
    var stage = document.getElementById("cleanframe-stage");
    if (stage) {
      stage.classList.remove("cf-apps-text", "cf-apps-icons", "cf-apps-both");
      stage.classList.remove("cf-ctrl-text", "cf-ctrl-icons", "cf-ctrl-both");
      stage.classList.add("cf-apps-" + (l.apps || "both"));
      stage.classList.add("cf-ctrl-" + (l.controls || "both"));
    }
  }
  function applyFont() {
    var f = savedFont();
    var stage = document.getElementById("cleanframe-stage");
    if (stage) stage.style.setProperty("--cf-font", fontStack(f));
  }
  function fontStack(name) {
    var map = {
      "Manrope": '"Manrope", system-ui, sans-serif',
      "Geist": '"Geist", system-ui, sans-serif',
      "Newsreader": '"Newsreader", Georgia, serif',
      "Neue Montreal": '"Neue Montreal", "Helvetica Neue", sans-serif',
      "Mori": '"Mori", system-ui, sans-serif',
      "Pangram Sans": '"Pangram Sans", system-ui, sans-serif'
    };
    return map[name] || '"Manrope", system-ui, sans-serif';
  }
  function applyFocus() {
    var f = savedFocus();
    var stage = document.getElementById("cleanframe-stage");
    if (stage) {
      stage.classList.remove("cf-focus-type", "cf-focus-glass");
      stage.classList.remove("cf-tint-soft", "cf-tint-frost", "cf-tint-clear");
      stage.classList.add("cf-focus-" + (f.type || "glass"));
      stage.classList.add("cf-tint-" + (f.tint || "frost"));
    }
  }
  function applyRotation() {
    if (state.rotationTimer) { clearInterval(state.rotationTimer); state.rotationTimer = null; }
    var bg = savedBg();
    if (bg.mode !== "photo") return;
    if (bg.rotation === "open") { shuffleWallpaper(); return; }
    var mins = parseInt(bg.rotation, 10);
    if (!mins) return;
    state.rotationTimer = setInterval(function () {
      if (document.visibilityState && document.visibilityState !== "visible") return;
      shuffleWallpaper();
    }, mins * 60000);
  }
  function loadWallpapers() {
    if (!global.fetch) return;
    global.fetch("cleanframe/wallpapers.json", { cache: "no-store" }).then(function (r) {
      if (!r.ok) throw new Error("wallpapers");
      return r.json();
    }).then(function (list) {
      if (!Array.isArray(list)) return;
      list = list.filter(validWall).slice(0, 64);
      if (!list.length) return;
      wallpaperFiles = list;
      var chosen = savedWall();
      if (chosen && list.indexOf(chosen) >= 0) setWallpaper(chosen, false);
      else shuffleWallpaper();
    }, function () {});
  }

  function start(hooks) {
    if (state.mounted) return;
    state.mounted = true;
    state.hooks = hooks || null;
    state.controls = buildControls();
    state.order = savedPackages();
    // Open on the middle app, so pressing Home later returns to the same place.
    state.focus = Math.floor(Math.max(1, homeApps().length) / 2);
    document.documentElement.classList.add("cleanframe");

    // Free faces from the original CleanFrame typography list (paid faces fall back to Manrope).
    if (!document.getElementById("cf-fonts")) {
      var link = document.createElement("link");
      link.id = "cf-fonts";
      link.rel = "stylesheet";
      link.href = "https://fonts.googleapis.com/css2?family=Manrope:wght@200..800&family=Geist:wght@200..800&family=Newsreader:opsz,wght@6..72,200..800&display=swap";
      document.head.appendChild(link);
    }

    var main = document.createElement("main");
    main.className = "cleanframe-stage";
    main.id = "cleanframe-stage";
    main.setAttribute("aria-label", "CleanFrame home screen");
    main.innerHTML = ''
      + '<img class="cleanframe-photo" id="cleanframe-photo" src="cleanframe/wallpapers/' + DEFAULT_WALL + '" alt="CleanFrame wallpaper">'
      + '<div class="cleanframe-scrim"></div><div class="cleanframe-shade"></div>'
      + '<div class="cleanframe-caption"><time id="cleanframe-time"></time>'
      + '<button class="cleanframe-art-btn" id="cleanframe-art-btn" type="button" aria-label="Art Mode" title="Art Mode">' + QUICK_SVG.art + '<span>Art Mode</span></button></div>'
      + '<nav class="cleanframe-utils" aria-label="Home controls">' + state.controls.map(utilityHtml).join("") + '</nav>'
      + '<div class="cleanframe-dock"><div class="cleanframe-dock-scroll"><div class="cleanframe-track" id="cleanframe-track"></div></div></div>'
      + '<button class="cleanframe-down-arrow" id="cleanframe-down-arrow" type="button" aria-label="All apps" title="All apps"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg><span>All apps</span></button>'
      + '<div class="cleanframe-status" id="cleanframe-status" role="status"></div>'
      + '<section class="cleanframe-grid" id="cleanframe-grid" aria-label="All apps"><h1 class="cleanframe-grid-title">All apps</h1><div class="cleanframe-grid-body" id="cleanframe-grid-body"></div><p class="cleanframe-back">Back returns to the dock</p></section>'
      + '<section class="cleanframe-art" id="cleanframe-art" aria-label="Art Mode" aria-hidden="true"><img class="cleanframe-art-photo" id="cleanframe-art-photo" alt=""><div class="cleanframe-art-shade"></div><div class="cleanframe-art-title">Art Mode</div><div class="cleanframe-art-caption" id="cleanframe-art-caption"></div><p class="cleanframe-art-controls" id="cleanframe-art-controls">\u2190 \u2192 change photo \u00b7 Home or Back to exit</p></section>'
      + '<section class="cleanframe-settings" id="cleanframe-settings" aria-label="CleanFrame settings" aria-hidden="true">'
      + '<img class="cfs-bg" id="cleanframe-settings-photo" alt="">'
      + '<div class="cfs-veil"></div>'
      + '<div class="cfs-home" id="cfs-home"><h1 class="cfs-title">Settings</h1><div class="cfs-list" id="cfs-list"></div><p class="cfs-hint" id="cfs-hint"></p></div>'
      + '<div class="cfs-detail" id="cfs-detail" hidden><button class="cfs-back" id="cfs-back" type="button">' + SVG.back + '<span>Settings</span></button><h2 class="cfs-title cfs-detail-title" id="cfs-detail-title"></h2><div class="cfs-detail-list" id="cfs-detail-list"></div><p class="cfs-hint" id="cfs-detail-hint"></p></div>'
      + '</section>';
    document.body.appendChild(main);
    // The Night home's floating menus belong above the CleanFrame stage: they move to body level
    // and cleanframe.css unhides them while open, because the skin filter hides everything else
    // the Night home keeps there.
    ["sleep-menu", "inputs-pop"].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) document.body.appendChild(el);
    });
    // The weather layer belongs over the CleanFrame wallpaper: it moves into the stage, right
    // after the shade, under everything drawn later (caption, dock, settings sheet).
    var shade = main.querySelector(".cleanframe-shade");
    var anchor = shade && shade.parentNode === main ? shade.nextSibling : null;
    ["ambient-lighting", "weather-canvas"].forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      if (anchor) main.insertBefore(el, anchor);
      else main.appendChild(el);
    });
    document.addEventListener("keydown", onKey, true);
    document.addEventListener("keyup", onKeyUp, true);
    global.addEventListener("blur", okReset);

    main.addEventListener("click", function (event) {
      if (event.target.closest("#cleanframe-art-btn")) { openArt(); return; }
      if (event.target.closest(".cleanframe-down-arrow")) { openGrid(); return; }
      var utility = event.target.closest(".cleanframe-utility");
      if (utility) {
        state.utility = Array.prototype.indexOf.call(document.querySelectorAll(".cleanframe-utility"), utility);
        focusUtility();
        activateUtility();
        return;
      }
      var back = event.target.closest(".cfs-back");
      if (back) { settingsBack(); return; }
      var group = event.target.closest(".cfs-group");
      if (group) {
        state.settingsFocus = Number(group.dataset.i) || 0;
        activateSettingsGroup();
        return;
      }
      var choice = event.target.closest(".cfs-choice");
      if (choice) {
        state.detailFocus = Number(choice.dataset.i) || 0;
        activateDetailRow();
        return;
      }
      var gridItem = event.target.closest(".cleanframe-grid-item");
      if (gridItem) {
        launch(apps()[Number(gridItem.dataset.index)]);
        return;
      }
      var tile = event.target.closest(".cleanframe-tile");
      if (tile) {
        if (state.lift >= 0) { dropLift(); return; }
        state.focus = Number(tile.dataset.index);
        focusDock();
        launch(homeApps()[state.focus]);
      }
    });

    fit();
    global.addEventListener("resize", fit);
    updateClock();
    setInterval(updateClock, 15000);
    renderDock();
    state.utility = 0;
    focusDock();
    loadWallpapers();
    applyBg();
    applyLayout();
    applyFont();
    applyFocus();
    applyRotation();
  }

  global.CleanFrame = {
    active: requested,
    start: start,
    version: VERSION,
    exitArtMode: closeArt,
    backIntent: backIntent,
    homeIntent: homeIntent,
    pause: pause
  };
})(typeof window !== "undefined" ? window : this);
