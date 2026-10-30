---
layout: plugin

id: aurora
title: Aurora UI
description: A complete redesign of the OctoPrint interface, with light and dark themes, accent colors and a fluid layout.
authors:
- Baptiste Dhumaux
license: AGPL-3.0-or-later

date: 2026-10-30

homepage: https://github.com/Limoniak/OctoPrint-Aurora
source: https://github.com/Limoniak/OctoPrint-Aurora
archive: https://github.com/Limoniak/OctoPrint-Aurora/archive/refs/heads/main.zip

tags:
- ui
- theme
- dark mode
- design
- appearance

screenshots:
- url: /assets/img/plugins/aurora/main-dark.png
  alt: Aurora UI, dark theme
  caption: Dark theme
- url: /assets/img/plugins/aurora/main-light.png
  alt: Aurora UI, light theme
  caption: Light theme
- url: /assets/img/plugins/aurora/settings.png
  alt: Aurora UI settings
  caption: Settings with live preview

featuredimage: /assets/img/plugins/aurora/main-dark.png

compatibility:
  octoprint:
  - 1.11.0
  os:
  - linux
  - windows
  - macos
  - freebsd
  python: ">=3.7,<4"

---

Aurora UI redesigns the whole OctoPrint web interface: card panels, pill tabs, modern buttons and
forms, a styled login page, and a temperature graph and GCode viewer drawn in the theme colors.

* **Light, dark or automatic theme**, following the operating system, with a navbar button to switch per browser.
* **Accent color** of your choice; text on colored buttons stays readable automatically.
* **Layout options**: sidebar left or right, compact density, full width, corner radius.
* **Instance color** from Settings > Appearance shown as a thin stripe, to tell several printers apart.
* **Translated** into English, French, Spanish, Portuguese, Russian, German and Italian.
* **Accessible**: text contrast meets WCAG AA in both themes.

Everything is scoped to the theme, so unticking "Enable" in the settings restores the stock look
instantly. Tested with the ten most used third-party plugins, including UI Customizer.

**Before submitting:** copy `docs/main-dark.png`, `docs/main-light.png` and `docs/settings-light.png`
(as `settings.png`) to `assets/img/plugins/aurora/` in the plugins.octoprint.org repository.
