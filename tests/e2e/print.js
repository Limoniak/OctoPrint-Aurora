// A simulated print on the virtual printer, in the dark theme: upload, print,
// pause, resume, cancel, plus every tab while printing. Fails on page errors
// and checks that the temperature graph and GCode viewer use theme colors.

const os = require("os");
const fs = require("fs");
const path = require("path");
const { launch, openUi, dismissNotifications, createChecker } = require("./helpers");

// A 20 x 20 mm, 30-layer cube: enough for a few seconds of printing
function writeTestCube() {
    const lines = ["M140 S60", "M104 S205", "M190 S60", "M109 S205", "G28", "G90", "M82", "G92 E0"];
    let e = 0;
    for (let layer = 0; layer < 30; layer++) {
        lines.push(`;LAYER:${layer}`, `G1 Z${(0.2 * (layer + 1)).toFixed(2)} F600`);
        const corners = [[90, 90], [110, 90], [110, 110], [90, 110], [90, 90]];
        lines.push(`G0 X90 Y90 F6000`);
        for (const [x, y] of corners.slice(1)) {
            e += 0.8;
            lines.push(`G1 X${x} Y${y} E${e.toFixed(3)} F1800`);
        }
    }
    lines.push("M104 S0", "M140 S0", "G28 X0", "M84");
    const file = path.join(os.tmpdir(), "aurora_test_cube.gcode");
    fs.writeFileSync(file, lines.join("\n") + "\n");
    return file;
}

(async () => {
    const t = createChecker("print");
    const browser = await launch();
    const page = await openUi(browser, { scheme: "dark" });

    await page.setInputFiles("#gcode_upload", [writeTestCube()]);
    await page.waitForTimeout(3000);
    await dismissNotifications(page);
    const entry = page.locator("#files .gcode_files .entry", { hasText: "aurora_test_cube.gcode" });
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
