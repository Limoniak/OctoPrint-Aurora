/*
 * Aurora UI: customizable layout. Sidebar panels and tabs can be hidden and
 * reordered from Aurora's settings (instance-wide), and the open/closed state
 * of each sidebar panel is remembered per browser. Steps aside when
 * UI Customizer is active, since it manages the layout itself.
 */
(function () {
    var COLLAPSED_KEY = "aurora.layout.collapsed";

    function textOf(el) {
        return $(el).text().replace(/\s+/g, " ").trim();
    }

    // items in the saved order; items not in it keep their original order, after
    function ordered(items, order) {
        var rank = {};
        order.forEach(function (id, index) {
            rank[id] = index;
        });
        return items
            .map(function (item, index) {
                return {item: item, key: item.id in rank ? rank[item.id] : order.length + index};
            })
            .sort(function (a, b) {
                return a.key - b.key;
            })
            .map(function (entry) {
                return entry.item;
            });
    }

    function AuroraLayoutViewModel(parameters) {
        var self = this;

        self.settingsViewModel = parameters[0];
        self.s = undefined;

        self.sidebarItems = ko.observableArray([]);
        self.tabItems = ko.observableArray([]);

        // UI Customizer marks the page only once it has rearranged it, which
        // can be after this view model runs: its settings tell earlier
        self.uicActive = ko.pureComputed(function () {
            return (
                !!self.settingsViewModel.settings.plugins.uicustomizer ||
                document.body.classList.contains("UICResponsiveMode")
            );
        });

        var originalSidebar = [];
        var originalTabs = [];
        var cache = {};

        self.enabled = ko.pureComputed(function () {
            return AuroraUI.active() && !self.uicActive();
        });

        // one entry per element, with a writable "visible" flag for the checkbox
        var entry = function (kind, id, title) {
            var key = kind + ":" + id;
            if (!cache[key]) {
                var hidden = function () {
                    return kind === "sidebar" ? self.s.layout_sidebar_hidden : self.s.layout_tabs_hidden;
                };
                cache[key] = {
                    id: id,
                    title: title,
                    visible: ko.pureComputed({
                        read: function () {
                            return hidden()().indexOf(id) < 0;
                        },
                        write: function (value) {
                            var list = hidden()().filter(function (other) {
                                return other !== id;
                            });
                            if (!value) list.push(id);
                            hidden()(list);
                        }
                    })
                };
            }
            return cache[key];
        };

        self.sidebarList = ko.pureComputed(function () {
            if (!self.s) return [];
            return ordered(self.sidebarItems(), self.s.layout_sidebar_order()).map(function (item) {
                return entry("sidebar", item.id, item.title);
            });
        });

        self.tabList = ko.pureComputed(function () {
            if (!self.s) return [];
            return ordered(self.tabItems(), self.s.layout_tabs_order()).map(function (item) {
                return entry("tabs", item.id, item.title);
            });
        });

        var move = function (list, orderObservable, item, delta) {
            var ids = list().map(function (other) {
                return other.id;
            });
            var from = ids.indexOf(item.id);
            var to = from + delta;
            if (from < 0 || to < 0 || to >= ids.length) return;
            ids.splice(from, 1);
            ids.splice(to, 0, item.id);
            orderObservable()(ids);
        };

        self.moveSidebarUp = function (item) {
            move(self.sidebarList, function () { return self.s.layout_sidebar_order; }, item, -1);
        };
        self.moveSidebarDown = function (item) {
            move(self.sidebarList, function () { return self.s.layout_sidebar_order; }, item, 1);
        };
        self.moveTabUp = function (item) {
            move(self.tabList, function () { return self.s.layout_tabs_order; }, item, -1);
        };
        self.moveTabDown = function (item) {
            move(self.tabList, function () { return self.s.layout_tabs_order; }, item, 1);
        };

        self.reset = function () {
            self.s.layout_sidebar_order([]);
            self.s.layout_sidebar_hidden([]);
            self.s.layout_tabs_order([]);
            self.s.layout_tabs_hidden([]);
        };

        // ----- Applying the layout to the page

        var applySidebar = function () {
            var sidebar = $("#sidebar");
            var ids = self.enabled()
                ? self.sidebarList().map(function (item) { return item.id; })
                : originalSidebar;
            var hidden = self.enabled() ? self.s.layout_sidebar_hidden() : [];
            ids.forEach(function (id) {
                var group = document.getElementById(id);
                // leave alone a panel that something else moved out of the sidebar
                if (!group || group.parentElement !== sidebar[0]) return;
                sidebar.append(group);
                group.classList.toggle("aurora-hidden", hidden.indexOf(id) >= 0);
            });
        };

        var applyTabs = function () {
            var tabs = $("#tabs");
            var ids = self.enabled()
                ? self.tabList().map(function (item) { return item.id; })
                : originalTabs;
            var hidden = self.enabled() ? self.s.layout_tabs_hidden() : [];
            ids.forEach(function (id) {
                var li = document.getElementById(id);
                // only tabs of the tab bar (or of its overflow menu)
                if (!li || !$(li).closest("#tabs").length) return;
                tabs.append(li);
                li.classList.toggle("aurora-hidden", hidden.indexOf(id) >= 0);
            });

            // never leave a hidden tab selected
            var active = tabs.find("li.active[id$='_link']").get(0);
            if (active && active.classList.contains("aurora-hidden")) {
                var first = ids.filter(function (id) {
                    return hidden.indexOf(id) < 0 && document.getElementById(id);
                })[0];
                if (first) $("#" + first + " > a").tab("show");
            }
            // let bootstrap-tabdrop recompute which tabs overflow
            $(window).trigger("resize");
        };

        // ----- Remembering open/closed sidebar panels (per browser)

        var collapsed = function () {
            try {
                return JSON.parse(AuroraUI.storageGet(COLLAPSED_KEY) || "[]") || [];
            } catch (e) {
                return [];
            }
        };

        var restoreCollapsed = function () {
            if (!self.enabled()) return;
            collapsed().forEach(function (id) {
                var body = document.getElementById(id);
                if (body && $(body).parent().parent().is("#sidebar")) {
                    body.classList.remove("in");
                }
            });
        };

        var watchCollapsed = function () {
            $("#sidebar").on("shown hidden", ".accordion-body", function (event) {
                if (event.target !== this || !self.enabled()) return;
                if (!$(this).parent().parent().is("#sidebar")) return;
                var list = collapsed().filter(function (id) {
                    return id !== event.target.id;
                });
                if (event.type === "hidden") list.push(event.target.id);
                AuroraUI.storageSet(COLLAPSED_KEY, JSON.stringify(list));
            });
        };

        self.onBeforeBinding = function () {
            self.s = self.settingsViewModel.settings.plugins.aurora;
        };

        self.onAllBound = function () {
            var sidebar = [];
            $("#sidebar > .accordion-group[id]").each(function () {
                sidebar.push({id: this.id, title: textOf($(this).find(".accordion-heading .accordion-toggle").first())});
            });
            var tabs = [];
            $("#tabs li[id$='_link']").each(function () {
                tabs.push({id: this.id, title: textOf($(this).children("a"))});
            });
            originalSidebar = sidebar.map(function (item) { return item.id; });
            originalTabs = tabs.map(function (item) { return item.id; });
            self.sidebarItems(sidebar);
            self.tabItems(tabs);

            ko.computed(applySidebar);
            ko.computed(applyTabs);
            restoreCollapsed();
            watchCollapsed();
        };
    }

    OCTOPRINT_VIEWMODELS.push({
        construct: AuroraLayoutViewModel,
        dependencies: ["settingsViewModel"],
        elements: []
    });
})();
