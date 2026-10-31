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

        var cam = function () {
            return self.settingsViewModel.settings.plugins.classicwebcam;
        };

        self.streamUrl = ko.pureComputed(function () {
            var c = cam();
            return c && c.stream ? c.stream() || "" : "";
        });

        self.available = ko.pureComputed(function () {
            var enabled = self.settingsViewModel.webcam_webcamEnabled();
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

        self.streamSrc = ko.pureComputed(function () {
            return self.showing() ? self.streamUrl() : BLANK;
        });

        self.transform = ko.pureComputed(function () {
            var c = cam();
            if (!c) return "";
            var parts = [];
            if (c.flipH && c.flipH()) parts.push("scaleX(-1)");
            if (c.flipV && c.flipV()) parts.push("scaleY(-1)");
            if (c.rotate90 && c.rotate90()) parts.push("rotate(-90deg)");
            return parts.join(" ");
        });

        self.buttonTitle = ko.pureComputed(function () {
            return self.open() ? gettext("Close the floating webcam") : gettext("Open the floating webcam");
        });

        self.pipTitle = ko.pureComputed(function () {
            return self.inPip() ? gettext("Back to the page") : gettext("Picture in picture");
        });

        self.frameStyle = ko.pureComputed(function () {
            return {
                left: self.x() === undefined ? "auto" : self.x() + "px",
                top: self.y() === undefined ? "auto" : self.y() + "px",
                right: self.x() === undefined ? MARGIN + "px" : "auto",
                bottom: self.y() === undefined ? MARGIN + "px" : "auto",
                width: self.width() + "px"
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

        self.onLoad = function () {
            self.error(false);
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
            var stop = function () {
                el.classList.remove("dragging");
                window.removeEventListener("pointermove", move);
                window.removeEventListener("pointerup", stop);
                save();
            };
            window.addEventListener("pointermove", move);
            window.addEventListener("pointerup", stop);
            event.preventDefault();
            return false;
        };

        // ----- Picture in picture (Document Picture-in-Picture API)

        self.togglePip = function () {
            if (pipWindow) {
                pipWindow.close();
                return;
            }
            var img = frame().querySelector("img");
            var height = Math.round((self.width() * 9) / 16);
            window.documentPictureInPicture
                .requestWindow({width: self.width(), height: height})
                .then(function (win) {
                    pipWindow = win;
                    win.document.body.style.cssText = "margin:0;background:#000;display:grid;place-items:center;height:100vh";
                    img.style.width = "100%";
                    img.style.height = "100%";
                    img.style.objectFit = "contain";
                    win.document.body.appendChild(img);
                    self.inPip(true);
                    win.addEventListener("pagehide", function () {
                        img.style.cssText = "";
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
                        var width = Math.round(el.getBoundingClientRect().width);
                        if (width >= MIN_WIDTH && width !== self.width()) {
                            self.width(width);
                            save();
                        }
                    }, 250);
                }).observe(el);
            }
            window.addEventListener("resize", clamp);
        };
    }

    OCTOPRINT_VIEWMODELS.push({
        construct: AuroraWebcamViewModel,
        dependencies: ["settingsViewModel"],
        elements: ["#aurora_webcam", "#navbar_plugin_aurora_webcam"]
    });
})();
