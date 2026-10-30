// Aurora's settings: live preview, revert on close, save, navbar theme toggle,
// persistence across reloads, login stylesheet and disabling the theme.
// Leaves the theme disabled, so run it last.

const { BASE_URL, launch, openUi, createChecker } = require("./helpers");

const state = (page) =>
    page.evaluate(() => ({
        enabled: document.documentElement.classList.contains("aurora"),
        theme: document.documentElement.dataset.auroraTheme,
        accent: document.documentElement.style.getPropertyValue("--a-accent"),
        sidebar: document.documentElement.dataset.auroraSidebar,
    }));

async function openAuroraSettings(page) {
    await page.evaluate(() => OctoPrint.coreui.viewmodels.settingsViewModel.show());
    await page.waitForTimeout(2500);
    await page.evaluate(() => $('#settings_dialog a[href="#settings_plugin_aurora"]').tab("show"));
    await page.waitForTimeout(800);
}

const save = async (page) => {
    await page.click("#settings_dialog > .modal-footer .btn-primary:visible");
    await page.waitForTimeout(2500);
};

(async () => {
    const t = createChecker("settings");
    const browser = await launch();
    const page = await openUi(browser, { scheme: "light" });

    let s = await state(page);
    t.check(s.enabled && s.theme === "light" && s.accent === "#6d4aff", "defaults applied (light, default accent)");

    await openAuroraSettings(page);
    await page.click('#settings_plugin_aurora .aurora-swatch[title="#db2777"]');
    await page.selectOption('#settings_plugin_aurora select[data-bind="value: s.sidebar"]', "right");
    s = await state(page);
    t.check(s.accent === "#db2777" && s.sidebar === "right", "changes are previewed live");

    await page.click('#settings_dialog > .modal-footer button.btn:has-text("Close"):visible');
    await page.waitForTimeout(1000);
    s = await state(page);
    t.check(s.accent === "#6d4aff" && s.sidebar === "left", "closing without saving reverts the preview");

    await openAuroraSettings(page);
    await page.click('#settings_plugin_aurora .aurora-swatch[title="#db2777"]');
    await save(page);
    s = await state(page);
    t.check(s.accent === "#db2777", "saved accent is applied");

    await page.click("#navbar_plugin_aurora a");
    await page.waitForTimeout(500);
    t.check((await state(page)).theme === "dark", "navbar button switches to the dark theme");

    await page.reload();
    await page.waitForTimeout(6000);
    s = await state(page);
    t.check(s.theme === "dark" && s.accent === "#db2777", "theme and accent survive a reload");

    const css = await (await page.request.get(BASE_URL + "/plugin/aurora/login.css")).text();
    t.check(/--a-accent: #db2777;/.test(css), "login stylesheet uses the saved accent");

    await openAuroraSettings(page);
    await page.click("#settings_plugin_aurora input[type=checkbox] >> nth=0");
    await save(page);
    t.check(!(await state(page)).enabled, "unticking Enable restores the stock look");
    const login = await (await page.request.get(BASE_URL + "/login/")).text();
    t.check(!login.includes("aurora/login.css"), "login page is no longer themed when disabled");

    t.check(!page.errors.length, `no page errors ${page.errors.join("; ")}`);
    await browser.close();
    t.done();
})();
