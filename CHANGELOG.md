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

### Settings and languages
- Live preview in the settings, reverted when the dialog is closed without saving.
- Interface translated into French, Spanish, Portuguese, Russian, German and Italian.

### Compatibility
- Text contrast meets WCAG AA (4.5:1) in both themes.
- Older browsers without `color-mix()` get the same theme with plain backgrounds instead of tinted ones.
- Tested with the 10 most used third-party plugins (Bed Level Visualizer, PrintTimeGenius, Firmware Updater, Dashboard, UI Customizer, Slicer Thumbnails, Cancelobject, DisplayLayerProgress, Themeify, Preheat Button), plus Octolapse, OctoEverywhere and Obico.
- UI Customizer: its layout is kept, Aurora provides the colors.
- Themeify and TouchUI: Aurora warns when Themeify is also active, and pauses itself while TouchUI is in use.
