import os
import re

import flask
from markupsafe import Markup

import octoprint.plugin

MODES = ("auto", "light", "dark")
LOGOS = ("octoprint", "aurora", "none")
DENSITIES = ("comfortable", "compact")
SIDEBAR_POSITIONS = ("left", "right")
INSTANCE_MODES = ("stripe", "accent", "none")
HEX_COLOR = re.compile(r"^#[0-9a-fA-F]{6}$")

# OctoPrint's navbar colors (Settings > Appearance), from its octoprint.less.
# Same values as INSTANCE_COLORS in aurora.js.
INSTANCE_COLORS = {
    "red": "#bd362f",
    "orange": "#f27728",
    "yellow": "#f2de28",
    "green": "#77ff28",
    "blue": "#0044cc",
    "violet": "#7728ff",
    "black": "#383838",
    "white": "#eeeeee",
}

# The light and dark token blocks of aurora.css, reused by the login page
THEME_BLOCK = re.compile(
    r'html\.aurora\[data-aurora-theme="(light|dark)"\]\s*\{(.*?)\}', re.S
)


def contrast_color(hex_color):
    """Black or white text for the given accent, same rule as aurora.js."""

    def linear(channel):
        c = int(channel, 16) / 255
        return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4

    r, g, b = (linear(hex_color[i : i + 2]) for i in (1, 3, 5))
    luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b
    # contrast with white vs. with #0b0d14 (relative luminance ~0.004)
    with_white = 1.05 / (luminance + 0.05)
    with_dark = (luminance + 0.05) / 0.054
    return "#0b0d14" if with_dark > with_white else "#ffffff"


def mix_colors(color_a, color_b, weight):
    """Mix two #rrggbb colors like CSS color-mix(in srgb, a weight, b)."""
    a = [int(color_a[i : i + 2], 16) for i in (1, 3, 5)]
    b = [int(color_b[i : i + 2], 16) for i in (1, 3, 5)]
    return "#" + "".join(
        "%02x" % round(x * weight + y * (1 - weight)) for x, y in zip(a, b)
    )


def with_alpha(hex_color, alpha):
    r, g, b = (int(hex_color[i : i + 2], 16) for i in (1, 3, 5))
    return f"rgba({r}, {g}, {b}, {alpha})"


class AuroraPlugin(
    octoprint.plugin.SettingsPlugin,
    octoprint.plugin.AssetPlugin,
    octoprint.plugin.TemplatePlugin,
    octoprint.plugin.BlueprintPlugin,
):
    ##~~ SettingsPlugin

    def get_settings_defaults(self):
        return {
            "enabled": True,
            "mode": "auto",
            "accent": "#6d4aff",
            "logo": "aurora",
            "instance": "stripe",
            "density": "comfortable",
            "radius": 14,
            "sidebar": "left",
            "wide": True,
            "glass": True,
            "watermark": False,
            "graph": True,
        }

    def on_settings_save(self, data):
        cleaned = dict(data)

        if "mode" in cleaned and cleaned["mode"] not in MODES:
            del cleaned["mode"]
        if "logo" in cleaned and cleaned["logo"] not in LOGOS:
            del cleaned["logo"]
        if "instance" in cleaned and cleaned["instance"] not in INSTANCE_MODES:
            del cleaned["instance"]
        if "density" in cleaned and cleaned["density"] not in DENSITIES:
            del cleaned["density"]
        if "sidebar" in cleaned and cleaned["sidebar"] not in SIDEBAR_POSITIONS:
            del cleaned["sidebar"]
        if "accent" in cleaned and not HEX_COLOR.match(str(cleaned["accent"])):
            del cleaned["accent"]
        if "radius" in cleaned:
            try:
                cleaned["radius"] = max(0, min(28, int(cleaned["radius"])))
            except (TypeError, ValueError):
                del cleaned["radius"]

        return octoprint.plugin.SettingsPlugin.on_settings_save(self, cleaned)

    ##~~ AssetPlugin

    def get_assets(self):
        return {"css": ["css/aurora.css"], "js": ["js/aurora.js"]}

    ##~~ TemplatePlugin

    def is_template_autoescaped(self):
        return True

    def get_template_configs(self):
        return [
            {"type": "settings", "name": "Aurora UI", "custom_bindings": True},
            {"type": "navbar", "custom_bindings": True},
        ]

    ##~~ BlueprintPlugin

    def is_blueprint_protected(self):
        # the login page stylesheet must be reachable before anyone is logged in
        return False

    def is_blueprint_csrf_protected(self):
        return True

    _theme_tokens = None

    def get_theme_tokens(self):
        """The --a-* declarations of the light and dark blocks of aurora.css."""
        if self._theme_tokens is None:
            path = os.path.join(self._basefolder, "static", "css", "aurora.css")
            with open(path, encoding="utf-8") as f:
                blocks = dict(THEME_BLOCK.findall(f.read()))
            # our own stylesheet, so safe to emit unescaped
            self._theme_tokens = {
                name: Markup(blocks.get(name, "").strip("\n"))
                for name in ("light", "dark")
            }
        return self._theme_tokens

    @octoprint.plugin.BlueprintPlugin.route("/login.css", methods=["GET"])
    def login_css(self):
        accent = self._settings.get(["accent"])
        if not HEX_COLOR.match(str(accent)):
            accent = self.get_settings_defaults()["accent"]

        instance_color = INSTANCE_COLORS.get(
            self._settings.global_get(["appearance", "color"])
        )
        if self._settings.get(["instance"]) == "accent" and instance_color:
            accent = instance_color

        css = flask.render_template(
            "aurora_login_css.jinja2",
            tokens=self.get_theme_tokens(),
            mode=self._settings.get(["mode"]),
            logo=self._settings.get(["logo"]),
            accent=accent,
            accent_2=mix_colors(accent, "#ff7ac6", 0.55),
            accent_ring=with_alpha(accent, 0.35),
            accent_text_light=mix_colors(accent, "#000000", 0.62),
            accent_text_dark=mix_colors(accent, "#ffffff", 0.6),
            glow_1=with_alpha(accent, 0.22),
            glow_2=with_alpha(accent, 0.12),
            on_accent=contrast_color(accent),
            radius=self._settings.get_int(["radius"]),
        )
        response = flask.make_response(css)
        response.headers["Content-Type"] = "text/css; charset=utf-8"
        response.headers["Cache-Control"] = "no-cache"
        return response

    ##~~ Software Update hook

    def get_update_information(self):
        return {
            "aurora": {
                "displayName": "Aurora UI",
                "displayVersion": self._plugin_version,
                "type": "github_release",
                "user": "Limoniak",
                "repo": "OctoPrint-Aurora",
                "current": self._plugin_version,
                "pip": "https://github.com/Limoniak/OctoPrint-Aurora/archive/{target_version}.zip",
            }
        }

    ##~~ Theming hook for the login page

    def get_login_theming(self):
        if not self._settings.get_boolean(["enabled"]):
            return []
        return [flask.url_for("plugin.aurora.login_css")]


__plugin_name__ = "Aurora UI"
__plugin_pythoncompat__ = ">=3.7,<4"


def __plugin_load__():
    global __plugin_implementation__
    __plugin_implementation__ = AuroraPlugin()

    global __plugin_hooks__
    __plugin_hooks__ = {
        "octoprint.theming.login": __plugin_implementation__.get_login_theming,
        "octoprint.plugin.softwareupdate.check_config": __plugin_implementation__.get_update_information,
    }
