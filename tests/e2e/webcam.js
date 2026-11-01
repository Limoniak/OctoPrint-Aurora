// Floating webcam with the stream types OctoPrint's Classic Webcam plays:
// MJPEG in an <img>, HLS and WebRTC in a <video>, and picture in picture.
//
// A small server started here plays the camera: it serves an HLS stream
// made with ffmpeg (skipped when ffmpeg is missing) and answers WebRTC
// offers like camera-streamer, from a second browser page that streams a
// drawn canvas.

const fs = require("fs");
const os = require("os");
const path = require("path");
const http = require("http");
const { execFileSync } = require("child_process");
const { chromium } = require("playwright");
const { openUi, createChecker } = require("./helpers");

const PORT = +(process.env.CAM_PORT || 5101);
const CAM = `http://localhost:${PORT}`;

const vm = "OctoPrint.coreui.viewmodels.auroraWebcamViewModel";
const setStream = (page, stream) =>
    page.evaluate((stream) => OctoPrint.settings.save({ plugins: { classicwebcam: { stream } } }), stream);

function makeHls() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "aurora-hls-"));
    try {
        execFileSync("ffmpeg", [
            "-loglevel", "error", "-f", "lavfi", "-i", "testsrc=size=640x480:rate=15", "-t", "8",
            "-c:v", "libx264", "-profile:v", "baseline", "-pix_fmt", "yuv420p", "-g", "15",
            "-f", "hls", "-hls_time", "2", "-hls_playlist_type", "vod", path.join(dir, "cam.m3u8"),
        ]);
        return dir;
    } catch (e) {
        return null;
    }
}

