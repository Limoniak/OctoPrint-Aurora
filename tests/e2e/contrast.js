// Contrast of every text in the main views, the tabs, every settings section
// and the About dialog, in both themes. Also fails on uncaught page errors.

const { BASE_URL, launch, openUi, contrastScan, createChecker } = require("./helpers");

(async () => {
    const t = createChecker("contrast");
    const browser = await launch();

    for (const scheme of ["light", "dark"]) {
        console.log(`\n[${scheme}]`);

        const login = await browser.newPage({ colorScheme: scheme });
        await login.goto(BASE_URL + "/login/");
        const loginFailures = await login.evaluate(contrastScan);
        t.check(!loginFailures.length, `login page ${loginFailures.join("; ")}`);
        await login.close();

        const page = await openUi(browser, { scheme });
        t.check(
            await page.evaluate(() => document.documentElement.classList.contains("aurora")),
            "theme is active"
        );

        const tabs = await page.$$eval("#tabs > li[id$='_link']:not(.tabdrop)", (items) => items.map((li) => li.id));
        for (const id of tabs) {
            await page.click(`#${id} a`);
            await page.waitForTimeout(1500);
            const failures = await page.evaluate(contrastScan);
            t.check(!failures.length, `tab ${id} ${failures.join("; ")}`);
        }

        await page.evaluate(() => OctoPrint.coreui.viewmodels.settingsViewModel.show());
        await page.waitForTimeout(2500);
        const sections = await page.$$eval("#settings_dialog .nav-list a[href^='#settings_']", (links) =>
            links.map((a) => a.getAttribute("href"))
        );
        const bad = [];
        for (const href of sections) {
            await page.evaluate((h) => $(`#settings_dialog a[href="${h}"]`).tab("show"), href);
            await page.waitForTimeout(400);
            const failures = await page.evaluate(contrastScan);
            if (failures.length) bad.push(`${href}: ${failures.join("; ")}`);
        }
        t.check(sections.length > 20 && !bad.length, `${sections.length} settings sections ${bad.join(" | ")}`);
        await page.keyboard.press("Escape");
        await page.waitForTimeout(800);

        await page.click("#footer_about a");
        await page.waitForTimeout(1500);
        const about = await page.evaluate(contrastScan);
        t.check(!about.length, `about dialog ${about.join("; ")}`);

        t.check(!page.errors.length, `no page errors ${page.errors.join("; ")}`);
        await page.close();
    }

    await browser.close();
    t.done();
})();
