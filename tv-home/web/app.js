// TV home page, tvOS style: Keep watching on top, a grid of apps below, one screen, no scrolling.
// Runs inside the launcher's WebView (window.TVOS is the native side) or in any browser for
// development: ?mock=1 uses mock.js for everything, ?preview=1 uses mock apps with the real bridge.
(function () {
  "use strict";

  var TV = window.TVOS || null;
  var Q = location.search;
  var MOCK = /[?&]mock\b/.test(Q);
  var PREVIEW = /[?&]preview\b/.test(Q);
  var API = decodeURIComponent((Q.match(/[?&]api=([^&]+)/) || [])[1] || "");
  // which TV this page is on (the launcher adds ?tv=<id> on any TV that is not the default); none = living room
  var TV_ID = (Q.match(/[?&]tv=([a-z-]+)/) || [])[1] || "";
  // The launcher's saved copy of this page, opened when the computer is off (or when there is no
  // computer at all): scenes, clock, weather straight from Open-Meteo and the apps in the saved
  // order; nothing that needs the bridge.
  var OFFLINE = /[?&]offline=1/.test(Q);
  // No computer at all (option A): the launcher's built-in copy is the home, so there is no
  // "computer is off" note to show.
  var ALONE = OFFLINE && /[?&]alone=1/.test(Q);
  if (OFFLINE) document.documentElement.classList.add("offline");
  var CACHE_KEY = "tvhome.cache.v2";
  // Every word on screen comes from i18n.js, in the language picked in Home settings.
  var t = window.I18N ? window.I18N.t : function (k) { return k; };

  // Settings from the bridge's config.json (served as config.js, and saved with the offline copy),
  // read in readConfig() once the page starts (mock.js fills them in for previews). See docs/CONFIG.md.
  var CFG = {}, HOME = {}, TVCFG = {}, QUICK = [];
  var WXCFG = { lat: -33.8688, lon: 151.2093, place: "Sydney", timezone: "Australia/Sydney" };
  var QUICK_ALL = ["sleep", "picture", "connections", "bluetooth", "network", "screensaver", "clock"];
  var ON_TV = false;   // served by the on-TV app (config "mode"), which can open the TV's own settings screens
  // The look: always the Night scenes on this TV (the Classic look is switched off).
  var THEME = "night", NIGHT = true, CLOCK24 = false;
  // Glass panels ("off", "on", or "lite": no blur, for slower TVs) and the video background, from
  // Home settings, then home.glass and home.video_url. Both are off unless someone switches them on.
  var GLASS = "off", GLASS_ICONS = false, VIDEO_ON = false, VIDEO_URL = "";
  // The TV's own "remove animations" switch: the zoom steps aside when it is on.
  var REDUCED = false;
  try { REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) {}
  // How clear the glass is, 1 (frosted) to 5 (very clear), and the Night clock's style ("frosted",
  // the photo's frosted copy, or "liquid", clear glass digits): Home settings, Look, else
  // home.glass_amount and home.clock_style (#25, #29).
  var GLASS_AMT = 3, CLOCK_LIQUID = false;
  // Home settings made on this TV with the gear tile (see "home settings" below). They win over
  // config.js. ST is the saved object; the rest are read from it in readConfig().
  var ST = {}, WX_SHOW = true, WX_F = false, WX_EVERY = 30, HIDDEN_TV = [];
  // Weather effects (ambient-weather.js): rain, snow, fog and lightning over the scene, on unless
  // switched off; sunlight colour grading, off unless switched on (Home settings, Weather).
  var WX_AMBIENT = true, WX_SUN_GRADE = false, WX_EFFECTS = true, WX_EFFECT_TYPE = "auto";
  // The clock customiser (Home settings, Clock; the live drawer): what the digits look like, from
  // Home settings on this TV. Kept in ST with everything else, so it saves to localStorage at once
  // and survives a restart; ?mock=1 previews it on a computer. See applyClock() below.
  var CK_DEF = {
    clock_layout: "single", clock_font: "antonio", clock_weight: 300, clock_scale: 1,
    clock_align: "scene", clock_fill: "glass", clock_color: "wallpaper",
    clock_shadow: false, clock_date: "above"
  };
  var CK_FONTS = [["antonio", "ck_f_antonio"], ["inter", "ck_f_inter"], ["archivo", "ck_f_archivo"],
    ["nunito", "ck_f_nunito"], ["fraunces", "ck_f_fraunces"]];
  var CK_LAYOUTS = [["single", "ck_l_single"], ["stack", "ck_l_stack"], ["offset", "ck_l_offset"], ["tight", "ck_l_tight"]];
  var CK_ALIGNS = [["scene", "ck_a_scene"], ["left", "ck_a_left"], ["center", "ck_a_center"], ["right", "ck_a_right"], ["mid", "ck_a_mid"]];
  var CK_FILLS = [["glass", "ck_fill_glass"], ["solid", "ck_fill_solid"]];
  var CK_SIZES = [[0.8, "ck_sz_80"], [0.9, "ck_sz_90"], [1, "ck_sz_100"], [1.1, "ck_sz_110"], [1.2, "ck_sz_120"], [1.3, "ck_sz_130"], [1.4, "ck_sz_140"]];
  var CK_WEIGHTS = [[300, "300"], [400, "400"], [500, "500"], [600, "600"], [700, "700"], [800, "800"], [900, "900"]];
  var CK_DATES = [["above", "ck_d_above"], ["below", "ck_d_below"], ["off", "ck_d_off"], ["fixed", "ck_d_fixed"]];
  // the face and its real weight, so document.fonts.load() finds it before the glass is measured
  var CK_LOAD = { antonio: [300, "Antonio"], inter: [450, "Inter"], archivo: [400, "Archivo Black"],
    nunito: [800, "Nunito"], fraunces: [600, "Fraunces"] };
  var CK_COLOURS = [["wallpaper", "ck_c_wallpaper", null], ["white", "ck_c_white", "#ffffff"], ["oled", "ck_c_oled", "#0b0b10"],
    ["cyan", "ck_c_cyan", "#6fd6ff"], ["amber", "ck_c_amber", "#ffbf5e"], ["coral", "ck_c_coral", "#ff7a6e"],
    ["violet", "ck_c_violet", "#b79bff"], ["mint", "ck_c_mint", "#62e6b0"], ["rose", "ck_c_rose", "#ff8fc7"],
    ["lime", "ck_c_lime", "#d3f56b"], ["sky", "ck_c_sky", "#7fb2ff"], ["peach", "ck_c_peach", "#ffc9a3"],
    ["lavender", "ck_c_lavender", "#cbb8ff"], ["gold", "ck_c_gold", "#ffd76a"], ["teal", "ck_c_teal", "#5ee0d0"],
    ["ruby", "ck_c_ruby", "#ff5f7e"], ["silver", "ck_c_silver", "#d8dde6"], ["sand", "ck_c_sand", "#e8d3ae"]];
  var CK_TABS = ["ck_tab_shape", "ck_tab_type", "ck_tab_colour"];
  // a tint for each of your own scenes, so "wallpaper colour" follows the photo on screen
  var CK_SCENE_TINTS = ["#ffd479", "#8fe6ff", "#ffb38a", "#c8b6ff", "#9df0c8", "#ffc2df", "#b9d4ff", "#e9f79a"];
  // Now playing (#31), on unless switched off; Keep watching, on unless switched off
  var NP_ON = true, KW_ON = true, SOUND_STYLE = "system";
  // glass app icons: the focused app in its own colours, or staying glass (#32)
  var GLASS_FOCUS = "colour";
  // WebViews before Chrome 84 (still on many Android 9 TVs) skip gap in a flex box, so icons touch
  // their words and rows touch each other. html.no-flex-gap lets app.css put margins in instead (#26).
  (function () {
    var d = document.createElement("div");
    d.style.cssText = "display:flex;flex-direction:column;row-gap:1px;position:absolute;visibility:hidden";
    d.appendChild(document.createElement("div"));
    d.appendChild(document.createElement("div"));
    document.documentElement.appendChild(d);
    var ok = d.scrollHeight === 1;
    d.parentNode.removeChild(d);
    document.documentElement.classList.toggle("no-flex-gap", !ok);
  })();

  // What this TV keeps for itself (app order, new apps, the look). Written to the
  // page's storage and to the launcher (TVOS.keep), so the live page and the saved copy share it.
  var PFX = MOCK || PREVIEW ? "mock:" : "";
  function kept(key) {
    var v = null;
    try { if (TV && TV.kept) v = TV.kept(PFX + key); } catch (e) {}
    if (v == null) try { v = localStorage.getItem(PFX + key); } catch (e) {}
    try { return v == null ? null : JSON.parse(v); } catch (e) { return null; }
  }
  function keep(key, value) {
    var j = JSON.stringify(value);
    try { localStorage.setItem(PFX + key, j); } catch (e) {}
    try { if (TV && TV.keep) TV.keep(PFX + key, j); } catch (e) {}
  }

  // Default order: YouTube, then Netflix, then the rest the way a household reaches for them.
  var APP_ORDER = [
    "com.google.android.youtube.tv", "com.amazon.firetv.youtube", "com.netflix.ninja", "au.net.abc.iview", "com.disney.disneyplus",
    "au.com.stan.and", "au.com.streamotion.ares.tv", "com.amazon.amazonvideo.livingroom",
    "com.sbs.ondemand.tv", "com.apple.atve.androidtv.appletv", "com.cbs.ca", "au.com.ninenow.ctv",
    "com.swm.live", "au.com.tenplay", "au.com.kayosports.tv", "au.com.foxtel.atv", "com.wbd.stream",
    "com.spotify.tv.android", "com.google.android.youtube.tvmusic"
  ];
  // The TV's own tools go last, in this order, just before the screens.
  var APP_LAST = ["com.mediatek.wwtv.tvcenter", "com.android.vending", "com.android.tv.settings"];
  // Kept behind the "More apps" tile on every TV (apps most people rarely open).
  var TUCKED = ["com.mediatek.wwtv.tvcenter", "com.google.android.youtube.tvmusic", "com.spotify.tv.android"];
  // The same tools on other makers' TVs, by name.
  var TUCKED_NAMES = /^(screen ?shar|live ?tv|usb|media ?cent|browser|device assistant)/i;
  // The Play Store, under the name most people know it by (in the chosen language).
  var RENAME = { "com.android.vending": "app_store" };
  // Never shown: home screens, store and system clutter, and Moonlight (a screen tile opens it).
  // A maker's own clutter (help apps, file browsers) is listed per house in config.json,
  // home.hide_packages, and added to this list in readConfig().
  var HIDDEN = [
    "com.google.android.apps.tv.launcherx", "com.google.android.tvlauncher", "app.couchtv.launcher",
    "com.limelight", "com.google.android.play.games", "com.google.android.videos"
  ];
  var GRID_COLS = 12, GRID_MAX = 24;
  var DOCK_APPS = 10;   // Night: apps in the dock before Settings and More apps (home.dock_size)
  var SETTINGS_PKG = "com.android.tv.settings";
  // The Play Store: always the first tile of More apps, never in the dock's order.
  var STORE_PKG = "com.android.vending";
  var HOLD_MS = 600;    // how long OK is held to pick something up

  var ICONS = {
    screen: '<svg viewBox="0 0 24 24"><rect x="2.5" y="3.5" width="19" height="13" rx="2"/><path d="M9 20.5h6M12 16.5v4"/></svg>',
    moon: '<svg viewBox="0 0 24 24"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>',
    picture: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M12 3.5v17a8.5 8.5 0 0 0 0-17z" class="fill"/></svg>',
    more: '<svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="19" cy="12" r="1.2"/></svg>',
    gear: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3.2"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
    look: '<svg viewBox="0 0 24 24"><rect x="2.5" y="4.5" width="19" height="15" rx="3"/><path d="M2.5 16l5.5-5.5 4.5 4.5 3-3 6 6"/><circle cx="16.5" cy="8.8" r="1.6"/></svg>',
    eye: '<svg viewBox="0 0 24 24"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z"/><circle cx="12" cy="12" r="2.8"/></svg>',
    input: '<svg viewBox="0 0 24 24"><rect x="2.5" y="4" width="19" height="13" rx="2.5"/><path d="M8 21h8M12 7.5v6M9.5 11l2.5 2.5 2.5-2.5"/></svg>',
    screensaver: '<svg viewBox="0 0 24 24"><rect x="2.5" y="4" width="19" height="14" rx="2.5"/><path d="M15.2 7.3a3.4 3.4 0 1 0 2.1 5 3.9 3.9 0 0 1-2.1-5z"/></svg>',
    bluetooth: '<svg viewBox="0 0 24 24"><path d="M6.5 7.5l11 9-5.5 4.5v-18l5.5 4.5-11 9"/></svg>',
    network: '<svg viewBox="0 0 24 24"><path d="M2.5 9a14 14 0 0 1 19 0M5.7 12.5a9.5 9.5 0 0 1 12.6 0M8.9 16a4.8 4.8 0 0 1 6.2 0"/><circle cx="12" cy="19.3" r="1"/></svg>',
    connections: '<svg viewBox="0 0 24 24"><path d="M10 14a4 4 0 0 1 0-5.7l3-3a4 4 0 0 1 5.7 5.7l-2 2"/><path d="M14 10a4 4 0 0 1 0 5.7l-3 3a4 4 0 0 1-5.7-5.7l2-2"/></svg>',
    clock: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.4V12l3.1 2"/></svg>',
    store: '<svg viewBox="0 0 24 24"><path d="M5 8h14l-1.2 11.2a2 2 0 0 1-2 1.8H8.2a2 2 0 0 1-2-1.8z"/><path d="M9 10.5V7a3 3 0 0 1 6 0v3.5"/></svg>',
    check: '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    // Now playing's buttons (filled shapes)
    prev: '<svg viewBox="0 0 24 24" class="solid"><path d="M7 6h2v12H7zM20 6v12l-9-6z"/></svg>',
    next: '<svg viewBox="0 0 24 24" class="solid"><path d="M15 6h2v12h-2zM4 6v12l9-6z"/></svg>',
    play: '<svg viewBox="0 0 24 24" class="solid"><path d="M7 5v14l12-7z"/></svg>',
    pause: '<svg viewBox="0 0 24 24" class="solid"><path d="M6.5 5h4v14h-4zM13.5 5h4v14h-4z"/></svg>',
    note: '<svg viewBox="0 0 24 24"><path d="M9 18V6l11-2v12"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/></svg>',
    updown: '<svg viewBox="0 0 24 24"><path d="M8 9.5l4-4 4 4M8 14.5l4 4 4-4"/></svg>',
    sliders: '<svg viewBox="0 0 24 24"><path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/></svg>',
    chevron: '<svg viewBox="0 0 24 24"><path d="M9.5 5.5 16 12l-6.5 6.5"/></svg>',
    // the settings screen's sections
    globe: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.6 2.5 3.8 5.3 3.8 8.5s-1.2 6-3.8 8.5c-2.6-2.5-3.8-5.3-3.8-8.5s1.2-6 3.8-8.5z"/></svg>',
    pin: '<svg viewBox="0 0 24 24"><path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.4"/></svg>',
    cloud: '<svg viewBox="0 0 24 24"><path d="M17.5 19H8a4 4 0 1 1 .9-7.9A5.5 5.5 0 0 1 19.4 12a3.5 3.5 0 0 1-1.9 7z"/></svg>',
    apps: '<svg viewBox="0 0 24 24"><rect x="3.5" y="3.5" width="7" height="7" rx="2"/><rect x="13.5" y="3.5" width="7" height="7" rx="2"/><rect x="3.5" y="13.5" width="7" height="7" rx="2"/><rect x="13.5" y="13.5" width="7" height="7" rx="2"/></svg>',
    person: '<svg viewBox="0 0 24 24"><circle cx="12" cy="8.5" r="3.8"/><path d="M4.5 20.5c.8-3.9 3.7-6 7.5-6s6.7 2.1 7.5 6"/></svg>',
    bolt: '<svg viewBox="0 0 24 24"><path d="M13 2.8 5.5 13.2h5.8L10.5 21l8-10.6h-5.9z"/></svg>',
    info: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5M12 7.6v.2"/></svg>',
    download: '<svg viewBox="0 0 24 24"><path d="M12 3.5v11M7.5 10l4.5 4.5 4.5-4.5"/><path d="M4.5 16v2.5a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V16"/></svg>'
  };
  // weather glyphs for the date line, by Open-Meteo's WMO code
  var WX = {
    sun: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4"/></svg>',
    moon: '<svg viewBox="0 0 24 24"><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/></svg>',
    cloud: '<svg viewBox="0 0 24 24"><path d="M17.5 19H8a4 4 0 1 1 .9-7.9A5.5 5.5 0 0 1 19.4 12a3.5 3.5 0 0 1-1.9 7z"/></svg>',
    rain: '<svg viewBox="0 0 24 24"><path d="M17.5 15H8a4 4 0 1 1 .9-7.9A5.5 5.5 0 0 1 19.4 8a3.5 3.5 0 0 1-1.9 7z"/><path d="M9 18l-1 2.5M13 18l-1 2.5M17 18l-1 2.5"/></svg>',
    storm: '<svg viewBox="0 0 24 24"><path d="M17.5 15H8a4 4 0 1 1 .9-7.9A5.5 5.5 0 0 1 19.4 8a3.5 3.5 0 0 1-1.9 7z"/><path d="M12.5 15.5 10.5 19h3l-2 3.5"/></svg>'
  };
  function wxIcon(w) {
    var c = w.code;
    if (c >= 95) return WX.storm;
    if (c >= 51) return WX.rain;
    if (c >= 3 || c === 45 || c === 48) return WX.cloud;
    return w.is_day ? WX.sun : WX.moon;
  }

  var $ = function (id) { return document.getElementById(id); };
  var data = { shows: [], apps: [], screens: [], bridge: null };
  var zone = "grid", s = 0, g = 0;   // focus: zone, shelf index, grid index
  var shelfEls = [], gridEls = [], gridItems = [];
  var touched = false, expanded = false;
  var retryTimer = null, retryMs = 2500, statusTimer = null;
  var lift = null;                   // the dock app picked up to move: {pkg}
  var newApps = [];                  // apps installed since this TV first saw its apps, until opened once

  // Which wins, lowest first: the defaults here, config.js (config.json), then Home settings made on
  // this TV (kept by the bridge too when there is one), then ?theme= for a preview. docs/CONFIG.md.
  function readConfig() {
    CFG = window.COUCH_CONFIG || {};
    HOME = CFG.home || {};
    ON_TV = CFG.mode === "on-tv";
    ST = loadSettings();
    // the language: Home settings, then config.json, then the TV's own language if the home speaks it
    if (window.I18N) window.I18N.set(ST.lang || HOME.language || window.I18N.device());
    if (CFG.weather) WXCFG = CFG.weather;
    var pl = ST.place;
    if (pl && isFinite(pl.lat) && isFinite(pl.lon)) WXCFG = { lat: pl.lat, lon: pl.lon, place: pl.name || "", timezone: pl.timezone || "auto" };
    WX_SHOW = ST.wx_show !== false;
    WX_F = ST.wx_unit === "f";
    WX_EVERY = [15, 30, 60].indexOf(ST.wx_every) >= 0 ? ST.wx_every : 30;
    WX_AMBIENT = typeof ST.ambient_weather === "boolean" ? ST.ambient_weather : HOME.ambient_weather !== false;
    WX_EFFECTS = typeof ST.weather_effects === "boolean" ? ST.weather_effects : (HOME.weather_effects !== false);
    WX_EFFECT_TYPE = (typeof ST.weather_effect === "string" && ["auto","rain","snow","fog","storm","clear"].indexOf(ST.weather_effect) >= 0) ? ST.weather_effect : "auto";
    WX_SUN_GRADE = typeof ST.ambient_sun_grade === "boolean" ? ST.ambient_sun_grade : HOME.ambient_sun_grade === true;
    var mine = TV_ID || CFG.default_tv;
    TVCFG = (CFG.tvs || []).filter(function (t) { return t.id === mine; })[0] || (CFG.tvs || [])[0] || {};
    // The clock button is new: put it at the front of a quick list saved before it existed, once,
    // so the live clock drawer can always be reached with the remote. Removing it later sticks.
    if (Array.isArray(ST.quick) && !ST.ck_quick && ST.quick.indexOf("clock") < 0) {
      ST.quick = ["clock"].concat(ST.quick);
      ST.ck_quick = true;
      saveSettings();
    }
    // Bluetooth and Wi-Fi are separate quick buttons now: split the older combined one, once.
    if (Array.isArray(ST.quick) && ST.quick.indexOf("connections") >= 0 && !ST.quick_split) {
      var splitQ = [];
      ST.quick.forEach(function (q) {
        if (q === "connections") splitQ.push("bluetooth", "network");
        else splitQ.push(q);
      });
      ST.quick = splitQ;
      ST.quick_split = true;
      saveSettings();
    }
    // no "quick" from an older bridge: the sleep timer, and the picture switch where the TV has one
    QUICK = (Array.isArray(ST.quick) ? ST.quick : TVCFG.quick || ["sleep", "picture"])
      .filter(function (q, i, a) { return QUICK_ALL.indexOf(q) >= 0 && a.indexOf(q) === i; });
    // The Classic look is switched off on this TV: the home always uses the Night scenes, so the
    // Look button and the Classic choice are gone and nothing can bring the old look back.
    NIGHT = true;
    document.documentElement.classList.toggle("theme-night", NIGHT);
    GLASS = glassSetting();
    applyGlass();
    // glass app icons (#25): set in Home settings, else home.glass_icons; off unless switched on
    GLASS_ICONS = typeof ST.glass_icons === "boolean" ? ST.glass_icons : HOME.glass_icons === true;
    NP_ON = typeof ST.now_playing === "boolean" ? ST.now_playing : HOME.now_playing !== false;
    KW_ON = typeof ST.keep_watching === "boolean" ? ST.keep_watching : HOME.keep_watching !== false;
    GLASS_FOCUS = (ST.glass_focus || HOME.glass_focus) === "glass" ? "glass" : "colour";
    document.documentElement.classList.toggle("gi-stay", GLASS_FOCUS === "glass");
    SOUND_STYLE = ["system", "soft", "off"].indexOf(ST.nav_sound || HOME.nav_sound) >= 0 ? (ST.nav_sound || HOME.nav_sound) : "system";
    document.documentElement.classList.toggle("glass-icons", GLASS_ICONS);
    GLASS_AMT = glassAmount();
    CLOCK_LIQUID = (ST.clock_style || HOME.clock_style) === "liquid";
    glassClasses();
    // a link set in Home settings wins over home.video_url; one from config.json alone means on
    VIDEO_URL = typeof ST.video_url === "string" ? ST.video_url : typeof HOME.video_url === "string" ? HOME.video_url : "";
    VIDEO_ON = !!VIDEO_URL && (typeof ST.video === "boolean" ? ST.video : true);
    GRID_COLS = NIGHT ? 12 : 8;
    DOCK_APPS = Math.max(1, Math.min(10, parseInt(HOME.dock_size, 10) || 10));
    if (smartOn()) DOCK_APPS = Math.min(DOCK_APPS, 9);   // the Smart home tile takes one place in the dock
    CLOCK24 = clock24();
    (Array.isArray(HOME.hide_packages) ? HOME.hide_packages : []).forEach(function (p) {
      if (typeof p === "string" && HIDDEN.indexOf(p) < 0) HIDDEN.push(p);
    });
    HIDDEN_TV = (Array.isArray(ST.hidden_apps) ? ST.hidden_apps : []).filter(function (p) { return typeof p === "string"; });
    SCENE_LIB = BUILT_IN.concat(myScenes(HOME.my_scenes));
    var st = sceneState();
    SCENES = st.order.filter(function (id) { return st.off.indexOf(id) < 0; }).map(sceneById).filter(Boolean);
    if (!SCENES.length) SCENES = [SCENE_LIB[0]];
    SCENE_MS = Math.max(5, parseInt(ST.scene_seconds || HOME.scene_seconds, 10) || 20) * 1000;
    newApps = kept("tvhome.apps.new") || [];
    applyClock();
  }
  function lookSetting() { return "night"; }   // Classic is switched off; kept so older code still answers
  function glassAmount() {
    var n = parseInt(ST.glass_amount != null ? ST.glass_amount : HOME.glass_amount, 10);
    return n >= 1 && n <= 5 ? n : 3;
  }
  function glassClasses() {
    var r = document.documentElement;
    for (var i = 1; i <= 5; i++) r.classList.toggle("ga-" + i, GLASS_AMT === i);
    if (r.classList.contains("clock-liquid") !== CLOCK_LIQUID) { r.classList.toggle("clock-liquid", CLOCK_LIQUID); glassShown = ""; }
  }
  // The panels' look has to change on the spot when Home settings is used, not after a restart.
  function applyGlass() {
    var r = document.documentElement;
    r.classList.toggle("glass", GLASS !== "off");
    r.classList.toggle("glass-lite", GLASS === "lite");
    glassShown = "";
  }
  function glassSetting() { var g = ST.glass || HOME.glass; return g === "on" || g === "lite" ? g : "off"; }
  // no clock in Home settings or config.json: the one usual for the language (24 hour in Italian and German)
  function clock24() { return (ST.clock || HOME.clock || (window.I18N ? window.I18N.clock() : "12h")) === "24h"; }

  // ---------------- helpers ----------------
  function esc(v) { return String(v == null ? "" : v).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  // The saved copy has its own storage, so the app order is also kept by the launcher (TVOS.keep).
  function load() {
    if (MOCK || PREVIEW) return null;
    try {
      if (OFFLINE) return TV && TV.kept ? { order: (JSON.parse(TV.kept(CACHE_KEY) || "null") || {}).order || null } : null;
      return JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
    } catch (e) { return null; }
  }
  function save() {
    if (MOCK || PREVIEW || OFFLINE) return;
    var j = JSON.stringify({ screens: data.screens, order: data.order });
    try { localStorage.setItem(CACHE_KEY, j); } catch (e) {}
    try { if (TV && TV.keep) TV.keep(CACHE_KEY, j); } catch (e) {}
  }
  function mark(name) { try { performance.mark(name); } catch (e) {} }

  function api(method, path, body, timeoutMs) {
    if (TV_ID) {
      if (method === "GET") path += (path.indexOf("?") < 0 ? "?" : "&") + "tv=" + TV_ID;
      else body = Object.assign({ tv: TV_ID }, body || {});
    }
    if (MOCK && window.MOCK_API) return window.MOCK_API(method, path, body);
    // previews on a computer read the real bridge but never change it
    if (PREVIEW && method !== "GET") return Promise.resolve({ ok: true, note: "" });
    return new Promise(function (resolve, reject) {
      var x = new XMLHttpRequest();
      x.open(method, API + path);
      x.timeout = timeoutMs || 6000;
      x.setRequestHeader("Content-Type", "application/json");
      x.onload = function () {
        var j = null;
        try { j = JSON.parse(x.responseText); } catch (e) {}
        if (x.status >= 200 && x.status < 300 && j && j.ok !== false) resolve(j);
        else reject(new Error((j && j.error) || t("bridge_no", { status: x.status })));
      };
      x.onerror = function () { reject(new Error(t("bridge_down"))); };
      x.ontimeout = function () { reject(new Error(t("bridge_slow"))); };
      x.send(body ? JSON.stringify(body) : null);
    });
  }

  function status(text, sticky) {
    clearTimeout(statusTimer);
    $("status").textContent = text || "";
    if (text && !sticky) statusTimer = setTimeout(function () { status(data.bridge === false && !ALONE ? t("computer_quiet") : "", true); }, 6000);
  }

  function iconUrl(pkg) {
    if (!pkg) return null;
    if (TV) return TV.iconUrl ? TV.iconUrl(pkg) : "http://tvos.invalid/icon/" + pkg;   // Samsung: samsung/app/tizen.js
    return window.MOCK_ICON ? window.MOCK_ICON(pkg) : null;
  }

  // ---------------- the photo, the clock and the big title ----------------
  // Free Creative Commons photos (backgrounds/CREDITS.md), in the order they rotate.
  var PHOTOS = [
    { file: "tessellated-pavement", place: "Tessellated Pavement, Tasmania", by: "JJ Harrison" },
    { file: "grose-valley", place: "Grose Valley, Blue Mountains", by: "Diliff" },
    { file: "albury-storm", place: "Storm at sunset, Albury", key: "photo_albury", by: "Thennicke" },
    { file: "aresquiers-beach", place: "Aresquiers beach, France", key: "photo_aresquiers", by: "Christian Ferrer" },
    { file: "vang-vieng-sunset", place: "Vang Vieng, Laos", by: "Basile Morin" }
  ];
  var PHOTO_MS = 90000;

  // A 4K screen gets the 4K copies of the built-in pictures (the same names with @2x added before
  // the extension). The
  // page is laid out at 1920x1080 but drawn at devicePixelRatio 2 there, so the 1080 files were
  // stretched and looked soft (couch-tv#8, a UHD LG). Your own scenes in mine/ have no 4K copy.
  var HI_RES = (window.devicePixelRatio || 1) * window.innerWidth >= 3000;
  function bgPath(name, ext, builtIn) { return "backgrounds/" + name + (HI_RES && builtIn !== false ? "@2x" : "") + ext; }
  var photo = 0, photoTimer = null, bgShown = null, bgLayer = 0, bgTicket = 0;

  function photoForHour(h) {   // sunrise in the morning, green by day, sunsets in the evening
    if (h >= 5 && h < 9) return 0;
    if (h >= 9 && h < 13) return 1;
    if (h >= 13 && h < 17) return 2;
    if (h >= 17 && h < 19) return 3;
    if (h >= 19 && h < 22) return 5;
    return 4;
  }

  function setBg(url, isShow) {
    if (!url || url === bgShown) return;
    var ticket = ++bgTicket;   // only the latest request may land
    var pre = new Image();
    pre.onload = function () {
      if (ticket !== bgTicket) return;
      var box = $("bg");
      while (box.children.length < 2) { var im = document.createElement("img"); im.alt = ""; box.appendChild(im); }
      var next = box.children[bgLayer = 1 - bgLayer], prev = box.children[1 - bgLayer];
      next.src = url;
      next.classList.toggle("show", !!isShow);
      next.classList.add("on");
      prev.classList.remove("on");
      bgShown = url;
    };
    pre.src = url;
  }

  // Classic: the household's own photos (Home settings) when there are any, else the five above.
  function classicPhotos() {
    var own = ownScenes().filter(function (s) { return sceneState().off.indexOf(s.id) < 0; });
    if (!own.length) return PHOTOS;
    return own.map(function (s) { return { src: s.src, place: t("scene_photo", { n: s.n }), by: "" }; });
  }

  function showPhoto() {
    if (NIGHT) { $("place").textContent = ""; return; }   // the scenes carry their own photos
    var list = classicPhotos(), p = list[photo % list.length];
    setBg(p.src || bgPath(p.file, ".jpg"), false);
    $("place").textContent = (p.key ? t(p.key) : p.place) + (p.by ? "  ·  " + t("photo_by", { by: p.by }) : "");
  }

  function nextPhoto() {
    photo = (photo + 1) % classicPhotos().length;
    if (zone !== "shelf") showPhoto();
  }

  // Open-Meteo gives Celsius; Fahrenheit is worked out here when Home settings asks for it.
  function tempText(c) { return WX_F ? Math.round(c * 9 / 5 + 32) + "°F" : c + "°"; }
  function wxText(w) { var k = WMO_KEY[w.code]; return k ? t(k) : (w.text || ""); }

  function clock() {
    var d = new Date(), h = d.getHours(), m = d.getMinutes();
    var mm = (m < 10 ? "0" : "") + m;
    var hm = CLOCK24 ? (h < 10 ? "0" : "") + h + ":" + mm : (h % 12 || 12) + ":" + mm;
    $("time").innerHTML = hm + (CLOCK24 ? "" : "<small>" + esc(h < 12 ? t("am") : t("pm")) + "</small>");
    var loc = window.I18N ? window.I18N.locale() : "en-AU";
    var day = d.toLocaleDateString(loc, { weekday: "long", day: "numeric", month: "long" }).replace(",", "");
    day = day.charAt(0).toUpperCase() + day.slice(1);   // "lunes 27 de octubre" starts a line on screen
    var w = NIGHT && WX_SHOW && data.weather && data.weather.temp != null ? data.weather : null;
    $("date").innerHTML = '<span class="dline">' + esc(day) + (w ? '<span class="wx">' + wxIcon(w) + esc(tempText(w.temp)) +
      '<span class="ww"> ' + esc(wxText(w)) + "</span></span>" : "") + "</span>";
    fitDate();
    document.body.classList.toggle("night", h >= 21 || h < 6);
    if (NIGHT) { glassClock(hm); updateAmbientWeather(); }
    if (quickReady) renderQuick();
  }

  // Night: five lock screen scenes take turns every 20 s (home.scenes picks which and in what
  // order, home.scene_seconds how long each stays). Each has its own photo,
  // a big glass clock and (most) a cut-out of the photo that stands in front of the clock. The clock's
  // fill is the frosted copy of the photo exactly behind each digit, so it is re-aligned whenever the
  // time changes or a scene is about to show. Only the scene showing and the next one are drawn.
  // Files: backgrounds/<photo>.jpg, and optionally <photo>-glass.jpg and <photo>-fg.webp.
  var SCENE_LIB = [
    // Photos are the generated scene-*.jpg set in backgrounds/. Drop your own 1920x1080 JPEGs in there
    // and name them here. Each one can have:
    //   fg: true     backgrounds/<photo>-fg.webp, a transparent copy of everything in front of the sky
    //                (peaks, trees, hills), drawn over the clock so the scenery overlaps its digits
    //   glass: true  backgrounds/<photo>-glass.jpg, a blurred and brightened copy of the photo used
    //                as the clock's frosted fill (without it the fill is the photo itself)
    //   water: 0.55  the waterline, as a share of the screen height: above it the clock is sharp,
    //                below it a blurred copy shows like a reflection
    // Your own scenes are not listed here: tools/make-scene.py makes them and home.my_scenes in
    // config.json names them (myScenes() below, docs/MAKE-A-SCENE.md).
    // Each scene's clock and date positions are in app.css (.s-<id>, .scene-<id> .date).
    { id: "golden", photo: "scene-golden", fg: true, glass: true }
  ];
  var BUILT_IN = SCENE_LIB.slice();   // readConfig() adds your own scenes to SCENE_LIB
  var SCENES = SCENE_LIB.slice(), SCENE_MS = 20000;
  var scene = 0, sceneEls = [], glassShown = "", sceneTimer = null;

  // Your own scenes (home.my_scenes in config.json), made with tools/make-scene.py: the photo, glass
  // copy and cut-out in backgrounds/mine/, and how its clock looks. Anything odd falls back to the
  // built-in look, and the clock is kept above Keep watching and the dock whatever the numbers say.
  // A scene whose photo is not on this TV leaves the turns by itself (lostScene below).
  function myScenes(list) {
    var taken = BUILT_IN.map(function (s) { return s.id; }).concat(["own", "mine"]), out = [];
    var share = function (v, lo, hi, d) { return typeof v === "number" && isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d; };
    (Array.isArray(list) ? list : []).forEach(function (m) {
      if (!m || typeof m.id !== "string" || !/^[a-z0-9]{1,24}$/.test(m.id) || taken.indexOf(m.id) >= 0) return;
      taken.push(m.id);
      var c = m.clock && typeof m.clock === "object" ? m.clock : {};
      var size = share(c.size, 0.2, 0.45, 0.37);   // the digits' font size, as a share of the screen height
      var below = m.date === "below", inter = c.font === "inter";
      // the top of the clock, as a share of the screen height. The digits' ink ends 0.92 of the
      // font size below it (Antonio; Inter 0.77), and must end above Keep watching, as on the
      // waterline scene; with the date below, the date must fit too.
      var y = share(c.y, 0.12, 0.6, 0.14);
      y = Math.max(0.12, Math.min(y, 0.62 - (inter ? 0.77 : 0.92) * size - (below ? 0.06 : 0)));
      // cutout: true only when make-scene.py made the cut-out (scene-<id>-fg.webp); without it the
      // clock is simply drawn over the photo
      out.push({ id: m.id, photo: "mine/scene-" + m.id, fg: m.cutout === true, glass: true, mine: true, n: out.length + 1,
        name: typeof m.name === "string" ? m.name.slice(0, 40) : "",
        x: ["left", "right"].indexOf(c.x) >= 0 ? c.x : "centre", y: y, size: size,
        inter: inter, weight: Math.round(share(c.weight, 100, 900, 600) / 100) * 100,
        below: below, dark: m.text === "dark" });
    });
    return out;
  }
  function sceneClass(s) { return s.own ? "own" : s.mine ? "mine" : s.id; }
  function sceneLabel(s) {
    if (!s) return "";
    return s.own ? t("scene_photo", { n: s.n }) : s.mine ? (s.name || t("scene_mine", { n: s.n })) : t("scene_" + s.id);
  }

  // The household's own photos (Home settings, "Your photos") are scenes too, with no cut-out and
  // no glass copy: the clock's fill is the photo itself, frosted in app.css (.s-own).
  function photoSrc(p) { return p.file ? "http://tvos.invalid/photo/" + encodeURIComponent(p.file) : p.url; }
  function ownScenes() {
    return (Array.isArray(ST.photos) ? ST.photos : []).filter(function (p) { return p && p.id && (p.file || p.url); })
      .map(function (p, i) { return { id: "p-" + p.id, src: photoSrc(p), own: true, n: i + 1, fg: false, glass: false }; });
  }
  function sceneById(id) { return SCENE_LIB.concat(ownScenes()).filter(function (s) { return s.id === id; })[0] || null; }
  // Which scenes take turns and in what order: Home settings (scene_order, scenes_off) when set,
  // else home.scenes from config.json, with anything not listed there switched off.
  function sceneState() {
    var all = SCENE_LIB.concat(ownScenes()), ids = all.map(function (x) { return x.id; });
    var uniq = function (id, i, a) { return ids.indexOf(id) >= 0 && a.indexOf(id) === i; };
    var order, off;
    if (Array.isArray(ST.scene_order)) {
      order = ST.scene_order.filter(uniq);
      order = order.concat(ids.filter(function (id) { return order.indexOf(id) < 0; }));
      off = (Array.isArray(ST.scenes_off) ? ST.scenes_off : []).filter(function (id) { return ids.indexOf(id) >= 0; });
    } else {
      // your own scenes (home.my_scenes) are always on: listed in home.scenes they go where they
      // are listed, otherwise after the built-in ones
      var lib = SCENE_LIB.map(function (x) { return x.id; }), builtIn = BUILT_IN.map(function (x) { return x.id; });
      var pick = (HOME.scenes || []).filter(function (id, i, a) { return lib.indexOf(id) >= 0 && a.indexOf(id) === i; });
      if (!pick.length) pick = builtIn;
      order = pick.concat(ids.filter(function (id) { return pick.indexOf(id) < 0; }));
      off = builtIn.filter(function (id) { return pick.indexOf(id) < 0; });
    }
    return { order: order, off: off, all: all };
  }
  function cssUrl(u) { return 'url("' + String(u).replace(/["\\\n]/g, encodeURIComponent) + '")'; }

  function buildScenes() {
    var box = $("scenes");
    sceneEls = SCENES.map(function (s, si) {
      var el = document.createElement("div");
      el.className = "scene s-" + sceneClass(s);
      el.innerHTML = '<img class="sbg" alt=""><div class="shade"></div><div class="gclock"></div>' +
        (s.water ? '<div class="gclock under"></div>' : "") + (s.fg ? '<img class="fg" alt="">' : "");
      if (s.mine) {   // your own scene: its clock from config.json (app.css, "your own scenes")
        el.className += " x-" + s.x + (s.inter ? " f-inter" : "") + (s.dark ? " t-dark" : "");
        el.style.setProperty("--my-top", s.y * 100 + "vh");
        el.style.setProperty("--my-size", s.size * 100 + "vh");
        el.style.setProperty("--my-weight", s.weight);
        // adaptive digits follow this scene's own colour
        el.style.setProperty("--ck-scene", CK_SCENE_TINTS[si % CK_SCENE_TINTS.length]);
        el.querySelector(".sbg").onerror = function () { lostScene(s); };
        var fg = el.querySelector(".fg");
        if (fg) fg.onerror = function () { fg.style.display = "none"; };   // "cutout": true but no file: the clock stays in front
      }
      box.appendChild(el);
      return el;
    });
  }

  // An own scene whose photo is not on this TV (option A with an app built before the scene was
  // made, or a scene named in config.json but not made yet) leaves the turns instead of showing black.
  function lostScene(s) {
    s.lost = true;
    if (SCENES.every(function (x) { return x.lost; })) {
      SCENES = [BUILT_IN[0]];
      $("scenes").innerHTML = "";
      buildScenes();
      scene = 0;
      showScene(0);
    } else if (SCENES[scene] === s) showScene(nextFrom(scene));
  }
  function nextFrom(i) {
    for (var k = 1; k <= SCENES.length; k++) if (!SCENES[(i + k) % SCENES.length].lost) return (i + k) % SCENES.length;
    return i;
  }

  // Item 1: a scene switched off (or back on) in Look and scenes must take effect at once, and the
  // turn timer must be re-armed, so nothing rotates once only one scene is left.
  function applyScenes() {
    var cur = SCENES[scene] ? (SCENES[scene].own ? "own" : SCENES[scene].id) : null;
    var st = sceneState();
    SCENES = st.order.filter(function (id) { return st.off.indexOf(id) < 0; }).map(sceneById).filter(Boolean);
    if (!SCENES.length) SCENES = [SCENE_LIB[0]];
    if (NIGHT) {
      $("scenes").innerHTML = "";
      buildScenes();
      var i = cur ? SCENES.map(function (s) { return s.own ? "own" : s.id; }).indexOf(cur) : 0;
      showScene(Math.max(0, i));
    }
    armScenes();
  }
  // How long each scene stays also comes from Look and scenes, so the timer is re-armed on any change.
  function armScenes() {
    if (sceneTimer) { clearInterval(sceneTimer); sceneTimer = null; }
    if (NIGHT && SCENES.length > 1) sceneTimer = setInterval(nextScene, SCENE_MS);
  }

  // draw a scene (load its pictures, place its clock) so it can fade in
  function readyScene(i) {
    var s = SCENES[i], el = sceneEls[i];
    if (!el.classList.contains("ready")) {
      el.querySelector(".sbg").src = s.src || bgPath(s.photo, ".jpg", !s.mine);
      if (s.fg) el.querySelector(".fg").src = bgPath(s.photo + "-fg", ".webp", !s.mine);
      el.classList.add("ready");
    }
    drawClocks(el, s, glassShown);
  }

  function drawClocks(el, s, hm) {
    if (!hm) return;
    var cs = el.querySelectorAll(".gclock");
    for (var k = 0; k < cs.length; k++) {
      var c = cs[k];
      // The same split markup in every glass layer (hour, colon, minute), so the photo clip still
      // lines up while a split layout or an outline minute is drawn (the clock customiser).
      var inner = clockHTML(hm);
      c.innerHTML = '<span class="edge">' + inner + '</span><span class="fill">' + inner +
        '</span><span class="sheen">' + inner + '</span><span class="rim">' + inner + "</span>";
      var f = c.querySelector(".fill"), ex = c.offsetLeft + f.offsetLeft, ey = c.offsetTop + f.offsetTop;
      if (CLOCK_LIQUID) {
        // Liquid glass (#25): the sharp photo seen through the digits, magnified LENS times about
        // the clock's middle, the way a thick clear glass bends what is behind it. Clear amounts
        // 1 and 2 use the frosted copy instead, so the glass reads as frosted.
        var cx = c.offsetLeft + c.offsetWidth / 2, cy = c.offsetTop + c.offsetHeight / 2, LENS = 1.07;
        var frost = GLASS_AMT <= 2 && s.glass && !s.src;
        f.style.backgroundImage = s.src ? cssUrl(s.src) : "url(backgrounds/" + s.photo + (frost ? "-glass" : "") + ".jpg)";
        f.style.backgroundSize = LENS * 100 + "vw " + LENS * 100 + "vh";
        f.style.backgroundPosition = (-ex - (LENS - 1) * cx) + "px " + (-ey - (LENS - 1) * cy) + "px";
      } else {
        f.style.backgroundImage = s.src ? cssUrl(s.src) : "url(backgrounds/" + s.photo + (s.glass ? "-glass" : "") + ".jpg)";
        f.style.backgroundPosition = -ex + "px " + -ey + "px";
      }
    }
    if (s.water) {   // above the waterline sharp, below it the blurred reflection
      // The digits hang below the clock's box (its line height is tight), so the clips reach past
      // the box on the open sides; a plain inset cut the bottom of the numbers off .
      var line = innerHeight * s.water - cs[0].offsetTop, out = "-50%";
      cs[0].style.clipPath = "inset(" + out + " " + out + " " + (cs[0].offsetHeight - line) + "px " + out + ")";
      cs[1].style.clipPath = "inset(" + line + "px " + out + " " + out + " " + out + ")";
    }
  }

  function glassClock(hm) {
    if (hm === glassShown) return;
    glassShown = hm;
    sceneEls.forEach(function (el, i) { if (el.classList.contains("ready")) drawClocks(el, SCENES[i], hm); });
  }

  // ---------------- the video background (Home settings, Look; home.video_url) ----------------
  // A muted clip that loops in place of the photo, in both looks. The photo stays until the clip
  // really plays, and comes back if it fails or has not started within 20 s. It pauses while the
  // home is not on screen (the launcher calls tv.pause, and the page's own visibility).
  var vidTimer = null;
  function startVideo() {
    var v = $("bgvid"), root = document.documentElement;
    if (!VIDEO_ON) return;
    if (v.getAttribute("src") !== VIDEO_URL) {
      root.classList.remove("has-video");
      v.onplaying = function () { clearTimeout(vidTimer); root.classList.add("has-video"); };
      v.onerror = stopVideo;
      v.src = VIDEO_URL;
      clearTimeout(vidTimer);
      vidTimer = setTimeout(function () { if (!root.classList.contains("has-video")) stopVideo(); }, 20000);
    }
    var p = v.play();
    if (p && p.catch) p.catch(function () {});
  }
  function stopVideo() {
    var v = $("bgvid");
    clearTimeout(vidTimer);
    VIDEO_ON = false;
    document.documentElement.classList.remove("has-video");
    v.pause();
    v.removeAttribute("src");
    try { v.load(); } catch (e) {}
  }
  function pauseVideo() {
    if (window.AmbientWeather) window.AmbientWeather.pause();
    var v = $("bgvid"); if (v.getAttribute("src")) v.pause();
  }
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) pauseVideo();
    else { startVideo(); if (window.AmbientWeather) window.AmbientWeather.resume(); try { goHome(); } catch (e) {} }
  });

  function showScene(i) {
    var prev = scene;
    scene = i;
    readyScene(i);
    var date = $("date");
    date.classList.add("swap");
    setTimeout(function () {
      var s = SCENES[i], root = document.documentElement, cls = " scene-" + sceneClass(s);
      if (s.mine) {   // the date follows your own scene's clock
        cls += " mine-" + s.x + (s.below ? " mine-below" : "") + (s.inter ? " mine-inter" : "") + (s.dark ? " mine-dark" : "");
        root.style.setProperty("--my-top", s.y * 100 + "vh");
        root.style.setProperty("--my-size", s.size * 100 + "vh");
      }
      root.className = root.className.replace(/\b(scene|mine)-\w+/g, "").replace(/\s+/g, " ").trim() + cls;
      date.classList.remove("swap");
      fitDate();
    }, 600);
    sceneEls[i].classList.add("on");
    // this scene's own clock look takes over as it fades in (Home settings and the drawer save per scene)
    applyClock();
    if (prev !== i) sceneEls[prev].classList.remove("on");
    // after the fade, stop drawing the old one and get the next one ready
    setTimeout(function () {
      var next = nextFrom(scene);
      sceneEls.forEach(function (el, k) { if (k !== scene && k !== next) el.classList.remove("ready"); });
      readyScene(next);
    }, 2000);
  }

  // Night: the date line sits centred above the clock, beside the quick buttons. Longer words
  // (Spanish, a running sleep timer, four buttons) can reach them, so it makes
  // room: first it centres in the space left, then drops the weather's words, then the weather.
  // The date and its weather sit on the clock, wherever the digits are. The old rules reset the
  // left/right here after placing it, which is why a fixed date could stay at the top left.
  function fitDate() {
    if (!NIGHT) return;
    placeDate();
  }

  // the settings screen covers the scenes, so they wait (one less thing for a small TV stick to draw)
  // while the clock is being adjusted the scene stays put, so the digits do not move under the drawer
  function nextScene() { if (zone !== "settings" && zone !== "clock" && zone !== "clockbar") showScene(nextFrom(scene)); }

  // Sun-synchronized day/night calculation (astronomical solar altitude from lat, lon and time)
  function solarAltitude(lat, lon, d) {
    d = d || new Date();
    var start = new Date(Date.UTC(d.getUTCFullYear(), 0, 0));
    var dayOfYear = Math.floor((d - start) / 86400000);
    var b = (360 / 365.25) * (dayOfYear - 81) * (Math.PI / 180);
    var eot = 9.87 * Math.sin(2 * b) - 7.53 * Math.cos(b) - 1.5 * Math.sin(b);
    var decl = 23.45 * Math.sin(b) * (Math.PI / 180);
    var utcHours = d.getUTCHours() + d.getUTCMinutes() / 60 + d.getUTCSeconds() / 3600;
    var solarTime = (utcHours + (lon / 15) + (eot / 60) + 24) % 24;
    var hourAngle = (solarTime - 12) * 15 * (Math.PI / 180);
    var latRad = lat * (Math.PI / 180);
    var sinAlt = Math.sin(latRad) * Math.sin(decl) + Math.cos(latRad) * Math.cos(decl) * Math.cos(hourAngle);
    var alt = Math.asin(Math.max(-1, Math.min(1, sinAlt))) * (180 / Math.PI);
    return { alt: alt, hourAngle: hourAngle * (180 / Math.PI) };
  }
  function getSunPos() {
    if (WXCFG && WXCFG.lat != null && isFinite(WXCFG.lat) && WXCFG.lon != null && isFinite(WXCFG.lon)) {
      return solarAltitude(Number(WXCFG.lat), Number(WXCFG.lon), new Date());
    }
    var h = new Date().getHours();
    return { alt: (h >= 6 && h < 18) ? 35 : -20, hourAngle: (h - 12) * 15 };
  }
  // The ambient weather effects follow the settings: off unless chosen, and not while the
  // weather itself is hidden.
  function applyWeatherEffectType() {
    var a = window.AmbientWeather;
    if (!a) return;
    if (!WX_EFFECTS || !WX_SHOW || !NIGHT) { a.setWeather(null, getSunPos()); return; }
    if (WX_EFFECT_TYPE !== "auto") {
      // force the chosen effect: synthesize a weather code
      var code = WX_EFFECT_TYPE === "rain" ? 63 : WX_EFFECT_TYPE === "snow" ? 73 : WX_EFFECT_TYPE === "fog" ? 45 : WX_EFFECT_TYPE === "storm" ? 95 : 0;
      a.setWeather({ code: code, temp: (data.weather && data.weather.temp) || 20 }, getSunPos());
      return;
    }
    updateAmbientWeather();
  }
  function ambientSync() {
    var a = window.AmbientWeather;
    if (!a) return;
    a.setEnabled(WX_EFFECTS && WX_SHOW && NIGHT);
    a.setSunGradeEnabled(WX_SUN_GRADE && NIGHT);
    applyWeatherEffectType();
  }
  function updateAmbientWeather() {
    if (!window.AmbientWeather) return;
    if (WX_EFFECT_TYPE !== "auto") { applyWeatherEffectType(); return; }
    window.AmbientWeather.setWeather(WX_SHOW ? data.weather : null, getSunPos());
  }

  // The bridge's reading for the place in config.json, or straight from Open-Meteo with no bridge
  // or when Home settings chose another place. Hidden when Home settings switched the weather off.
  function refreshWeather() {
    if (!NIGHT || !WX_SHOW) { updateAmbientWeather(); return Promise.resolve(); }
    var direct = OFFLINE || !!(ST.place && isFinite(ST.place.lat));
    return (direct ? weatherDirect() : api("GET", "/api/weather")).then(function (j) {
      data.weather = j; clock(); ambientSync();
    }, function () {});
  }

  // Open-Meteo (free, no key), the same call the bridge makes. The words come from i18n.js.
  var WMO_KEY = { 0: "wx_clear", 1: "wx_mostly_clear", 2: "wx_partly", 3: "wx_cloudy", 45: "wx_fog", 48: "wx_fog",
    51: "wx_drizzle", 53: "wx_drizzle", 55: "wx_drizzle", 56: "wx_drizzle", 57: "wx_drizzle", 61: "wx_light_rain",
    63: "wx_rain", 65: "wx_heavy_rain", 66: "wx_rain", 67: "wx_rain", 80: "wx_showers", 81: "wx_showers",
    82: "wx_heavy_showers", 95: "wx_storms", 96: "wx_storms", 99: "wx_storms" };
  function weatherDirect() {
    var url = "https://api.open-meteo.com/v1/forecast?latitude=" + WXCFG.lat + "&longitude=" + WXCFG.lon +
      "&current=temperature_2m,weather_code,is_day&timezone=" + encodeURIComponent(WXCFG.timezone || "auto") + "&forecast_days=1";
    return fetch(url).then(function (r) { return r.json(); }).then(function (j) {
      var c = j.current, code = Math.round(c.weather_code);
      return { temp: Math.round(c.temperature_2m), code: code, text: "", is_day: !!c.is_day };
    });
  }

  function hero(it) {
    var el = $("hero");
    if (!it) { el.classList.remove("on"); return; }
    $("hero-title").textContent = it.title;
    $("hero-sub").textContent = subtitle(it);
    el.classList.add("on");
  }

  // ---------------- Now playing (#31) ----------------
  // The song any app is playing behind the home (Spotify, YouTube Music, ...): its title, artist and
  // cover, with previous, play or pause and next. The bridge or the on-TV app reads it from the TV's
  // media sessions (/api/music) every 5 s while the home is on screen; the buttons are the remote's
  // media keys. A paused song stays for ten minutes so play can start it again. No computer and no
  // on-TV app (option A): Android lets no ordinary app read other apps' sessions, so no card.
  var music = null, npI = 1;
  function npVisible() { return NP_ON && !!music && !OFFLINE; }
  // reachable with the remote: in the Night look it steps aside with the cards while More apps is open
  function npReach() { return npVisible() && !(NIGHT && expanded); }
  function renderNp() {
    var el = $("np"), on = npVisible();
    el.classList.toggle("on", on);
    if (NIGHT) {
      // the row shows while Keep watching is on and has a show, or while a song plays
      $("shelf-section").classList.toggle("kw-off", !KW_ON);
      $("shelf-section").classList.toggle("empty", !(KW_ON && data.shows.length) && !on);
      $("np-slot").classList.toggle("on", on);
    }
    if (!on) { el.innerHTML = ""; return; }
    var playing = music.state === "playing";
    // the cover from the bridge (Apple's music search); none yet, or none found: a music note
    var art = music.art ? '<img class="np-art" src="' + esc(music.art) + '" alt="" decoding="async" onerror="this.className=\'np-art gone\'">' :
      '<span class="np-art">' + ICONS.note + "</span>";
    var btns = [["prev", t("np_prev")], [playing ? "pause" : "play", playing ? t("np_pause") : t("np_play")], ["next", t("np_next")]];
    el.innerHTML = art + '<div class="np-t"><span class="np-app">' + esc((music.app && music.app.name) || t("np_head")) + "</span>" +
      "<b>" + esc(music.title) + "</b><small>" + esc(music.artist || music.album || "") + "</small></div>" +
      '<div class="np-ctl">' + btns.map(function (b, i) {
        return '<span class="nb' + (zone === "np" && i === npI ? " focus" : "") + '" role="button" aria-label="' + esc(b[1]) + '">' + ICONS[b[0]] + "</span>";
      }).join("") + "</div>";
  }
  function refreshMusic() {
    if (!NP_ON || OFFLINE || document.hidden) { if (music) { music = null; renderNp(); } return; }
    api("GET", "/api/music", null, 5000).then(function (j) {
      var had = !!music;
      music = j.music || null;
      renderNp();
      if (had !== !!music && zone === "np" && !music) paintFocus();   // the card went away under the focus
    }, function () { if (music) { music = null; renderNp(); if (zone === "np") paintFocus(); } });
  }
  function npPress() {
    if (!music) return;
    var key = ["previous", "play_pause", "next"][npI];
    if (key === "play_pause") { music.state = music.state === "playing" ? "paused" : "playing"; renderNp(); }   // straight away
    api("POST", "/api/key", { key: key }).catch(function (e) { note(e.message); });
    setTimeout(refreshMusic, key === "play_pause" ? 1500 : 900);
  }

  // ---------------- quick buttons: from tvs[].quick in config.json, in that order ----------------
  // sleep: the sleep timer. picture: flip between the TV's two picture modes. look: Night scenes or
  // Classic. input: the TV's input list. A button that cannot work right now is left out (no bridge
  // for the sleep timer, a TV with no picture setting, an input list nobody can open).
  var SLEEP_CHOICES = [15, 30, 60, 90, 0];   // 0 = off
  // picture mode only exists where the bridge says this TV supports it
  var sleepEnds = null, picMode = null, picCanSet = false, picShown = false, picBusy = false, picModes = null;
  var qi = 0, menuI = 0, noteTimer = null, quickReady = false, quickEls = [];

  function note(text) {
    clearTimeout(noteTimer);
    $("quick-note").textContent = text || "";
    if (text) noteTimer = setTimeout(function () { $("quick-note").textContent = ""; }, 6000);
  }
  function minutesLeft() {
    if (!sleepEnds) return 0;
    var m = Math.ceil((sleepEnds - Date.now()) / 60000);
    if (m <= 0) { sleepEnds = null; return 0; }
    return m;
  }
  function nativeInputs() {
    try { return !!(TV && TV.canOpenInputs && TV.canOpenInputs()); } catch (e) { return false; }
  }
  function nativeScreensaver() {
    try { return !!(TV && TV.canStartScreensaver && TV.canStartScreensaver()); } catch (e) { return false; }
  }
  function nativeSettings() {
    try { return !!(TV && TV.openSettingsScreen); } catch (e) { return false; }
  }
  function quickVisible() {
    return QUICK.filter(function (q) {
      if (q === "sleep") return !OFFLINE;
      if (q === "picture") return !OFFLINE && picShown;
      if (q === "input") return !OFFLINE || nativeInputs();
      if (q === "screensaver") return nativeScreensaver();
      if (q === "bluetooth" || q === "network") return nativeSettings() || (ON_TV && !OFFLINE);
      if (q === "connections") return nativeSettings() || (ON_TV && !OFFLINE);
      if (q === "clock") return true;   // the clock customiser always works, with or without a bridge
      return false;
    });
  }
  function hasQuick() { return quickVisible().length > 0; }
  function picLabel() {
    if (picBusy) return t("switching");
    var names = picModes || (TVCFG.picture_modes || []).map(function (n) { return { id: null, name: n }; });
    var hit = names.filter(function (m) { return m.id === picMode; })[0];
    if (hit) return hit.name;
    if (picMode && picMode !== "other") return picMode.charAt(0).toUpperCase() + picMode.slice(1).replace(/-/g, " ");
    return t("picture_mode");
  }
  function renderQuick() {
    quickReady = true;
    var gq = $("qgear");
    if (gq && !gq.innerHTML) gq.innerHTML = ICONS.gear;
    var box = $("qbtns"), vis = quickVisible(), key = vis.join(",");
    if (box.getAttribute("data-k") !== key) {
      box.innerHTML = vis.map(function (q) { return '<span class="qbtn" id="q-' + q + '"></span>'; }).join("");
      box.setAttribute("data-k", key);
    }
    $("quick").classList.toggle("none", !vis.length);
    quickEls = vis.map(function (q) { return $("q-" + q); });
    var m = minutesLeft();
    vis.forEach(function (q) {
      var el = $("q-" + q);
      if (q === "sleep") {
        el.innerHTML = ICONS.moon + "<span>" + esc(m ? t(NIGHT ? "off_in_night" : "off_in", { m: m }) : t("sleep_timer")) + "</span>";
        el.classList.toggle("set", !!m);
      } else if (q === "picture") {
        el.innerHTML = ICONS.picture + "<span>" + esc(picLabel()) + "</span>";
        el.classList.toggle("off", !picCanSet);
      } else if (q === "input") {
        el.innerHTML = ICONS.input + "<span>" + esc(t("input")) + "</span>";
      } else if (q === "screensaver") {
        el.innerHTML = ICONS.screensaver + "<span>" + esc(t("quick_screensaver")) + "</span>";
      } else if (q === "bluetooth" || q === "network") {
        el.innerHTML = ICONS[q] + "<span>" + esc(t(q)) + "</span>";
      } else if (q === "connections") {
        el.innerHTML = ICONS.connections + "<span>" + esc(t("quick_connections")) + "</span>";
      } else if (q === "clock") {
        el.innerHTML = ICONS.clock + "<span>" + esc(t("quick_clock")) + "</span>";
      }
    });
    if (qi >= vis.length) qi = Math.max(0, vis.length - 1);
    fitDate();
  }
  // a short list straight under the Sleep timer button (#33, thanks alonmustafa), up and down to choose
  function renderMenu() {
    var menu = $("sleep-menu");
    menu.innerHTML = SLEEP_CHOICES.map(function (c, i) {
      return '<span class="opt' + (i === menuI ? " focus" : "") + '">' + esc(c ? t("n_min", { n: c }) : t("timer_off")) + "</span>";
    }).join("");
  }
  function openMenu() {
    var m = minutesLeft();
    menuI = m ? SLEEP_CHOICES.length - 1 : 1;   // a timer is running: start on Off; otherwise 30 min
    zone = "menu";
    var menu = $("sleep-menu"), btn = $("q-sleep");
    menu.classList.add("on");
    renderMenu();
    if (btn) menu.style.right = Math.max(0, $("quick").getBoundingClientRect().right - btn.getBoundingClientRect().right) + "px";
  }
  function closeMenu() {
    $("sleep-menu").classList.remove("on");
    zone = "quick";
  }
  function setSleep(minutes) {
    closeMenu();
    sleepEnds = minutes ? Date.now() + minutes * 60000 : null;   // show it straight away
    renderQuick();
    api("POST", "/api/sleep", { minutes: minutes })
      .then(function (j) { if (j.ends !== undefined) sleepEnds = j.ends ? Date.parse(j.ends) : null; renderQuick(); })
      .catch(function (e) { note(e.message); refreshQuick(); });
  }
  function togglePicture() {
    if (!picCanSet) { note(t("pic_not_ready")); return; }
    // A picture switch can take several seconds. Extra presses meanwhile would switch it straight back,
    // so they do nothing, and the label says what the TV actually ended on, not a guess.
    if (picBusy) return;
    picBusy = true;
    renderQuick();
    api("POST", "/api/picture", { mode: "toggle" }, 20000)
      .then(function (j) { if (j.mode) picMode = j.mode; })
      .catch(function (e) { note(e.message); })
      .then(function () { picBusy = false; renderQuick(); });
  }
  // Start the page again, so a new look or new settings take effect everywhere at once.
  function restart() {
    location.replace(location.href.replace(/([?&])theme=[a-z]+&?/, "$1").replace(/[?&]$/, ""));
  }
  // The TV's own input list (HDMI, a console, a set top box): the TV_INPUT key through the bridge,
  // or straight from the launcher when there is no bridge (only where the TV has such a screen).
  function openInputs() {
    // the TV lists its inputs: couch-tv's own menu, each one opening straight away (#30)
    var list = inputList();
    if (list.length) { openInputMenu(list); return; }
    var native = function () { try { return !!(TV && TV.openInputs && TV.openInputs()); } catch (e) { return false; } };
    if (OFFLINE) { if (!native()) note(t("no_inputs")); return; }
    api("POST", "/api/key", { key: "input" })
      .catch(function (e) { if (!native()) note(e.message); });
  }
  // One quick button for both: Bluetooth and Network in the same pop-up the input list uses.
  function openConnections() { openInputMenu([]); }
  // ---------------- the Input menu (#30) ----------------
  // The TV's own inputs, read by the launcher from Android's TV input list (TVOS.tvInputs): each HDMI
  // port by the TV's own name for it (ARC or eARC only where that label says so; Android has no public
  // way to read it), the devices HDMI-CEC found behind it, then Bluetooth and Network. A TV that lists
  // no inputs keeps its own input screen. ?mock=1&inputs=4 stands in four ports for a preview.
  var inI = 0, inItems = [];
  function inputList() {
    try {
      if (TV && TV.tvInputs) return JSON.parse(TV.tvInputs()) || [];
      if (window.MOCK_INPUTS) return window.MOCK_INPUTS;
    } catch (e) {}
    return [];
  }
  function openInputMenu(list) {
    // No HDMI ports in couch-tv's own menu: they stay in the TV's own settings. The menu is the
    // Bluetooth and Network shortcuts (the combined quick button opens it too).
    inItems = (list || []).filter(function (x) { return x.type !== "hdmi"; }).map(function (x) {
      var kind = x.type === "hdmi" ? "HDMI" : t("input");
      var sub = (x.devices || []).join(", ");
      return { act: "input", id: x.id, icon: ICONS.input, label: x.label || kind, sub: sub };
    });
    if ((TV && TV.openSettingsScreen) || ON_TV || window.MOCK_INPUTS) {
      inItems.push({ act: "bluetooth", icon: ICONS.bluetooth, label: t("bluetooth"), sub: t("bt_sub") });
      inItems.push({ act: "network", icon: ICONS.network, label: t("network"), sub: t("net_sub") });
    }
    inI = 0; zone = "inputs";
    renderInputMenu();
  }
  function renderInputMenu() {
    var pop = $("inputs-pop");
    pop.innerHTML = inItems.map(function (it, i) {
      return '<div class="grow' + (i === inI ? " focus" : "") + '" role="menuitem"><i>' + it.icon + "</i><span><b>" + esc(it.label) +
        "</b>" + (it.sub ? "<small>" + esc(it.sub) + "</small>" : "") + "</span></div>";
    }).join("");
    pop.classList.add("on");
    hintFlash = t(inItems.length > 0 && inItems[0].act === "input" ? "inputs_hint" : "connections_hint"); renderHint();
    // under the Input button, kept inside the screen's safe area
    var el = quickEls[qi], rem = innerWidth / 120;
    if (el) {
      var b = el.getBoundingClientRect(), w = pop.offsetWidth;
      pop.style.left = Math.max(5 * rem, Math.min(innerWidth - w - 5 * rem, b.right - w)) + "px";
      pop.style.top = Math.max(3.75 * rem, Math.min(innerHeight - pop.offsetHeight - 3.75 * rem, b.bottom + 1.25 * rem)) + "px";
    }
  }
  function closeInputMenu() {
    $("inputs-pop").classList.remove("on");
    hintFlash = "";
    if (zone === "inputs") zone = "quick";
  }
  function doInputMenu() {
    var it = inItems[inI];
    closeInputMenu();
    if (!it) return;
    if (it.act === "input") {
      var done = false;
      try { done = !!(TV && TV.openInput && TV.openInput(it.id)); } catch (e) {}
      if (!done) note(window.MOCK_INPUTS ? t("opening", { title: it.label }) : t("no_inputs"));
      return;
    }
    if (TV && TV.openSettingsScreen) { try { TV.openSettingsScreen(it.act); } catch (e) {} }
    else if (ON_TV) openSettingsScreen(it.act);
  }
  // The TV's Bluetooth or network settings, opened by the on-TV app (Tv.openSettingsScreen).
  function openSettingsScreen(which) {
    api("POST", "/api/launch", { app: which }).catch(function (e) { note(e.message); });
  }
  // The TV's own screensaver (Google TV's Ambient mode: the Google Photos albums are chosen there).
  function startScreensaver() {
    var ok = false;
    try { ok = !!(TV && TV.startScreensaver && TV.startScreensaver()); } catch (e) {}
    if (!ok) note(t("no_screensaver"));
  }
  // Google TV's own Ambient mode settings: where the source and the Google Photos albums are picked.
  function openAmbientSettings() {
    var ok = false;
    try { ok = !!(TV && TV.openAmbientSettings && TV.openAmbientSettings()); } catch (e) {}
    if (!ok) { SET.msg = t("no_screensaver"); renderSettings(); }
  }
  function quickAction() {
    var q = quickVisible()[qi];
    if (q === "sleep") openMenu();
    else if (q === "picture") togglePicture();
    else if (q === "input") openInputs();
    else if (q === "screensaver") startScreensaver();
    else if (q === "bluetooth" || q === "network") {
      // the on-TV app opens the TV's own page; the bridge asks the TV to open it
      var done = false;
      try { done = !!(TV && TV.openSettingsScreen && TV.openSettingsScreen(q)); } catch (e) {}
      if (!done) openSettingsScreen(q);
    }
    else if (q === "connections") openConnections();
    else if (q === "clock") openClockBar();
  }
  function refreshQuick() {
    var jobs = [];
    if (QUICK.indexOf("sleep") >= 0) {
      jobs.push(api("GET", "/api/sleep").then(function (j) { sleepEnds = j.ends ? Date.parse(j.ends) : null; }, function () {}));
    }
    if (QUICK.indexOf("picture") >= 0) {
      jobs.push(api("GET", "/api/picture").then(function (j) {
        picShown = j.supported !== false;
        picMode = j.mode || null; picCanSet = !!j.can_set;
        if (j.modes && j.modes.length) picModes = j.modes;
      }, function () { picShown = false; picCanSet = false; }));
    }
    return Promise.all(jobs).then(renderQuick);
  }

  // ---------------- Keep watching ----------------
  function subtitle(it) {
    var parts = [];
    if (it.app && it.app.name) parts.push(it.app.name);
    if (it.season && it.episode) parts.push("S" + it.season + ", E" + it.episode);
    if (it.episode_title) parts.push(it.episode_title);
    return parts.join("  ·  ");
  }

  // ---------------- Keep watching (#8) ----------------
  // Keep watching shows up to ten; the row slides along under the remote.
  var KEEP_MAX = 10;
  function renderShelf() {
    var track = $("shelf");
    data.shows = (data.shows || []).slice(0, KEEP_MAX);
    // nothing on the go: no empty box, the photo has the space (unless Now playing is up at night).
    // With Keep watching off the show cards and heading go; Now playing can still use the row.
    $("shelf-section").classList.toggle("kw-off", !KW_ON);
    $("shelf-section").classList.toggle("empty", !(KW_ON && data.shows.length) && !(NIGHT && npVisible()));
    if (!KW_ON) {
      track.innerHTML = "";
      shelfEls = [];
      return;
    }
    if (!data.shows.length) {
      track.innerHTML = '<p class="shelf-none">' + esc(t("nothing_yet")) + "</p>";
      shelfEls = [];
      return;
    }
    if (NIGHT) {
      // lock screen notifications: glass cards, three in view, the row slides past the third
      track.innerHTML = data.shows.map(function (it) {
        var art = it.backdrop || it.poster;
        var ep = it.season && it.episode ? "S" + it.season + " E" + it.episode : (it.episode_title || "");
        return '<div class="tile ncard">' +
          (art ? '<img class="thumb" src="' + esc(art) + '" alt="" decoding="async">' :
            '<span class="thumb none"></span>') +
          '<div class="t"><div class="nap">' +
          esc(it.app ? it.app.name : "") + "</div><b>" + esc(it.title) + "</b>" + (ep ? "<i>" + esc(ep) + "</i>" : "") +
          (it.progress ? '<span class="nbar"><i style="width:' + Math.round(it.progress * 100) + '%"></i></span>' : "") + "</div></div>";
      }).join("");
      shelfEls = Array.prototype.slice.call(track.children);
      return;
    }
    track.innerHTML = data.shows.map(function (it) {
      var art = it.backdrop || it.poster;
      var pkg = it.app && it.app.package;
      var badge = pkg && iconUrl(pkg) ? '<span class="badge"><img src="' + esc(iconUrl(pkg)) + '" alt="" onerror="this.parentNode.remove()"></span>' : "";
      var bar = it.progress ? '<span class="bar"><i style="width:' + Math.round(it.progress * 100) + '%"></i></span>' : "";
      return '<div class="tile show"><div class="face">' +
        (art ? '<img src="' + esc(art) + '" alt="" decoding="async">' : '<span class="no-art">' + esc(it.title) + "</span>") +
        badge + bar + '</div><div class="caption"><b>' + esc(it.title) + "</b><span>" + esc(subtitle(it)) + "</span></div></div>";
    }).join("");
    shelfEls = Array.prototype.slice.call(track.children);
  }

  function setKeepWatching(on) {
    KW_ON = !!on;
    ST.keep_watching = KW_ON;
    saveSettings();
    renderShelf();
    renderNp();
    if (!KW_ON && zone === "shelf") { zone = gridEls.length ? "grid" : "quick"; g = 0; paintFocus(); }
  }

  // ---------------- apps ----------------
  function tucked(a) {
    return TUCKED.indexOf(a.package) >= 0 || TUCKED_NAMES.test(a.name || "");
  }
  function isNew(pkg) { return newApps.indexOf(pkg) >= 0; }
  // The TV's apps less the ones hidden in Home settings (they come back from the Apps list there).
  function shownApps() { return data.apps.filter(function (a) { return HIDDEN_TV.indexOf(a.package) < 0; }); }
  // The gear tile: always there, whatever the TV calls its own settings app. OK opens a small menu,
  // Home settings (this page's own) or TV settings (Android's).
  function gearItem() { return { kind: "gear", name: t("settings"), package: SETTINGS_PKG }; }
  function moreItem() { return { kind: "more", name: t("more_apps") }; }
  // Smart home (optional, smarthome.js): its tile sits just before the gear tile, only when
  // config.json has a home_assistant section with rooms or scenes. Otherwise nothing changes.
  function smartOn() { return !!(window.smartHome && window.smartHome.available()); }
  function smartItem() { return { kind: "smart", name: t("smart_home"), package: "smart:home" }; }
  // The Settings tile is gone from the dock: the gear button at the top left (#qgear) opens the same
  // menu, so the row holds only apps (and Smart home, when it is set up).
  function toolItems() { return smartOn() ? [smartItem()] : []; }
  function gridList() {
    if (NIGHT) return dockList();
    var apps = shownApps().filter(function (a) { return a.package !== SETTINGS_PKG; });
    var list = apps.filter(function (a) { return !tucked(a); });
    var extra = apps.filter(tucked);
    data.screens.forEach(function (sc) { list.push({ kind: "screen", id: sc.id, name: sc.name, ready: sc.ready, note: sc.note }); });
    var tools = toolItems();
    if (expanded) return list.concat(extra, tools);
    if (extra.length || list.length > GRID_MAX - tools.length) {
      list = list.slice(0, GRID_MAX - 1 - tools.length).concat(tools, [moreItem()]);
    } else list = list.concat(tools);
    return list;
  }

  // Night: a dock of the first ten apps (home.dock_size), then Settings, then More apps (which shows
  // everything, the App Store first). The order and the More apps line come from Arrange apps on the
  // phone, or from moving apps with the TV remote (hold OK), once one is saved.
  function arrangeItems() {
    var rest = shownApps().filter(function (a) { return a.package !== SETTINGS_PKG && a.package !== STORE_PKG; });
    var screens = data.screens.map(function (sc) {
      return { kind: "screen", id: sc.id, name: sc.name, ready: sc.ready, note: sc.note, package: "screen:" + sc.id };
    });
    var items = rest.filter(function (a) { return !tucked(a); }).concat(screens, rest.filter(tucked));
    var line = Math.min(DOCK_APPS, rest.filter(function (a) { return !tucked(a); }).length);
    var o = data.order;
    if (o && o.saved) {
      var at = {};
      o.packages.forEach(function (p, i) { at[p] = i; });
      var known = items.filter(function (it) { return at[it.package] !== undefined; })
        .sort(function (a, b) { return at[a.package] - at[b.package]; });
      var gained = items.filter(function (it) { return at[it.package] === undefined; });   // new apps go below the line
      items = known.concat(gained);
      // the line counts the apps above it that this TV still has
      var above = o.packages.slice(0, o.line).filter(function (p) { return known.some(function (it) { return it.package === p; }); }).length;
      line = Math.min(DOCK_APPS, above);
    }
    return { items: items, line: line };
  }

  function dockList() {
    var store = data.apps.filter(function (a) { return a.package === STORE_PKG; })[0];
    var arr = arrangeItems();
    var list = expanded ? arr.items.slice() : arr.items.slice(0, arr.line);
    if (expanded && store) list.unshift({ kind: "app", store: true, name: t("app_store"), package: STORE_PKG, id: store.id });
    list = list.concat(toolItems());
    // the 3-dot "More apps" tile is gone: a floating down arrow expands the dock instead
    return list;
  }

  // Tell the bridge which apps this TV has (in its default order), so the phone can arrange them.
  var reported = "";
  function reportApps() {
    if (!NIGHT || MOCK || PREVIEW || !data.apps.length) return;
    var saved = data.order;
    data.order = null;   // the default order, not the arranged one
    var arr = arrangeItems();
    data.order = saved;
    var payload = { apps: arr.items.map(function (it) { return { package: it.package, name: it.name }; }), line: arr.line };
    var key = JSON.stringify(payload);
    if (key === reported) return;
    api("POST", "/api/home-apps", payload).then(function () { reported = key; }, function () {});
  }

  // ---------------- moving apps with the TV remote ----------------
  // The arrangement as it is on screen, written down as a saved order, so it can be changed.
  function materialise() {
    var arr = arrangeItems();
    data.order = { saved: true, line: arr.line, packages: arr.items.map(function (it) { return it.package; }) };
    return arr;
  }
  // Saved through the bridge (the phone's Arrange apps reads the same order), or on this TV with no
  // bridge. A TV-only order is marked pending and handed to the bridge the next time it answers.
  function persistOrder() {
    var o = data.order;
    var local = { line: o.line, packages: o.packages, pending: true };
    keep("tvhome.order.tv", local);
    save();
    if (OFFLINE || data.bridge === false) return;
    api("POST", "/api/app-order", { order: o.packages, line: o.line })
      .then(function () { local.pending = false; keep("tvhome.order.tv", local); }, function () {});
  }
  function nameOf(pkg) {
    var it = arrangeItems().items.filter(function (x) { return x.package === pkg; })[0];
    return it ? it.name : t("that_app");
  }
  var hintTimer = null, hintFlash = "";
  function renderHint() {
    var text = hintFlash ||
      (zone === "clockbar" ? "" :
        lift ? t("app_lift_hint") :
        zone === "qgear" ? t("qgear_hint") :
        zone === "clock" ? t("ck_hint_clock") :
        NIGHT && expanded && zone === "grid" ? t("app_add_hint") : "");
    $("hint").textContent = text;
    $("hint").classList.toggle("on", !!text);
    document.documentElement.classList.toggle("hinting", !!text);
  }
  function flash(text) {
    clearTimeout(hintTimer);
    hintFlash = text;
    renderHint();
    hintTimer = setTimeout(function () { hintFlash = ""; renderHint(); }, 4000);
  }
  // Holding OK on a dock app opens a small menu (Move, Hide, Uninstall, App info). "Move" is the
  // old pick-up-to-reorder behaviour, now in startMove(). Store/gear/smart/screen tiles stay put.
  function holdApp() {
    var a = gridItems[g];
    if (!a || a.kind === "more") return false;
    if (a.store || a.kind === "gear" || a.kind === "smart" || a.kind === "screen") { flash(t("stays_put", { name: a.name })); return true; }
    if (a.kind !== "app") return startMove();
    openAppMenu(a);
    return true;
  }

  // ---------------- hold-OK app menu ----------------
  var amI = 0, amItems = [], amApp = null;
  function openAppMenu(a) {
    amApp = a; amI = 0;
    amItems = [{ act: "move", label: t("ctx_move") }, { act: "hide", label: t("ctx_hide") }];
    if (TV && TV.uninstall) amItems.push({ act: "uninstall", label: t("ctx_uninstall") });
    if (TV && TV.appInfo) amItems.push({ act: "info", label: t("ctx_info") });
    zone = "appmenu";
    renderAppMenu();
  }
  function renderAppMenu() {
    var pop = $("app-pop");
    pop.innerHTML = amItems.map(function (it, i) {
      return '<div class="grow' + (i === amI ? " focus" : "") + '" role="menuitem"><span><b>' + esc(it.label) + "</b></span></div>";
    }).join("");
    pop.classList.add("on");
    document.documentElement.classList.add("apping");
    hintFlash = t("ctx_hint"); renderHint();
    var el = gridEls[g], rem = innerWidth / 120;
    if (el) {
      var b = el.getBoundingClientRect(), w = pop.offsetWidth;
      pop.style.left = Math.max(5 * rem, Math.min(innerWidth - w - 5 * rem, b.left + b.width / 2 - w / 2)) + "px";
      pop.style.top = Math.max(3.75 * rem, b.top - pop.offsetHeight - 2.25 * rem) + "px";
    }
  }
  function closeAppMenu() {
    $("app-pop").classList.remove("on");
    document.documentElement.classList.remove("apping");
    hintFlash = "";
    if (zone === "appmenu") zone = "grid";
  }
  function doAppMenu() {
    var it = amItems[amI], a = amApp;
    closeAppMenu();
    if (!it || !a) { paintFocus(); return; }
    if (it.act === "move") { startMove(); return; }
    if (it.act === "hide") {
      materialise();
      var o = data.order, i = o.packages.indexOf(a.package);
      if (i >= 0) { if (i < o.line) o.line -= 1; o.packages.splice(i, 1); }
      setHidden(HIDDEN_TV.concat([a.package]));
      persistOrder();
      renderGrid();
      g = Math.max(0, Math.min(g, gridEls.length - 1));
      paintFocus();
      flash(t("ctx_hidden"));
      return;
    }
    if (it.act === "uninstall") { try { TV.uninstall(a.package); } catch (e) {} paintFocus(); return; }
    if (it.act === "info") { try { TV.appInfo(a.package); } catch (e) {} paintFocus(); return; }
    paintFocus();
  }

  // Pick an app up to move it (the old hold-OK behaviour), reached from the menu's "Move".
  function startMove() {
    var a = gridItems[g];
    if (!a) return false;
    var arr = arrangeItems();
    var idx = arr.items.map(function (it) { return it.package; }).indexOf(a.package);
    if (idx < 0) return false;
    if (!expanded) {
      materialise();
      lift = { pkg: a.package };
      hintFlash = "";
      renderGrid(); paintFocus();
      return true;
    }
    if (idx < arr.line) { flash(t("already_home", { name: a.name })); return true; }
    // More apps: add it to the end of the dock; a full dock sends its last app behind More apps
    var o = materialise() && data.order, msg = t("now_home", { name: a.name });
    o.packages.splice(idx, 1);
    if (o.line < DOCK_APPS) { o.packages.splice(o.line, 0, a.package); o.line += 1; }
    else {
      o.packages.splice(o.line - 1, 0, a.package);
      msg += " " + t("moved_more", { name: nameOf(o.packages[o.line]) });
    }
    persistOrder();
    expanded = false;
    renderGrid();
    g = o.packages.indexOf(a.package);
    paintFocus();
    flash(msg);
    return true;
  }
  function moveLift(dx, dy) {
    var o = data.order, i = o.packages.indexOf(lift.pkg);
    if (dx) {
      var j = i + dx;
      if (j >= 0 && j < o.line) { o.packages[i] = o.packages[j]; o.packages[j] = lift.pkg; g = j; }
    } else if (dy > 0) {   // behind More apps: first in line there
      var name = nameOf(lift.pkg);
      o.packages.splice(i, 1);
      o.packages.splice(o.line - 1, 0, lift.pkg);
      o.line -= 1;
      lift = null;
      persistOrder();
      renderGrid();
      g = Math.min(i, gridEls.length - 1);
      flash(t("moved_more", { name: name }));
    }
    renderGrid();
    paintFocus();
  }
  function dropLift() {
    lift = null;
    persistOrder();
    renderGrid();
    paintFocus();
    flash(t("saved"));
  }

  // Apps installed since this TV first listed its apps: the end of the dock when there is room,
  // otherwise first behind More apps, with a New dot until opened once.
  function detectNew() {
    if (!data.apps.length) return;
    var pk = data.apps.filter(function (a) { return a.package !== SETTINGS_PKG && a.package !== STORE_PKG; })
      .map(function (a) { return a.package; });
    var seen = kept("tvhome.apps.seen");
    if (!seen) { keep("tvhome.apps.seen", pk); return; }
    var fresh = pk.filter(function (p) { return seen.indexOf(p) < 0; });
    if (!fresh.length) return;
    keep("tvhome.apps.seen", seen.concat(fresh));
    newApps = newApps.concat(fresh.filter(function (p) { return newApps.indexOf(p) < 0; }));
    keep("tvhome.apps.new", newApps);
    if (!NIGHT) return;
    materialise();
    var o = data.order;
    fresh.forEach(function (p) {
      var app = data.apps.filter(function (a) { return a.package === p; })[0];
      var i = o.packages.indexOf(p);
      if (i < 0 || i < o.line || (app && tucked(app))) return;
      o.packages.splice(i, 1);
      o.packages.splice(o.line, 0, p);
      if (o.line < DOCK_APPS) o.line += 1;
    });
    persistOrder();
  }
  function opened(pkg) {
    if (!isNew(pkg)) return;
    newApps = newApps.filter(function (p) { return p !== pkg; });
    keep("tvhome.apps.new", newApps);
    renderGrid();
  }

  function dockHTML(it) {
    var face;
    if (it.kind === "screen") face = '<div class="face tool">' + ICONS.screen + "</div>";
    else if (it.kind === "more") face = '<div class="face tool">' + ICONS.more + "</div>";
    else if (it.kind === "gear") face = '<div class="face tool">' + ICONS.gear + "</div>";
    else if (it.kind === "smart") face = '<div class="face tool">' + window.smartHome.icon + "</div>";
    else if (iconUrl(it.package)) face = '<div class="face"><img src="' + esc(iconUrl(it.package)) + '" alt="" decoding="async" onerror="this.parentNode.className=\'face word\';this.parentNode.textContent=this.getAttribute(\'data-name\')" data-name="' + esc(it.name) + '"></div>';
    else if (it.store) face = '<div class="face tool">' + ICONS.store + "</div>";
    else face = '<div class="face word">' + esc(it.name) + "</div>";
    var cls = "tile app dock-ic" + (lift && it.package === lift.pkg ? " lifted" : "");
    return '<div class="' + cls + '">' + face + dotHTML(it) + '<div class="label">' + esc(it.name) + "</div></div>";
  }

  function appHTML(it) {
    if (NIGHT) return dockHTML(it);
    var face;
    if (it.kind === "screen") face = '<div class="face tool">' + ICONS.screen + "</div>";
    else if (it.kind === "more") face = '<div class="face tool">' + ICONS.more + "</div>";
    else if (it.kind === "gear") face = '<div class="face tool">' + ICONS.gear + "</div>";
    else if (it.kind === "smart") face = '<div class="face tool">' + window.smartHome.icon + "</div>";
    else if (it.banner) face = '<div class="face"><img src="' + esc(it.banner) + '" alt="" decoding="async"></div>';
    else if (iconUrl(it.package)) face = '<div class="face icon" style="background:' + esc(it.colour || "#2a2a30") + '"><img src="' + esc(iconUrl(it.package)) + '" alt=""></div>';
    else face = '<div class="face word" style="background:' + esc(it.colour || "#2a2a30") + '">' + esc(it.name) + "</div>";
    return '<div class="tile app">' + face + dotHTML(it) + '<div class="label">' + esc(it.name) + "</div></div>";
  }
  // The small blue dot: an app not opened yet, or (on the gear tile) a new couch-tv release.
  function dotHTML(it) {
    if (false && isNew(it.package)) return '<i class="dot" aria-label="' + esc(t("new_app")) + '"></i>';
    if (it.kind === "gear" && updReady()) return '<i class="dot" aria-label="' + esc(t("upd_gear", { v: UPD.latest })) + '"></i>';
    return "";
  }

  function renderGrid() {
    document.documentElement.classList.toggle("expanded", expanded);
    document.documentElement.classList.toggle("lifting", !!lift);
    gridItems = gridList();
    if (NIGHT) {
      // the dock is as wide as what is in it; More apps uses all twelve columns
      GRID_COLS = expanded ? 12 : Math.max(1, Math.min(12, gridItems.length));
      $("grid").style.gridTemplateColumns = "repeat(" + GRID_COLS + ", 7rem)";
    }
    $("grid").innerHTML = gridItems.map(appHTML).join("");
    gridEls = Array.prototype.slice.call($("grid").children);
    clearIcons();
    renderHint();
    var _arr = arrangeItems();
    var _arrow = $("dock-arrow");
    if (_arrow) _arrow.classList.toggle("on", !expanded && _arr.items.length > _arr.line);
  }

  // Glass app icons, Apple's clear style (#25): each icon's glyph without its background
  // (clearicon.js), drawn light on the glass tile. The focused app shows its own icon. An icon that
  // will not split cleanly keeps the grey version (app.css).
  function clearIcons() {
    if (!GLASS_ICONS || !window.ClearIcon) return;
    Array.prototype.forEach.call($("grid").querySelectorAll(".app .face:not(.tool):not(.word) > img"), function (im) {
      var face = im.parentNode, src = im.getAttribute("src");
      if (!src || face.querySelector(".glyph")) return;
      window.ClearIcon.get(src, function (g) {
        if (!g || !face.parentNode || face.querySelector(".glyph")) return;
        var gi = document.createElement("img");
        gi.className = "glyph"; gi.alt = ""; gi.src = g;
        face.appendChild(gi);
        face.classList.add("clear");
      });
    });
  }

  // ---------------- focus ----------------
  function clearFocus() {
    shelfEls.concat(gridEls, quickEls).forEach(function (el) { if (el) el.classList.remove("focus"); });
    var gq = $("qgear"); if (gq) gq.classList.remove("focus");
    positionClockFocus(false);
  }

  function scrollShelf() {
    var track = $("shelf");
    var el = shelfEls[s];
    if (!el) { track.style.transform = ""; return; }
    var step = el.offsetWidth + parseFloat(getComputedStyle(track).columnGap || 0);
    // how many cards fit: three glass cards on the Night look, about five posters on Classic
    var fit = Math.max(1, Math.floor((track.parentNode.clientWidth + step - el.offsetWidth) / step));
    // Night: the row moves on once focus goes past the last card in view; Classic keeps it centred
    var first = NIGHT ? s - fit + 1 : s - 2;
    first = Math.max(0, Math.min(first, shelfEls.length - fit));
    track.style.transform = "translateX(" + (-first * step) + "px)";
  }

  function shelfOn() { return !$("shelf-section").classList.contains("empty"); }

  function paintFocus() {
    if (zone === "settings") { renderSettings(); return; }
    if (zone === "smart") { window.smartHome.paint(); return; }
    if (zone === "clockbar") { clearFocus(); renderCkbar(); return; }   // the drawer carries its own focus
    clearFocus();
    renderHint();
    if (npVisible()) renderNp();   // its buttons carry the focus only while zone is "np"
    if (zone === "clock") {
      // up from the quick buttons: the ring sits round the real digits; OK opens the drawer
      positionClockFocus(true);
      hero(null);
      $("place").style.visibility = "";
      showPhoto();
      renderHint();
      return;
    }
    if (zone === "gear") {
      if (gearAnchor) gearAnchor.classList.add("focus");
      else if (gridEls[g]) gridEls[g].classList.add("focus");
      renderGear();
      return;
    }
    if (zone === "appmenu") { if (gridEls[g]) gridEls[g].classList.add("focus"); renderAppMenu(); return; }
    if (zone === "updask") { renderAsk(); return; }
    if (zone === "menu") { renderMenu(); return; }
    if (zone === "inputs") { if (quickEls[qi]) quickEls[qi].classList.add("focus"); renderInputMenu(); return; }
    if (zone === "np") {
      if (!npReach()) { zone = shelfEls.length ? "shelf" : "grid"; paintFocus(); return; }
      renderNp();
      hero(null);
      $("place").style.visibility = "";
      showPhoto();
      return;
    }
    if (zone === "qgear") {
      var gq = $("qgear"); if (gq) gq.classList.add("focus");
      hero(null);
      $("place").style.visibility = "";
      showPhoto();
      return;
    }
    if (zone === "quick" && quickEls[qi]) {
      quickEls[qi].classList.add("focus");
      hero(null);
      $("place").style.visibility = "";
      showPhoto();
      return;
    }
    if (zone === "shelf" && shelfEls[s]) {
      shelfEls[s].classList.add("focus");
      scrollShelf();
      if (NIGHT) return;   // the cards carry the titles; the photo stays put under the clock
      setBg(data.shows[s].backdrop || data.shows[s].poster, true);
      hero(data.shows[s]);
      $("place").style.visibility = "hidden";
    } else {
      zone = "grid";
      g = Math.max(0, Math.min(g, gridEls.length - 1));
      if (gridEls[g]) gridEls[g].classList.add("focus");
      hero(null);
      $("place").style.visibility = "";
      showPhoto();
      panWall();
    }
    renderHint();
  }

  // The photo drifts the other way as the selection moves along the dock, so the wallpaper answers the
  // remote instead of sitting still (item 7).
  function panWall() {
    var n = gridEls.length, t = n > 1 ? g / (n - 1) : 0.5;
    document.documentElement.style.setProperty("--pan", ((t - 0.5) * -2.6).toFixed(2) + "%");
  }

  function nearestInRow(row, x) {
    var best = row * GRID_COLS, bestD = Infinity;
    for (var i = row * GRID_COLS; i < Math.min(gridEls.length, (row + 1) * GRID_COLS); i++) {
      var b = gridEls[i].getBoundingClientRect();
      var d = Math.abs(b.left + b.width / 2 - x);
      if (d < bestD) { bestD = d; best = i; }
    }
    return best;
  }

  function move(dx, dy) {
    touched = true;
    if (zone === "settings") { setMove(dx, dy); return; }
    if (zone === "smart") { window.smartHome.move(dx, dy); return; }
    if (zone === "gear") { if (dy) { gi = Math.max(0, Math.min(2, gi + dy)); renderGear(); } return; }
    if (zone === "appmenu") { if (dy) { amI = Math.max(0, Math.min(amItems.length - 1, amI + dy)); renderAppMenu(); } return; }
    if (zone === "updask") { if (dy) { ai = Math.max(0, Math.min(1, ai + dy)); renderAsk(); } return; }
    if (zone === "inputs") { if (dy) { inI = Math.max(0, Math.min(inItems.length - 1, inI + dy)); renderInputMenu(); } return; }
    if (zone === "clockbar") { ckMove(dx, dy); return; }
    if (zone === "qgear") {
      if (dx > 0) { zone = "quick"; qi = 0; }
      else if (dy > 0 && gridEls.length) { zone = "grid"; g = 0; }
      paintFocus();
      return;
    }
    if (zone === "clock") {
      // down (or either side) leaves the digits; up stays put, there is nothing above them
      if (dy > 0 || dx) { zone = hasQuick() ? "quick" : "grid"; if (zone === "quick" && dx) qi = dx > 0 ? 0 : quickVisible().length - 1; }
      paintFocus();
      return;
    }
    if (lift) { moveLift(dx, dy); return; }
    // Night with More apps open: the cards step aside, so up and down skip them
    var cards = NIGHT && expanded ? [] : shelfEls;
    if (zone === "menu") {
      if (dx || dy) menuI = Math.max(0, Math.min(SLEEP_CHOICES.length - 1, menuI + (dy || dx)));
      paintFocus();
      return;
    }
    if (zone === "np") {
      if (NIGHT) {
        // the first card of the row: right past the last button goes on to the shows
        if (dx > 0 && npI === 2) { if (cards.length) { zone = "shelf"; s = 0; } }
        else if (dx) npI = Math.max(0, Math.min(2, npI + dx));
        else if (dy < 0) { if (hasQuick()) { zone = "quick"; qi = 0; } }
        else if (dy > 0 && gridEls.length) {
          var nb = $("np").getBoundingClientRect();
          g = nearestInRow(0, nb.left + nb.width / 2);
          zone = "grid";
        }
      } else {
        // Classic: top right, under the quick buttons
        if (dx) npI = Math.max(0, Math.min(2, npI + dx));
        else if (dy < 0) { if (hasQuick()) zone = "quick"; }
        else if (dy > 0) {
          if (cards.length) zone = "shelf";
          else { zone = "grid"; g = Math.min(g, gridEls.length - 1); }
        }
      }
      paintFocus();
      return;
    }
    if (zone === "quick") {
      var nq = quickVisible().length;
      if (dx < 0 && qi === 0) { zone = "qgear"; paintFocus(); return; }
      if (dx) qi = Math.max(0, Math.min(nq - 1, qi + dx));
      else if (dy < 0 && NIGHT) zone = "clock";   // up from the quick buttons: the clock itself
      else if (dy > 0) {
        if (NIGHT && npReach() && !cards.length) { zone = "np"; npI = 2; }
        else if (!NIGHT && npReach()) zone = "np";
        else if (cards.length) zone = "shelf";
        else { zone = "grid"; g = Math.min(GRID_COLS, gridEls.length) - 1; }
      }
      paintFocus();
      return;
    }
    if (zone === "shelf") {
      if (dx < 0 && s === 0 && NIGHT && npReach()) { zone = "np"; npI = 2; }
      else if (dx) s = Math.max(0, Math.min(shelfEls.length - 1, s + dx));
      else if (dy < 0) { if (!NIGHT && npReach()) zone = "np"; else if (hasQuick()) { zone = "quick"; qi = 0; } }
      else if (dy > 0 && gridEls.length) {
        // land on the app under the show
        var b = shelfEls[s].getBoundingClientRect();
        g = nearestInRow(0, b.left + b.width / 2);
        zone = "grid";
      }
    } else {
      var row = Math.floor(g / GRID_COLS), lastRow = Math.floor((gridEls.length - 1) / GRID_COLS);
      if (dx) {
        var nx = g + dx;
        if (nx >= 0 && nx < gridEls.length && Math.floor(nx / GRID_COLS) === row) g = nx;
        else if (NIGHT && !expanded && gridEls.length > 1) {
          // one row: right past the last app is the first again, and left past the first the last (item 6)
          if (dx > 0 && g >= gridEls.length - 1) g = 0;
          else if (dx < 0 && g <= 0) g = gridEls.length - 1;
        }
      } else if (dy < 0 && row === 0) {
        zone = "qgear";
      } else if (dy < 0) {
        g -= GRID_COLS;
      } else if (!expanded && dy > 0 && row === lastRow) {
        expanded = true; renderGrid(); g = Math.min(g, gridEls.length - 1); paintFocus(); return;
      } else if (row < lastRow) {
        g = Math.min(g + GRID_COLS, gridEls.length - 1);
      }
    }
    paintFocus();
  }

  // Start on the first app of the row, so Home always lands on an app.
  function startFocus() {
    s = 0; g = 0;
    zone = gridEls.length ? "grid" : shelfEls.length ? "shelf" : "grid";
  }

  function goHome() {
    if (zone === "settings") { setBack(); return; }
    if (zone === "smart") { closeSmart(); paintFocus(); return; }
    if (zone === "clockbar") { closeClockBar(); return; }
    if (zone === "clock") { startFocus(); paintFocus(); return; }
    if (zone === "gear") { closeGear(); paintFocus(); return; }
    if (zone === "appmenu") { closeAppMenu(); paintFocus(); return; }
    if (zone === "updask") { answerAsk(false); return; }   // BACK counts as "I'll check myself"
    if (lift) { dropLift(); return; }   // BACK puts a picked-up app down where it is
    if (zone === "menu") { closeMenu(); paintFocus(); return; }   // BACK just closes the sleep choices
    if (zone === "inputs") { closeInputMenu(); paintFocus(); return; }
    if (expanded) { expanded = false; renderGrid(); }
    startFocus();
    paintFocus();
  }

  // ---------------- actions ----------------
  // A long press of OK (or the Menu key): pick up an app to move it. Returns false when there is
  // nothing to pick up here, and then the press counts as a normal OK.
  function hold() {
    touched = true;
    if (zone === "settings") return setHold();
    if (zone === "clockbar") return true;   // holding OK in the drawer does nothing; a press still acts
    if (zone === "clock") { openClockBar(); return true; }   // hold OK on the clock: the live drawer
    if (zone === "gear" || zone === "smart" || zone === "updask" || zone === "inputs" || zone === "qgear") return false;
    if (lift) { dropLift(); return true; }
    if (zone === "grid" && NIGHT) return holdApp();
    return false;
  }

  function activate() {
    touched = true;
    if (zone === "settings") { setActivate(); return; }
    if (zone === "smart") { window.smartHome.ok(); return; }
    if (zone === "clockbar") { ckActivate(); return; }
    if (zone === "clock") { openClockBar(); return; }
    if (zone === "gear") {
      if (gi === 0) openSettings();
      else if (gi === 1) openTvSettings();
      else { setKeepWatching(!KW_ON); renderGear(); }
      return;
    }
    if (zone === "appmenu") { doAppMenu(); return; }
    if (zone === "updask") { answerAsk(ai === 0); return; }
    if (lift) { dropLift(); return; }
    if (zone === "menu") { setSleep(SLEEP_CHOICES[menuI]); paintFocus(); return; }
    if (zone === "inputs") { doInputMenu(); paintFocus(); return; }
    if (zone === "np") { npPress(); return; }
    if (zone === "qgear") { openGear(true); return; }
    if (zone === "quick") { quickAction(); return; }
    if (zone === "shelf") {
      var it = data.shows[s];
      if (!it) return;
      status(it.app ? t("opening_in", { title: it.title, app: it.app.name }) : t("opening", { title: it.title }), true);
      if (it.wn && TV && TV.openWatchNext) {
        if (!TV.openWatchNext(String(it.id)) && it.app) TV.launch(it.app.package);
        status("");
        return;
      }
      api("POST", "/api/continue/open", { id: it.id }, 60000)
        .then(function (res) { status(res.note || ""); })
        .catch(function (e) {
          // the bridge can't help: at least open the app it was in
          if (TV && it.app && TV.launch(it.app.package)) { status(""); return; }
          status(e.message);
        });
      return;
    }
    var a = gridItems[g], el = gridEls[g];
    if (!a) return;
    if (a.kind === "more") { expanded = true; renderGrid(); paintFocus(); return; }
    if (a.kind === "gear") { openGear(); return; }
    if (a.kind === "smart") { openSmart(); return; }
    if (a.kind === "screen") {
      if (!a.ready) { status(a.note || t("screen_not_set")); return; }
      el.classList.add("busy");
      api("POST", "/api/screens/open", { id: a.id }, 10000)
        .then(function (res) { status(res.note || ""); })
        .catch(function (e) {
          if (TV && TV.launch("com.limelight")) { status(""); return; }
          status(e.message);
        })
        .then(function () { el.classList.remove("busy"); });
      return;
    }
    opened(a.package);
    // the app starts straight away (the launch transition was removed)
    if (TV && TV.launch(a.package)) return;
    api("POST", "/api/launch", { app: a.id || a.package }).catch(function (e) { status(e.message); });
  }

  // ---------------- Smart home: the rooms and scenes screen (smarthome.js) ----------------
  function openSmart() { zone = "smart"; clearFocus(); window.smartHome.open(); }
  function closeSmart() { window.smartHome.close(); zone = "grid"; }

  // ---------------- the gear tile's menu: Home settings or the TV's own settings ----------------
  var gi = 0, gearAnchor = null;
  function openGear(fromQuick) {
    gearAnchor = fromQuick ? $("qgear") : null;
    zone = "gear"; gi = 0;
    renderGear();
  }
  function renderGear() {
    var pop = $("gear-pop");
    var items = [[ICONS.sliders, t("gear_home"), updReady() ? t("upd_gear", { v: UPD.latest }) : t("gear_home_sub")],
      [ICONS.gear, t("gear_tv"), t("gear_tv_sub")],
      [ICONS.eye, t("gear_kw"), KW_ON ? t("gear_kw_on") : t("gear_kw_off")]];
    pop.innerHTML = items.map(function (it, i) {
      return '<div class="grow' + (i === gi ? " focus" : "") + '" role="menuitem"><i>' + it[0] + "</i><span><b>" + esc(it[1]) +
        "</b><small>" + esc(it[2]) + "</small></span></div>";
    }).join("");
    pop.classList.add("on");
    document.documentElement.classList.add("gearing");
    // under the button it came from, kept inside the screen's safe area
    var el = gearAnchor || gridEls[g], rem = innerWidth / 120;
    if (el) {
      var b = el.getBoundingClientRect(), w = pop.offsetWidth;
      pop.style.left = Math.max(5 * rem, Math.min(innerWidth - w - 5 * rem, b.left + b.width / 2 - w / 2)) + "px";
      pop.style.top = gearAnchor ? (b.bottom + 1.25 * rem) + "px" : Math.max(3.75 * rem, b.top - pop.offsetHeight - 2.25 * rem) + "px";
    }
  }
  function closeGear() {
    $("gear-pop").classList.remove("on");
    document.documentElement.classList.remove("gearing");
    if (zone === "gear") zone = gearAnchor ? "qgear" : "grid";
    gearAnchor = null;
  }
  // Android's own settings: the Settings app where the TV has one, else the system settings screen.
  function openTvSettings() {
    closeGear();
    paintFocus();
    var done = false;
    // The app on the TV knows its own Settings app: Fire OS does not answer the standard intent with
    // a usable screen. Older builds and the browser fall back to the package name, then the intent.
    try { done = !!(TV && TV.openTvSettings && TV.openTvSettings()); } catch (e) {}
    if (!done) {
      try { done = !!(TV && ((TV.launch && TV.launch(SETTINGS_PKG)) || (TV.openSettings && TV.openSettings()))); } catch (e) {}
    }
    if (done) return;
    if (OFFLINE) { status(t("tv_settings_none")); return; }
    api("POST", "/api/launch", { app: "settings" }).catch(function () { status(t("tv_settings_none")); });
  }

  // ---------------- Home settings: couch-tv's own settings screen ----------------
  // A tvOS style list: the sections on the left, their rows on the right. Up and down move, OK
  // changes a row, holding OK picks a row up to move it (scenes, apps, quick buttons), Back
  // goes back a step and then closes. What is saved, and which copy wins: docs/CONFIG.md.
  // Saved on this TV (page storage and the launcher's own store, TVOS.keep) and, with a bridge,
  // also on the computer (/api/settings), so the phone and the TV agree.
  var ST_KEY = "tvhome.settings";
  // The order asked for (item 4): Looks and Scenes, Quick buttons, Apps, Weather, Location, Language,
  // Updates (added in start() when the launcher can update itself), About.
  var SECS = [["look", "look"], ["clock", "clock"], ["quick", "bolt"], ["apps", "apps"], ["weather", "cloud"],
    ["location", "pin"], ["language", "globe"], ["about", "info"]];
  var SET = { col: "secs", sec: 0, ri: 0, keyFocus: null, sub: null, lift: null, confirm: null, dirty: false, typing: null,
    msg: "", geo: { q: "", list: null, busy: false, err: false } };
  var REPO_URL = "github.com/Seagey/couch-tv";
  var WX_DEFAULT = { lat: -33.8688, lon: 151.2093, place: "Sydney", timezone: "Australia/Sydney" };
  var pushTimer = null;

  function loadSettings() {
    var r = kept(ST_KEY);
    return r && r.s && typeof r.s === "object" && !Array.isArray(r.s) ? r.s : {};
  }
  function keepSettings(pending) {
    var rec = { s: ST, updated: Date.now(), pending: pending };
    keep(ST_KEY, rec);
    return rec;
  }
  function pushSettings(rec) {
    return api("POST", "/api/settings", { settings: rec.s })
      .then(function () { rec.pending = false; keep(ST_KEY, rec); }, function () {});
  }
  // Kept on this TV straight away; handed to the bridge a moment later (pending until it has it).
  function saveSettings() {
    var rec = keepSettings(true);
    // Only a change made on the settings screen restarts the page when it closes; the clock drawer
    // applies everything live, so closing Home settings afterwards should not reload the home.
    if (zone === "settings") SET.dirty = true;
    if (OFFLINE || data.bridge === false) return;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(function () { pushSettings(rec); }, 400);
  }
  // Same content, whatever order the keys came back in.
  function canon(v) {
    if (Array.isArray(v)) return "[" + v.map(canon).join(",") + "]";
    if (v && typeof v === "object") return "{" + Object.keys(v).sort().map(function (k) { return JSON.stringify(k) + ":" + canon(v[k]); }).join(",") + "}";
    return JSON.stringify(v);
  }
  // On every refresh with the bridge: a change made here while the computer was off goes to the
  // bridge; otherwise the bridge's copy comes back (this TV's storage was cleared, say).
  function syncSettings() {
    return api("GET", "/api/settings").then(function (j) {
      var rec = kept(ST_KEY), remote = j.settings && typeof j.settings === "object" && !Array.isArray(j.settings) ? j.settings : null;
      if (rec && rec.pending) return pushSettings(rec);
      if (!remote || (!j.updated && !Object.keys(remote).length)) {   // the bridge has none yet: it gets ours
        if (Object.keys(ST).length) return pushSettings(keepSettings(true));
        return null;
      }
      if (canon(remote) === canon(ST)) return null;
      ST = remote;
      keepSettings(false);
      if (zone !== "settings") restart();
      return null;
    });
  }

  function staticText() {
    $("shelf-title").textContent = t("keep_watching");
    $("apps-section").setAttribute("aria-label", t("apps"));
    $("settings").setAttribute("aria-label", t("set_title"));
  }

  function openSettings() {
    closeGear();
    zone = "settings";
    SET.col = "secs"; SET.sec = 0; SET.ri = 0; SET.keyFocus = null; SET.sub = null; SET.lift = null; SET.confirm = null; SET.msg = "";
    clearFocus();
    $("settings").classList.add("on");
    document.documentElement.classList.add("setting");
    renderSettings();
  }
  // Closing starts the page again when anything changed, so the look, scenes and words all agree.
  function closeSettings() {
    if (SET.typing) stopTyping();
    if (SET.lift) dropRow();
    $("settings").classList.remove("on");
    document.documentElement.classList.remove("setting");
    zone = "grid";
    if (SET.dirty) { SET.dirty = false; restart(); return; }
    paintFocus();
  }

  // ---- rows ----
  function rowsNow() { return SET.sub ? SET.sub.rows() : sectionRows(SECS[SET.sec][0]); }
  function focusable(r) { return !!r && r.kind !== "head" && r.kind !== "info"; }
  function firstRow(rows) { for (var i = 0; i < rows.length; i++) if (focusable(rows[i])) return i; return -1; }
  function stepRow(rows, i, d) { for (var j = i + d; j >= 0 && j < rows.length; j += d) if (focusable(rows[j])) return j; return i; }
  function indexOfKey(rows, k) { for (var i = 0; i < rows.length; i++) if (rows[i].key === k) return i; return -1; }
  function head(label) { return { kind: "head", key: "h:" + label, label: label }; }
  function info(key, label, value, sub) { return { kind: "info", key: key, label: label, value: value, sub: sub }; }

  function sectionRows(id) {
    if (id === "updates") return updateRows();
    if (id === "language") return languageRows();
    if (id === "location") return locationRows();
    if (id === "weather") return weatherRows();
    if (id === "look") return lookRows();
    if (id === "clock") return clockRows();
    if (id === "apps") return appsRows();
    if (id === "quick") return quickRows();
    return aboutRows();
  }

  function languageRows() {
    var L = window.I18N;
    var rows = L ? L.langs.map(function (l) {
      return { kind: "choice", key: "lang:" + l.id, label: l.name, lang: l.locale, checked: L.lang() === l.id, act: function () {
        ST.lang = l.id; L.set(l.id); saveSettings(); staticText();
        if (CLOCK24 !== clock24()) { CLOCK24 = !CLOCK24; glassShown = ""; clock(); }
      } };
    }) : [];
    rows.push(info("lang-note", t("lang_note")));
    return rows;
  }

  // ---- location: Open-Meteo's place search (free, no key) ----
  var geoTimer = null, geoTicket = 0;
  function locationRows() {
    var geo = SET.geo;
    var rows = [info("loc-now", t("loc_now"), WXCFG.place || t("loc_unset"), WXCFG.timezone && WXCFG.timezone !== "auto" ? WXCFG.timezone : "")];
    rows.push({ kind: "input", key: "loc-search", label: t("loc_search"), value: geo.q, act: function () {
      startTyping({ label: t("loc_type"), value: geo.q, search: true,
        live: function (q) { findPlaces(q, false); }, submit: function (q) { findPlaces(q, true); } });
    } });
    if (geo.busy) rows.push(info("loc-busy", t("loc_searching")));
    else if (geo.err) rows.push(info("loc-err", t("loc_error")));
    else if (geo.list && !geo.list.length) rows.push(info("loc-none", t("loc_none", { q: geo.q })));
    if (geo.list && geo.list.length) {
      rows.push(head(t("loc_results")));
      geo.list.forEach(function (p, i) {
        rows.push({ kind: "choice", key: "place:" + i, label: p.name, sub: p.area,
          checked: !!(ST.place && ST.place.lat === p.lat && ST.place.lon === p.lon), act: function () { choosePlace(p); } });
      });
    }
    if (ST.place) {
      rows.push({ kind: "action", key: "loc-reset", label: t("loc_reset"), act: function () {
        delete ST.place;
        WXCFG = CFG.weather || WX_DEFAULT;
        saveSettings();
        SET.msg = t("loc_set", { place: WXCFG.place || "" });
      } });
    }
    rows.push(info("loc-note", t("loc_note")));
    return rows;
  }
  // In the home's language. A language with a country of its own (Italian: Italy) asks there too and
  // lists those places first, so the small towns are not lost among bigger places abroad, while
  // "Londra" still finds London. Either search may fail on its own.
  function geocode(q) {
    var L = window.I18N, lang = (L ? L.lang() : "en").slice(0, 2), home = L ? L.country() : "";
    var url = "https://geocoding-api.open-meteo.com/v1/search?count=8&format=json&language=" + lang + "&name=" + encodeURIComponent(q);
    var get = function (u) {
      return fetch(u).then(function (r) { if (!r.ok) throw new Error("place search " + r.status); return r.json(); })
        .then(null, function () { return null; });
    };
    return Promise.all(home ? [get(url + "&countryCode=" + home), get(url)] : [get(url)]).then(function (js) {
      if (!js.some(Boolean)) throw new Error("place search");
      var seen = {}, out = [];
      js.forEach(function (j) {
        ((j && j.results) || []).forEach(function (r) {
          if (!isFinite(r.latitude) || !isFinite(r.longitude) || seen[r.id]) return;
          seen[r.id] = true;
          out.push(r);
        });
      });
      return out.slice(0, 10).map(function (r) {
        // two decimals is about a kilometre: the town, never the house
        return { name: r.name, area: placeArea(r, home),
          lat: Math.round(r.latitude * 100) / 100, lon: Math.round(r.longitude * 100) / 100, timezone: r.timezone || "auto" };
      });
    });
  }
  // What tells places with the same name apart: the municipality it belongs to (Italy: the comune),
  // then the province or county, then the region or state, and the country unless it is the
  // language's own. Each one only once, and not when it is the place's own name.
  function placeArea(r, home) {
    var out = [];
    [r.admin3, r.admin2, r.admin1].forEach(function (a) {
      a = String(a || "").trim();
      if (a && a.replace(/^Comune di /, "") !== r.name && out.indexOf(a) < 0) out.push(a);
    });
    if (r.country && r.country_code !== home) out.push(r.country);
    return out.join(", ");
  }
  // While typing: a search half a second after the last key. OK: straight away, then onto the first place.
  function findPlaces(q, go) {
    clearTimeout(geoTimer);
    q = (q || "").trim();
    SET.geo.q = q;
    if (q.length < 2) {
      SET.geo = { q: q, list: null, busy: false, err: false };
      if (zone === "settings") renderSettings();
      return;
    }
    var run = function () {
      var ticket = ++geoTicket;
      SET.geo.busy = true; SET.geo.err = false;
      if (zone === "settings") renderSettings();
      geocode(q).then(function (list) {
        if (ticket !== geoTicket) return;
        SET.geo = { q: q, list: list, busy: false, err: false };
        if (go && list.length && !SET.typing) { SET.col = "rows"; SET.keyFocus = "place:0"; }
        if (zone === "settings") renderSettings();
      }, function () {
        if (ticket !== geoTicket) return;
        SET.geo = { q: q, list: null, busy: false, err: true };
        if (zone === "settings") renderSettings();
      });
    };
    if (go) run(); else geoTimer = setTimeout(run, 500);
  }
  function choosePlace(p) {
    ST.place = { name: p.name, lat: p.lat, lon: p.lon, timezone: p.timezone };
    WXCFG = { lat: p.lat, lon: p.lon, place: p.name, timezone: p.timezone };
    saveSettings();
    SET.msg = t("loc_set", { place: p.name });
    data.weather = null;
    refreshWeather();
  }

  // ---- weather ----
  function weatherRows() {
    return [
      { kind: "toggle", key: "wx-show", label: t("wx_show"), value: WX_SHOW ? t("on") : t("off"), act: function () {
        WX_SHOW = !WX_SHOW; ST.wx_show = WX_SHOW; saveSettings();
        if (WX_SHOW) refreshWeather();
        ambientSync();
        clock();
      } },
      { kind: "toggle", key: "wx-effects", label: t("wx_effects"), sub: t("wx_effects_sub"), value: WX_EFFECTS ? t("on") : t("off"), act: function () {
        WX_EFFECTS = !WX_EFFECTS; ST.weather_effects = WX_EFFECTS; saveSettings(); ambientSync();
      } },
      { kind: "cycle", key: "wx-effect-type", label: t("wx_effect_type"), value: t("wx_effect_" + WX_EFFECT_TYPE), act: function () {
        var opts = ["auto","rain","snow","fog","storm","clear"];
        var i = opts.indexOf(WX_EFFECT_TYPE);
        WX_EFFECT_TYPE = opts[(i + 1) % opts.length];
        ST.weather_effect = WX_EFFECT_TYPE; saveSettings(); ambientSync();
      }, adjust: function (d) {
        var opts = ["auto","rain","snow","fog","storm","clear"];
        var i = opts.indexOf(WX_EFFECT_TYPE);
        i = (i + d + opts.length) % opts.length;
        WX_EFFECT_TYPE = opts[i];
        ST.weather_effect = WX_EFFECT_TYPE; saveSettings(); ambientSync();
      } },
      { kind: "toggle", key: "wx-sun-grade", label: t("wx_sun_grade"), sub: t("wx_sun_grade_sub"), value: WX_SUN_GRADE ? t("on") : t("off"), act: function () {
        WX_SUN_GRADE = !WX_SUN_GRADE; ST.ambient_sun_grade = WX_SUN_GRADE; saveSettings(); ambientSync();
      } },
      { kind: "cycle", key: "wx-unit", label: t("wx_units"), value: WX_F ? "°F (Fahrenheit)" : "°C (Celsius)", act: function () {
        WX_F = !WX_F; ST.wx_unit = WX_F ? "f" : "c"; saveSettings(); clock();
      } },
      { kind: "cycle", key: "wx-every", label: t("wx_every"), value: t("every_min", { n: WX_EVERY }), act: function () {
        WX_EVERY = WX_EVERY === 15 ? 30 : WX_EVERY === 30 ? 60 : 15; ST.wx_every = WX_EVERY; saveSettings();
      } },
      info("wx-provider", t("wx_provider"), "Open-Meteo", t("wx_provider_note")),
      info("wx-night", t("wx_night_only"))
    ];
  }

  // ---- look, scenes and the household's own photos ----
  var SECS_STEPS = [10, 15, 20, 30, 45, 60, 120];
  // The scenes have a page of their own (Look and scenes > Photo scenes): every scene with its tick,
  // in the order they take turns. Keeping them off the Look section leaves it short however many
  // scenes there are, and Back comes straight back to the row that opened it.
  function sceneRows() {
    var st = sceneState(), rows = [];
    st.order.forEach(function (id) {
      var sc = sceneById(id);
      if (!sc) return;
      var label = sc.own ? t("scene_photo", { n: sc.n }) : sc.mine ? sc.name || t("scene_mine", { n: sc.n }) : t("scene_" + id);
      rows.push({ kind: "check", key: "scene:" + id, label: label,
        thumb: sc.own ? sc.src : "backgrounds/" + sc.photo + ".jpg", checked: st.off.indexOf(id) < 0,
        act: function () { toggleScene(id); }, move: function (d) { moveScene(id, d); } });
    });
    return rows;
  }
  function openScenes() {
    var rows = sceneRows();
    SET.sub = { back: "scenes-open", crumb: t("sec_look"), title: function () { return t("scenes_open"); },
      rows: sceneRows };
    SET.keyFocus = rows.length ? rows[0].key : "scenes-open";
  }
  function lookRows() {
    var st = sceneState(), rows = [];
    var on = st.order.filter(function (id) { return st.off.indexOf(id) < 0; }).length;
    rows.push(head(t("scenes_head")));
    rows.push({ kind: "nav", key: "scenes-open", label: t("scenes_open"),
      sub: t("scenes_open_sub", { on: on, all: st.order.length }), act: openScenes });
    var secs = Math.round(SCENE_MS / 1000);
    rows.push({ kind: "cycle", key: "scene-secs", label: t("scene_secs"), value: t("n_secs", { n: secs }), act: function () {
      var i = SECS_STEPS.indexOf(secs), n = i < 0 ? 20 : SECS_STEPS[(i + 1) % SECS_STEPS.length];
      ST.scene_seconds = n; SCENE_MS = n * 1000; saveSettings(); armScenes();
    } });
    rows.push({ kind: "cycle", key: "clock", label: t("clock"), value: CLOCK24 ? t("clock_24") : t("clock_12"), act: function () {
      CLOCK24 = !CLOCK24; ST.clock = CLOCK24 ? "24h" : "12h"; saveSettings(); glassShown = ""; clock();
    } });
    // Keep watching: the row of started shows and films, right under the scene and clock rows
    rows.push(head(t("kw_head")));
    rows.push({ kind: "toggle", key: "keep-watching", label: t("kw_show"), value: KW_ON ? t("on") : t("off"), act: function () {
      setKeepWatching(!KW_ON);
    } });
    rows.push(info("kw-note", t("kw_note")));
    // the TV's own screensaver (Google TV's Ambient mode) and the albums it shows
    rows.push(head(t("ambient_head")));
    rows.push({ kind: "action", key: "ambient", label: t("ambient_settings"), sub: t("ambient_settings_sub"),
      act: function () { openAmbientSettings(); } });
    // glass panels: off, on, on with no blur (for slower TVs)
    rows.push(head(t("glass_head")));
    rows.push({ kind: "cycle", key: "glass", label: t("glass"), value: GLASS === "lite" ? t("glass_lite") : GLASS === "on" ? t("on") : t("off"), act: function () {
      GLASS = GLASS === "off" ? "on" : GLASS === "on" ? "lite" : "off"; ST.glass = GLASS;
      applyGlass(); if (NIGHT) clock();
      saveSettings();
    } });
    rows.push({ kind: "toggle", key: "glass-icons", label: t("glass_icons"), value: GLASS_ICONS ? t("on") : t("off"), act: function () {
      GLASS_ICONS = !GLASS_ICONS; ST.glass_icons = GLASS_ICONS; saveSettings();
      document.documentElement.classList.toggle("glass-icons", GLASS_ICONS);   // seen straight away
      clearIcons();
    } });
    // with glass app icons: the focused app shows its own colours, or stays glass (#32)
    if (GLASS_ICONS) rows.push({ kind: "cycle", key: "glass-focus", label: t("glass_focus"),
      value: GLASS_FOCUS === "glass" ? t("glass_focus_glass") : t("glass_focus_colour"), act: function () {
        GLASS_FOCUS = GLASS_FOCUS === "glass" ? "colour" : "glass"; ST.glass_focus = GLASS_FOCUS; saveSettings();
        document.documentElement.classList.toggle("gi-stay", GLASS_FOCUS === "glass");   // seen straight away
      } });
    // how clear, 1 to 5 (#29): left and right on the row, or OK to step; seen straight away
    var setAmt = function (n) {
      n = Math.max(1, Math.min(5, n));
      if (n === GLASS_AMT) return;
      GLASS_AMT = n; ST.glass_amount = n; glassClasses(); glassShown = ""; saveSettings();
    };
    rows.push({ kind: "slider", key: "glass-amount", label: t("glass_amount"), value: t("glass_amt_" + GLASS_AMT), level: GLASS_AMT,
      adjust: function (dx) { setAmt(GLASS_AMT + dx); }, act: function () { setAmt(GLASS_AMT === 5 ? 1 : GLASS_AMT + 1); } });
    // the Night clock: frosted (the photo's frosted copy) or liquid glass (#25)
    rows.push({ kind: "cycle", key: "clock-style", label: t("clock_style"), value: CLOCK_LIQUID ? t("clock_liquid") : t("clock_frosted"), act: function () {
      CLOCK_LIQUID = !CLOCK_LIQUID; ST.clock_style = CLOCK_LIQUID ? "liquid" : "frosted"; glassClasses(); saveSettings();
    } });
    rows.push(info("glass-note", t("glass_note", { keep: t("keep_watching") }) + " " + t("glass_icons_note") + " " + t("glass_amount_note")));
    // the sound on every arrow and OK (#32): the TV's own, a softer one, or none
    rows.push(head(t("sound_head")));
    rows.push({ kind: "cycle", key: "nav-sound", label: t("nav_sound"), value: t("nav_sound_" + SOUND_STYLE), act: function () {
      SOUND_STYLE = SOUND_STYLE === "system" ? "soft" : SOUND_STYLE === "soft" ? "off" : "system";
      ST.nav_sound = SOUND_STYLE; saveSettings(); blip(0, 0);
    } });
    // the video background: its switch only once there is a link
    rows.push(head(t("video_head")));
    if (VIDEO_URL) {
      var vidOn = typeof ST.video === "boolean" ? ST.video : true;
      rows.push({ kind: "toggle", key: "video", label: t("video"), value: vidOn ? t("on") : t("off"), act: function () {
        ST.video = !vidOn; saveSettings();
      } });
    }
    rows.push({ kind: "input", key: "video-url", label: t("video_url"), sub: VIDEO_URL || t("video_none"), act: function () {
      startTyping({ label: t("video_url_type"), value: VIDEO_URL, url: true, submit: setVideoUrl });
    } });
    if (VIDEO_URL) rows.push({ kind: "action", key: "video-rm", label: t("video_remove"), danger: true, act: function () {
      ST.video_url = ""; VIDEO_URL = ""; ST.video = false; saveSettings();
    } });
    rows.push(info("video-note", t("video_note")));
    // Now playing (#31): the card with the song and its buttons; it needs the computer or the on-TV app
    rows.push(head(t("np_head")));
    rows.push({ kind: "toggle", key: "now-playing", label: t("np_show"), value: NP_ON ? t("on") : t("off"), act: function () {
      NP_ON = !NP_ON; ST.now_playing = NP_ON; saveSettings(); refreshMusic();
    } });
    rows.push(info("np-note", t(OFFLINE ? "np_note_offline" : "np_note")));
    rows.push(head(t("photos_head")));
    if (canPick()) rows.push({ kind: "action", key: "photo-pick", label: t("photos_pick"), sub: t("photos_pick_sub"), act: pickPhotos });
    else rows.push(info("photo-nopick", t("photos_no_pick"), "", t("photos_no_pick_sub")));
    rows.push({ kind: "input", key: "photo-url", label: t("photos_url"), act: function () {
      startTyping({ label: t("photos_url_type"), value: "", url: true, submit: addPhotoUrl });
    } });
    (Array.isArray(ST.photos) ? ST.photos : []).forEach(function (p, i) {
      rows.push({ kind: "action", key: "photo-rm:" + p.id, label: t("photo_remove", { n: i + 1 }), thumb: photoSrc(p), danger: true,
        act: function () { removePhoto(p.id); } });
    });
    rows.push(info("photos-note", t("photos_note")));
    return rows;
  }
  function setScenes(st) {
    ST.scene_order = st.order; ST.scenes_off = st.off;
    saveSettings();
    applyScenes();   // seen at once, and the turn timer is re-armed (item 1)
  }
  function toggleScene(id) {
    var st = sceneState(), i = st.off.indexOf(id);
    if (i >= 0) st.off.splice(i, 1);
    else if (st.order.length - st.off.length <= 1) { SET.msg = t("one_scene"); return; }
    else st.off.push(id);
    setScenes(st);
  }
  function moveScene(id, d) {
    var st = sceneState(), i = st.order.indexOf(id), j = i + d;
    if (i < 0 || j < 0 || j >= st.order.length) return;
    st.order[i] = st.order[j]; st.order[j] = id;
    setScenes(st);
  }
  // The launcher's file picker (Android's "open a document" screen), where the TV has one.
  function canPick() { try { return !!(TV && TV.canPickPhotos && TV.canPickPhotos()); } catch (e) { return false; } }
  function pickPhotos() {
    var ok = false;
    try { ok = !!TV.pickPhotos(); } catch (e) {}
    if (!ok) SET.msg = t("photos_no_pick");
  }
  function uid() { return Date.now().toString(36) + Math.floor(Math.random() * 1296).toString(36); }
  function photosAdded(names) {
    var list = [];
    try { list = typeof names === "string" ? JSON.parse(names) : names || []; } catch (e) { list = []; }
    var photos = Array.isArray(ST.photos) ? ST.photos.slice() : [], n = 0;
    list.forEach(function (f) { if (typeof f === "string" && photos.length < 20) { photos.push({ id: uid(), file: f }); n++; } });
    if (!n) return;
    ST.photos = photos;
    saveSettings();
    SET.msg = n === 1 ? t("photos_added") : t("photos_added_n", { n: n });
    if (zone === "settings") renderSettings();
  }
  // The video background's link: checked by loading it once (muted), like a photo's address.
  function setVideoUrl(u) {
    u = (u || "").trim();
    if (!u) return;
    // a computer at home (typed as its number, or a name ending in .local) is usually plain http
    if (!/^https?:\/\//i.test(u)) u = (/^(\d+\.){3}\d+|^[^\/]+\.local\b/i.test(u) ? "http://" : "https://") + u;
    SET.msg = t("video_checking");
    var v = document.createElement("video"), done = false;
    var finish = function (good) {
      if (done) return;
      done = true;
      clearTimeout(timer);
      v.removeAttribute("src");
      if (good) {
        ST.video_url = u; ST.video = true; VIDEO_URL = u;
        saveSettings();
        SET.msg = t("video_added");
      // Apple's own server (the tvOS aerials) uses a certificate from Apple's private CA, which
      // Android and Chrome do not trust, so its links never load here whatever the format (#27).
      } else SET.msg = t(/^https:\/\/sylvan\.apple\.com\//i.test(u) ? "video_apple" : "video_bad");
      if (zone === "settings") renderSettings();
    };
    var timer = setTimeout(function () { finish(false); }, 20000);
    v.muted = true;
    v.preload = "metadata";
    v.onloadedmetadata = function () { finish(v.videoWidth > 0); };
    v.onerror = function () { finish(false); };
    v.src = u;
  }
  function addPhotoUrl(u) {
    u = (u || "").trim();
    if (!u) return;
    if (!/^https?:\/\//i.test(u)) u = "https://" + u;
    if ((ST.photos || []).length >= 20) { SET.msg = t("photos_full"); return; }
    SET.msg = t("photos_checking");
    var im = new Image(), done = false;
    var finish = function (good) {
      if (done) return;
      done = true;
      clearTimeout(timer);
      if (good) {
        ST.photos = (Array.isArray(ST.photos) ? ST.photos : []).concat([{ id: uid(), url: u }]);
        saveSettings();
        SET.msg = t("photos_added");
      } else SET.msg = t("photos_bad");
      if (zone === "settings") renderSettings();
    };
    var timer = setTimeout(function () { finish(false); }, 20000);
    im.onload = function () { finish(im.naturalWidth > 0); };
    im.onerror = function () { finish(false); };
    im.src = u;
  }
  function removePhoto(id) {
    var p = (ST.photos || []).filter(function (x) { return x.id === id; })[0];
    if (!p) return;
    if (p.file) try { if (TV && TV.removePhoto) TV.removePhoto(p.file); } catch (e) {}
    ST.photos = ST.photos.filter(function (x) { return x.id !== id; });
    saveSettings();
  }

  // ---- apps: the same order as holding OK on the dock, plus hiding ----
  function appsRows() {
    var arr = arrangeItems(), rows = [];
    var hidden = data.apps.filter(function (a) { return HIDDEN_TV.indexOf(a.package) >= 0; });
    if (!arr.items.length && !hidden.length) return [info("apps-none", t("apps_none"))];
    var row = function (it, where) {
      return { kind: "item", key: "app:" + it.package, label: it.name, value: t(where), icon: it.package,
        act: function () { cycleApp(it.package); },
        move: where === "app_hidden" ? null : function (d) { moveAppRow(it.package, d); } };
    };
    rows.push(head(t("apps_home", { n: arr.line, max: DOCK_APPS })));
    arr.items.slice(0, arr.line).forEach(function (it) { rows.push(row(it, "app_on_home")); });
    rows.push(head(t("apps_more")));
    arr.items.slice(arr.line).forEach(function (it) { rows.push(row(it, "app_in_more")); });
    if (hidden.length) {
      rows.push(head(t("apps_hidden")));
      hidden.forEach(function (a) { rows.push(row(a, "app_hidden")); });
    }
    rows.push(info("apps-note", t("apps_note")));
    if (!NIGHT) rows.push(info("apps-classic", t("apps_classic")));
    return rows;
  }
  function setHidden(list) { HIDDEN_TV = list; ST.hidden_apps = list.slice(); saveSettings(); }
  // OK on an app: home, then More apps, then hidden, then back on home (a screen skips hidden).
  function cycleApp(pkg) {
    var h = HIDDEN_TV.indexOf(pkg);
    if (h >= 0) {
      setHidden(HIDDEN_TV.filter(function (p) { return p !== pkg; }));
      materialise();
      appToHome(pkg);
    } else {
      var o = materialise() && data.order, i = o.packages.indexOf(pkg);
      if (i < 0) return;
      if (i < o.line) { o.packages.splice(i, 1); o.line -= 1; o.packages.splice(o.line, 0, pkg); persistOrder(); }
      else if (pkg.indexOf("screen:") === 0) appToHome(pkg);
      else { o.packages.splice(i, 1); setHidden(HIDDEN_TV.concat([pkg])); persistOrder(); }
    }
    SET.dirty = true;
    renderGrid();
  }
  // To the end of the dock; a full dock sends its last app behind More apps (as holding OK does).
  function appToHome(pkg) {
    var o = data.order, i = o.packages.indexOf(pkg);
    if (i >= 0) o.packages.splice(i, 1);
    if (o.line < DOCK_APPS) { o.packages.splice(o.line, 0, pkg); o.line += 1; }
    else {
      o.packages.splice(o.line - 1, 0, pkg);
      SET.msg = t("moved_more", { name: nameOf(o.packages[o.line]) });
    }
    persistOrder();
  }
  // Up and down while an app is picked up; across the line moves it between home and More apps.
  function moveAppRow(pkg, d) {
    var o = data.order, i = o.packages.indexOf(pkg), j = i + d;
    if (i < 0) return;
    var swap = function (a, b) { var x = o.packages[a]; o.packages[a] = o.packages[b]; o.packages[b] = x; };
    if (d > 0 && i === o.line - 1) o.line -= 1;
    else if (d < 0 && i === o.line) { if (o.line < DOCK_APPS) o.line += 1; else swap(i, i - 1); }
    else if (j >= 0 && j < o.packages.length) swap(i, j);
    renderGrid();
  }

  // ---- quick buttons ----
  function quickRows() {
    var on = QUICK.slice(), order = on.concat(QUICK_ALL.filter(function (q) { return on.indexOf(q) < 0; }));
    var rows = order.map(function (q) {
      var enabled = on.indexOf(q) >= 0;
      return { kind: "check", key: "quick:" + q, label: t("quick_" + q), checked: enabled, sub: quickNeeds(q),
        act: function () { toggleQuick(q); }, move: enabled ? function (d) { moveQuick(q, d); } : null };
    });
    rows.push(info("quick-note", t("quick_note")));
    return rows;
  }
  function quickNeeds(q) {
    if (q === "sleep" && OFFLINE) return t("quick_needs_bridge");
    if (q === "picture" && (OFFLINE || !picShown)) return t("quick_needs_picture");
    if (q === "input" && OFFLINE && !nativeInputs()) return t("quick_needs_inputs");
    if (q === "screensaver" && !nativeScreensaver()) return t("quick_needs_tv_app");
    if ((q === "bluetooth" || q === "network") && !nativeSettings() && (!ON_TV || OFFLINE)) return t("quick_needs_tv_app");
    if (q === "connections" && !nativeSettings() && (!ON_TV || OFFLINE)) return t("quick_needs_tv_app");
    return "";
  }
  function setQuick(list) { QUICK = list; ST.quick = list.slice(); saveSettings(); renderQuick(); }
  function toggleQuick(q) {
    var had = QUICK.indexOf(q) >= 0;
    setQuick(had ? QUICK.filter(function (x) { return x !== q; }) : QUICK.concat([q]));
    if (!had && !OFFLINE) refreshQuick().then(function () { if (zone === "settings") renderSettings(); });
  }
  function moveQuick(q, d) {
    var l = QUICK.slice(), i = l.indexOf(q), j = i + d;
    if (i < 0 || j < 0 || j >= l.length) return;
    l[i] = l[j]; l[j] = q;
    setQuick(l);
  }

  // ---- about ----
  function aboutRows() {
    var ver = "";
    try { ver = TV && TV.version ? TV.version() : ""; } catch (e) {}
    var run = ALONE ? "run_alone" : OFFLINE ? "run_off" : data.bridge === false ? "run_quiet" : "run_bridge";
    return [
      info("ver", t("about_version"), ver || t("about_web")),
      info("code", t("about_code"), REPO_URL),
      info("run", t("about_running"), t(run)),
      info("kept", t("about_kept"), t(OFFLINE || data.bridge === false ? "kept_tv" : "kept_both")),
      { kind: "action", key: "reset", label: t("about_reset"), sub: t("about_reset_sub"), danger: true, confirmText: t("confirm_reset"),
        act: resetSettings }
    ];
  }
  // ---- updates: couch-tv's own GitHub releases (the launcher's Updater.kt) ----
  // The launcher looks once a day while the home is on screen (switch below); "Check now" looks
  // straight away. A newer release puts a dot on the gear tile and says so on the home once.
  // Installing always goes through Android's own "update this app?" screen, and keeps every
  // setting. No launcher behind the page (a browser, a Samsung, the on-TV app, an older launcher):
  // no Updates section at all. mock.js stands in for previews (?update=1).
  var UPD = null;
  function upd() { return window.TVUP || window.MOCK_UPDATER || null; }
  function updRead() {
    var u = upd();
    UPD = null;
    try { if (u) UPD = JSON.parse(u.state()); } catch (e) {}
    return UPD;
  }
  function updReady() { return !!(UPD && UPD.available); }
  // the launcher's news: a check finished, a download moved on, the installer answered
  function updChanged(s) {
    var was = updReady();
    UPD = s && typeof s === "object" ? s : updRead();
    if (zone === "settings") renderSettings();
    else if (updReady() !== was) renderGrid();
    updTell();
  }
  // Once per release, a line on the home; the gear tile's dot stays until it is installed.
  function updTell() {
    if (!updReady() || kept("tvhome.update.told") === UPD.latest) return;
    keep("tvhome.update.told", UPD.latest);
    status(t("upd_told", { v: UPD.latest }));
  }
  // Asked once: tell the household about new versions, or leave it to "Check for updates now"? Until
  // they answer nothing is checked by itself, so frequent releases never nag anyone who did not ask.
  // The setup's answer (home.updates in config.json) counts as the answer; Back counts as No.
  var ai = 0;
  function updAsk() {
    if (!UPD || !UPD.supported || UPD.answered) return;
    if (HOME.updates === "notify" || HOME.updates === "manual") { upd().auto(HOME.updates === "notify"); return; }
    if (zone !== "grid" && zone !== "shelf" && zone !== "quick") return;
    zone = "updask"; ai = 0;
    clearFocus();
    renderAsk();
  }
  function renderAsk() {
    var pop = $("gear-pop");
    var items = [[ICONS.download, t("upd_ask_yes"), t("upd_ask_yes_sub")], [ICONS.sliders, t("upd_ask_no"), t("upd_ask_no_sub")]];
    pop.innerHTML = '<div class="ask-h"><b>' + esc(t("upd_ask")) + "</b><small>" + esc(t("upd_ask_sub")) + "</small></div>" +
      items.map(function (it, i) {
        return '<div class="grow' + (i === ai ? " focus" : "") + '" role="menuitem"><i>' + it[0] + "</i><span><b>" +
          esc(it[1]) + "</b><small>" + esc(it[2]) + "</small></span></div>";
      }).join("");
    pop.style.left = pop.style.top = "";
    pop.classList.add("on", "ask");
    document.documentElement.classList.add("gearing");
  }
  function answerAsk(yes) {
    $("gear-pop").classList.remove("on", "ask");
    document.documentElement.classList.remove("gearing");
    zone = "grid";
    upd().auto(yes);
    startFocus();
    paintFocus();
    status(t("upd_ask_done"));
  }
  function updWhen(u) {
    if (!u.checked) return t("upd_never");
    var loc = window.I18N ? window.I18N.locale() : "en-AU";
    var when = new Date(u.checked).toLocaleString(loc, { day: "numeric", month: "long", hour: "numeric", minute: "2-digit", hour12: !CLOCK24 });
    return t("upd_last", { when: when });
  }
  function updateRows() {
    var u = updRead() || {}, busy = u.busy || "";
    var rows = [info("upd-ver", t("about_version"), u.current || "")];
    if (u.available) {
      rows.push({ kind: "action", key: "upd-install", label: t("upd_install", { v: u.latest }),
        sub: busy === "downloading" ? t("upd_downloading", { p: u.progress || 0 }) : busy === "installing" ? t("upd_confirm") : u.title || "",
        act: function () { if (!busy) upd().install(); } });
    }
    rows.push({ kind: "action", key: "upd-check", label: t("upd_check"), sub: busy === "checking" ? t("upd_checking") : updWhen(u),
      act: function () { if (!busy) upd().check(); } });
    if (u.error) rows.push(info("upd-err", t("upd_err_" + u.error)));
    else if (u.refused) rows.push(info("upd-err", t("upd_err_other_key")));
    else if (u.checked && !u.available && !busy) rows.push(info("upd-latest", t("upd_latest")));
    rows.push({ kind: "toggle", key: "upd-auto", label: t("upd_auto"), value: u.auto ? t("on") : t("off"),
      act: function () { upd().auto(!u.auto); } });
    rows.push(info("upd-note", t("upd_note")));
    return rows;
  }

  // Back to config.json for everything but the apps (which have their own list).
  function resetSettings() {
    (Array.isArray(ST.photos) ? ST.photos : []).forEach(function (p) {
      if (p.file) try { if (TV && TV.removePhoto) TV.removePhoto(p.file); } catch (e) {}
    });
    ST = Array.isArray(ST.hidden_apps) ? { hidden_apps: ST.hidden_apps } : {};
    keep("tvhome.look", null);
    if (window.I18N) window.I18N.set(HOME.language || window.I18N.device());
    saveSettings();
    staticText();
    SET.msg = t("reset_done");
  }

  // ---- typing a place, a name or a photo address ----
  // One text box above the rows. OK on a typing row focuses it, so the TV's keyboard comes up; OK
  // (Enter) is done, Back cancels, up and down leave it. The phone remote's Type also lands here.
  function isTyping() { return !!SET.typing; }
  function startTyping(spec) {
    SET.typing = spec;
    var inp = $("set-input");
    $("set-type-label").textContent = spec.label;
    inp.value = spec.value || "";
    inp.type = spec.url ? "url" : "text";
    inp.setAttribute("enterkeyhint", spec.search ? "search" : "done");
    inp.setAttribute("autocapitalize", spec.url ? "off" : "words");
    $("set-type").classList.add("on");
    renderSettings();
    try { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); } catch (e) {}
  }
  function stopTyping() {
    SET.typing = null;
    $("set-type").classList.remove("on");
    try { $("set-input").blur(); } catch (e) {}
    renderSettings();
  }
  function typingKey(e) {
    if (!SET.typing || zone !== "settings") return false;
    var inp = $("set-input");
    if (document.activeElement !== inp) { stopTyping(); return false; }   // the box lost the keys
    if (e.key === "Enter" || e.keyCode === 13) {
      // Nothing typed yet: this OK is the remote asking for the TV's keyboard (a WebView raises it
      // on OK in a text box), so it is left to do that rather than closing the box.
      if (inp.value.trim() === String(SET.typing.value || "").trim()) return true;
      e.preventDefault();
      var spec = SET.typing, v = inp.value;
      stopTyping();
      spec.submit(v);
      if (zone === "settings") renderSettings();
      return true;
    }
    if (e.key === "Escape" || e.key === "Esc") { e.preventDefault(); stopTyping(); return true; }
    var up = e.key === "ArrowUp" || e.keyCode === 38, down = e.key === "ArrowDown" || e.keyCode === 40;
    if (up || down) { e.preventDefault(); stopTyping(); setMove(0, up ? -1 : 1); return true; }
    return true;   // everything else is typing (Backspace deletes here, it does not go back)
  }

  // ---- keys on the settings screen ----
  function enterRows() {
    var rows = rowsNow(), i = firstRow(rows);
    if (i < 0) return;
    SET.col = "rows"; SET.ri = i; SET.keyFocus = rows[i].key;
  }
  function leaveRows() {
    if (SET.sub) { SET.keyFocus = SET.sub.back; SET.sub = null; return; }
    SET.col = "secs"; SET.keyFocus = null;
  }
  function setMove(dx, dy) {
    var rows = rowsNow();
    if (SET.lift) {
      if (dy) {
        var r = rows[indexOfKey(rows, SET.lift)];
        if (r && r.move) r.move(dy);
        SET.keyFocus = SET.lift;
      }
      renderSettings();
      return;
    }
    SET.confirm = null;
    if (SET.col === "secs") {
      if (dy) {
        var n = Math.max(0, Math.min(SECS.length - 1, SET.sec + dy));
        if (n !== SET.sec) { SET.sec = n; SET.sub = null; SET.msg = ""; SET.keyFocus = null; SET.ri = 0; }
      } else if (dx > 0) enterRows();
    } else if (dy) {
      SET.ri = stepRow(rows, SET.ri, dy);
      SET.keyFocus = rows[SET.ri] ? rows[SET.ri].key : null;
    } else if (dx && rows[SET.ri] && rows[SET.ri].adjust) {
      rows[SET.ri].adjust(dx);
      SET.keyFocus = rows[SET.ri].key;
    } else if (dx < 0) leaveRows();
    renderSettings();
  }
  function setActivate() {
    if (SET.lift) { dropRow(); return; }
    if (SET.col === "secs") { enterRows(); renderSettings(); return; }
    var rows = rowsNow(), r = rows[SET.ri];
    if (!focusable(r) || !r.act) return;
    if (r.danger && SET.confirm !== r.key) { SET.confirm = r.key; renderSettings(); return; }
    SET.confirm = null;
    SET.keyFocus = r.key;
    r.act();
    if (zone === "settings" && !SET.typing) renderSettings();
  }
  function setHold() {
    if (SET.lift) { dropRow(); return true; }
    if (SET.col !== "rows") return false;
    var r = rowsNow()[SET.ri];
    if (!r || !r.move) return false;
    SET.confirm = null;
    if (r.key.indexOf("app:") === 0) materialise();
    SET.lift = r.key;
    renderSettings();
    return true;
  }
  function dropRow() {
    var k = SET.lift || "";
    SET.lift = null;
    if (k.indexOf("app:") === 0) { persistOrder(); SET.dirty = true; }
    if (zone === "settings") renderSettings();
  }
  function setBack() {
    if (SET.typing) { stopTyping(); return; }
    if (SET.lift) { dropRow(); return; }
    SET.confirm = null;
    if (SET.col === "rows") { leaveRows(); renderSettings(); return; }
    closeSettings();
  }

  // ---- drawing it ----
  function rowHTML(r, i) {
    if (r.kind === "head") return '<div class="shead">' + esc(r.label) + "</div>";
    var f = SET.col === "rows" && i === SET.ri, lifted = SET.lift === r.key;
    var cls = "srow k-" + r.kind + (f ? " focus" : "") + (lifted ? " lifted" : "") + (r.danger ? " danger" : "");
    var lead = "";
    if (r.icon && iconUrl(r.icon)) lead = '<img class="sicon" src="' + esc(iconUrl(r.icon)) + '" alt="" onerror="this.remove()">';
    else if (r.kind === "item") lead = '<span class="sicon none">' + (r.icon.indexOf("screen:") === 0 ? ICONS.screen : esc((r.label || "?").charAt(0).toUpperCase())) + "</span>";
    else if (r.thumb) lead = '<img class="sthumb" src="' + esc(r.thumb) + '" alt="" decoding="async" onerror="this.remove()">';
    var label = SET.confirm === r.key ? r.confirmText || t("confirm_remove") : r.label;
    var tail = "";
    if (lifted) tail = '<i class="smark">' + ICONS.updown + "</i>";
    else if (r.kind === "choice") tail = r.checked ? '<i class="smark">' + ICONS.check + "</i>" : "";
    else if (r.kind === "check") tail = '<i class="sbox' + (r.checked ? " on" : "") + '">' + (r.checked ? ICONS.check : "") + "</i>";
    else if (r.kind === "nav" || r.kind === "input") tail = '<i class="smark dim">' + ICONS.chevron + "</i>";
    else if (r.kind === "slider") {
      for (var lv = 1; lv <= 5; lv++) tail += '<i class="sstep' + (lv <= r.level ? " on" : "") + '"></i>';
      tail = '<span class="sslide">' + tail + "</span>";
    }
    var value = r.value != null && r.value !== "" ? '<span class="sv">' + esc(r.value) + "</span>" : "";
    var sub = r.sub ? "<small>" + esc(r.sub) + "</small>" : "";
    return '<div class="' + cls + '"' + (r.lang ? ' lang="' + esc(r.lang) + '"' : "") + ">" + lead +
      '<span class="sl"><b>' + esc(label) + "</b>" + sub + "</span>" + value + tail + "</div>";
  }
  function renderSettings() {
    var rows = rowsNow();
    if (SET.sub && !rows.length) { SET.sub = null; rows = rowsNow(); }
    if (SET.col === "rows") {
      var k = SET.keyFocus ? indexOfKey(rows, SET.keyFocus) : -1;
      if (k >= 0 && focusable(rows[k])) SET.ri = k;
      else {
        SET.ri = Math.max(0, Math.min(SET.ri, rows.length - 1));
        if (!focusable(rows[SET.ri])) { var back = stepRow(rows, SET.ri, -1); SET.ri = back !== SET.ri ? back : stepRow(rows, SET.ri, 1); }
      }
      if (focusable(rows[SET.ri])) SET.keyFocus = rows[SET.ri].key;
      else SET.col = "secs";
    }
    $("set-title").textContent = t("set_title");
    $("set-secs").innerHTML = SECS.map(function (sc, i) {
      var cls = "ssec" + (i === SET.sec ? (SET.col === "secs" ? " focus" : " on") : "");
      return '<div class="' + cls + '"><i>' + ICONS[sc[1]] + "</i><span>" + esc(t("sec_" + sc[0])) + "</span></div>";
    }).join("");
    $("set-crumb").textContent = SET.sub ? SET.sub.crumb : "";
    $("set-head").textContent = SET.sub ? SET.sub.title() : t("sec_" + SECS[SET.sec][0]);
    var box = $("set-rows");
    box.innerHTML = rows.map(rowHTML).join("");
    $("set-msg").textContent = SET.msg || "";
    var cur = rows[SET.ri];
    $("set-hint").textContent = SET.typing ? t("hint_typing") : SET.lift ? t("hint_lift") : SET.col === "secs" ? t("hint_secs") :
      cur && cur.move ? t("hint_rows_move") : SET.col === "rows" && cur && cur.adjust ? t("hint_slider") : t("hint_rows");
    // keep the focused row well inside the list (a quarter of it from either edge), scrolling only
    // when it gets closer, so short lists and their headings never move
    var f = box.querySelector(".srow.focus");
    if (!f) { box.scrollTop = 0; return; }
    var top = f.offsetTop, bottom = top + f.offsetHeight, view = box.clientHeight, edge = view / 4;
    if (top - edge < box.scrollTop) box.scrollTop = Math.max(0, top - edge);
    else if (bottom + edge > box.scrollTop + view) box.scrollTop = bottom + edge - view;
  }
  function initSettings() {
    $("set-input").addEventListener("input", function () { if (SET.typing && SET.typing.live) SET.typing.live(this.value); });
  }

  // ---------------- the clock customiser ----------------
  // Every choice lives in ST, so it is kept on this TV straight away (localStorage, and the launcher's
  // own copy) and survives a restart. The digits are rebuilt in drawClocks(), never by editing #time:
  // the Night clock is four clipped glass layers per scene.
  // Each scene keeps its own clock: ST.clock_scenes[scene id]. A scene with no saved copy
  // starts from the look this TV already had (the old top-level keys), then the built-in default.
  function ckSceneId() { var s = SCENES[scene]; return s && s.id ? s.id : "default"; }
  function ckScene() {
    if (!ST.clock_scenes || typeof ST.clock_scenes !== "object" || Array.isArray(ST.clock_scenes)) ST.clock_scenes = {};
    var id = ckSceneId(), all = ST.clock_scenes;
    if (!all[id] || typeof all[id] !== "object" || Array.isArray(all[id])) {
      all[id] = {};
      Object.keys(CK_DEF).forEach(function (k) { if (ST[k] != null) all[id][k] = ST[k]; });
    }
    return all[id];
  }
  function ck(key) { var v = ckScene()[key]; return v == null ? CK_DEF[key] : v; }
  function ckOpt(list, val) {
    for (var i = 0; i < list.length; i++) if (list[i][0] === val) return list[i];
    return list[0];
  }
  function ckLabel(list, val) { return t(ckOpt(list, val)[1]); }
  function ckHex(id) { return ckOpt(CK_COLOURS, id)[2] || null; }
  function hexA(hex, a) {
    var m = /^#?([0-9a-f]{6})$/i.exec(hex || "");
    if (!m) return "rgba(111, 214, 255, " + a + ")";
    var n = parseInt(m[1], 16);
    return "rgba(" + (n >> 16 & 255) + ", " + (n >> 8 & 255) + ", " + (n & 255) + ", " + a + ")";
  }
  function applyClock() {
    var r = document.documentElement;
    // keep every other class (theme-night, glass, night...), replace only the clock's own
    r.className = r.className.split(/\s+/).filter(function (c) { return c && c.indexOf("ck-") !== 0; }).join(" ");
    r.classList.add("ck-layout-" + ck("clock_layout"));
    r.classList.add("ck-font-" + ck("clock_font"));
    r.classList.add("ck-fill-" + ck("clock_fill"));
    r.classList.add("ck-align-" + ck("clock_align"));
    r.classList.add("ck-color-" + ck("clock_color"));
    if (ck("clock_shadow")) r.classList.add("ck-shadow");
    if (ck("clock_date") === "off") r.classList.add("ck-nodate");
    if (ck("clock_date") === "fixed") r.classList.add("ck-date-fixed");
    r.style.setProperty("--ck-scale", ck("clock_scale"));
    r.style.setProperty("--ck-weight", ck("clock_weight"));
    var hex = ckHex(ck("clock_color")) || "#ffffff";
    r.style.setProperty("--ck-c1", hex);
    if (ck("clock_color") === "wallpaper") r.style.removeProperty("--ck-user-tint");
    else r.style.setProperty("--ck-user-tint", hex);
    glassShown = "";
    if (NIGHT) { clock(); placeDate(); }
    positionClockFocus(zone === "clock");
  }
  function clockHTML(hm) {
    var s = String(hm), i = s.indexOf(":"), h = i < 0 ? s : s.slice(0, i), m = i < 0 ? "" : s.slice(i + 1);
    return '<span class="ck"><span class="ck-h">' + esc(h) + '</span><span class="ck-colon">:</span>' +
      '<span class="ck-m">' + esc(m) + "</span></span>";
  }
  // The tight box around the digits themselves. .fill spans the whole scene, so measuring the
  // element gave a full-width rectangle: the old focus ring stretched into a wide box.
  function clockTextRect(el) {
    if (!el) return null;
    try {
      var rg = document.createRange();
      rg.selectNodeContents(el.querySelector(".fill") || el);
      var r = rg.getBoundingClientRect();
      if (r && r.width > 0 && r.height > 0) return r;
    } catch (e) {}
    return el.getBoundingClientRect();
  }
  function dateOverlaps(a, b) {
    return !!(a && b && b.width && a.right > b.left && a.left < b.right && a.bottom > b.top && a.top < b.bottom);
  }
  // The date and the weather sit just above the digits (or below them), wherever the clock has been
  // moved to. "Fixed" is the one exception: top centre, level with the quick buttons. The line stays
  // on screen, and gives up the weather word or its temperature before it touches the quick buttons.
  function placeDate() {
    if (!NIGHT) return;
    var d = $("date");
    if (!d) return;
    if (ck("clock_date") === "off") { d.style.display = "none"; return; }
    d.style.display = "";
    var rem = innerWidth / 120;
    d.classList.remove("tight", "tighter");
    d.style.left = ""; d.style.right = ""; d.style.transform = ""; d.style.textAlign = "";
    if (ck("clock_date") === "fixed") {
      d.style.left = "50%"; d.style.right = "auto"; d.style.transform = "translateX(-50%)"; d.style.textAlign = "center";
      var qf = $("qbtns").getBoundingClientRect();
      var dhf = d.getBoundingClientRect().height || 2.5 * rem;
      d.style.top = Math.round(qf.height ? qf.top + (qf.height - dhf) / 2 : 5 * rem) + "px";
      if (d.getBoundingClientRect().width > innerWidth - 2 * rem) d.classList.add("tight");
      if (d.getBoundingClientRect().width > innerWidth - 2 * rem) d.classList.add("tighter");
      return;
    }
    var el = document.querySelector(".scene.on .gclock:not(.under)");
    if (!el) { d.style.top = ""; return; }
    var r = clockTextRect(el);
    if (!r || !r.width) { d.style.top = ""; return; }
    var below = ck("clock_date") === "below";
    var dh = d.getBoundingClientRect().height || 2.5 * rem;
    // no room above: put it under the digits instead of pushing it off the top
    if (!below && r.top - dh - 0.5 * rem < 0.5 * rem) below = true;
    d.style.left = Math.round(r.left + r.width / 2) + "px";
    d.style.right = "auto";
    d.style.transform = "translateX(-50%)";
    d.style.textAlign = "center";
    d.style.top = Math.round(below ? r.bottom + 0.5 * rem : r.top - dh - 0.5 * rem) + "px";
    // keep it on screen, dropping the weather word and then the temperature if it still runs off
    if (d.getBoundingClientRect().width > innerWidth - 2 * rem) d.classList.add("tight");
    if (d.getBoundingClientRect().width > innerWidth - 2 * rem) d.classList.add("tighter");
    var b = d.getBoundingClientRect();
    if (b.left < rem || b.right > innerWidth - rem) {
      var cx = Math.max(rem + b.width / 2, Math.min(innerWidth - rem - b.width / 2, r.left + r.width / 2));
      d.style.left = Math.round(cx) + "px";
      b = d.getBoundingClientRect();
    }
    // the quick buttons live at the top right: slide the date clear of them, never under them
    var q = $("quick").classList.contains("none") ? null : $("qbtns").getBoundingClientRect();
    if (q && q.width && dateOverlaps(d.getBoundingClientRect(), q)) {
      d.classList.add("tight");
      if (dateOverlaps(d.getBoundingClientRect(), q)) d.classList.add("tighter");
      b = d.getBoundingClientRect();
      if (dateOverlaps(b, q)) {
        var left = Math.max(rem + b.width / 2, q.left - rem - b.width / 2);
        d.style.left = Math.round(left) + "px";
      }
    }
  }
  // The ring around the digits while the clock itself has the focus (up from the quick buttons).
  function positionClockFocus(on) {
    var f = $("ckfocus");
    if (!f) return;
    if (!on) { f.classList.remove("on"); return; }
    var el = document.querySelector(".scene.on .gclock:not(.under)");
    if (!el) { f.classList.remove("on"); return; }
    var rect = clockTextRect(el);
    if (!rect || !rect.width) { f.classList.remove("on"); return; }
    var rem = innerWidth / 120, pad = 0.9 * rem;
    f.style.left = (rect.left - pad) + "px";
    f.style.top = (rect.top - pad) + "px";
    f.style.width = (rect.width + pad * 2) + "px";
    f.style.height = (rect.height + pad * 2) + "px";
    f.classList.add("on");
  }
  function setClock(key, val) {
    ckScene()[key] = val;
    applyClock();
    saveSettings();
    if (CKB.open) renderCkbar();
    // a new face has to be in before the glass fill is measured again
    if ((key === "clock_font" || key === "clock_weight") && document.fonts) {
      var lf = CK_LOAD[ck("clock_font")] || CK_LOAD.antonio;
      document.fonts.load(lf[0] + ' 10px "' + lf[1] + '"').then(function () { applyClock(); }, function () {});
    }
  }
  function ckStep(key, list, d) {
    var cur = ck(key), i = 0;
    for (var k = 0; k < list.length; k++) if (list[k][0] === cur) i = k;
    i = (i + d + list.length) % list.length;
    setClock(key, list[i][0]);
  }
  function resetClock() {
    var o = ckScene();
    Object.keys(CK_DEF).forEach(function (k) { o[k] = CK_DEF[k]; });
    applyClock();
    saveSettings();
    if (CKB.open) renderCkbar();
    if (zone === "settings") renderSettings();
  }
  // ---- the clock card's controls: a compact row per setting, an icon on the left ----
  var CKI = {
    shape: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="7" height="16" rx="2"/><rect x="14" y="4" width="7" height="7" rx="2"/><rect x="14" y="13" width="7" height="7" rx="2"/></svg>',
    type: '<svg viewBox="0 0 24 24"><path d="M4 19 9.5 5h3L19 19"/><path d="M7 13.5h8"/></svg>',
    colour: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 1 0 16"/><path d="M9 9.5h.01"/></svg>',
    inline: '<svg viewBox="0 0 24 24"><rect x="3" y="8" width="8" height="8" rx="2"/><rect x="13" y="8" width="8" height="8" rx="2"/></svg>',
    split: '<svg viewBox="0 0 24 24"><rect x="7" y="3" width="10" height="8" rx="2"/><rect x="7" y="13" width="10" height="8" rx="2"/></svg>',
    layout: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="6" rx="2"/><rect x="3" y="14" width="18" height="6" rx="2"/></svg>',
    align: '<svg viewBox="0 0 24 24"><path d="M4 6h16M4 12h10M4 18h16"/></svg>',
    size: '<svg viewBox="0 0 24 24"><path d="M9 4H4v5M15 4h5v5M9 20H4v-5M15 20h5v-5"/></svg>',
    date: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="15" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
    font: '<svg viewBox="0 0 24 24"><path d="M4 19 10 5h4l6 14"/><path d="M7 14h10"/></svg>',
    weight: '<svg viewBox="0 0 24 24"><path d="M5 5h6a4 4 0 0 1 0 8H5zM5 13h7a4 4 0 0 1 0 8H5z"/></svg>',
    depth: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="13" height="13" rx="3"/><path d="M10 10h11v11H10z"/></svg>'
  };
  var CK_TAB_ICONS = [CKI.shape, CKI.type, CKI.colour];
  // ---- the clock card: the Font & Colour popup, with every old control kept ----
  var CK_FACE = { antonio: "Antonio", inter: "Inter", archivo: "'Archivo Black'", nunito: "Nunito", fraunces: "Fraunces" };
  var CK_SWATCH = CK_COLOURS.map(function (o) {
    return [o[0], "ck_sw_" + o[0], o[2] || "linear-gradient(135deg,#9fc4ff,#ffc4d8 55%,#ffe0a8)"];
  });
  var CK_ROWS = ["fonts", "sliders", "swatches", "fill", "pos", "date", "shadow"];
  var CKB = { open: false, row: 0, col: 0, grab: false, foot: false, fi: 0, text: 0 };
  function ckRowLen(k) {
    if (k === "fonts") return CK_FONTS.length;
    if (k === "sliders") return 2;
    if (k === "swatches") return CK_SWATCH.length;
    if (k === "fill") return CK_FILLS.length;
    if (k === "pos") return CK_ALIGNS.length;
    if (k === "date") return CK_DATES.length;
    return 1;
  }
  function ckIndex(list, v) {
    for (var i = 0; i < list.length; i++) if (String(list[i][0]) === String(v)) return i;
    return 0;
  }
  // Where the cursor starts when a row gets the focus: on the choice that is already set.
  function ckRowStart(k) {
    if (k === "fonts") return ckIndex(CK_FONTS, ck("clock_font"));
    if (k === "swatches") return ckIndex(CK_SWATCH, ck("clock_color"));
    if (k === "fill") return ckIndex(CK_FILLS, ck("clock_fill"));
    if (k === "pos") return ckIndex(CK_ALIGNS, ck("clock_align"));
    if (k === "date") return ckIndex(CK_DATES, ck("clock_date"));
    return 0;
  }
  function ckSizePct() {
    var v = ck("clock_scale"), i = 0, best = 9;
    for (var k = 0; k < CK_SIZES.length; k++) {
      var d = Math.abs(CK_SIZES[k][0] - v);
      if (d < best) { best = d; i = k; }
    }
    return (i / (CK_SIZES.length - 1)) * 100;
  }
  function ckRowHTML(k, i) {    var focus = !CKB.foot && CKB.row === i;
    var cls = "ckrow2" + (focus ? " focus" : "");
    if (k === "fonts") {
      return '<div class="' + cls + ' ckfonts">' + CK_FONTS.map(function (f, fi) {
        return '<span class="ckf' + (ck("clock_font") === f[0] ? " on" : "") + (focus && CKB.col === fi ? " sel" : "") + '"' +
          ' style="font-family:' + CK_FACE[f[0]] + '">12</span>';
      }).join("") + "</div>";
    }
    if (k === "sliders") {
      var sp = ckSizePct(), wp = (ckIndex(CK_WEIGHTS, ck("clock_weight")) / (CK_WEIGHTS.length - 1)) * 100;
      function part(label, pct, idx) {
        var on = focus && CKB.col === idx;
        return '<span class="cksl' + (on ? " on" : "") + (on && CKB.grab ? " grab" : "") + '">' +
          '<span class="ckslab">' + esc(label) + '</span><span class="ckline"><i class="cktint" style="width:' + pct +
          '%"></i><i class="ckthumb" style="left:' + pct + '%"></i></span></span>';
      }
      return '<div class="' + cls + ' cksliders">' + part(t("ck_size"), sp, 0) + part(t("ck_weight"), wp, 1) + "</div>";
    }
    if (k === "swatches") {
      return '<div class="' + cls + ' ckswatchrow">' + CK_SWATCH.map(function (o, oi) {
        return '<span class="cksw' + (ck("clock_color") === o[0] ? " on" : "") + (focus && CKB.col === oi ? " sel" : "") +
          '" style="background:' + o[2] + '"></span>';
      }).join("") + "</div>";
    }
    if (k === "fill") {
      return '<div class="' + cls + '"><span class="cklab cklab-big">' + esc(t("ck_fill")) + '</span><span class="ckopts ckfills">' +
        CK_FILLS.map(function (o, oi) {
          return '<span class="ckopt' + (String(o[0]) === String(ck("clock_fill")) ? " on" : "") +
            (focus && CKB.col === oi ? " sel" : "") + '">' + esc(t(o[1])) + "</span>";
        }).join("") + "</span></div>";
    }
    if (k === "pos") {
      var pi = ckIndex(CK_ALIGNS, ck("clock_align"));
      return '<div class="' + cls + ' ckposrow">' + CK_ALIGNS.map(function (o, oi) {
        return '<span class="ckdot' + (oi === pi ? " on" : "") + (focus && CKB.col === oi ? " sel" : "") + '" title="' + esc(t(o[1])) + '"></span>';
      }).join("") + "</div>";
    }
    if (k === "date") {
      return '<div class="' + cls + '"><span class="cklab cklab-big">' + esc(t("ck_date")) + '</span><span class="ckopts ckdates">' +
        CK_DATES.map(function (o, oi) {
          return '<span class="ckopt' + (String(o[0]) === String(ck("clock_date")) ? " on" : "") +
            (focus && CKB.col === oi ? " sel" : "") + '">' + esc(t(o[1])) + "</span>";
        }).join("") + "</span></div>";
    }
    if (k === "shadow") {
      var son = !!ck("clock_shadow");
      return '<div class="' + cls + '"><span class="cklab cklab-big">' + esc(t("ck_shadow")) + '</span>' +
        '<span class="ckswitch' + (son ? " on" : "") + (focus && CKB.col === 0 ? " sel" : "") + '"><i></i></span></div>';
    }
  }
  function renderCkbar() {
    var body = $("ck-body");
    if (!body) return;
    body.innerHTML = '<div class="ck-list" id="ck-list">' + CK_ROWS.map(ckRowHTML).join("") + "</div>";
    $("ck-title").textContent = t("ck_title");
    $("ck-scene").textContent = sceneLabel(SCENES[scene]);
    $("ckbar-reset").className = "ckfoot-reset" + (CKB.foot && CKB.fi === 0 ? " focus" : "");
    $("ckbar-reset").textContent = t("ck_reset_pill");
    $("ckbar-done").className = "ckfoot-done" + (CKB.foot && CKB.fi === 1 ? " focus" : "");
    $("ckbar-done-text").textContent = t("ck_done");
    var list = $("ck-list"), el = list.children[CKB.row], view = body.clientHeight;
    if (el) {
      var top = el.offsetTop, h = el.offsetHeight;
      if (top < body.scrollTop) body.scrollTop = top;
      else if (top + h > body.scrollTop + view) body.scrollTop = top + h - view;
    }
    $("ckbar").classList.add("on");
  }
  function openClockBar() {
    CKB.open = true; CKB.row = 0; CKB.col = ckRowStart("fonts");
    CKB.grab = false; CKB.foot = false; CKB.fi = 0;
    $("ck-body").scrollTop = 0;
    zone = "clockbar";
    clearTimeout(hintTimer); hintFlash = "";
    clearFocus();   // the dock's tile stops glowing while the popup is up
    renderCkbar();
    positionClockFocus(false);
    renderHint();
  }
  function closeClockBar() {
    CKB.open = false; CKB.foot = false; CKB.grab = false;
    $("ckbar").classList.remove("on");
    zone = "clock";
    paintFocus();
  }
  function ckMove(dx, dy) {
    if (CKB.foot) {
      if (dy < 0) { CKB.foot = false; CKB.row = CK_ROWS.length - 1; CKB.col = 0; }
      else if (dx) {
        CKB.fi = Math.max(0, Math.min(1, CKB.fi + (dx > 0 ? 1 : -1)));
        renderCkbar(); return;
      }
      renderCkbar(); return;
    }
    if (dy > 0 && CKB.row === CK_ROWS.length - 1) { CKB.foot = true; CKB.fi = 0; CKB.grab = false; renderCkbar(); return; }
    if (dy) {
      CKB.row = Math.max(0, Math.min(CK_ROWS.length - 1, CKB.row + dy));
      CKB.grab = false;
      CKB.col = ckRowStart(CK_ROWS[CKB.row]);
      renderCkbar(); return;
    }
    if (!dx) return;
    var k = CK_ROWS[CKB.row];
    if (k === "fonts") CKB.col = Math.max(0, Math.min(CK_FONTS.length - 1, CKB.col + dx));
    else if (k === "swatches") CKB.col = Math.max(0, Math.min(CK_SWATCH.length - 1, CKB.col + dx));
    else if (k === "sliders") {
      if (CKB.grab) {
        if (CKB.col === 0) {
          var i = ckIndex(CK_SIZES, ck("clock_scale"));
          i = Math.max(0, Math.min(CK_SIZES.length - 1, i + (dx > 0 ? 1 : -1)));
          setClock("clock_scale", CK_SIZES[i][0]);
        } else {
          var wi = ckIndex(CK_WEIGHTS, ck("clock_weight"));
          wi = Math.max(0, Math.min(CK_WEIGHTS.length - 1, wi + (dx > 0 ? 1 : -1)));
          setClock("clock_weight", CK_WEIGHTS[wi][0]);
        }
      } else CKB.col = Math.max(0, Math.min(1, CKB.col + dx));
    } else if (k === "fill") {
      CKB.col = (CKB.col + (dx > 0 ? 1 : -1) + CK_FILLS.length) % CK_FILLS.length;
      setClock("clock_fill", CK_FILLS[CKB.col][0]);
    } else if (k === "pos") {
      CKB.col = (CKB.col + (dx > 0 ? 1 : -1) + CK_ALIGNS.length) % CK_ALIGNS.length;
      setClock("clock_align", CK_ALIGNS[CKB.col][0]);
    } else if (k === "date") {
      var di = ckIndex(CK_DATES, ck("clock_date"));
      di = (di + (dx > 0 ? 1 : -1) + CK_DATES.length) % CK_DATES.length;
      setClock("clock_date", CK_DATES[di][0]); CKB.col = di;
    } else if (k === "shadow") {
      setClock("clock_shadow", dx > 0);
    }
    renderCkbar();
  }
  function ckActivate() {
    if (CKB.foot) {
      if (CKB.fi === 0) resetClock();
      else closeClockBar();
      return;
    }
    var k = CK_ROWS[CKB.row];
    if (k === "fonts") { setClock("clock_font", CK_FONTS[CKB.col][0]); return; }
    if (k === "swatches") { setClock("clock_color", CK_SWATCH[CKB.col][0]); return; }
    if (k === "sliders") { CKB.grab = !CKB.grab; renderCkbar(); return; }
    if (k === "fill") { setClock("clock_fill", CK_FILLS[CKB.col][0]); return; }
    if (k === "pos") { setClock("clock_align", CK_ALIGNS[CKB.col][0]); return; }
    if (k === "date") { setClock("clock_date", CK_DATES[CKB.col][0]); return; }
    if (k === "shadow") { setClock("clock_shadow", !ck("clock_shadow")); return; }
    ckMove(1, 0);
  }
  // The same controls in Home settings, so the clock can always be changed with the remote alone.
  function clockRows() {
    var rows = [head(t("ck_head")), info("ck-scene", t("ck_scene_note", { name: sceneLabel(SCENES[scene]) }))];
    function cycle(key, label, list) {
      rows.push({ kind: "cycle", key: "ck-" + key, label: t(label), value: ckLabel(list, ck(key)),
        act: function () { ckStep(key, list, 1); }, adjust: function (d) { ckStep(key, list, d); } });
    }
    function toggle(key, label) {
      rows.push({ kind: "check", key: "ck-" + key, label: t(label), checked: !!ck(key),
        act: function () { setClock(key, !ck(key)); } });
    }
    cycle("clock_font", "ck_font", CK_FONTS);
    cycle("clock_weight", "ck_weight", CK_WEIGHTS);
    cycle("clock_scale", "ck_size", CK_SIZES);
    cycle("clock_align", "ck_align", CK_ALIGNS);
    cycle("clock_fill", "ck_fill", CK_FILLS);
    cycle("clock_color", "ck_colour", CK_COLOURS);
    cycle("clock_date", "ck_date", CK_DATES);
    toggle("clock_shadow", "ck_shadow");
    rows.push({ kind: "nav", key: "ck-reset", label: t("ck_reset"), sub: t("ck_reset_sub"), act: resetClock });
    rows.push(info("ck-note", t("ck_note")));
    return rows;
  }

  // ---------------- keys: any normal TV remote, keyboard or game controller ----------------
  // The full table is in docs/REMOTES.md. The launcher also turns BUTTON_A, BUTTON_SELECT and
  // NUMPAD_ENTER into OK and BUTTON_B and ESCAPE into Back before the page sees them. Any other key
  // (media, numbers, colour buttons, voice, app buttons) is left alone so Android still gets it.
  var OK_KEYS = ["Enter", " ", "Select", "Accept", "NumpadEnter"];
  var BACK_KEYS = ["Escape", "Esc", "Backspace", "GoBack", "BrowserBack"];
  var ARROWS = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0],
    Up: [0, -1], Down: [0, 1], Left: [-1, 0], Right: [1, 0] };
  var ARROW_CODES = { 38: [0, -1], 40: [0, 1], 37: [-1, 0], 39: [1, 0], 19: [0, -1], 20: [0, 1], 21: [-1, 0], 22: [1, 0] };
  function isOk(e) { return OK_KEYS.indexOf(e.key) >= 0 || e.keyCode === 13 || e.keyCode === 23 || e.keyCode === 32; }
  function isBack(e) { return BACK_KEYS.indexOf(e.key) >= 0 || e.keyCode === 27 || e.keyCode === 8 || e.keyCode === 10009; }   // 10009: Samsung
  function isMenu(e) { return e.key === "ContextMenu" || e.key === "Menu" || e.keyCode === 93 || e.keyCode === 82; }
  function arrowOf(e) { return ARROWS[e.key] || (e.key === "Unidentified" || !e.key ? ARROW_CODES[e.keyCode] : null) || null; }

  // Focus is never lost: after any key, if nothing shows focus, the first dock app gets it.
  function ensureFocus() {
    if (zone === "clock" || zone === "clockbar") return;   // the ring and the drawer are their own focus
    if (document.querySelector(".focus")) return;
    zone = "grid"; g = 0;
    paintFocus();
  }

  // OK acts when it is let go, so holding it can pick things up instead (tvOS does the same).
  // Works for remotes that repeat the key while it is held and for ones that only send the press
  // and, later, the release. One press is one action: a pick-up never also opens the app.
  var okDown = false, okHeld = false, okTimer = null;
  function okReset() { okDown = false; okHeld = false; clearTimeout(okTimer); }

  // A short navigation click on every arrow and OK, like the TV's own launcher.
  var AC = null, SOUND = true;
  // "Soft": a short, quiet, lower tap instead of the TV's click (#32, thanks alonmustafa)
  function softTick() {
    try {
      var Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      AC = AC || new Ctx();
      if (AC.state === "suspended") AC.resume();
      var now = AC.currentTime, o = AC.createOscillator(), g = AC.createGain();
      o.type = "sine";
      o.frequency.setValueAtTime(392, now);
      o.frequency.exponentialRampToValueAtTime(294, now + 0.075);
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(0.05, now + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.095);
      o.connect(g); g.connect(AC.destination);
      o.start(now); o.stop(now + 0.1);
    } catch (e) {}
  }
  function blip(dx, dy) {
    if (!SOUND || SOUND_STYLE === "off") return;
    if (SOUND_STYLE === "soft") { softTick(); return; }
    // On the TV: Android's own navigation sound (TVOS.tick), the one other TV launchers play.
    // It follows the TV's "system sounds" switch. 1 up, 2 down, 3 left, 4 right, 0 OK.
    if (TV && TV.tick) {
      try { TV.tick(dy < 0 ? 1 : dy > 0 ? 2 : dx < 0 ? 3 : dx > 0 ? 4 : 0); } catch (e) {}
      return;
    }
    // Anywhere else (a browser preview): a short tick synthesised with Web Audio, no sound file.
    try {
      var Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      AC = AC || new Ctx();
      if (AC.state === "suspended") AC.resume();
      var now = AC.currentTime;
      // A mid body (triangle, 520 -> 300 Hz) plus a faint bright transient, gone within ~60 ms.
      var o = AC.createOscillator(), g = AC.createGain();
      o.type = "triangle";
      o.frequency.setValueAtTime(520, now);
      o.frequency.exponentialRampToValueAtTime(300, now + 0.045);
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(0.16, now + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);
      o.connect(g); g.connect(AC.destination);
      o.start(now); o.stop(now + 0.07);
      var c = AC.createOscillator(), cg = AC.createGain();
      c.type = "sine";
      c.frequency.setValueAtTime(1800, now);
      cg.gain.setValueAtTime(0.0001, now);
      cg.gain.exponentialRampToValueAtTime(0.04, now + 0.002);
      cg.gain.exponentialRampToValueAtTime(0.0001, now + 0.015);
      c.connect(cg); cg.connect(AC.destination);
      c.start(now); c.stop(now + 0.02);
    } catch (e) {}
  }

  // The remote's own Settings/gear key (KEYCODE_SETTINGS = 176, or e.key "Settings"/"TvSettings").
  // couch-tv has no system home behind it, so it opens couch-tv's own gear menu, like the gear tile.
  function isSettings(e) { return e.key === "Settings" || e.key === "TvSettings" || e.keyCode === 176; }
  function settingsKey() {
    if (zone === "gear" || zone === "settings" || zone === "smart" || zone === "appmenu" || zone === "updask" ||
      zone === "inputs" || zone === "clock" || zone === "clockbar") { goHome(); return; }
    openGear();
  }

  document.addEventListener("keydown", function (e) {
    if (typingKey(e)) return;   // typing a place or a name: the keys belong to the text box
    if (isOk(e)) {
      e.preventDefault();
      if (e.repeat || okDown) return;   // a held key repeating: the timer is already running
      okDown = true; okHeld = false;
      blip(0, 0);
      okTimer = setTimeout(function () { okHeld = true; if (!hold()) activate(); ensureFocus(); }, HOLD_MS);
      return;
    }
    var arrow = arrowOf(e);
    if (arrow) { blip(arrow[0], arrow[1]); move(arrow[0], arrow[1]); }
    else if (isBack(e)) goHome();
    else if (isSettings(e)) { if (!e.repeat) settingsKey(); }   // the remote's own Settings/gear key
    else if (isMenu(e)) { if (!e.repeat) hold(); }   // optional: many remotes have no Menu key
    else { ensureFocus(); return; }                   // anything else is not ours: Android gets it
    e.preventDefault();
    ensureFocus();
  });
  document.addEventListener("keyup", function (e) {
    if (!isOk(e) || isTyping()) return;
    e.preventDefault();
    if (!okDown) return;
    var held = okHeld;
    okReset();
    if (!held) activate();
    ensureFocus();
  });
  window.addEventListener("blur", okReset);

  // ---------------- data ----------------
  function nativeApps() {
    var list;
    try { list = JSON.parse(TV.apps()); } catch (e) { return null; }
    return list.map(function (a) {
      return { kind: "app", name: RENAME[a.package] ? t(RENAME[a.package]) : a.label, package: a.package,
        banner: TV.bannerUrl ? TV.bannerUrl(a.package) : "http://tvos.invalid/banner/" + a.package };   // the launcher makes one when the app has none
    });
  }
  function sortApps(list) {
    var rank = function (p) {
      var i = APP_ORDER.indexOf(p);
      if (i >= 0) return i;
      i = APP_LAST.indexOf(p);
      return i >= 0 ? 2000 + i : 1000;
    };
    return list.filter(function (a) { return HIDDEN.indexOf(a.package) < 0; })
      .sort(function (a, b) { return rank(a.package) - rank(b.package) || a.name.localeCompare(b.name); });
  }

  function render() {
    renderShelf();
    renderGrid();
    if (!touched && zone !== "updask") startFocus();
    paintFocus();
  }

  function bridgeOrder(j) {
    data.order = { saved: !!j.saved, line: j.line, packages: (j.apps || []).map(function (a) { return a.package; }) };
    var lo = kept("tvhome.order.tv");
    if (lo && lo.pending && lo.packages) {
      data.order = { saved: true, line: lo.line, packages: lo.packages };
      api("POST", "/api/app-order", { order: lo.packages, line: lo.line })
        .then(function () { lo.pending = false; keep("tvhome.order.tv", lo); }, function () {});
    }
  }

  function sendWatchNext() {
    if (!TV || !TV.watchNext) return Promise.resolve();
    var rows = [];
    try { rows = JSON.parse(TV.watchNext()) || []; } catch (e) {}
    rows = rows.filter(function (r) { return r.package && r.title; }).map(function (r) {
      return { package: r.package, title: r.title, episode_title: r.episode_title || null,
        season: r.season || null, episode: r.episode || null, engaged: r.engaged || 0 };
    });
    return api("POST", "/api/watch-next", { rows: rows });
  }

  function refresh() {
    // never reshuffle under something being moved, or under the settings screen
    if (lift || zone === "settings" || zone === "gear" || zone === "smart" || zone === "updask") return Promise.resolve();
    if (OFFLINE) {
      // only the TV's own apps, in the order last saved; no Screens
      if (TV) data.apps = sortApps(nativeApps() || []);
      else if (window.MOCK_APPS) data.apps = sortApps(window.MOCK_APPS.slice());
      data.bridge = false;
      // Keep watching with no computer: Android's own Watch Next list
      data.shows = [];
      if (TV && TV.watchNext) {
        try { data.shows = JSON.parse(TV.watchNext()) || []; } catch (e) {}
      }
      detectNew();
      status(ALONE ? "" : t("computer_off"), true);
      render();
      return Promise.resolve();
    }
    var jobs = [
      // Keep watching for this TV (the bridge gathers it across everyone who watched here)
      api("GET", "/api/continue", null, 9000).then(function (j) { data.shows = (j.items || []).slice(0, KEEP_MAX); }),
      api("GET", "/api/screens").then(function (j) { data.screens = j.screens || []; }),
      (TV || PREVIEW || MOCK) ? Promise.resolve() : api("GET", "/api/apps").then(function (j) { data.bridgeApps = j.apps || []; }),
      // the order arranged on the phone (or with this TV's remote)
      NIGHT ? api("GET", "/api/app-order").then(bridgeOrder) : Promise.resolve(),
      // Home settings: the bridge keeps a copy, so the phone and this TV agree
      syncSettings(),
      // Android's Watch Next rows: this app may read them, the bridge's ADB may not. They name a
      // play an app gave no title for (Netflix sends none, Prime only its own name, issue #23).
      sendWatchNext()
    ];
    return Promise.all(jobs.map(function (p) { return p.then(function () { return true; }, function () { return false; }); }))
      .then(function (ok) {
        if (lift || zone === "settings" || zone === "gear" || zone === "smart" || zone === "updask") return;
        data.bridge = ok[0] || ok[1];
        var apps = TV ? nativeApps() : (window.MOCK_APPS ? window.MOCK_APPS.slice() : null);
        if (!apps) apps = (data.bridgeApps || []).filter(function (a) { return a.installed !== false && a.id !== "home"; })
          .map(function (a) { return { kind: "app", id: a.id, name: a.name, package: a.package, colour: a.colour }; });
        data.apps = sortApps(apps);
        if (!data.bridge) {   // no bridge: the order this TV keeps itself
          var lo = kept("tvhome.order.tv");
          if (lo && lo.packages) data.order = { saved: true, line: lo.line, packages: lo.packages };
        }
        reportApps();
        detectNew();
        status(data.bridge ? "" : t("computer_quiet"), true);
        if (data.bridge) save();
        render();
        clearTimeout(retryTimer);
        if (!ok[0] && !ok[1]) { retryMs = Math.min(retryMs * 2, 60000); retryTimer = setTimeout(refresh, retryMs); }
        else retryMs = 2500;
      });
  }

  // the native side calls these
  // Home on the remote also re-reads the lists, so an order arranged on the phone shows straight away
  window.tv = { back: goHome, home: function () { if (zone === "settings") closeSettings(); else goHome(); refresh(); },
    noDream: function () { note(t("no_dream")); },
    // the remote's Settings/gear key, caught by the launcher natively (MainActivity.dispatchKeyEvent)
    settingsKey: function () { blip(0, 0); settingsKey(); },
    resume: function () { okReset(); refresh(); if (!OFFLINE) refreshQuick(); refreshWeather(); startVideo(); refreshMusic(); if (window.AmbientWeather) window.AmbientWeather.resume(); },
    // an app is in front: the video background stops until the home is back
    pause: pauseVideo,
    // the launcher's file picker has copied the chosen photos into its own storage (Home settings)
    photosAdded: function (names) { photosAdded(names); },
    // the launcher's updater has news (Updater.kt)
    update: function (state) { updChanged(state); } };

  function start() {
    readConfig();
    staticText();
    initSettings();
    // Home settings gets an Updates section, before About, where the launcher can update itself
    if (updRead() && UPD.supported) SECS.splice(SECS.length - 1, 0, ["updates", "download"]);
    mark("app-start");
    clock();
    setInterval(clock, 15000);
    if (NIGHT) {
      if (window.AmbientWeather) {
        window.AmbientWeather.init($("weather-canvas"), $("ambient-lighting"));
        ambientSync();
      }
      buildScenes();
      // ?scene=fog starts on that scene, for previews (?scene=own: the first of the household's
      // photos; ?scene=<id>: one of your own scenes)
      var first = (Q.match(/[?&]scene=([a-z0-9]+)/) || [])[1];
      showScene(Math.max(0, SCENES.map(function (s) { return s.own ? "own" : s.id; }).indexOf(first)));
      armScenes();
      // the chosen clock font must be in before the glass is measured
      var lf = CK_LOAD[ck("clock_font")] || CK_LOAD.antonio;
      if (document.fonts) document.fonts.load(lf[0] + ' 10px "' + lf[1] + '"').then(function () { glassShown = ""; clock(); }, function () {});
      refreshWeather();
      setInterval(refreshWeather, WX_EVERY * 60000);
    }
    photo = photoForHour(new Date().getHours());
    showPhoto();
    startVideo();
    photoTimer = setInterval(nextPhoto, PHOTO_MS);
    var cached = load();
    if (cached) { data.screens = cached.screens || []; data.order = cached.order || null; }
    if (OFFLINE) {   // no bridge: an order made with this TV's remote wins
      var lo = kept("tvhome.order.tv");
      if (lo && lo.packages) data.order = { saved: true, line: lo.line, packages: lo.packages };
    }
    if (TV) data.apps = sortApps(nativeApps() || []);
    if (cached || TV) { render(); mark("home-painted-from-cache"); }
    if (NIGHT) $("np-slot").appendChild($("np"));   // Now playing: the first card of the row
    renderQuick();
    if (!OFFLINE) refreshQuick();
    refreshMusic();
    setInterval(refreshMusic, 5000);
    // The lists, then once the home is up: the one-time "tell you about new versions?" question.
    Promise.resolve().then(refresh).then(function () { mark("home-painted-live"); updTell(); updAsk(); });
  }

  if (MOCK || PREVIEW) {
    var sc = document.createElement("script");
    sc.src = "mock.js?v=" + Date.now();   // a preview always picks up an edited mock.js
    sc.onload = start;
    document.head.appendChild(sc);
  } else {
    start();
  }
})();
