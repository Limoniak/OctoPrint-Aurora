# Changelog

## 0.3.0 – 2026-10-31

Features inspired by other OctoPrint interface plugins.

### New
- Print alerts (like the browser notification plugins): a chime and/or a browser notification when a print finishes, fails, or pauses on its own (filament change, runout). Pauses asked for by the user and cancelled prints raise no alert. The chime is generated in the browser (no sound file) and plays once the page has been clicked; notifications need OctoPrint over HTTPS or localhost, and the settings say so, ask the browser's permission, and offer a Test button. Both off by default.
- Full screen webcam (like the full screen webcam plugins): button in the floating webcam's bar, or a double-click on the picture. Turned and mirrored streams fill the screen too.
- Touch screen density (like TouchUI's large controls): buttons, fields, tabs and menus at least 44px high (36px for small buttons), 16px text in fields (no zoom on iPhones), file buttons on their own line, field groups kept aligned.
- Custom CSS (like Themeify's custom rules): a field in the settings, applied after the theme while it is on, previewed as you type and reverted if the settings are closed without saving; up to 20,000 characters.
- Project website: https://limoniak.github.io/OctoPrint-Aurora/

## 0.2.6 – 2026-10-31

### Phones
- OctoPrint's main page declares no viewport, so phones laid it out as a 980px desktop page shrunk to fit, and Aurora's phone layout never applied there. While Aurora is on, the page now declares the device width (a viewport set by another plugin, such as UI Customizer's responsive mode, is left alone, and Aurora's is removed when the theme is turned off).
- On phones the navbar, which plugins' items can spread over several lines, scrolls away with the page instead of staying pinned and covering a third of the screen.
- Floating webcam: a corner grip replaces the browser's resize handle, which does not exist on touch screens; it works with a mouse, a pen or a finger.

### Accessibility
- Grid view: thumbnails are buttons, reachable with Tab and activated with Enter or Space (OctoPrint's file names cannot be reached by keyboard), with a visible focus ring.
- Floating webcam: Escape closes it and gives the focus back to its navbar button.
- Print card: the progress ring is labelled with the file name for screen readers.

### Translations
- German: "Abbrechen" (was "Abbruch"), "Druckt" (was "Drucke"), "Verstrichen" (was "Vergangen").
- Clearer wording for bringing the webcam back from picture in picture (French, German, Italian, Spanish, Portuguese).
- Spanish: "Disposición" for the layout heading, like the rest of the page. Russian: clearer Themeify warning.

## 0.2.5 – 2026-10-31

### Fixes
- UI Customizer on narrow screens: its collapsible navbar menu was forced open by Aurora's narrow-screen navbar rules, and its menu button did nothing. Those rules now leave UI Customizer's menu alone.
- Link-style buttons (recent terminal commands, "Clear"…) turned into grey boxes while focused, after a click.
- The dropdown half of split buttons lost its keyboard focus ring.
- Date, time and color fields now get the same focus ring as the other fields.
- Read-only fields (API keys, URLs to copy) showed a "not allowed" cursor; it is kept for disabled fields only.
- The blur behind the "offline" and drag-and-drop overlays now also works in Safari before version 18.

### Tests and documentation
- New unit test: the login page route passes exactly the variables its template uses.
- README: browser support stated as tested (Chromium) versus expected (Firefox, Safari); performance figures; accent shade adjustment; how TouchUI was checked.
- Plugin listing: compatibility written as ">=1.11.0", and the screenshot to copy is docs/settings.png.

### Checked
- Every line of the stylesheet, the login page template, the scripts changed since their last review, the tests and the documentation.

## 0.2.4 – 2026-10-31

### Fixes
- The login page template is loaded with the plugin's template prefix: loading it without was deprecated by OctoPrint and slated for removal in 2.0, which would have left the login page unstyled.
- UI Customizer: on narrow screens its compact navbar menu kept a light grey background, on which the dark theme's text was nearly invisible.
- Floating webcam: right after opening, the size of the blank placeholder could be taken for the stream's, giving a square window.
- Floating webcam: a position saved in a larger browser window could leave it off screen; it is brought back into view whenever it appears.
- Floating webcam: a touch drag interrupted by the system no longer leaves the window stuck in dragging mode.
- Floating webcam: works with OctoPrint versions before 1.9, whose webcam settings were not in the Classic Webcam plugin, instead of failing.
- Every on/off setting is now checked when saved (five of them were not), and an invalid corner radius in config.yaml no longer breaks the login page.

### Improvements
- Print status card: printers with several hotends show each one ("T0 215 °C · T1 180 °C").

### Checked
- Full review of the Python, templates, JavaScript and CSS.
- UI Customizer and Themeify with this version; TouchUI simulated.
- All six translations on the settings, print card and terminal tools, desktop and phone: no clipped or overflowing text.
- Two hotends and a heated chamber, and 300 files in grid view (decorated in about a second, smooth scrolling).
- The plugin's code on Python 3.8 and with the Python 3.7 grammar.

## 0.2.3 – 2026-10-31

### Colors
- An accent too close to the theme's background (a white or yellow accent in the light theme, a black or dark blue one in the dark theme, including OctoPrint's instance colors used as accent) made the active tab, buttons and panel icons disappear. Aurora now uses the nearest darker or lighter shade of it that stands out at 3:1 (WCAG minimum for buttons and icons), in the interface and on the login page, and says so under the color picker. The nine presets are never changed.
- The instance color stripe gets the same treatment, so a white stripe stays visible in the light theme.
- Links in alerts and notifications take the message's own color (underlined): the accent color was not readable on every alert type.
- Red error text in the light theme reaches 4.5:1 on every background.
- Dark (inverse) labels and badges now match the dark button, and "info" progress bars are blue like the other info elements.

### Buttons
- Dark (inverse) buttons no longer turn light on hover or when pressed (dark in the dark theme).
- Colored buttons keep their color while pressed on touch screens instead of turning grey.
- The -/+ buttons of the temperature table had 4px corners instead of the theme's radius.

Checked: 586 buttons on every tab, settings page and dialog, in both themes. They follow five sizes with one corner radius, line up with their neighbours, and fields and buttons in groups have the same height.

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
