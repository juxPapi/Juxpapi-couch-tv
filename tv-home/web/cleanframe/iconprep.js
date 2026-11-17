// In-memory app icon preparation for the Fire TV skin.
// It turns ordinary launcher icons into one simple monochrome mask without extracting or
// redistributing app assets. The original APK icons stay on the device.
(function (root) {
  "use strict";

  var ready = typeof WeakSet !== "undefined" ? new WeakSet() : null;

  function distance(r, g, b, c) {
    var dr = r - c.r, dg = g - c.g, db = b - c.b;
    return Math.sqrt(dr * dr + dg * dg + db * db);
  }

  function dominantEdgeColor(data, w, h) {
    var counts = {}, best = null, n = 0;
    function add(i) {
      var r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
      if (a < 100) return;
      var key = (r >> 4) + ":" + (g >> 4) + ":" + (b >> 4);
      counts[key] = counts[key] || { r: 0, g: 0, b: 0, n: 0 };
      var c = counts[key]; c.r += r; c.g += g; c.b += b; c.n += 1; n += 1;
      if (!best || c.n > best.n) best = c;
    }
    for (var x = 0; x < w; x += 2) { add((0 * w + x) * 4); add(((h - 1) * w + x) * 4); }
    for (var y = 0; y < h; y += 2) { add((y * w + 0) * 4); add((y * w + w - 1) * 4); }
    if (!best) return { r: 0, g: 0, b: 0, n: 0 };
    return { r: best.r / best.n, g: best.g / best.n, b: best.b / best.n, n: best.n };
  }

  function process(img) {
    if (!img || img.complete === false || img.naturalWidth < 4 || img.naturalHeight < 4 || img.__cleanframeIcon) return;
    try {
      var canvas = document.createElement("canvas");
      var max = 128;
      var scale = Math.min(max / img.naturalWidth, max / img.naturalHeight, 1);
      canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
      var ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      var w = canvas.width, h = canvas.height, image;
      try { image = ctx.getImageData(0, 0, w, h); } catch (e) { return; }
      var data = image.data, edge = dominantEdgeColor(data, w, h);
      var opaqueBorder = edge.n >= Math.max(20, Math.round((w + h) * 0.18));
      var threshold = 64;
      var kept = 0;
      for (var i = 0; i < data.length; i += 4) {
        var a = data[i + 3];
        if (a < 35) { data[i + 3] = 0; continue; }
        var foreground = !opaqueBorder || distance(data[i], data[i + 1], data[i + 2], edge) > threshold;
        if (!foreground) { data[i + 3] = 0; continue; }
        data[i] = 255; data[i + 1] = 255; data[i + 2] = 255; data[i + 3] = 255;
        kept += 1;
      }
      if (kept < 12) return;
      ctx.putImageData(image, 0, 0);

      // Crop to the visible mark, then draw it centered on a full 128px transparent canvas.
      var minX = w, minY = h, maxX = -1, maxY = -1;
      for (var y = 0; y < h; y += 1) {
        var row = y * w * 4;
        for (var x = 0; x < w; x += 1) {
          if (data[row + x * 4 + 3]) { minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); }
        }
      }
      if (maxX < minX || maxY < minY) return;
      var crop = document.createElement("canvas");
      crop.width = 128; crop.height = 128;
      var out = crop.getContext("2d");
      out.clearRect(0, 0, 128, 128);
      var bw = maxX - minX + 1, bh = maxY - minY + 1;
      var fit = Math.min(96 / bw, 96 / bh);
      var dw = bw * fit, dh = bh * fit;
      out.imageSmoothingEnabled = true;
      out.imageSmoothingQuality = "high";
      out.drawImage(canvas, minX, minY, bw, bh, (128 - dw) / 2, (128 - dh) / 2, dw, dh);
      img.src = crop.toDataURL("image/png");
      img.__cleanframeIcon = true;
    } catch (e) {
      // A tainted or unusual icon keeps its original pixels; the label remains usable.
    }
  }

  function processAll(rootElement) {
    var images = (rootElement || document).querySelectorAll('img.icon-mark:not([data-iconprep="done"])');
    Array.prototype.forEach.call(images, function (img) {
      img.setAttribute("data-iconprep", "done");
      var src = img.getAttribute("src") || "";
      var fallback = function () {
        if (img.complete) process(img);
        else img.addEventListener("load", function () { process(img); }, { once: true });
      };
      // clearicon.js makes a cleaner white glyph from the app's own icon (transparent background,
      // soft edges, multi-colour marks). The simple mask below is the fallback for icons it refuses.
      if (root.ClearIcon && src && src.slice(0, 5) !== "data:") {
        var immediate = root.ClearIcon.get(src, function (v) {
          if (v) { img.src = v; img.__cleanframeIcon = true; }
          else fallback();
        });
        if (immediate) { img.src = immediate; img.__cleanframeIcon = true; }
        else if (immediate === "") fallback();
      } else {
        fallback();
      }
    });
  }

  root.CleanFrameIcons = { prepare: processAll };
})(typeof window !== "undefined" ? window : this);
