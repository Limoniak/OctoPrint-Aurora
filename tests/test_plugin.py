"""Unit tests for the Python side of Aurora UI and for the data it shares
with the stylesheet, the script and the translations."""

import os
import re
from unittest import mock

import jinja2
import pytest
from babel.messages.mofile import read_mo
from babel.messages.pofile import read_po

import octoprint_aurora as aurora

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PACKAGE = os.path.join(ROOT, "octoprint_aurora")
LANGUAGES = ("de", "es", "fr", "it", "pt", "ru")


def read(*parts):
    with open(os.path.join(PACKAGE, *parts), encoding="utf-8") as f:
        return f.read()


def contrast(color_a, color_b):
    def luminance(color):
        channels = []
        for i in (1, 3, 5):
            c = int(color[i : i + 2], 16) / 255
            channels.append(c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4)
        return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]

    a, b = luminance(color_a), luminance(color_b)
    return (max(a, b) + 0.05) / (min(a, b) + 0.05)


##~~ color helpers


@pytest.mark.parametrize(
    "accent, expected",
    [("#6d4aff", "#ffffff"), ("#000000", "#ffffff"), ("#84cc16", "#0b0d14"), ("#ffffff", "#0b0d14")],
)
def test_contrast_color_picks_the_more_readable_text(accent, expected):
    assert aurora.contrast_color(accent) == expected


def test_mix_colors():
    assert aurora.mix_colors("#000000", "#ffffff", 0.5) == "#808080"
    assert aurora.mix_colors("#6d4aff", "#000000", 1) == "#6d4aff"


def test_with_alpha():
    assert aurora.with_alpha("#6d4aff", 0.35) == "rgba(109, 74, 255, 0.35)"


##~~ settings validation


def save(data):
    plugin = aurora.AuroraPlugin()
    with mock.patch(
        "octoprint.plugin.SettingsPlugin.on_settings_save", side_effect=lambda self, d: d
    ):
        return plugin.on_settings_save(data)


def test_valid_settings_are_kept():
    data = {
        "mode": "dark",
        "accent": "#123abc",
        "logo": "none",
        "instance": "accent",
        "density": "compact",
        "sidebar": "right",
        "radius": 8,
    }
    assert save(data) == data


def test_invalid_settings_are_dropped():
    cleaned = save(
        {
            "mode": "neon",
            "accent": "red;}body{display:none",
            "logo": "clippy",
            "instance": "rainbow",
            "density": "huge",
            "sidebar": "top",
            "radius": "abc",
        }
    )
    assert cleaned == {}


@pytest.mark.parametrize("radius, expected", [(-5, 0), ("99", 28), (14, 14)])
def test_radius_is_clamped(radius, expected):
    assert save({"radius": radius}) == {"radius": expected}


def test_feature_settings_are_validated():
    cleaned = save(
        {
            "print_card": False,
            "tab_progress": "yes",
            "terminal_favorites": ["  G28  ", "M114\nM84", 42, "G28", ""],
            "layout_tabs_order": ["temp_link", "<script>", "temp_link", "control_link"],
            "layout_sidebar_hidden": "files_wrapper",
        }
    )
    assert cleaned == {
        "print_card": False,
        "terminal_favorites": ["G28", "M114 M84"],
        "layout_tabs_order": ["temp_link", "control_link"],
    }


def test_favorites_are_capped():
    assert len(aurora.clean_favorites(["G%d" % i for i in range(50)])) == aurora.MAX_FAVORITES


##~~ assets and templates


def test_declared_assets_exist():
    assets = aurora.AuroraPlugin().get_assets()
    for kind in ("css", "js"):
        for path in assets[kind]:
            assert os.path.isfile(os.path.join(PACKAGE, "static", path)), path


# OctoPrint picks a template's type from its name (<plugin id>_<type>.jinja2):
# a generic template named e.g. aurora_webcam.jinja2 would become a webcam
# provider and be rendered inside the Control tab.
TEMPLATE_TYPES = ("navbar", "sidebar", "tab", "settings", "usersettings", "wizard", "about", "webcam")


