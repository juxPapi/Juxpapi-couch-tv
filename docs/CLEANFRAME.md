# CleanFrame skin for couch-tv (Fire TV)

This is an optional Fire TV skin inspired by [CleanFrame](https://github.com/nthnclrk/CleanFrame).
It is a couch-tv launcher skin, **not** a Samsung or Tizen package and it intentionally includes
nothing from CleanFrame's Samsung TV installation, Art Mode or Home-button setup.

It shows:

- a full-screen photo;
- the time;
- **Art Mode** beside the time, in the top-left;
- your quick buttons in the top-right: **Bluetooth** and **Network** when they are in
  `tvs[].quick`, a **house** button (CleanFrame's settings sheet) and a **gear** (TV settings);
- a frosted dock, centred near the bottom, with your launchable Fire TV apps;
- only a small down-arrow beneath the dock when more apps are available: it opens the full-screen
  app grid. Pressing **Down** from the dock does the same.

## Controls

- **Bluetooth / Network**: the preview says when it cannot open the system panel. On the TV,
  Fire OS opens its own Bluetooth or Wi-Fi settings screen.
- **House**: opens the CleanFrame settings sheet (see below).
- **Gear**: opens the TV's own settings.
- **Art Mode button**: fills the screen with the bundled photos (see below).
- **Down from the dock** opens the grid; **Back** from the grid returns to the dock.
- **Long press OK on an app** lifts it; **Left/Right** move it; **OK** places it; **Back** cancels
  without changing the order. The order is shared with the Night dock and the phone's Arrange apps
  screen.
- **Up** from the dock reaches the quick buttons.

## CleanFrame settings sheet

The house button opens a small sheet:

- **Skin**: CleanFrame or Night scenes, with a check on the current one.
- **Background**: shuffle at each start, or one of the bundled photos (with swatches).
- **Apps on Home**: Arrange apps (as above) or All apps.
- **Home settings**: couch-tv's own settings screen, opened above the skin.
- **TV settings**: the TV's own settings.
- **About**: skin version and source.

## Home settings, Skin tab

Skin is its own **Skin** tab in Home settings. It switches between **CleanFrame** and
**Night scenes** with a tick on the current one. Night stays the default when nothing is saved.

## Art Mode

Art Mode fills the screen with the photos bundled in `cleanframe/wallpapers/`. It rotates the
photos every 30 seconds and keeps the display awake until you press **Home** or **Back**. It
never leaves Art Mode by itself.

The default build includes a small set of landscape photos. Use
`CLEANFRAME_WALLPAPERS` to supply your own larger selection; that same set is used for the home
wallpaper and Art Mode.

CleanFrame's reference design and wallpaper concepts are MIT-licensed by Nathan Clark. The
wallpaper and font are used under their own licences/credits. See `tv-home/web/cleanframe/` for
the bundled assets and attribution.

## Use it

Set this in `config.json`:

```json
{
  "home": {
    "look": "cleanframe"
  }
}
```

`?theme=cleanframe` is handy for a browser preview. The Night look stays the default.

## Build with your own wallpapers

Wallpapers are chosen at **build time**, not read from the internet or from the TV at runtime.
Point the build at a folder of **1920x1080 JPEG, WebP, PNG or AVIF** images:

```sh
CLEANFRAME_WALLPAPERS="/path/to/wallpapers" sh scripts/build-apk.sh
```

On this Windows machine:

```powershell
.\build\build-apk.ps1 "C:\Path\To\Wallpapers"
```

or:

```powershell
$env:CLEANFRAME_WALLPAPERS = "C:\Path\To\Wallpapers"
.\build\build-apk.ps1
```

The folder can contain up to 64 images, each 15 MB or smaller. They are copied into the APK and
listed in `cleanframe/wallpapers.json`; the next time the launcher opens, it picks one at random.
If this variable is not set, the bundled default wallpapers are used.

If you keep the source folder clean of huge files, the APK stays small. A 2 MB wallpaper adds
about 2 MB to the APK.

## Notes and limits

- This skin targets **Fire TV / Android TV**, not Samsung TVs.
- It keeps couch-tv's Android TV app launching and quick settings.
- It does not recreate Samsung's Art Mode, Samsung Home settings or Tizen package flow.
- External wallpapers are licensed by you to include; check their licence/credit requirements
  before shipping an APK publicly.
- The icon preparer reads the icon each app publishes on the TV and draws it as a simplified
  white mark in memory. It does not extract app packages or copy their icons into the APK. An app
  with no icon keeps a monogram.
- Back from the app grid returns to the dock; in Art Mode it exits Art Mode. Home exits Art Mode
  first, otherwise recentres the dock. The house button switches between skins via the sheet.
- If anything goes wrong, set `"look": "night"` and rebuild (or install the normal release).
