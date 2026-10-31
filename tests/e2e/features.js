// Aurora's features: customizable layout, remembered panels, file grid view,
// terminal tools, floating webcam, print status card and progress in the browser tab.

const { BASE_URL, launch, openUi, dismissNotifications, contrastScan, createChecker, uploadTestCube } = require("./helpers");

const BLANK = "data:image/gif";

async function openAuroraSettings(page) {
    await page.evaluate(() => OctoPrint.coreui.viewmodels.settingsViewModel.show());
    await page.waitForTimeout(2500);
    await page.evaluate(() => $('#settings_dialog a[href="#settings_plugin_aurora"]').tab("show"));
    await page.waitForTimeout(800);
}

const closeSettings = (page) => page.click('#settings_dialog > .modal-footer button.btn:has-text("Close"):visible');
const saveSettings = (page) => page.click("#settings_dialog > .modal-footer .btn-primary:visible");
// tabs in the order they appear, those moved into the overflow menu ("☰") included
const tabOrder = (page) => page.evaluate(() => OctoPrint.coreui.viewmodels.auroraLayoutViewModel.tabList().map((item) => item.id));
const stateText = (page) => page.evaluate(() => document.querySelector("#state").textContent);

(async () => {
    const t = createChecker("features");
    const browser = await launch();
    let page = await openUi(browser, { scheme: "dark" });

    t.check(!(await page.isVisible("#aurora_printcard")), "no print status card while idle");

    // ----- Layout: hide and reorder, revert on close, save, reset

    const sidebar = await page.evaluate(() => OctoPrint.coreui.viewmodels.auroraLayoutViewModel.sidebarList().map((i) => i.id));
    const tabs = await tabOrder(page);
    t.check(sidebar.length >= 3 && tabs.length >= 4, `layout lists ${sidebar.length} panels and ${tabs.length} tabs`);
    const panel = sidebar[sidebar.length - 1];

    await openAuroraSettings(page);
    await page.locator("#settings_plugin_aurora .aurora-layout-list").first().locator("li").last().locator("input[type=checkbox]").uncheck();
    await page.locator("#settings_plugin_aurora .aurora-layout-list").nth(1).locator("li").first().locator("button").nth(1).click();
    await page.waitForTimeout(500);
    t.check(await page.evaluate((id) => document.getElementById(id).classList.contains("aurora-hidden"), panel), `previewing: panel ${panel} hidden`);
    t.check((await tabOrder(page))[1] === tabs[0], "previewing: first tab moved down");
    t.check(
        await page.evaluate((id) => {
            const order = Array.from(document.querySelectorAll("#tabs li[id$='_link']")).filter((li) => !li.closest(".tabdrop"));
            const ids = order.map((li) => li.id);
            return ids.indexOf(id) === 1 || document.querySelector("#tabs .tabdrop #" + id) !== null;
        }, tabs[0]),
        "previewing: the tab bar follows the new order"
    );

    await closeSettings(page);
    await page.waitForTimeout(1000);
    t.check(!(await page.evaluate((id) => document.getElementById(id).classList.contains("aurora-hidden"), panel)), "closing without saving shows the panel again");
    t.check((await tabOrder(page))[0] === tabs[0], "closing without saving restores the tab order");

    await openAuroraSettings(page);
    await page.locator("#settings_plugin_aurora .aurora-layout-list").first().locator("li").last().locator("input[type=checkbox]").uncheck();
    await saveSettings(page);
    await page.waitForTimeout(2500);
    await page.reload();
    await page.waitForTimeout(7000);
    t.check(await page.evaluate((id) => document.getElementById(id).classList.contains("aurora-hidden"), panel), "a hidden panel stays hidden after a reload");

    await openAuroraSettings(page);
    await page.click('#settings_plugin_aurora button:has-text("Reset the layout")');
    await saveSettings(page);
    await page.waitForTimeout(2500);
    t.check(!(await page.evaluate((id) => document.getElementById(id).classList.contains("aurora-hidden"), panel)), "resetting the layout shows every panel");

    // ----- Collapsed panel remembered in this browser

    await page.click("#files_wrapper .accordion-toggle");
    await page.waitForTimeout(1000);
    await page.reload();
    await page.waitForTimeout(7000);
    t.check(!(await page.evaluate(() => document.getElementById("files").classList.contains("in"))), "a collapsed panel stays collapsed after a reload");
    await page.click("#files_wrapper .accordion-toggle");
    await page.waitForTimeout(1000);
    await dismissNotifications(page);

    // ----- File list grid view

    const cube = await uploadTestCube(page);
    t.check(await page.isVisible("#files_wrapper > .accordion-heading #aurora_files_view a"), "the grid toggle is in the Files panel header");
    await page.click("#aurora_files_view a");
    await page.waitForTimeout(800);
    t.check(await page.evaluate(() => document.querySelector("#files .gcode_files").classList.contains("aurora-grid")), "the toggle switches the file list to a grid");
    t.check(await cube.locator(".aurora-file-thumb").isVisible(), "each file card has a thumbnail area");
    await cube.locator(".aurora-file-thumb").click();
    await page.waitForTimeout(1500);
    const loaded = await page.evaluate(() => OctoPrint.coreui.viewmodels.printerStateViewModel.filename());
    t.check(loaded === "aurora_test_cube.gcode", `clicking the thumbnail loads the file (${loaded})`);
    await page.reload();
    await page.waitForTimeout(7000);
    t.check(await page.evaluate(() => document.querySelector("#files .gcode_files").classList.contains("aurora-grid")), "the grid view is remembered after a reload");
    await page.click("#aurora_files_view a");
    await page.waitForTimeout(800);
    t.check(!(await page.evaluate(() => document.querySelector("#files .gcode_files").classList.contains("aurora-grid"))), "the toggle switches back to the list");
    await dismissNotifications(page);

    // ----- Terminal tools

    await page.click("#term_link a");
    await page.waitForTimeout(1500);
    await page.fill("#terminal-command", "M114");
    await page.click("#terminal-send");
    await page.waitForTimeout(2000);
    const recent = await page.$$eval("#aurora_terminal .btn-link.aurora-terminal-chip", (chips) => chips.map((c) => c.textContent));
    t.check(recent[0] === "M114", `the sent command is in the recent list (${recent.join(", ")})`);
    const favorite = await page.$eval("#aurora_terminal .aurora-terminal-chip:not(.btn-link)", (chip) => chip.textContent);
    await page.click("#aurora_terminal .aurora-terminal-chip:not(.btn-link)");
    await page.waitForTimeout(2000);
    const output = await page.$eval("#terminal-output", (el) => el.textContent);
    t.check(output.includes("Send: " + favorite), `the favorite ${favorite} is sent to the printer`);
    t.check((await page.$$("#terminal-output .t-cmd")).length > 0, "G-code in the terminal is colored");

    // ----- Floating webcam

    if (await page.isVisible("#navbar_plugin_aurora_webcam > a")) {
        await page.click("#navbar_plugin_aurora_webcam > a");
        await page.waitForTimeout(1500);
        t.check(await page.isVisible("#aurora_webcam"), "the floating webcam opens");
        const src = await page.$eval("#aurora_webcam img", (img) => img.getAttribute("src"));
        t.check(src && !src.startsWith(BLANK), `it shows the stream (${src})`);

        const before = await page.$eval("#aurora_webcam", (el) => el.getBoundingClientRect().left);
        const bar = await page.$eval("#aurora_webcam .aurora-webcam-title", (el) => {
            const r = el.getBoundingClientRect();
            return { x: r.left + 20, y: r.top + r.height / 2 };
        });
        await page.mouse.move(bar.x, bar.y);
        await page.mouse.down();
        await page.mouse.move(bar.x - 300, bar.y - 100, { steps: 8 });
        await page.mouse.up();
        const after = await page.$eval("#aurora_webcam", (el) => el.getBoundingClientRect().left);
        t.check(after < before - 200, "it can be dragged by its title bar");

        await page.click("#temp_link a");
        await page.waitForTimeout(800);
        t.check(await page.isVisible("#aurora_webcam"), "it stays visible on another tab");

        await page.click("#aurora_webcam .aurora-webcam-button[aria-label]:last-child");
        await page.waitForTimeout(800);
        const closed = await page.$eval("#aurora_webcam img", (img) => img.getAttribute("src"));
        t.check(!(await page.isVisible("#aurora_webcam")) && closed.startsWith(BLANK), "closing it stops the stream");
    } else {
        console.log("  skip  floating webcam (no webcam stream configured)");
    }

    // ----- Print status card and progress in the browser tab

    const entry = await uploadTestCube(page);
    await entry.locator(".btn-files-print").click();
    await page.waitForFunction(() => /Printing/.test(document.querySelector("#state").textContent), null, { timeout: 30000 });
    await page.waitForTimeout(4000);
    await dismissNotifications(page);

    t.check(await page.isVisible("#aurora_printcard"), "the print status card shows while printing");
    t.check(await page.evaluate(() => document.querySelector(".tabbable > #aurora_printcard") !== null), "it sits above the tabs");
    const card = await page.evaluate(() => ({
        file: document.querySelector(".aurora-printcard-file").textContent,
        percent: document.querySelector(".aurora-printcard-ring strong").textContent,
    }));
    t.check(card.file === "aurora_test_cube.gcode" && /^\d+$/.test(card.percent), `it shows the file and the progress (${card.file}, ${card.percent}%)`);
    t.check(/^\d+% · aurora_test_cube\.gcode · /.test(await page.title()), `the tab title shows the progress (${await page.title()})`);
    const icon = await page.$eval('link[rel~="icon"]', (link) => decodeURIComponent(link.getAttribute("href")));
    t.check(icon.startsWith("data:image/svg+xml") && icon.includes("stroke-dasharray"), "the tab icon shows a progress ring");

    for (const scheme of ["dark", "light"]) {
        await page.emulateMedia({ colorScheme: scheme });
        await page.click("#temp_link a");
        await page.waitForTimeout(800);
        const failures = await page.evaluate(contrastScan);
        t.check(!failures.length, `contrast with the card, ${scheme} theme ${failures.join("; ")}`);
    }

    await page.click('#aurora_printcard button:has-text("Pause")');
    await page.waitForFunction(() => /Paused/.test(document.querySelector("#state").textContent), null, { timeout: 30000 });
    await page.waitForTimeout(1000);
    t.check(await page.evaluate(() => document.getElementById("aurora_printcard").classList.contains("paused")), "pausing from the card");
    t.check((await page.title()).startsWith("⏸"), "the tab title marks the pause");

    await page.click('#aurora_printcard button:has-text("Resume")');
    await page.waitForFunction(() => /Printing/.test(document.querySelector("#state").textContent), null, { timeout: 30000 });
    t.check(true, "resuming from the card");

    await page.click('#aurora_printcard button:has-text("Cancel")');
    await page.waitForTimeout(1000);
    await page.locator(".modal:visible .modal-footer .btn-danger, .modal:visible .modal-footer .btn-primary").last().click();
    await page.waitForFunction(() => /Operational/.test(document.querySelector("#state").textContent), null, { timeout: 60000 });
    await page.waitForTimeout(1500);
    t.check(!(await page.isVisible("#aurora_printcard")), "the card goes away once the print is cancelled");
    t.check(!/%/.test(await page.title()), `the tab title is restored (${await page.title()})`);

    t.check(!page.errors.length, `no page errors ${page.errors.join("; ")}`);
    await browser.close();
    t.done();
})();
