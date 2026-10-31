/*
 * Aurora UI: print status card above the tabs, and print progress in the
 * browser tab (title and favicon ring).
 */
(function () {
    var RING_RADIUS = 42;
    var RING_LENGTH = 2 * Math.PI * RING_RADIUS;
    var LAYER_POLL_MS = 10000;

    function formatClock(date) {
        var options = {hour: "2-digit", minute: "2-digit"};
        var sameDay = date.toDateString() === new Date().toDateString();
        if (!sameDay) options.weekday = "short";
        return date.toLocaleTimeString([], options);
    }

    function AuroraProgressViewModel(parameters) {
        var self = this;

        self.printerState = parameters[0];
        self.settingsViewModel = parameters[1];
        self.temperature = parameters[2];
        self.appearance = parameters[3];
        self.s = undefined;

        self.thumbnail = ko.observable(null);
        self.layer = ko.observable(null);
        self.now = ko.observable(Date.now());

        var layerTimer = null;
        var thumbnailKey = null;

        self.isPrinting = ko.pureComputed(function () {
            return !!self.printerState.isPrinting();
        });

        self.isPaused = ko.pureComputed(function () {
            return !!self.printerState.isPaused();
        });

        self.isActive = ko.pureComputed(function () {
            return self.isPrinting() || self.isPaused();
        });

        self.visible = ko.pureComputed(function () {
            return AuroraUI.active() && self.s && self.s.print_card() && self.isActive();
        });

        self.percent = ko.pureComputed(function () {
            var progress = self.printerState.progress();
            return progress === undefined || progress === null ? 0 : Math.round(progress);
        });

        self.ringOffset = ko.pureComputed(function () {
            return (RING_LENGTH * (1 - self.percent() / 100)).toFixed(1);
        });

        self.ringLength = RING_LENGTH.toFixed(1);

        self.fileName = ko.pureComputed(function () {
            return self.printerState.filedisplay() || self.printerState.filename() || "";
        });

        self.stateText = ko.pureComputed(function () {
            return self.isPaused() ? gettext("Paused") : gettext("Printing");
        });

        self.timeLeft = ko.pureComputed(function () {
            var left = self.printerState.printTimeLeft();
            if (left === undefined || left === null) return "–";
            return self.printerState.printTimeLeftString();
        });

        self.eta = ko.pureComputed(function () {
            var left = self.printerState.printTimeLeft();
            if (left === undefined || left === null || !self.isPrinting()) return "–";
            return formatClock(new Date(self.now() + left * 1000));
        });

        self.elapsed = ko.pureComputed(function () {
            return self.printerState.printTimeString();
        });

        self.layerText = ko.pureComputed(function () {
            var layer = self.layer();
            if (!layer || layer.current === undefined || layer.current === "-") return null;
            return layer.current + " / " + layer.total;
        });

        self.tempText = ko.pureComputed(function () {
            var parts = [];
            var tools = self.temperature.tools();
            if (tools.length && tools[0].actual() !== undefined && tools[0].actual() !== null) {
                parts.push(Math.round(tools[0].actual()) + " °C");
            }
            if (self.temperature.hasBed() && self.temperature.bedTemp.actual() !== undefined) {
                parts.push(gettext("bed") + " " + Math.round(self.temperature.bedTemp.actual()) + " °C");
            }
            return parts.join(" · ");
        });

        self.canPause = ko.pureComputed(function () {
            return self.printerState.enablePause();
        });

        self.canCancel = ko.pureComputed(function () {
            return self.printerState.enableCancel();
        });

        self.pause = function () {
            self.printerState.onlyPause();
        };

        self.resume = function () {
            self.printerState.onlyResume();
        };

        self.cancel = function () {
            self.printerState.cancel();
        };

        // ----- Thumbnail (Slicer Thumbnails / Cura Thumbnails metadata)

        var updateThumbnail = function () {
            var data = self.printerState.filedata();
            var key = data ? data.origin + ":" + data.path : null;
            if (key === thumbnailKey) return;
            thumbnailKey = key;
            self.thumbnail(null);
            if (!data || data.origin !== "local" || !data.path) return;

            OctoPrint.files.get("local", data.path).done(function (file) {
                if (thumbnailKey !== key || !file || !file.thumbnail) return;
                // a path relative to the OctoPrint root, e.g. plugin/prusaslicerthumbnails/thumbnail/...
                var url = file.thumbnail;
                self.thumbnail(/^(https?:)?\//.test(url) ? url : BASEURL + url);
            });
        };

        // ----- Current layer (DisplayLayerProgress, when installed)

        var pollLayer = function () {
            OctoPrint.get("plugin/DisplayLayerProgress/values")
                .done(function (values) {
                    self.layer(values && values.layer ? values.layer : null);
                })
                .fail(function () {
                    self.layer(null);
                });
        };

        var updateLayerPolling = function () {
            var hasDlp = !!(self.settingsViewModel.settings.plugins.DisplayLayerProgress);
            var wanted = hasDlp && self.visible();
            if (wanted && layerTimer === null) {
                pollLayer();
                layerTimer = window.setInterval(pollLayer, LAYER_POLL_MS);
            } else if (!wanted && layerTimer !== null) {
                window.clearInterval(layerTimer);
                layerTimer = null;
                self.layer(null);
            }
        };

        // ----- Tab title and favicon

        var updateTab = function () {
            var base = self.appearance.title();
            var show = AuroraUI.active() && self.s && self.s.tab_progress() && self.isActive();
            if (!show) {
                AuroraUI.setTabProgress(null);
                if (document.title !== base) document.title = base;
                return;
            }
            var prefix = (self.isPaused() ? "⏸ " : "") + self.percent() + "%";
            var name = self.fileName();
            document.title = prefix + (name ? " · " + name : "") + " · " + base;
            AuroraUI.setTabProgress(self.percent());
        };

        self.onBeforeBinding = function () {
            self.s = self.settingsViewModel.settings.plugins.aurora;
        };

        // Above the tabs on wide screens; on a single column (phones), first on
        // the page, before the sidebar panels. UI Customizer manages its own
        // layout, so there the card always stays above the tabs.
        var singleColumn = window.matchMedia("(max-width: 979px)");

        var placeCard = function () {
            var card = $("#aurora_printcard");
            var uic =
                !!self.settingsViewModel.settings.plugins.uicustomizer ||
                document.body.classList.contains("UICResponsiveMode");
            if (singleColumn.matches && !uic && $("#sidebar").length) {
                $("#sidebar").before(card);
            } else {
                $("#tabs").closest(".tabbable").prepend(card);
            }
        };

        self.onAllBound = function () {
            // moved only now that every view model is bound
            placeCard();
            if (singleColumn.addEventListener) {
                singleColumn.addEventListener("change", placeCard);
            } else if (singleColumn.addListener) {
                singleColumn.addListener(placeCard);
            }

            ko.computed(updateTab);
            ko.computed(function () {
                self.printerState.filedata();
                updateThumbnail();
            });
            ko.computed(updateLayerPolling);
            // keep the estimated finish time current
            window.setInterval(function () {
                self.now(Date.now());
            }, 30000);
        };
    }

    OCTOPRINT_VIEWMODELS.push({
        construct: AuroraProgressViewModel,
        dependencies: [
            "printerStateViewModel",
            "settingsViewModel",
            "temperatureViewModel",
            "appearanceViewModel"
        ],
        elements: ["#aurora_printcard"]
    });
})();
