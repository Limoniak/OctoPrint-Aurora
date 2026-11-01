#!/usr/bin/env bash
# Browser tests against a real OctoPrint.
#
# Needs OctoPrint and Aurora installed in the current Python environment
# (pip install OctoPrint . ) and the Node dependencies of tests/e2e
# (cd tests/e2e && npm install && npx playwright install chromium).
# Starts OctoPrint with the virtual printer on a throwaway base folder, runs
# the tests in tests/e2e, then stops it. OctoPrint refuses to run as root.
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
port="${PORT:-5099}"
basedir="$(mktemp -d)"

cat > "$basedir/config.yaml" <<'EOF'
server:
  firstRun: false
  onlineCheck: {enabled: false}
  pluginBlacklist: {enabled: false}
  seenWizards: {corewizard: 4, tracking: null, backup: null, softwareupdate: null, achievements: null}
plugins:
  # any image works as a "stream" for the floating webcam test (the config
  # version keeps the plugin from migrating it away)
  classicwebcam: {stream: /static/img/tentacle-76x76.png, _config_version: 1}
  tracking: {enabled: false}
  virtual_printer: {enabled: true}
  announcements: {enabled_channels: []}
serial:
  autoconnect: true
  port: VIRTUAL
  additionalPorts: []
EOF

octoprint --basedir "$basedir" user add admin --password admin --admin > /dev/null
octoprint --basedir "$basedir" serve --port "$port" > "$basedir/octoprint.log" 2>&1 &
server=$!

cleanup() {
    kill "$server" 2> /dev/null || true
    wait "$server" 2> /dev/null || true
    rm -rf "$basedir"
}
trap cleanup EXIT

for _ in $(seq 90); do
    if curl -sf -o /dev/null "http://localhost:$port/login/"; then break; fi
    if ! kill -0 "$server" 2> /dev/null; then break; fi
    sleep 2
done
if ! curl -sf -o /dev/null "http://localhost:$port/login/"; then
    echo "OctoPrint did not start:"
    tail -n 40 "$basedir/octoprint.log"
    exit 1
fi
if ! grep -q "Aurora UI" "$basedir/octoprint.log"; then
    echo "Aurora UI is not loaded, install it in this Python environment first."
    exit 1
fi

export BASE_URL="http://localhost:$port"
status=0
cd "$here/e2e"
# settings.js disables the theme at the end, so it runs last.
# TESTS="features.js" runs a subset.
for test in ${TESTS:-contrast.js print.js features.js webcam.js settings.js}; do
    echo "=== $test"
    node "$test" || status=1
done

if [ "$status" -ne 0 ]; then
    echo "--- OctoPrint log (last 40 lines)"
    tail -n 40 "$basedir/octoprint.log"
fi
exit "$status"
