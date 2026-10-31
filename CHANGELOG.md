# Changelog

## 0.1.0 – 2026-10-30

First release.

### Design
- Complete redesign of the OctoPrint interface: card panels, pill tabs, buttons, forms, tables, dialogs, menus, notifications, terminal and file list.
- Light, dark or automatic theme (follows the operating system), with a moon/sun button in the navbar to override it per browser.
- Accent color: 9 presets (all readable with white text) or any custom color; the text on colored buttons switches between white and black automatically.
- "Nozzle" logo in the navbar, on the login page and as the browser tab icon; OctoPrint's original logo or text only are available in the settings.
- Temperature graph and GCode viewer drawn in the theme colors.
- Layout: sidebar on the left or right, comfortable or compact density, full width on large screens, adjustable corner radius.
- Styled login page.
- OctoPrint's instance color (Settings > Appearance) shown as a thin stripe at the top, or used as the accent color.

### Features
- Print status card above the tabs while printing: model thumbnail (Slicer Thumbnails, Cura Thumbnails), progress ring, time left, expected finish time, current layer (DisplayLayerProgress), temperatures, and Pause / Resume / Cancel. First on the page on phones.
- Print progress in the browser tab: title ("42% · file") and a progress ring as the tab icon.
- Floating webcam opened from the navbar: stays on screen on every tab, can be dragged and resized, and popped out into picture-in-picture where the browser supports it. The stream stops when it is closed.
- Terminal tools: G-code coloring, the last commands sent from this browser one click away, and favorite commands as buttons (edited in the settings or starred from the terminal).
- Customizable layout: hide and reorder sidebar panels and tabs from the settings, with live preview; folded panels stay folded per browser. Turned off when UI Customizer manages the layout.

### Settings and languages
- Live preview in the settings, reverted when the dialog is closed without saving.
- Interface translated into French, Spanish, Portuguese, Russian, German and Italian.

### Compatibility
- Text contrast meets WCAG AA (4.5:1) in both themes.
- Older browsers without `color-mix()` get the same theme with plain backgrounds instead of tinted ones.
- Tested with the 10 most used third-party plugins (Bed Level Visualizer, PrintTimeGenius, Firmware Updater, Dashboard, UI Customizer, Slicer Thumbnails, Cancelobject, DisplayLayerProgress, Themeify, Preheat Button), plus Octolapse, OctoEverywhere and Obico.
- Tested with a fourteen-plugin setup on Python 3.11 (Arc Welder, BLTouch, Change Filament, Cura Thumbnails, Navbar Temperature, Print History, Resource Monitor, Simple Filament Change Buttons, Telegram and others). Print History's summary rows and Resource Monitor's mini graphs now follow the dark theme.
- UI Customizer: its layout is kept, Aurora provides the colors.
- Themeify and TouchUI: Aurora warns when Themeify is also active, and pauses itself while TouchUI is in use.