def test_templates_exist_and_generic_names_are_safe():
    for config in aurora.AuroraPlugin().get_template_configs():
        name = config.get("template", "aurora_%s.jinja2" % config["type"])
        assert os.path.isfile(os.path.join(PACKAGE, "templates", name)), name
        if config["type"] == "generic":
            assert name not in ["aurora_%s.jinja2" % t for t in TEMPLATE_TYPES], name


##~~ data shared between Python, CSS and JS


def test_instance_colors_match_the_script():
    script = read("static", "js", "aurora.js")
    block = re.search(r"var INSTANCE_COLORS = \{(.*?)\};", script, re.S).group(1)
    in_script = dict(re.findall(r'(\w+): "(#[0-9a-f]{6})"', block))
    assert in_script == aurora.INSTANCE_COLORS


def test_settings_defaults_match_the_script():
    script = read("static", "js", "aurora.js")
    block = re.search(r"var DEFAULTS = \{(.*?)\};", script, re.S).group(1)
    assert set(re.findall(r"^\s*(\w+):", block, re.M)) == set(
        aurora.AuroraPlugin().get_settings_defaults()
    )


def test_accent_presets_keep_white_text_readable():
    script = read("static", "js", "aurora.js")
    block = re.search(r"self\.presets = \[(.*?)\];", script, re.S).group(1)
    presets = re.findall(r'"(#[0-9a-f]{6})"', block)
    assert len(presets) == 9
    for preset in presets:
        assert contrast(preset, "#ffffff") >= 4.5, preset


def test_theme_tokens_are_read_from_the_stylesheet():
    plugin = aurora.AuroraPlugin()
    plugin._basefolder = PACKAGE
    tokens = plugin.get_theme_tokens()
    for theme in ("light", "dark"):
        assert "--a-bg:" in tokens[theme]
        assert "--a-text:" in tokens[theme]
        assert "{" not in tokens[theme]
    assert "color-scheme: dark" in tokens["dark"]


@pytest.mark.parametrize("mode", ["auto", "light", "dark"])
@pytest.mark.parametrize("logo", ["aurora", "octoprint", "none"])
def test_login_stylesheet_renders(mode, logo):
    plugin = aurora.AuroraPlugin()
    plugin._basefolder = PACKAGE
    env = jinja2.Environment(
        loader=jinja2.FileSystemLoader(os.path.join(PACKAGE, "templates")),
        autoescape=True,
    )
    env.globals["url_for"] = lambda endpoint, filename: "/" + endpoint + "/" + filename
    css = env.get_template("aurora_login_css.jinja2").render(
        tokens=plugin.get_theme_tokens(),
        mode=mode,
        logo=logo,
        accent="#6d4aff",
        accent_2="#af60e5",
        accent_ring="rgba(109, 74, 255, 0.35)",
        accent_text_light="#442e9e",
        accent_text_dark="#a792ff",
        glow_1="rgba(109, 74, 255, 0.22)",
        glow_2="rgba(109, 74, 255, 0.12)",
        on_accent="#ffffff",
        radius=14,
    )
    assert "{{" not in css and "&#" not in css
    assert css.count("{") == css.count("}")
    assert css.count("--a-bg:") == (2 if mode == "auto" else 1)
    assert ("brand.svg" in css) == (logo == "aurora")
    assert ("tentacle" in css) == (logo == "octoprint")


##~~ translations


def template_ids():
    with open(os.path.join(ROOT, "translations", "messages.pot"), encoding="utf-8") as f:
        return {m.id for m in read_po(f) if m.id}


@pytest.mark.parametrize("language", LANGUAGES)
def test_translations_are_complete(language):
    folder = os.path.join(PACKAGE, "translations", language, "LC_MESSAGES")
    with open(os.path.join(folder, "messages.po"), encoding="utf-8") as f:
        catalog = read_po(f)
    translated = {m.id: m.string for m in catalog if m.id}
    assert set(translated) == template_ids()
    assert all(translated.values())
    assert not catalog.fuzzy

    # the compiled catalog must match the .po file
    with open(os.path.join(folder, "messages.mo"), "rb") as f:
        compiled = {m.id: m.string for m in read_mo(f) if m.id}
    assert compiled == translated
