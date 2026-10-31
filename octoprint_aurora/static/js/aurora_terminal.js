/*
 * Aurora UI: terminal tools. G-code syntax coloring, a clickable history of
 * the commands sent from this browser, and favorite commands sent in one
 * click (edited in Aurora's settings or added with the star button).
 */
(function () {
    var HISTORY_KEY = "aurora.terminal.history";
    var HISTORY_SIZE = 10;

    // ----- Syntax coloring

    // pieces are built as HTML text and set in one go: far cheaper than one
    // DOM node per piece, at several lines a second while printing
    var ESCAPES = {"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"};

    function escapeHtml(text) {
        return text.replace(/[&<>"]/g, function (c) {
            return ESCAPES[c];
        });
    }

    function piece(text, cls) {
        if (!text) return "";
        return cls ? '<span class="' + cls + '">' + escapeHtml(text) + "</span>" : escapeHtml(text);
    }

    // Splits text with a global regex whose groups map to classes
    function tokenize(text, regex, classes) {
        var out = [];
        var last = 0;
        var match;
        regex.lastIndex = 0;
        while ((match = regex.exec(text)) !== null) {
            if (match.index > last) out.push(piece(text.slice(last, match.index)));
            for (var i = 1; i < match.length; i++) {
                if (match[i] !== undefined) {
                    out.push(piece(match[0], classes[i - 1]));
                    break;
                }
            }
            last = regex.lastIndex;
            if (match[0] === "") regex.lastIndex++;
        }
        if (last < text.length) out.push(piece(text.slice(last)));
        return out;
    }

    var SENT = /(;.*)|(\*\d+\s*$)|(\bN\d+\b)|(\b[GMT]\d+(?:\.\d+)?\b)|(\b[A-Z](?=-?[\d.]))/g;
    var SENT_CLASSES = ["t-comment", "t-dim", "t-dim", "t-cmd", "t-param"];
    var TEMPS = /(\b[TBC]\d?:|@\d?:)/g;
    // a temperature report: "T:21.3 /0.0" (actual / target)
    var TEMP_REPORT = /\bT\d?:\s*-?[\d.]+\s*\/\s*-?[\d.]+/;

    function temps(text) {
        return TEMP_REPORT.test(text) ? tokenize(text, TEMPS, ["t-temp"]) : [piece(text)];
    }

    function highlightLine(line) {
        var newline = line.endsWith("\n") ? "\n" : "";
        var text = newline ? line.slice(0, -1) : line;
        var match = /^(Send:|Recv:)(\s?)(.*)$/.exec(text);
        if (!match) return [piece(text, "t-info"), newline];

        var nodes = [piece(match[1], "t-dir"), piece(match[2])];
        var rest = match[3];
        if (match[1] === "Send:") {
            nodes = nodes.concat(tokenize(rest, SENT, SENT_CLASSES));
        } else if (/^(error|!!)/i.test(rest)) {
            nodes.push(piece(rest, "t-error"));
        } else if (/^(echo:|\/\/)/.test(rest)) {
            nodes.push(piece(rest, "t-dim"));
        } else if (/^ok\b/.test(rest)) {
            nodes.push(piece("ok", "t-ok"));
            nodes = nodes.concat(temps(rest.slice(2)));
        } else {
            nodes = nodes.concat(temps(rest));
        }
        nodes.push(newline);
        return nodes;
    }

    function highlight(span) {
        if (!span || span.nodeName !== "SPAN" || span.dataset.auroraColored) return;
        span.dataset.auroraColored = "1";
        span.innerHTML = highlightLine(span.textContent).join("");
    }

    // ----- View model

    function AuroraTerminalViewModel(parameters) {
        var self = this;

        self.terminal = parameters[0];
        self.settingsViewModel = parameters[1];
        self.loginState = parameters[2];
        self.access = parameters[3];
        self.s = undefined;

        var initialHistory = [];
        try {
            initialHistory = JSON.parse(AuroraUI.storageGet(HISTORY_KEY) || "[]") || [];
        } catch (e) {
            initialHistory = [];
        }
        self.history = ko.observableArray(initialHistory.slice(0, HISTORY_SIZE));
        self.newFavorite = ko.observable("");

        self.enabled = ko.pureComputed(function () {
            return AuroraUI.active() && !!self.s && self.s.terminal_tools();
        });

        self.favorites = ko.pureComputed(function () {
            return self.s ? self.s.terminal_favorites() : [];
        });

        self.canControl = ko.pureComputed(function () {
            return self.loginState.hasPermission(self.access.permissions.CONTROL);
        });

        self.canSend = ko.pureComputed(function () {
            return self.canControl() && !!self.terminal.isOperational();
        });

        self.canEditFavorites = ko.pureComputed(function () {
            return self.loginState.hasPermission(self.access.permissions.SETTINGS);
        });

        self.canStar = ko.pureComputed(function () {
            var command = (self.terminal.command() || "").trim();
            return self.canEditFavorites() && !!command && self.favorites().indexOf(command) < 0;
        });

        var remember = function (command) {
            command = (command || "").trim();
            if (!command) return;
            self.history.remove(command);
            self.history.unshift(command);
            if (self.history().length > HISTORY_SIZE) self.history.splice(HISTORY_SIZE);
            AuroraUI.storageSet(HISTORY_KEY, JSON.stringify(self.history()));
        };

        self.clearHistory = function () {
            self.history.removeAll();
            AuroraUI.storageSet(HISTORY_KEY, null);
        };

        // puts a recent command back into the input, ready to edit or send
        self.useHistory = function (command) {
            self.terminal.command(command);
            $("#terminal-command").trigger("focus");
        };

        self.sendFavorite = function (command) {
            if (!self.canSend()) return;
            OctoPrint.control.sendGcode(command);
            remember(command);
        };

        var saveFavorites = function (list) {
            self.s.terminal_favorites(list);
            self.settingsViewModel.saveData({plugins: {aurora: {terminal_favorites: list}}});
        };

        // star button next to the terminal: saves right away
        self.starCurrent = function () {
            if (!self.canStar()) return;
            saveFavorites(self.favorites().concat([(self.terminal.command() || "").trim()]));
        };

        // ----- editor in Aurora's settings (kept until Save, like the rest)

        self.addFavorite = function () {
            var command = (self.newFavorite() || "").replace(/\s+/g, " ").trim();
            if (command && self.favorites().indexOf(command) < 0) {
                self.s.terminal_favorites.push(command);
            }
            self.newFavorite("");
        };

        self.removeFavorite = function (command) {
            self.s.terminal_favorites.remove(command);
        };

        // record what is sent from the terminal input (button or Enter key)
        var originalSend = self.terminal.sendCommand;
        self.terminal.sendCommand = function () {
            if (self.enabled()) remember(self.terminal.command());
            return originalSend.apply(this, arguments);
        };

        self.onBeforeBinding = function () {
            self.s = self.settingsViewModel.settings.plugins.aurora;
        };

        self.onAllBound = function () {
            // moved only once every view model is bound: the terminal tab has
            // its own bindings, which must not reach into this element
            $("#aurora_terminal").insertAfter("#terminal-sendpanel");

            var output = document.getElementById("terminal-output");
            ko.computed(function () {
                document.documentElement.classList.toggle("aurora-terminal-colors", self.enabled());
            });
            if (!output || !window.MutationObserver) return;

            // lines are colored only while they can be seen: while printing
            // with the terminal tab closed, nothing is done for them, and
            // the lines still in the terminal are colored once it is opened
            var pane = document.getElementById("term");
            // (UI Customizer can show the terminal outside of the tabs:
            // there, it is always colored)
            var shown = function () {
                return (
                    self.enabled() &&
                    (!pane || pane.classList.contains("active") || document.body.classList.contains("UICResponsiveMode"))
                );
            };
            var highlightAll = function () {
                if (shown()) Array.prototype.forEach.call(output.children, highlight);
            };
            highlightAll();
            new MutationObserver(function (mutations) {
                if (!shown()) return;
                mutations.forEach(function (mutation) {
                    Array.prototype.forEach.call(mutation.addedNodes, highlight);
                });
            }).observe(output, {childList: true});
            $('a[data-toggle="tab"][href="#term"]').on("shown", highlightAll);
            self.enabled.subscribe(highlightAll);
        };
    }

    OCTOPRINT_VIEWMODELS.push({
        construct: AuroraTerminalViewModel,
        dependencies: ["terminalViewModel", "settingsViewModel", "loginStateViewModel", "accessViewModel"],
        elements: ["#aurora_terminal"]
    });
})();
