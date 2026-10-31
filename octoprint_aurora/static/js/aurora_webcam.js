/*
 * Aurora UI: floating webcam window, opened from the navbar, that stays
 * visible on every tab. Can be dragged, resized and, where the browser
 * supports it, popped out into a picture-in-picture window.
 */
(function () {
    var STATE_KEY = "aurora.webcam";
    var MARGIN = 16;
    var DEFAULT_WIDTH = 360;
    var MIN_WIDTH = 200;
    // a 1x1 transparent gif: assigning it stops the MJPEG download
    var BLANK = "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";

    function readState() {
        try {
            return JSON.parse(AuroraUI.storageGet(STATE_KEY) || "null") || {};
        } catch (e) {
            return {};
        }
    }

    function AuroraWebcamViewModel(parameters) {
        var self = this;

        self.settingsViewModel = parameters[0];
        self.s = undefined;

        var saved = readState();
        self.open = ko.observable(!!saved.open);
        self.x = ko.observable(saved.x);
        self.y = ko.observable(saved.y);
        self.width = ko.observable(saved.width || DEFAULT_WIDTH);
        self.error = ko.observable(false);
        self.inPip = ko.observable(false);
        self.pipSupported = "documentPictureInPicture" in window;

        var pipWindow = null;

        // OctoPrint 1.9 and later keep the webcam settings in the Classic
        // Webcam plugin; before that, they were core settings
        var cam = function () {
            var settings = self.settingsViewModel;
            var classic = settings.settings.plugins && settings.settings.plugins.classicwebcam;
            if (classic) return classic;
            if (!settings.webcam_streamUrl) return null;
            return {
                stream: settings.webcam_streamUrl,
                rotate90: settings.webcam_rotate90,
                flipH: settings.webcam_flipH,
                flipV: settings.webcam_flipV
            };
        };

        self.streamUrl = ko.pureComputed(function () {
            var c = cam();
            return c && c.stream ? c.stream() || "" : "";
        });

        self.available = ko.pureComputed(function () {
            var webcamEnabled = self.settingsViewModel.webcam_webcamEnabled;
            var enabled = ko.isObservable(webcamEnabled) ? webcamEnabled() : true;
            return (
                AuroraUI.active() &&
                !!self.s &&
                self.s.webcam_float() &&
                enabled !== false &&
                !!self.streamUrl()
            );
        });

        self.showing = ko.pureComputed(function () {
            return self.available() && self.open();
        });

        self.frameVisible = ko.pureComputed(function () {
            return self.showing() && !self.inPip();
        });

        // the stream is paused while the page is hidden (another browser tab,
        // a minimized window, a tablet's screen turned off): an MJPEG stream
        // otherwise keeps downloading, which a Raspberry Pi feels. Picture in
        // picture is meant to be watched from elsewhere, so it keeps playing.
        self.pageVisible = ko.observable(!document.hidden);
        document.addEventListener("visibilitychange", function () {
            self.pageVisible(!document.hidden);
        });

        self.streamSrc = ko.pureComputed(function () {
            return self.showing() && (self.pageVisible() || self.inPip()) ? self.streamUrl() : BLANK;
        });

        // width / height of the stream, known once its first frame is in
        self.ratio = ko.observable(16 / 9);

        self.rotated = ko.pureComputed(function () {
            var c = cam();
            return !!(c && c.rotate90 && c.rotate90());
        });

        // same order as OctoPrint's own webcam: turned, then mirrored
        self.transform = ko.pureComputed(function () {
            var c = cam();
            if (!c) return "";
            var parts = [];
            if (self.rotated()) parts.push("rotate(-90deg)");
            if (c.flipH && c.flipH()) parts.push("scaleX(-1)");
            if (c.flipV && c.flipV()) parts.push("scaleY(-1)");
            return parts.join(" ");
        });

        // a turned stream gets a portrait window, and the picture is sized
        // before it is turned so that, once turned, it fills it exactly
        self.bodyStyle = ko.pureComputed(function () {
            var ratio = self.ratio();
            return {aspectRatio: self.rotated() ? "1 / " + ratio : ratio + " / 1"};
        });

        var imageStyle = function () {
            if (self.inPip()) {
                return self.rotated()
                    ? {position: "", maxWidth: "", left: "", top: "", width: "100vh", height: "100vw", objectFit: "contain", transform: self.transform()}
                    : {position: "", maxWidth: "", left: "", top: "", width: "100%", height: "100%", objectFit: "contain", transform: self.transform()};
            }
            if (!self.rotated()) {
                return {position: "", maxWidth: "", left: "", top: "", width: "", height: "", objectFit: "", transform: self.transform()};
            }
            var ratio = self.ratio();
            return {
                position: "absolute",
                // Bootstrap caps images at the width of their box: this one
                // is wider than the box until it is turned
                maxWidth: "none",
                left: "50%",
                top: "50%",
                width: ratio * 100 + "%",
                height: 100 / ratio + "%",
                objectFit: "",
                transform: "translate(-50%, -50%) " + self.transform()
            };
        };

        var image = function () {
            var el = document.getElementById("aurora_webcam");
            return el && el.querySelector("img");
        };

        // reads the stream's size: an MJPEG stream never finishes loading, so
        // its size is polled for a few seconds once the window opens
        var sizeTimer = null;
        var readSize = function () {
            window.clearInterval(sizeTimer);
            var tries = 0;
            sizeTimer = window.setInterval(function () {
                var img = image();
                tries++;
                // right after the switch, the size can still be the blank
                // 1x1 placeholder's: only the stream's own frames count
                if (img && img.naturalWidth > 1 && img.naturalHeight > 1 && img.currentSrc && img.currentSrc.indexOf("data:") !== 0) {
                    self.ratio(img.naturalWidth / img.naturalHeight);
                    window.clearInterval(sizeTimer);
                } else if (tries > 40) {
                    window.clearInterval(sizeTimer);
                }
            }, 250);
        };

        self.buttonTitle = ko.pureComputed(function () {
            return self.open() ? gettext("Close the floating webcam") : gettext("Open the floating webcam");
        });

        self.pipTitle = ko.pureComputed(function () {
            return self.inPip() ? gettext("Back to the page") : gettext("Picture in picture");
        });

        self.viewportHeight = ko.observable(window.innerHeight);

        // the width the window is drawn at: a turned (portrait) picture is
        // narrowed so that the window is never taller than the screen
        var BAR_HEIGHT = 40;
        self.shownWidth = ko.pureComputed(function () {
            var width = self.width();
            if (!self.rotated()) return width;
            var fit = Math.floor((self.viewportHeight() - 2 * MARGIN - BAR_HEIGHT) / self.ratio());
            return Math.max(MIN_WIDTH, Math.min(width, fit));
        });

        self.frameStyle = ko.pureComputed(function () {
            return {
                left: self.x() === undefined ? "auto" : self.x() + "px",
                top: self.y() === undefined ? "auto" : self.y() + "px",
                right: self.x() === undefined ? MARGIN + "px" : "auto",
                bottom: self.y() === undefined ? MARGIN + "px" : "auto",
                width: self.shownWidth() + "px"
            };
        });

        var save = function () {
            AuroraUI.storageSet(
                STATE_KEY,
                JSON.stringify({open: self.open(), x: self.x(), y: self.y(), width: self.width()})
            );
        };

        var frame = function () {
            return document.getElementById("aurora_webcam");
        };

        // keep the window inside the viewport (after a resize of the page too)
        var clamp = function () {
            var el = frame();
            if (!el || self.x() === undefined) return;
            var rect = el.getBoundingClientRect();
            var maxX = Math.max(MARGIN, window.innerWidth - rect.width - MARGIN);
            var maxY = Math.max(MARGIN, window.innerHeight - rect.height - MARGIN);
            self.x(Math.min(Math.max(MARGIN, self.x()), maxX));
            self.y(Math.min(Math.max(MARGIN, self.y()), maxY));
        };

        self.toggle = function () {
            self.open(!self.open());
            if (!self.open() && pipWindow) pipWindow.close();
            self.error(false);
            save();
        };

        self.close = function () {
            if (self.open()) self.toggle();
        };

        self.onLoad = function (data, event) {
            var img = event.target;
            if (img.getAttribute("src") === BLANK) return;
            self.error(false);
            if (img.naturalWidth > 1 && img.naturalHeight > 1) self.ratio(img.naturalWidth / img.naturalHeight);
        };

        self.onError = function (data, event) {
            if (event.target.getAttribute("src") !== BLANK) self.error(true);
        };

        // ----- Dragging by the title bar

        self.startDrag = function (data, event) {
            if (event.button !== 0 || $(event.target).closest("button").length) return true;
            var el = frame();
            var rect = el.getBoundingClientRect();
            var dx = event.clientX - rect.left;
            var dy = event.clientY - rect.top;
            el.classList.add("dragging");

            var move = function (e) {
                self.x(e.clientX - dx);
                self.y(e.clientY - dy);
                clamp();
            };
            // pointercancel: a touch gesture taken over by the system (scroll,
            // notification shade) must end the drag too
            var stop = function () {
                el.classList.remove("dragging");
                window.removeEventListener("pointermove", move);
                window.removeEventListener("pointerup", stop);
                window.removeEventListener("pointercancel", stop);
                save();
            };
            window.addEventListener("pointermove", move);
            window.addEventListener("pointerup", stop);
            window.addEventListener("pointercancel", stop);
            event.preventDefault();
            return false;
        };

        // ----- Picture in picture (Document Picture-in-Picture API)

        self.togglePip = function () {
            if (pipWindow) {
                pipWindow.close();
                return;
            }
            var img = image();
            var height = Math.round(self.rotated() ? self.shownWidth() * self.ratio() : self.shownWidth() / self.ratio());
            window.documentPictureInPicture
                .requestWindow({width: self.shownWidth(), height: height})
                .then(function (win) {
                    pipWindow = win;
                    win.document.body.style.cssText = "margin:0;background:#000;display:grid;place-items:center;height:100vh;overflow:hidden";
                    win.document.body.appendChild(img);
                    self.inPip(true);
                    win.addEventListener("pagehide", function () {
                        frame().querySelector(".aurora-webcam-body").prepend(img);
                        pipWindow = null;
                        self.inPip(false);
                    });
                })
                .catch(function () {
                    pipWindow = null;
                    self.inPip(false);
                });
        };

        self.onBeforeBinding = function () {
            self.s = self.settingsViewModel.settings.plugins.aurora;
        };

        self.onAllBound = function () {
            var el = frame();
            // a fixed window: keep it out of any container that could hide or clip it
            if (el && el.parentElement !== document.body) document.body.appendChild(el);
            // remember the width after a resize with the corner handle
            if (window.ResizeObserver && el) {
                var timer = null;
                new ResizeObserver(function () {
                    if (!self.frameVisible()) return;
                    window.clearTimeout(timer);
                    timer = window.setTimeout(function () {
                        // offsetWidth matches the CSS width (border-box); a gap of a
                        // pixel or two is rounding, not a resize by the user
                        var width = el.offsetWidth;
                        if (width >= MIN_WIDTH && Math.abs(width - self.shownWidth()) > 2) {
                            self.width(width);
                            save();
                        }
                    }, 250);
                }).observe(el);
            }
            window.addEventListener("resize", function () {
                self.viewportHeight(window.innerHeight);
                clamp();
            });

            // the picture's size and turn follow the webcam settings, in the
            // window and in picture in picture
            ko.computed(function () {
                var img = image();
                if (img) $(img).css(imageStyle());
            });
            self.showing.subscribe(function (showing) {
                if (showing) readSize();
            });
            if (self.showing()) readSize();

            // a position saved in a larger browser window could be off screen
            // now: bring the window back in view whenever it appears
            self.frameVisible.subscribe(function (visible) {
                if (visible) window.setTimeout(clamp, 0);
            });
            if (self.frameVisible()) window.setTimeout(clamp, 0);
        };
    }

    OCTOPRINT_VIEWMODELS.push({
        construct: AuroraWebcamViewModel,
        dependencies: ["settingsViewModel"],
        elements: ["#aurora_webcam", "#navbar_plugin_aurora_webcam"]
    });
})();
