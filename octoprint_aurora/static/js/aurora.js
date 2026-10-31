/*
 * Aurora UI for OctoPrint
 *
 * Applies the theme to <html> (class, data attributes and CSS custom
 * properties), themes the temperature graph and provides the settings and
 * navbar view model.
 */
(function () {
    var CACHE_KEY = "aurora.cache";
    var INSTANCE_KEY = "aurora.instanceColor";

    // OctoPrint's navbar colors (Settings > Appearance), from its
    // octoprint.less. Same values as INSTANCE_COLORS in __init__.py.
    var INSTANCE_COLORS = {
        red: "#bd362f",
        orange: "#f27728",
        yellow: "#f2de28",
        green: "#77ff28",
        blue: "#0044cc",
        violet: "#7728ff",
        black: "#383838",
        white: "#eeeeee"
    };
    var MODE_OVERRIDE_KEY = "aurora.modeOverride";

    var DEFAULTS = {
        enabled: true,
        mode: "auto",
        accent: "#6d4aff",
        logo: "aurora",
        instance: "stripe",
        density: "comfortable",
        radius: 14,
        sidebar: "left",
        wide: true,
        glass: true,
        watermark: false,
        graph: true,
        print_card: true,
        tab_progress: true,
        webcam_float: true,
        terminal_tools: true,
        file_grid: true,
        terminal_favorites: ["M114", "M105", "M503", "G28", "M84"],
        layout_sidebar_order: [],
        layout_sidebar_hidden: [],
        layout_tabs_order: [],
        layout_tabs_hidden: []
    };

    var root = document.documentElement;
    var darkQuery = window.matchMedia
        ? window.matchMedia("(prefers-color-scheme: dark)")
        : null;
    var current = null;
    var instanceColorName = null;

    function storageGet(key) {
        try {
            return window.localStorage.getItem(key);
        } catch (e) {
            return null;
        }
    }

    function storageSet(key, value) {
        try {
            if (value === null || value === undefined) {
                window.localStorage.removeItem(key);
            } else {
                window.localStorage.setItem(key, value);
            }
        } catch (e) {
            // storage unavailable (private mode etc), nothing to persist
        }
    }

    function withDefaults(config) {
        var result = {};
        for (var key in DEFAULTS) {
            result[key] =
                config && config[key] !== undefined && config[key] !== null
                    ? config[key]
                    : DEFAULTS[key];
        }
        return result;
    }

    function hexToRgb(hex) {
        var match = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex || "");
        if (!match) return null;
        return [parseInt(match[1], 16), parseInt(match[2], 16), parseInt(match[3], 16)];
    }

    // Pick black or white text depending on the accent's relative luminance
    function contrastColor(hex) {
        var rgb = hexToRgb(hex);
        if (!rgb) return "#ffffff";
        var channels = rgb.map(function (c) {
            c = c / 255;
            return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
        });
        var luminance = 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
        // contrast with white vs. with #0b0d14 (relative luminance ~0.004)
        var withWhite = 1.05 / (luminance + 0.05);
        var withDark = (luminance + 0.05) / 0.054;
        return withDark > withWhite ? "#0b0d14" : "#ffffff";
    }

    function modeOverride() {
        return storageGet(MODE_OVERRIDE_KEY);
    }

    function resolveTheme(config) {
        var mode = modeOverride() || config.mode;
        if (mode === "auto" || (mode !== "light" && mode !== "dark")) {
            mode = darkQuery && darkQuery.matches ? "dark" : "light";
        }
        return mode;
    }

    function setMetaThemeColor(theme) {
        var meta = document.querySelector('meta[name="theme-color"]');
        if (!meta) {
            meta = document.createElement("meta");
            meta.name = "theme-color";
            document.head.appendChild(meta);
        }
        meta.content = theme === "dark" ? "#0b0d14" : "#f3f4f9";
    }

    // Same nozzle glyph as static/img/brand.svg, on a 32×32 grid
    var BRAND_GLYPH =
        '<rect x="9" y="3" width="14" height="9" rx="2"/>' +
        '<path d="M12 12h8l-2.7 7.6a1 1 0 0 1-.94.67h-.72a1 1 0 0 1-.94-.67z"/>' +
        '<rect x="3" y="22.4" width="15.5" height="3.8" rx="1.9"/>' +
        '<rect x="3" y="27.4" width="26" height="2.2" rx="1.1" opacity=".45"/>';
    var originalFavicons = null;
    var lastFavicon;

    // Mix two hex colors, like color-mix(in srgb, a weight, b) in the CSS
    function mixHex(a, b, weight) {
        var ca = hexToRgb(a);
        var cb = hexToRgb(b);
        return (
            "#" +
            ca
                .map(function (c, i) {
                    var v = Math.round(c * weight + cb[i] * (1 - weight));
                    return ("0" + v.toString(16)).slice(-2);
                })
                .join("")
        );
    }

    function brandFavicon(accent) {
        var svg =
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">' +
            '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">' +
            '<stop offset="0" stop-color="' + accent + '"/>' +
            '<stop offset="1" stop-color="' + mixHex(accent, "#ff7ac6", 0.55) + '"/>' +
            "</linearGradient></defs>" +
            '<rect width="32" height="32" rx="8" fill="url(#g)"/>' +
            '<g fill="#fff" transform="translate(6 6) scale(.625)">' + BRAND_GLYPH + "</g></svg>";
        return "data:image/svg+xml," + encodeURIComponent(svg);
    }

    // Print progress as a ring around the nozzle, set by aurora_progress.js
    var faviconProgress = null;
    var faviconAccent = DEFAULTS.accent;

    function progressFavicon(accent, progress) {
        var circumference = 2 * Math.PI * 13;
        var done = Math.max(0, Math.min(1, progress / 100)) * circumference;
        var svg =
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">' +
            '<circle cx="16" cy="16" r="13" fill="none" stroke="#8b93a7" stroke-opacity=".35" stroke-width="5"/>' +
            '<circle cx="16" cy="16" r="13" fill="none" stroke="' + accent + '" stroke-width="5"' +
            ' stroke-linecap="round" stroke-dasharray="' + done.toFixed(2) + " " + circumference.toFixed(2) + '"' +
            ' transform="rotate(-90 16 16)"/>' +
            '<g fill="' + accent + '" transform="translate(9 9) scale(.4375)">' + BRAND_GLYPH + "</g></svg>";
        return "data:image/svg+xml," + encodeURIComponent(svg);
    }

    function setFavicon(useBrand, accent) {
        if (originalFavicons === null) {
            originalFavicons = Array.prototype.map.call(
                document.querySelectorAll('link[rel~="icon"]'),
                function (link) {
                    return {link: link, href: link.getAttribute("href")};
                }
            );
        }
        if (accent) faviconAccent = accent;
        var active = root.classList.contains("aurora");
        var href = null;
        if (active && faviconProgress !== null && current && current.tab_progress) {
            href = progressFavicon(faviconAccent, faviconProgress);
        } else if (active && useBrand) {
            href = brandFavicon(faviconAccent);
        }
        // the browser decodes the icon again on each change: skip repeats
        if (href === lastFavicon) return;
        lastFavicon = href;
        originalFavicons.forEach(function (entry) {
            entry.link.setAttribute("href", href || entry.href);
        });
    }

    function apply(config) {
        var previous = current;
        current = withDefaults(config);
        cssCache = {};

        // TouchUI replaces the whole interface and marks <html id="touch">:
        // stay out of its way while it is active.
        var enabled = !!current.enabled && root.id !== "touch";
        root.classList.toggle("aurora", enabled);
        if (window.AuroraUI) AuroraUI.active(enabled);
        window.setTimeout(themeGcodeViewer, 0);
        if (!enabled) {
            setFavicon(false);
            return;
        }

        var theme = resolveTheme(current);
        var accent = hexToRgb(current.accent) ? current.accent : DEFAULTS.accent;
        var instanceColor = INSTANCE_COLORS[instanceColorName];
        if (current.instance === "accent" && instanceColor) accent = instanceColor;
        root.classList.toggle("aurora-instance-stripe", current.instance === "stripe" && !!instanceColor);
        root.style.setProperty("--a-instance", instanceColor || "transparent");
        var radius = parseInt(current.radius, 10);
        if (isNaN(radius)) radius = DEFAULTS.radius;

        root.setAttribute("data-aurora-theme", theme);
        root.setAttribute("data-aurora-density", current.density);
        root.setAttribute("data-aurora-logo", current.logo);
        root.setAttribute("data-aurora-sidebar", current.sidebar);
        root.classList.toggle("aurora-wide", !!current.wide);
        root.classList.toggle("aurora-glass", !!current.glass);
        root.classList.toggle("aurora-no-watermark", !current.watermark);
        root.style.setProperty("--a-accent", accent);
        root.style.setProperty("--a-on-accent", contrastColor(accent));
        root.style.setProperty("--a-radius", radius + "px");
        // accent-derived colors as plain values (no color-mix() needed)
        root.style.setProperty("--a-accent-2", mixHex(accent, "#ff7ac6", 0.55));
        root.style.setProperty("--a-accent-soft", withAlpha(accent, 0.14));
        root.style.setProperty("--a-accent-ring", withAlpha(accent, 0.35));
        root.style.setProperty("--a-glow-1", withAlpha(accent, 0.16));
        root.style.setProperty("--a-glow-2", withAlpha(accent, 0.09));
        root.style.setProperty(
            "--a-accent-text",
            theme === "dark" ? mixHex(accent, "#ffffff", 0.6) : mixHex(accent, "#000000", 0.62)
        );
        setMetaThemeColor(theme);
        setFavicon(current.logo === "aurora", accent);

        if (
            !previous ||
            previous.graph !== current.graph ||
            previous.enabled !== current.enabled ||
            previous._theme !== theme
        ) {
            redrawTemperatureGraph();
        }
        current._theme = theme;
    }

    function reapply() {
        if (current) apply(current);
    }

    // What the feature modules (aurora_*.js) need from the theme core
    var themeActive = ko.observable(false);
    window.AuroraUI = {
        // true while the theme is applied (enabled, and TouchUI not in use)
        active: themeActive,
        setTabProgress: function (progress) {
            faviconProgress = progress === null || progress === undefined ? null : +progress;
            setFavicon(current && current.logo === "aurora");
        },
        storageGet: storageGet,
        storageSet: storageSet
    };

    function setInstanceColor(name) {
        if (name === instanceColorName) return;
        instanceColorName = name;
        storageSet(INSTANCE_KEY, name);
        reapply();
    }

    // Apply the cached configuration as early as possible to avoid a flash
    // of the stock theme while the settings are being fetched.
    instanceColorName = storageGet(INSTANCE_KEY);
    try {
        apply(JSON.parse(storageGet(CACHE_KEY) || "null") || DEFAULTS);
    } catch (e) {
        apply(DEFAULTS);
    }

    // TouchUI may switch on or off after this script ran
    if (window.MutationObserver) {
        new MutationObserver(reapply).observe(root, {attributes: true, attributeFilter: ["id"]});
    }

    if (darkQuery) {
        var onSchemeChange = function () {
            if (current && (modeOverride() || current.mode) === "auto") reapply();
        };
        if (darkQuery.addEventListener) {
            darkQuery.addEventListener("change", onSchemeChange);
        } else if (darkQuery.addListener) {
            darkQuery.addListener(onSchemeChange);
        }
    }

    // ----- Temperature graph theming -----------------------------------

    var SERIES_COLORS = {
        red: "--a-graph-1",
        blue: "--a-graph-2",
        orange: "--a-graph-3",
        green: "--a-graph-4",
        brown: "--a-graph-5",
        purple: "--a-graph-6",
        black: "--a-graph-7"
    };
    var targetColorMap = null;

    // Theme colors read from the stylesheet. The temperature graph asks for
    // them on every update (every second or so while printing), and each
    // read can force the browser to recompute styles: they are kept until
    // the theme changes. Empty values (stylesheet not loaded yet) are not kept.
    var cssCache = {};

    function cssVar(name) {
        if (cssCache[name]) return cssCache[name];
        var value = getComputedStyle(root).getPropertyValue(name).trim();
        if (value) cssCache[name] = value;
        return value;
    }

    function graphThemed() {
        return current && current.enabled && current.graph;
    }

    // Target series are drawn by OctoPrint as 50% tints of the actual color,
    // so build a lookup from those tints back to the base color name.
    function targetColors() {
        if (targetColorMap || !window.pusher) return targetColorMap || {};
        targetColorMap = {};
        for (var name in SERIES_COLORS) {
            try {
                targetColorMap[window.pusher.color(name).tint(0.5).html()] = name;
            } catch (e) {
                // unknown color for pusher, skip it
            }
        }
        return targetColorMap;
    }

    function withAlpha(color, alpha) {
        var rgb = hexToRgb(color);
        if (!rgb) return color;
        return "rgba(" + rgb.join(",") + "," + alpha + ")";
    }

    function themeSeries(data) {
        if (!$.isArray(data)) return data;
        var tints = targetColors();
        return $.map(data, function (series) {
            if (!series || typeof series.color !== "string") return [series];
            var color = series.color;
            if (SERIES_COLORS[color]) {
                return [$.extend({}, series, {color: cssVar(SERIES_COLORS[color])})];
            }
            if (tints[color]) {
                return [
                    $.extend({}, series, {
                        color: withAlpha(cssVar(SERIES_COLORS[tints[color]]), 0.5)
                    })
                ];
            }
            return [series];
        });
    }

    function themeOptions(options) {
        var themed = $.extend(true, {}, options);
        themed.grid = $.extend(themed.grid || {}, {
            color: cssVar("--a-text-3"),
            borderColor: cssVar("--a-border-strong"),
            tickColor: cssVar("--a-border"),
            borderWidth: 1
        });
        return themed;
    }

    if ($ && $.plot) {
        var originalPlot = $.plot;
        var themedPlot = function (placeholder, data, options) {
            if (!$(placeholder).is("#temperature-graph")) {
                return originalPlot.apply(this, arguments);
            }

            var plot = originalPlot.call(
                this,
                placeholder,
                graphThemed() ? themeSeries(data) : data,
                graphThemed() ? themeOptions(options) : options
            );

            // live updates go through setData, theme those as well
            var originalSetData = plot.setData;
            plot.setData = function (newData) {
                return originalSetData.call(
                    this,
                    graphThemed() ? themeSeries(newData) : newData
                );
            };
            return plot;
        };
        for (var prop in originalPlot) {
            if (Object.prototype.hasOwnProperty.call(originalPlot, prop)) {
                themedPlot[prop] = originalPlot[prop];
            }
        }
        $.plot = themedPlot;
    }

    var graphRedrawPending = false;

    function redrawTemperatureGraph() {
        // Flot cannot draw into a hidden placeholder (width 0): wait for the
        // temperature tab to be shown, see onAfterTabChange.
        if (!$("#temperature-graph").is(":visible")) {
            graphRedrawPending = true;
            return;
        }
        graphRedrawPending = false;
        try {
            var vm =
                window.OctoPrint &&
                OctoPrint.coreui &&
                OctoPrint.coreui.viewmodels &&
                OctoPrint.coreui.viewmodels.temperatureViewModel;
            if (vm && vm.plot && vm._initializePlot) {
                // defer so the new CSS custom properties are already applied
                window.setTimeout(function () {
                    vm._initializePlot(true);
                }, 0);
            }
        } catch (e) {
            // graph not available, nothing to redraw
        }
    }

    // ----- GCode viewer theming -----------------------------------------

    var GCODE_KEYS = ["bgColorGrid", "bgColorOffGrid", "colorGrid", "colorLine"];
    var gcodeDefaults = null;

    // The renderer paints the bed with a hard-coded white fill (its
    // bgColorGrid option is unused), so swap that one color on its canvas.
    var gcodeCanvasPatched = false;

    function patchGcodeCanvas() {
        if (gcodeCanvasPatched) return;
        var canvas = document.getElementById("gcode_canvas");
        var descriptor = Object.getOwnPropertyDescriptor(
            CanvasRenderingContext2D.prototype,
            "fillStyle"
        );
        if (!canvas || !canvas.getContext || !descriptor) return;

        var ctx = canvas.getContext("2d");
        Object.defineProperty(ctx, "fillStyle", {
            configurable: true,
            get: function () {
                return descriptor.get.call(this);
            },
            set: function (value) {
                if (
                    current &&
                    current.enabled &&
                    typeof value === "string" &&
                    value.toLowerCase() === "#ffffff"
                ) {
                    value = cssVar("--a-canvas") || value;
                }
                descriptor.set.call(this, value);
            }
        });
        gcodeCanvasPatched = true;
    }

    function themeGcodeViewer() {
        patchGcodeCanvas();
        var renderer = window.GCODE && GCODE.renderer;
        if (!renderer || !renderer.setOption || !renderer.getOptions) return;

        if (gcodeDefaults === null) {
            var options = renderer.getOptions();
            gcodeDefaults = {};
            GCODE_KEYS.forEach(function (key) {
                gcodeDefaults[key] = $.isArray(options[key]) ? options[key].slice() : options[key];
            });
        }

        if (!current || !current.enabled) {
            renderer.setOption(gcodeDefaults);
            return;
        }
        renderer.setOption({
            bgColorGrid: cssVar("--a-canvas"),
            bgColorOffGrid: cssVar("--a-canvas-off"),
            colorGrid: cssVar("--a-canvas-grid"),
            colorLine: [
                cssVar("--a-accent"),
                cssVar("--a-graph-2"),
                cssVar("--a-graph-1"),
                cssVar("--a-graph-4"),
                cssVar("--a-graph-6")
            ]
        });
    }

    // ----- View model ---------------------------------------------------

    function AuroraViewModel(parameters) {
        var self = this;

        self.settingsViewModel = parameters[0];
        // used by the layout and favorites editors in the settings page
        self.layout = parameters[1];
        self.terminal = parameters[2];
        self.s = undefined;
        self.saved = undefined;
        self.dialogOpen = false;

        // all of these keep white text at 4.5:1 or more
        self.presets = [
            "#6d4aff",
            "#2563eb",
            "#0e7490",
            "#047857",
            "#4d7c0f",
            "#b45309",
            "#c2410c",
            "#dc2626",
            "#db2777"
        ];

        // Themeify is another full theme; both at once give mixed results
        self.themeifyActive = ko.observable(false);
        self.touchUiActive = ko.observable(false);

        self.isDark = ko.observable(root.getAttribute("data-aurora-theme") === "dark");

        self.toggleTitle = ko.pureComputed(function () {
            return self.isDark()
                ? gettext("Switch to light theme")
                : gettext("Switch to dark theme");
        });

        self.snapshot = function () {
            return ko.toJS(self.s);
        };

        self.applyAndCache = function (config) {
            apply(config);
            storageSet(CACHE_KEY, JSON.stringify(withDefaults(config)));
            self.isDark(root.getAttribute("data-aurora-theme") === "dark");
        };

        self.selectAccent = function (color) {
            self.s.accent(color);
        };

        self.setMode = function (mode) {
            // choosing a mode in the settings drops the per-browser override
            storageSet(MODE_OVERRIDE_KEY, null);
            self.s.mode(mode);
            apply(self.snapshot());
            self.isDark(root.getAttribute("data-aurora-theme") === "dark");
        };

        // Navbar button: per-browser light/dark override on top of the
        // configured mode, so it works without settings permissions.
        self.toggleTheme = function () {
            storageSet(MODE_OVERRIDE_KEY, self.isDark() ? "light" : "dark");
            self.applyAndCache(self.saved || current);
        };

        self.onBeforeBinding = function () {
            self.s = self.settingsViewModel.settings.plugins.aurora;

            // OctoPrint's own instance color (Settings > Appearance)
            ko.computed(function () {
                setInstanceColor(self.settingsViewModel.appearance_color() || null);
            });

            // Runs whenever the plugin settings change: a live preview while
            // the settings dialog is open, otherwise freshly loaded values
            // (initial load, save, or a change made from another browser).
            ko.computed(function () {
                var config = ko.toJS(self.s);
                if (self.dialogOpen) {
                    apply(config);
                    self.isDark(root.getAttribute("data-aurora-theme") === "dark");
                } else {
                    self.saved = config;
                    self.applyAndCache(config);
                }
            });
        };

        self.onSettingsShown = function () {
            self.dialogOpen = true;
            self.themeifyActive(root.classList.contains("themeify"));
            self.touchUiActive(root.id === "touch");
        };

        self.onSettingsBeforeSave = function () {
            self.saved = self.snapshot();
        };

        self.onSettingsHidden = function () {
            self.dialogOpen = false;
            // revert an unsaved preview, including what the other Aurora
            // modules preview from these settings (layout, favorites)
            _.each(self.saved, function (value, key) {
                var observable = self.s[key];
                if (ko.isWriteableObservable(observable) && !_.isEqual(ko.toJS(observable), value)) {
                    observable(_.isArray(value) ? value.slice() : value);
                }
            });
            self.applyAndCache(self.saved);
        };

        self.onAllBound = function () {
            redrawTemperatureGraph();
            themeGcodeViewer();
            warnAboutThemeify();
        };

        // Themeify enables itself when installed: tell the user once per
        // session, since few people would open Aurora's settings to notice.
        var warnAboutThemeify = function () {
            if (!current || !current.enabled || !root.classList.contains("themeify")) return;
            try {
                if (window.sessionStorage.getItem("aurora.themeifyWarned")) return;
                window.sessionStorage.setItem("aurora.themeifyWarned", "1");
            } catch (e) {
                // no session storage: warn every time, that is fine
            }
            new PNotify({
                title: "Aurora UI",
                text: gettext(
                    "Themeify is also active. Two themes at the same time give mixed results: disable one of them."
                ),
                type: "notice",
                hide: false
            });
        };

        self.onAfterTabChange = function (current) {
            if (current === "#temp" && graphRedrawPending) {
                redrawTemperatureGraph();
            }
        };
    }

    OCTOPRINT_VIEWMODELS.push({
        construct: AuroraViewModel,
        dependencies: ["settingsViewModel", "auroraLayoutViewModel", "auroraTerminalViewModel"],
        elements: ["#settings_plugin_aurora", "#navbar_plugin_aurora"]
    });
})();