(async () => {
    const t = createChecker("webcam");
    // plain host addresses for the local WebRTC connection
    const browser = await chromium.launch({ args: ["--disable-features=WebRtcHideLocalIpsWithMdns"] });

    // the "camera": a page sending a moving 320x240 canvas
    const camera = await browser.newPage();
    await camera.setContent("<canvas width=320 height=240></canvas>");
    await camera.evaluate(() => {
        const canvas = document.querySelector("canvas");
        const ctx = canvas.getContext("2d");
        let n = 0;
        setInterval(() => {
            ctx.fillStyle = `hsl(${n++ % 360} 80% 50%)`;
            ctx.fillRect(0, 0, 320, 240);
        }, 50);
        window.stream = canvas.captureStream(15);
        window.answer = async (offer) => {
            const pc = new RTCPeerConnection();
            window.stream.getTracks().forEach((track) => pc.addTrack(track, window.stream));
            await pc.setRemoteDescription(offer);
            await pc.setLocalDescription(await pc.createAnswer());
            await new Promise((resolve) => {
                if (pc.iceGatheringState === "complete") return resolve();
                pc.addEventListener("icegatheringstatechange", () => pc.iceGatheringState === "complete" && resolve());
            });
            return { type: pc.localDescription.type, sdp: pc.localDescription.sdp };
        };
    });

    const hlsDir = makeHls();
    let offers = 0;
    const server = http.createServer((req, res) => {
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Headers", "*");
        res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
        if (req.method === "OPTIONS") return res.end();
        if (req.method === "POST" && req.url === "/webrtc") {
            let body = "";
            req.on("data", (chunk) => (body += chunk));
            req.on("end", async () => {
                offers++;
                const answer = await camera.evaluate((offer) => window.answer(offer), JSON.parse(body));
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify(answer));
            });
            return;
        }
        const file = hlsDir && path.join(hlsDir, path.basename(req.url.split("?")[0]));
        if (file && fs.existsSync(file)) {
            res.setHeader("Content-Type", file.endsWith(".m3u8") ? "application/vnd.apple.mpegurl" : "video/mp2t");
            return res.end(fs.readFileSync(file));
        }
        res.statusCode = 404;
        res.end();
    });
    await new Promise((resolve) => server.listen(PORT, resolve));

    const page = await openUi(browser, { scheme: "dark" });
    const original = await page.evaluate(() => OctoPrint.coreui.viewmodels.settingsViewModel.settings.plugins.classicwebcam.stream());

    const openWebcam = async () => {
        if (!(await page.isVisible("#aurora_webcam"))) await page.click("#navbar_plugin_aurora_webcam > a");
        await page.waitForTimeout(500);
    };
    const closeWebcam = async () => {
        if (await page.isVisible("#aurora_webcam")) await page.click("#navbar_plugin_aurora_webcam > a");
        await page.waitForTimeout(500);
    };
    const videoSize = () => page.$eval("#aurora_webcam video", (v) => `${v.videoWidth}x${v.videoHeight}`);
    const waitForVideo = async () => {
        for (let i = 0; i < 40; i++) {
            if ((await videoSize()) !== "0x0") return;
            await page.waitForTimeout(250);
        }
    };

    try {
        // ----- Picture in picture keeps the picture fitted to its window
        // (Chromium has Document Picture-in-Picture on localhost, headless too)
        const pipButton = "#aurora_webcam .aurora-webcam-button:has(.fa-up-right-from-square)";
        const pipCheck = async (selector, label) => {
            if (!(await page.isVisible(pipButton))) {
                console.log("  skip  picture in picture (not available)");
                return;
            }
            await page.click(pipButton);
            await page.waitForTimeout(500);
            const style = await page.evaluate(
                (selector) => {
                    const pip = documentPictureInPicture.window;
                    const el = pip && pip.document.querySelector(selector);
                    return el ? `${el.style.width} ${el.style.height} ${el.style.objectFit}` : "missing";
                },
                selector
            );
            t.check(style === "100% 100% contain", `${label} fills the picture in picture window (${style})`);
            // closing the window brings the picture back
            await page.evaluate(() => documentPictureInPicture.window.close());
            await page.waitForTimeout(500);
            t.check(await page.isVisible(`#aurora_webcam ${selector}`), `${label} comes back to the page`);
        };

        await openWebcam();
        await pipCheck("img", "the MJPEG picture");
        await closeWebcam();

        // ----- WebRTC (camera-streamer style)

        await setStream(page, `webrtc://localhost:${PORT}/webrtc`);
        await page.waitForTimeout(1500);
        await openWebcam();
        t.check(await page.isVisible("#aurora_webcam video"), "a WebRTC stream plays in a video");
        t.check(!(await page.isVisible("#aurora_webcam img")), "and the MJPEG picture is hidden");
        await waitForVideo();
        t.check((await videoSize()) === "320x240", `the WebRTC video plays (${await videoSize()})`);
        const ratio = await page.evaluate(`${vm}.ratio()`);
        t.check(Math.abs(ratio - 4 / 3) < 0.01, `the window takes the video's shape (${ratio.toFixed(3)})`);
        t.check(!(await page.isVisible("#aurora_webcam .aurora-webcam-error")), "no error shown");
        await pipCheck("video", "the WebRTC video");
        t.check(await page.$eval("#aurora_webcam video", (v) => !v.paused), "and keeps playing");
        await closeWebcam();
        t.check(await page.$eval("#aurora_webcam video", (v) => v.srcObject === null), "closing the window stops the WebRTC stream");
        const before = offers;
        await openWebcam();
        await waitForVideo();
        t.check(offers === before + 1 && (await videoSize()) === "320x240", "reopening connects again");
        await closeWebcam();

        // a camera that does not answer
        await setStream(page, `webrtc://localhost:${PORT}/nothing`);
        await page.waitForTimeout(1500);
        await openWebcam();
        // after the network addresses are gathered (2 seconds at most)
        await page.waitForTimeout(4000);
        t.check(await page.isVisible("#aurora_webcam .aurora-webcam-error"), "a WebRTC stream that fails shows the error");
        await closeWebcam();

        // ----- HLS (hls.js, shipped with OctoPrint)

        if (hlsDir) {
            await setStream(page, `${CAM}/cam.m3u8`);
            await page.waitForTimeout(1500);
            await openWebcam();
            await waitForVideo();
            t.check((await videoSize()) === "640x480", `an HLS stream plays (${await videoSize()})`);
            await closeWebcam();
            t.check(await page.$eval("#aurora_webcam video", (v) => !v.getAttribute("src")), "closing the window stops the HLS stream");
        } else {
            console.log("  skip  HLS (no ffmpeg)");
        }
    } finally {
        await setStream(page, original);
        await page.waitForTimeout(1000);
    }

    t.check(!page.errors.length, `no page errors ${page.errors.join("; ")}`);
    await browser.close();
    server.close();
    if (hlsDir) fs.rmSync(hlsDir, { recursive: true, force: true });
    t.done();
})();
