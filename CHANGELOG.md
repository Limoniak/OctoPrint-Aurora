# Changelog

## 0.2.2 – 2026-10-31

### Performance
- Terminal coloring only runs while the terminal can be seen: while printing with another tab open, it costs nothing, and the lines still in the terminal are colored when it is opened. Each line is built in one operation instead of one element per piece. Style and layout work on the terminal tab during a print is halved.
- The temperature graph no longer reads the theme colors from the stylesheet on every update (about once a second while printing): they are kept until the theme changes.
- Thin scrollbars are set on the elements that scroll instead of on every element: that rule was checked against the ~14,000 elements of the page at each style update.
- The tab icon and title are only rewritten when they change.
- The floating webcam pauses its stream while the page is hidden (another browser tab, a minimized window, a tablet's screen turned off), which spares the Raspberry Pi; picture in picture keeps playing.
- The file list thumbnails are only prepared when the grid view is on.

### Fixes
- With DisplayLayerProgress showing the progress in the browser title (its default), the title flickered between its format and Aurora's. Aurora now leaves the title to it, keeps the progress ring on the tab icon, and says so in its settings.
- The print status card showed "bed 0 °C" while the bed temperature was still unknown.

Measured with Chrome slowed down 4× during a long simulated print, Aurora now adds about 5% of CPU time to stock OctoPrint, and no memory growth.

## 0.2.1 – 2026-10-31

### Fixes
- Floating webcam: once opened, the window kept growing on its own (the saved width was measured border included and applied border excluded).
- Floating webcam: a stream turned by 90° (Settings > Webcam) overflowed its box and was cropped. The window now follows the stream's proportions, portrait when turned, and stays within the screen height.
- Floating webcam: the turn and mirroring are kept after coming back from picture in picture.
- Phones: the settings menu now sits above the pages instead of squeezing them into a narrow column, and form labels go above their fields.
- Phones: the temperature table and the GCode viewer scroll sideways within their tab, instead of squeezing their controls or making the whole page scroll.

## 0.2.0 – 2026-10-31

### Features
- Print status card above the tabs while printing: model thumbnail (Slicer Thumbnails, Cura Thumbnails), progress ring, time left, expected finish time, current layer (DisplayLayerProgress), temperatures, and Pause / Resume / Cancel. First on the page on phones.
- Print progress in the browser tab: title ("42% · file") and a progress ring as the tab icon.
- Floating webcam opened from the navbar: stays on screen on every tab, can be dragged and resized, and popped out into picture-in-picture where the browser supports it. The stream stops when it is closed.
- Terminal tools: G-code coloring, the last commands sent from this browser one click away, and favorite commands as buttons (edited in the settings or starred from the terminal).
- File list grid view: a button in the Files panel header switches between the list and a grid of cards with each model's thumbnail (Slicer Thumbnails, Cura Thumbnails); clicking a thumbnail loads the file or opens the folder. Remembered per browser.
- Customizable layout: hide and reorder sidebar panels and tabs from the settings, with live preview; folded panels stay folded per browser. Turned off when UI Customizer manages the layout.
- Each feature can be turned off in Settings > Aurora UI > Features, and is translated into the six languages.

### Compatibility
- Tested with a fourteen-plugin setup on Python 3.11 (Arc Welder, BLTouch, Change Filament, Cura Thumbnails, Navbar Temperature, Print History, Resource Monitor, Simple Filament Change Buttons, Telegram and others). Print History's summary rows and Resource Monitor's mini graphs now follow the dark theme.

### Documentation
- README rewritten in English, with new screenshots.

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
