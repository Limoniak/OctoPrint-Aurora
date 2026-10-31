// Shared helpers for the browser tests. They run against a live OctoPrint
// (see tests/run_e2e.sh) with Aurora installed and the virtual printer on.

const os = require("os");
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const BASE_URL = process.env.BASE_URL || "http://localhost:5000";
const USER = process.env.OCTOPRINT_USER || "admin";
const PASSWORD = process.env.OCTOPRINT_PASSWORD || "admin";

async function launch() {
    return chromium.launch();
}

// Logs in and waits for the UI to be ready. Collects uncaught page errors.
async function openUi(browser, { scheme = "light", width = 1440, height = 1000 } = {}) {
    const page = await browser.newPage({
        viewport: { width, height },
        colorScheme: scheme,
    });
    page.errors = [];
    page.on("pageerror", (e) => page.errors.push(process.env.STACKS ? e.stack : e.message));

    await page.goto(BASE_URL + "/login/");
    await page.fill("#login-user", USER);
    await page.fill("#login-password", PASSWORD);
    await page.click("#login-button");
    await page.waitForURL(BASE_URL + "/");
    await page.waitForSelector("#page-container-main", { state: "visible" });
    await page.waitForFunction(() => window.OctoPrint && OctoPrint.coreui && OctoPrint.coreui.viewmodels);
    await page.waitForTimeout(3000);
    await dismissNotifications(page);
    return page;
}

async function dismissNotifications(page) {
    await page.evaluate(() => window.PNotify && PNotify.removeAll());
}

// Returns every visible text below WCAG AA contrast (4.5:1, or 3:1 for large
// text) against its actual background. Disabled controls are exempt.
function contrastScan() {
    const parse = (c) => {
        let m = c.match(/color\(srgb ([^)]+)\)/);
        if (m) {
            const p = m[1].split(/[ /]+/).filter(Boolean).map(Number);
            return [p[0] * 255, p[1] * 255, p[2] * 255, p.length > 3 ? p[3] : 1];
        }
        m = c.match(/rgba?\(([^)]+)\)/);
        if (!m) return null;
        const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
        return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1];
    };
    const lin = (v) => {
        v /= 255;
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    };
    const luminance = (c) => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
    const over = (top, bottom) => [0, 1, 2].map((i) => top[i] * top[3] + bottom[i] * (1 - top[3])).concat(1);
    const background = (el) => {
        const stack = [];
        for (let e = el; e; e = e.parentElement) {
            const c = parse(getComputedStyle(e).backgroundColor);
            if (c && c[3] > 0) {
                stack.push(c);
                if (c[3] >= 1) break;
            }
        }
        let bg = [255, 255, 255, 1];
        for (let i = stack.length - 1; i >= 0; i--) bg = over(stack[i], bg);
        return bg;
    };

    const seen = {};
    const failures = [];
    document.querySelectorAll("body *").forEach((el) => {
        if (["SCRIPT", "STYLE", "CANVAS", "svg", "OPTION"].includes(el.tagName)) return;
        // OctoPrint draws this label over the progress bar fill, which is a
        // separate element the scan cannot see behind it
        if (el.classList.contains("progress-text-front")) return;
        const text = Array.from(el.childNodes)
            .filter((n) => n.nodeType === 3)
            .map((n) => n.textContent.trim())
            .join(" ")
            .trim();
        if (!text) return;
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height || r.bottom < 0 || r.top > innerHeight) return;
        const cs = getComputedStyle(el);
        if (cs.visibility === "hidden") return;
        let opacity = 1;
        for (let e = el; e; e = e.parentElement) opacity *= +getComputedStyle(e).opacity;
        if (opacity < 0.9 || el.closest(".disabled,[disabled],.modal-backdrop")) return;
        const hit = document.elementFromPoint(
            Math.min(innerWidth - 1, r.left + r.width / 2),
            Math.min(innerHeight - 1, r.top + r.height / 2)
        );
        if (hit && !el.contains(hit) && !hit.contains(el)) return; // covered by something else

        const bg = background(el);
        const fg = over(parse(cs.color), bg);
        const a = luminance(fg);
        const b = luminance(bg);
        const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
        const size = parseFloat(cs.fontSize);
        const large = size >= 24 || (+cs.fontWeight >= 700 && size >= 18.66);
        const needed = large ? 3 : 4.5;
        if (ratio >= needed) return;

        const key = el.tagName + "." + el.className + "|" + cs.color;
        if (seen[key]) return;
        seen[key] = true;
        const path = [];
        for (let e = el; e && path.length < 3; e = e.parentElement) {
            path.unshift(e.id ? "#" + e.id : e.tagName.toLowerCase() + (e.classList[0] ? "." + e.classList[0] : ""));
        }
        failures.push(`${ratio.toFixed(2)} < ${needed}  ${path.join(" > ")}  "${text.slice(0, 40)}"`);
    });
    return failures;
}

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

// Uploads the test cube unless it is already there (OctoPrint would ask
// whether to overwrite it) and returns its entry in the file list
async function uploadTestCube(page) {
    const entry = page.locator("#files .gcode_files .entry", { hasText: "aurora_test_cube.gcode" });
    if (!(await entry.count())) {
        await page.setInputFiles("#gcode_upload", [writeTestCube()]);
        await page.waitForTimeout(3000);
        await dismissNotifications(page);
    }
    return entry;
}

// Tiny assertion helper: collects failures and sets the exit code at the end.
function createChecker(name) {
    const failures = [];
    return {
        check(condition, message) {
            if (condition) {
                console.log("  ok    " + message);
            } else {
                console.log("  FAIL  " + message);
                failures.push(message);
            }
        },
        done() {
            if (failures.length) {
                console.log(`\n${name}: ${failures.length} failure(s)`);
                process.exitCode = 1;
            } else {
                console.log(`\n${name}: all checks passed`);
            }
        },
    };
}

module.exports = { BASE_URL, launch, openUi, dismissNotifications, contrastScan, createChecker, writeTestCube, uploadTestCube };
