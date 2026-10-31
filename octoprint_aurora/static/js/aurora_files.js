/*
 * Aurora UI: grid view for the file list. Each file becomes a card with its
 * thumbnail (from Slicer Thumbnails or Cura Thumbnails). OctoPrint's own
 * entries are kept and only laid out differently, so their buttons and what
 * other plugins add to them keep working. The view is remembered per browser.
 */
(function () {
    var VIEW_KEY = "aurora.files.view";

    function thumbnailUrl(data) {
        var url = data && data.thumbnail;
        if (!url) return null;
        // a path relative to the OctoPrint root, e.g. plugin/prusaslicerthumbnails/thumbnail/...
        return /^(https?:)?\//.test(url) ? url : BASEURL + url;
    }

    function icon(name) {
        var i = document.createElement("i");
        i.className = "fas " + name;
        i.setAttribute("aria-hidden", "true");
        return i;
    }

    // adds the thumbnail area to one file list entry
    function decorate(entry) {
        if (entry.classList.contains("back") || entry.querySelector(":scope > .aurora-file-thumb")) return;
        var data = ko.dataFor(entry);
        if (!data) return;

        var thumb = document.createElement("div");
        thumb.className = "aurora-file-thumb";
        if (data.type === "folder") {
            thumb.classList.add("folder");
            thumb.appendChild(icon("fa-folder"));
        } else {
            var url = thumbnailUrl(data);
            if (url) {
                var img = document.createElement("img");
                img.loading = "lazy";
                img.alt = "";
                img.src = url;
                thumb.appendChild(img);
            } else {
                thumb.appendChild(icon("fa-cube"));
            }
        }
        // same as clicking the name: loads the file, or opens the folder.
        // OctoPrint's name cannot be reached from the keyboard, so the
        // thumbnail is a real button there: Tab to it, Enter or Space.
        var title = entry.querySelector(".title");
        thumb.setAttribute("role", "button");
        thumb.setAttribute("tabindex", "0");
        if (title) thumb.setAttribute("aria-label", title.textContent.replace(/\s+/g, " ").trim());
        var activate = function () {
            var current = entry.querySelector(".title");
            if (current) current.click();
        };
        thumb.addEventListener("click", activate);
        thumb.addEventListener("keydown", function (event) {
            if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                activate();
            }
        });
        entry.insertBefore(thumb, entry.firstChild);
    }

    function AuroraFilesViewModel(parameters) {
        var self = this;

        self.settingsViewModel = parameters[0];
        self.s = undefined;

        self.view = ko.observable(AuroraUI.storageGet(VIEW_KEY) === "grid" ? "grid" : "list");

        self.available = ko.pureComputed(function () {
            return AuroraUI.active() && !!self.s && self.s.file_grid();
        });

        self.isGrid = ko.pureComputed(function () {
            return self.available() && self.view() === "grid";
        });

        self.toggleTitle = ko.pureComputed(function () {
            return self.view() === "grid" ? gettext("List view") : gettext("Grid view");
        });

        self.toggle = function () {
            self.view(self.view() === "grid" ? "list" : "grid");
            AuroraUI.storageSet(VIEW_KEY, self.view());
        };

        self.onBeforeBinding = function () {
            self.s = self.settingsViewModel.settings.plugins.aurora;
        };

        self.onAllBound = function () {
            // the button goes into the Files panel header, once everything is bound
            $("#files_wrapper > .accordion-heading").append($("#aurora_files_view"));

            var list = document.querySelector("#files .gcode_files");
            var wrapper = list && list.querySelector(".scroll-wrapper");
            if (!wrapper) return;

            ko.computed(function () {
                list.classList.toggle("aurora-grid", self.isGrid());
            });

            // OctoPrint re-renders entries when the list changes: decorate the
            // new ones. Only the grid shows thumbnails, so the list view costs
            // nothing; the entries are decorated when the grid is turned on.
            var pending = false;
            var decorateAll = function () {
                pending = false;
                if (!self.isGrid()) return;
                Array.prototype.forEach.call(wrapper.children, function (child) {
                    if (child.classList && child.classList.contains("entry")) decorate(child);
                });
            };
            decorateAll();
            self.isGrid.subscribe(decorateAll);
            // each entry is drawn by a template that can be redrawn on its own
            // (removing the thumbnail), so changes inside entries count too;
            // they are batched to one pass per frame
            new MutationObserver(function () {
                if (pending || !self.isGrid()) return;
                pending = true;
                window.requestAnimationFrame(decorateAll);
            }).observe(wrapper, {childList: true, subtree: true});
        };
    }

    OCTOPRINT_VIEWMODELS.push({
        construct: AuroraFilesViewModel,
        dependencies: ["settingsViewModel"],
        elements: ["#aurora_files_view"]
    });
})();
