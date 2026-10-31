/*
 * Aurora UI: print alerts. When a print finishes, fails or pauses on its
 * own (filament change, runout...), play a short chime and/or show a
 * browser notification, so the end of a print is not missed from another
 * tab or another room.
 *
 * The chime is generated with Web Audio (no sound file) and works on any
 * page. Browser notifications need a secure page (HTTPS or localhost) and
 * the permission of each browser; the settings explain both.
 */
(function () {
    var CHIMES = {
        // [frequency (Hz), start (s), duration (s)]
        done: [[659, 0, 0.18], [784, 0.16, 0.18], [1047, 0.32, 0.38]],
        failed: [[523, 0, 0.22], [415, 0.22, 0.22], [330, 0.44, 0.45]],
        paused: [[784, 0, 0.16], [784, 0.26, 0.16]]
    };

    var audioContext = null;

    function getAudioContext() {
        var AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return null;
        if (!audioContext) {
            try {
                audioContext = new AudioCtx();
            } catch (e) {
                return null;
            }
        }
        return audioContext;
    }

    // Browsers only let a page make sound after the user interacted with it:
    // the audio is unlocked on the first click or key press
    function unlockAudio() {
        var ctx = getAudioContext();
        if (ctx && ctx.state === "suspended") ctx.resume();
        document.removeEventListener("pointerdown", unlockAudio, true);
        document.removeEventListener("keydown", unlockAudio, true);
    }
    document.addEventListener("pointerdown", unlockAudio, true);
    document.addEventListener("keydown", unlockAudio, true);

    function playChime(kind) {
        var ctx = getAudioContext();
        if (!ctx) return false;
        if (ctx.state === "suspended") ctx.resume();
        var now = ctx.currentTime + 0.02;
        CHIMES[kind].forEach(function (note) {
            var osc = ctx.createOscillator();
            var gain = ctx.createGain();
            osc.type = "sine";
            osc.frequency.value = note[0];
            // short attack and decay: a soft bell, not a beep
            gain.gain.setValueAtTime(0.0001, now + note[1]);
            gain.gain.exponentialRampToValueAtTime(0.25, now + note[1] + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + note[1] + note[2]);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now + note[1]);
            osc.stop(now + note[1] + note[2] + 0.05);
        });
        return true;
    }

    function AuroraAlertsViewModel(parameters) {
        var self = this;

        self.settingsViewModel = parameters[0];
        self.loginState = parameters[1];
        self.s = undefined;

        // Notification API: present, and allowed on this page (secure context)
        self.notifySupported = "Notification" in window && window.isSecureContext !== false;
        self.permission = ko.observable(self.notifySupported ? Notification.permission : "unsupported");

        self.needsPermission = ko.pureComputed(function () {
            return self.notifySupported && self.permission() === "default";
        });

        self.blocked = ko.pureComputed(function () {
            return self.permission() === "denied";
        });

        self.requestPermission = function () {
            if (!self.notifySupported) return;
            var done = function (result) {
                self.permission(result || Notification.permission);
            };
            var promise = Notification.requestPermission(done);
            if (promise && promise.then) promise.then(done);
        };

        var enabled = function (key) {
            return AuroraUI.active() && !!self.s && self.s[key]();
        };

        var notify = function (kind, title, body) {
            if (!enabled("alert_notify") || !self.notifySupported || Notification.permission !== "granted") return false;
            try {
                var n = new Notification(title, {
                    body: body,
                    icon: AuroraUI.brandIcon(),
                    // one notification per printer, the latest replaces the previous
                    tag: "aurora-print-" + location.host,
                    renotify: true
                });
                n.onclick = function () {
                    window.focus();
                    n.close();
                };
                return true;
            } catch (e) {
                // some mobile browsers only allow notifications from a service worker
                return false;
            }
        };

        // what an alert did, for the settings "Test" button and the tests
        self.lastAlert = ko.observable(null);

        self.alert = function (kind, file, force) {
            var titles = {
                done: gettext("Print finished"),
                failed: gettext("Print failed"),
                paused: gettext("Print paused")
            };
            var sound = (force || enabled("alert_sound")) && playChime(kind);
            var shown = notify(kind, titles[kind], file || "");
            self.lastAlert({kind: kind, sound: !!sound, notification: shown});
        };

        self.test = function () {
            // the button itself is the user gesture that unlocks the audio
            unlockAudio();
            self.alert("done", gettext("This is how a finished print will sound and look."), true);
        };

        var fileOf = function (payload) {
            return (payload && (payload.name || payload.path)) || "";
        };

        self.onEventPrintDone = function (payload) {
            self.alert("done", fileOf(payload));
        };

        self.onEventPrintFailed = function (payload) {
            // a print cancelled on purpose is not worth an alarm
            if (payload && payload.reason === "cancelled") return;
            self.alert("failed", fileOf(payload));
        };

        self.onEventPrintPaused = function (payload) {
            // a pause asked for by this user (from any of their browsers) is
            // expected; one from the printer (filament change, runout) is not
            var user = self.loginState.username && self.loginState.username();
            if (payload && payload.user && payload.user === user) return;
            self.alert("paused", fileOf(payload));
        };

        self.onBeforeBinding = function () {
            self.s = self.settingsViewModel.settings.plugins.aurora;
        };

        self.onSettingsShown = function () {
            if (self.notifySupported) self.permission(Notification.permission);
        };
    }

    OCTOPRINT_VIEWMODELS.push({
        construct: AuroraAlertsViewModel,
        dependencies: ["settingsViewModel", "loginStateViewModel"],
        elements: []
    });
})();
