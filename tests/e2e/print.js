// A simulated print on the virtual printer, in the dark theme: upload, print,
// pause, resume, cancel, plus every tab while printing. Fails on page errors
// and checks that the temperature graph and GCode viewer use theme colors.

const { launch, openUi, createChecker, uploadTestCube } = require("./helpers");

(async () => {
    const t = createChecker("print");
    const browser = await launch();
    const page = await openUi(browser, { scheme: "dark" });

    const entry = await uploadTestCube(page);
    t.check((await entry.count()) === 1, "test file uploaded");

    await entry.locator(".btn-files-print").click();
    await page.waitForFunction(() => /Printing/.test(document.querySelector("#state").textContent), null, {
        timeout: 30000,
    });
    t.check(true, "print started");

    const grid = await page.evaluate(
        () => OctoPrint.coreui.viewmodels.temperatureViewModel.plot.getOptions().grid.borderColor
    );
    t.check(/255, 255, 255/.test(grid), `temperature graph uses the dark theme grid (${grid})`);

    for (const id of ["control_link", "gcode_link", "term_link", "timelapse_link", "temp_link"]) {
        await page.click(`#${id} a`);
        await page.waitForTimeout(1200);
    }
    await page.click("#gcode_link a");
    await page.waitForTimeout(1500);
    const bed = await page.evaluate(() => GCODE.renderer.getOptions().colorGrid);
    t.check(bed === "#2b3245", `GCode viewer uses the dark theme grid (${bed})`);

    await page.click("#job_pause");
    await page.waitForFunction(() => /Paused/.test(document.querySelector("#state").textContent), null, {
        timeout: 30000,
    });
    t.check(true, "print paused");
    await page.click("#job_pause");
    await page.waitForFunction(() => /Printing/.test(document.querySelector("#state").textContent), null, {
        timeout: 30000,
    });
    t.check(true, "print resumed");

    await page.click("#job_cancel");
    await page.waitForTimeout(1000);
    await page.locator(".modal:visible .modal-footer .btn-danger, .modal:visible .modal-footer .btn-primary").last().click();
    await page.waitForFunction(() => /Operational/.test(document.querySelector("#state").textContent), null, {
        timeout: 60000,
    });
    t.check(true, "print cancelled");

    t.check(!page.errors.length, `no page errors ${page.errors.join("; ")}`);
    await browser.close();
    t.done();
})();
