const CONFIG_PATH = "/data/local/tmp/libsec/config.json";
const GADGET_CONFIG_PATH = "/data/local/tmp/libsec/libsecmon.config.so";
const GADGET_BIN_PATH = "/data/local/tmp/libsec/libsecmon.so";
const GADGET_DIR = "/data/local/tmp/libsec";
const DEFAULT_GADGET_CONFIG = '{"interaction":{"type":"listen","address":"0.0.0.0","port":27042}}';
const DEMO_PACKAGE = "com.example.package";

let config = { targets: [] };
let allApps = [];
let callbackId = 0;
let gadgetInstalled = false;

// ── KSU exec wrapper using string-based callback registration ────────────────
function exec(cmd) {
    return new Promise(function (resolve) {
        var name = "_ksu_cb_" + (++callbackId);
        window[name] = function (errno, stdout, stderr) {
            delete window[name];
            resolve({ errno: errno, stdout: stdout, stderr: stderr });
        };
        ksu.exec(cmd, "{}", name);
    });
}

function shellQuote(s) {
    return "'" + String(s).replace(/'/g, "'\\''") + "'";
}

function escapeHtml(s) {
    return String(s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function escapeAttr(s) {
    return escapeHtml(s).replace(/\n/g, " ");
}

function defaultLibs() {
    return [{ path: GADGET_BIN_PATH }];
}

function stripDemoTargets(cfg) {
    if (!cfg || !Array.isArray(cfg.targets)) {
        return { targets: [] };
    }
    cfg.targets = cfg.targets.filter(function (t) {
        return t && t.app_name && t.app_name !== DEMO_PACKAGE;
    });
    return cfg;
}

// ── Config I/O ───────────────────────────────────────────────────────────────
async function loadConfig() {
    var stripped = false;
    var r = await exec("cat " + CONFIG_PATH);
    if (r.errno === 0 && r.stdout.trim().length > 0) {
        try {
            var parsed = JSON.parse(r.stdout);
            var before = Array.isArray(parsed.targets) ? parsed.targets.length : 0;
            config = stripDemoTargets(parsed);
            stripped = before !== config.targets.length;
        } catch (e) {
            ksu.toast("Config parse error: " + e.message);
            config = { targets: [] };
        }
    } else {
        config = { targets: [] };
    }
    if (!Array.isArray(config.targets)) {
        config.targets = [];
    }
    renderTargets();
    if (stripped) {
        await writeConfig();
    }
}

async function writeConfig() {
    var json = JSON.stringify(config, null, 4);
    return exec("echo " + shellQuote(json) + " > " + CONFIG_PATH + " && chmod 644 " + CONFIG_PATH);
}

async function saveConfig() {
    var r = await writeConfig();
    if (r.errno === 0) {
        ksu.toast("Config saved");
    } else {
        ksu.toast("Save failed: " + r.stderr);
    }
}

async function loadGadgetConfig() {
    var status = document.getElementById("gadget-status");
    var editor = document.getElementById("gadget-editor");
    var r = await exec("cat " + GADGET_CONFIG_PATH);
    if (r.errno === 0) {
        status.className = "status-ok";
        status.textContent = "OK";
        editor.value = r.stdout;
    } else {
        status.className = "status-err";
        status.textContent = "Not found";
        editor.value = DEFAULT_GADGET_CONFIG;
    }
}

async function saveGadgetConfig() {
    var content = document.getElementById("gadget-editor").value;
    var r = await exec("echo " + shellQuote(content) + " > " + GADGET_CONFIG_PATH + " && chmod 644 " + GADGET_CONFIG_PATH);
    if (r.errno === 0) {
        ksu.toast("Gadget config saved");
        loadGadgetConfig();
    } else {
        ksu.toast("Failed: " + r.stderr);
    }
}

function clearAllInjectedLibraries() {
    (config.targets || []).forEach(function (t) {
        t.injected_libraries = [];
        if (t.child_gating) {
            t.child_gating.injected_libraries = [];
        }
    });
    renderTargets();
}

async function maybeClearLibraries() {
    var box = document.getElementById("opt-clear-libs");
    if (!box || !box.checked) {
        return false;
    }
    clearAllInjectedLibraries();
    await saveConfig();
    return true;
}

async function refreshGadgetBinary() {
    var status = document.getElementById("gadget-bin-status");
    var info = document.getElementById("gadget-bin-info");
    var r = await exec(
        "if [ -f " + GADGET_BIN_PATH + " ]; then " +
        "stat -c '%s %y' " + GADGET_BIN_PATH + " 2>/dev/null || ls -l " + GADGET_BIN_PATH + "; " +
        "else echo MISSING; fi"
    );
    var text = (r.stdout || "").trim();
    gadgetInstalled = r.errno === 0 && text.length > 0 && text.indexOf("MISSING") !== 0;
    if (gadgetInstalled) {
        status.className = "status-ok";
        status.textContent = "Installed";
        info.textContent = GADGET_BIN_PATH + "  (" + text + ")";
    } else {
        status.className = "status-err";
        status.textContent = "Missing";
        info.textContent = "No gadget at " + GADGET_BIN_PATH;
    }
}

async function installGadget() {
    var src = (document.getElementById("gadget-path").value || "").trim();
    if (!src) {
        ksu.toast("Pick or enter a .so path first");
        return;
    }
    if (src.indexOf("\n") !== -1 || src.indexOf(";") !== -1) {
        ksu.toast("Invalid path");
        return;
    }

    var cmd =
        "set -e; " +
        "SRC=" + shellQuote(src) + "; " +
        "DST=" + shellQuote(GADGET_BIN_PATH) + "; " +
        "DIR=" + shellQuote(GADGET_DIR) + "; " +
        "mkdir -p \"$DIR\"; " +
        "if [ ! -f \"$SRC\" ]; then echo 'source not found' >&2; exit 2; fi; " +
        "case \"$SRC\" in " +
        "  *.xz) " +
        "    UNXZ=''; " +
        "    for c in /data/adb/ksu/bin/busybox /data/adb/magisk/busybox /data/adb/ap/bin/busybox busybox unxz xz; do " +
        "      [ -x \"$c\" ] || command -v \"$c\" >/dev/null 2>&1 || continue; " +
        "      UNXZ=\"$c\"; break; " +
        "    done; " +
        "    if [ -z \"$UNXZ\" ]; then echo 'no unxz/busybox found' >&2; exit 3; fi; " +
        "    if [ \"$UNXZ\" = xz ]; then xz -dc \"$SRC\" > \"$DST\"; " +
        "    elif [ \"$UNXZ\" = unxz ]; then unxz -c \"$SRC\" > \"$DST\"; " +
        "    else \"$UNXZ\" unxz -c \"$SRC\" > \"$DST\"; fi; " +
        "    ;; " +
        "  *) cp -f \"$SRC\" \"$DST\" ;; " +
        "esac; " +
        "chmod 644 \"$DST\"; " +
        "HDR=$(od -An -N4 -tx1 \"$DST\" 2>/dev/null | tr -d ' \\n'); " +
        "if [ \"$HDR\" != \"7f454c46\" ]; then echo 'not an ELF .so' >&2; rm -f \"$DST\"; exit 4; fi; " +
        "echo OK";

    var r = await exec(cmd);
    if (r.errno === 0 && (r.stdout || "").indexOf("OK") !== -1) {
        ksu.toast("Gadget installed");
        await maybeClearLibraries();
        await refreshGadgetBinary();
    } else {
        ksu.toast("Install failed: " + ((r.stderr || r.stdout || "unknown").trim()));
        await refreshGadgetBinary();
    }
}

async function removeGadget() {
    var r = await exec("rm -f " + GADGET_BIN_PATH);
    if (r.errno === 0) {
        ksu.toast("Gadget removed");
        await maybeClearLibraries();
        await refreshGadgetBinary();
    } else {
        ksu.toast("Remove failed: " + r.stderr);
    }
}

async function scanGadgetCandidates() {
    var list = document.getElementById("gadget-scan-list");
    list.innerHTML = '<div class="empty">Scanning...</div>';
    var r = await exec(
        "find /sdcard/Download /sdcard/Downloads /storage/emulated/0/Download " +
        "/data/local/tmp /sdcard -maxdepth 3 -type f " +
        "\\( -name '*.so' -o -name '*.so.xz' \\) 2>/dev/null | head -n 80"
    );
    var paths = (r.stdout || "").split("\n").map(function (l) { return l.trim(); }).filter(Boolean);
    if (paths.length === 0) {
        list.innerHTML = '<div class="empty">No .so files found under Download or /data/local/tmp</div>';
        return;
    }
    list.innerHTML = "";
    paths.forEach(function (p) {
        var row = document.createElement("div");
        row.className = "scan-row";
        row.textContent = p;
        row.onclick = function () {
            document.getElementById("gadget-path").value = p;
            ksu.toast("Selected");
        };
        list.appendChild(row);
    });
}

// ── App list ─────────────────────────────────────────────────────────────────
var appLabels = {};

async function fetchApps() {
    var r = await exec(
        "for p in $(pm list packages -3 | sed 's/package://'); do " +
        "l=$(dumpsys package \"$p\" | grep -m1 'nonLocalizedLabel=' | sed 's/.*nonLocalizedLabel=//;s/ .*//'); " +
        "echo \"$p|${l:-$p}\"; done"
    );
    if (r.errno === 0 && r.stdout.trim().length > 0) {
        allApps = [];
        r.stdout.split("\n").forEach(function (line) {
            line = line.trim();
            if (!line) return;
            var parts = line.split("|");
            var pkg = parts[0];
            var label = parts[1] || pkg;
            allApps.push(pkg);
            appLabels[pkg] = label;
        });
        allApps.sort(function (a, b) {
            return (appLabels[a] || a).localeCompare(appLabels[b] || b);
        });
    }
    if (allApps.length === 0) {
        var r2 = await exec("pm list packages -3");
        if (r2.errno === 0 && r2.stdout.trim().length > 0) {
            allApps = r2.stdout.split("\n")
                .filter(function (l) { return l.indexOf("package:") === 0; })
                .map(function (l) { return l.replace("package:", "").trim(); })
                .sort();
        }
    }
}

function getAppLabel(pkg) {
    return appLabels[pkg] || pkg;
}

// ── Render ───────────────────────────────────────────────────────────────────
function renderTargets() {
    var container = document.getElementById("targets");
    container.innerHTML = "";

    if (!config.targets || config.targets.length === 0) {
        container.innerHTML = '<div class="empty">No targets configured. Tap + Add to start.</div>';
        return;
    }

    config.targets.forEach(function (t, i) {
        var div = document.createElement("div");
        div.className = "target";

        var childHtml = "";
        if (t.child_gating && t.child_gating.enabled) {
            var childLibs = (t.child_gating.injected_libraries || [])
                .map(function (l) { return l.path; }).join("\n");
            childHtml =
                '<div class="field"><label>Mode</label>' +
                '<select onchange="updateField(' + i + ',\'child_mode\',this.value)">' +
                '<option value="freeze"' + (t.child_gating.mode === "freeze" ? " selected" : "") + '>Freeze</option>' +
                '<option value="kill"' + (t.child_gating.mode === "kill" ? " selected" : "") + '>Kill</option>' +
                '<option value="inject"' + (t.child_gating.mode === "inject" ? " selected" : "") + '>Inject</option>' +
                '</select></div>' +
                '<div class="field"><label>Child Libraries</label>' +
                '<textarea onchange="updateField(' + i + ',\'child_libs\',this.value)">' + childLibs + '</textarea></div>';
        }

        var libs = (t.injected_libraries || []).map(function (l) { return l.path; }).join("\n");
        var label = getAppLabel(t.app_name);

        div.innerHTML =
            '<div class="row">' +
                '<div class="target-title" title="' + escapeAttr(label + " (" + t.app_name + ")") + '">' +
                    '<strong>' + escapeHtml(label) + '</strong>' +
                    '<div class="target-pkg">' + escapeHtml(t.app_name) + '</div>' +
                '</div>' +
                '<div class="row row-gap">' +
                    '<label class="switch"><input type="checkbox"' + (t.enabled ? " checked" : "") +
                    ' onchange="updateField(' + i + ',\'enabled\',this.checked)"><span class="slider"></span></label>' +
                    '<button class="btn btn-danger btn-sm" onclick="removeTarget(' + i + ')">X</button>' +
                '</div>' +
            '</div>' +
            '<div class="row" style="margin-top:8px">' +
                '<span style="font-size:12px;color:var(--text2)">Kernel Evasion</span>' +
                '<label class="switch"><input type="checkbox"' + (t.kernel_assisted_evasion ? " checked" : "") +
                ' onchange="updateField(' + i + ',\'ksie\',this.checked)"><span class="slider"></span></label>' +
            '</div>' +
            '<div class="field"><label>Delay (ms)</label>' +
                '<input type="number" value="' + (t.start_up_delay_ms || 0) +
                '" onchange="updateField(' + i + ',\'delay\',this.value)"></div>' +
            '<div class="field"><label>Injected Libraries</label>' +
                '<textarea onchange="updateField(' + i + ',\'libs\',this.value)">' + libs + '</textarea></div>' +
            '<div class="child-panel">' +
                '<div class="row"><span style="font-size:12px">Child Gating</span>' +
                '<label class="switch"><input type="checkbox"' +
                (t.child_gating && t.child_gating.enabled ? " checked" : "") +
                ' onchange="updateField(' + i + ',\'child_enabled\',this.checked)"><span class="slider"></span></label>' +
                '</div>' + childHtml +
            '</div>';

        container.appendChild(div);
    });
}

// ── Data updates ─────────────────────────────────────────────────────────────
function updateField(i, field, value) {
    var t = config.targets[i];
    switch (field) {
        case "enabled":
            t.enabled = value;
            break;
        case "ksie":
            t.kernel_assisted_evasion = value;
            break;
        case "delay":
            t.start_up_delay_ms = parseInt(value) || 0;
            break;
        case "libs":
            t.injected_libraries = value.split("\n")
                .filter(function (l) { return l.trim() !== ""; })
                .map(function (l) { return { path: l.trim() }; });
            break;
        case "child_enabled":
            if (!t.child_gating) {
                t.child_gating = { enabled: false, mode: "freeze", injected_libraries: [] };
            }
            t.child_gating.enabled = value;
            renderTargets();
            break;
        case "child_mode":
            t.child_gating.mode = value;
            break;
        case "child_libs":
            t.child_gating.injected_libraries = value.split("\n")
                .filter(function (l) { return l.trim() !== ""; })
                .map(function (l) { return { path: l.trim() }; });
            break;
    }
}

function removeTarget(i) {
    config.targets.splice(i, 1);
    renderTargets();
}

function addTarget(pkg) {
    if (config.targets.some(function (t) { return t.app_name === pkg; })) {
        ksu.toast("Already added");
        return;
    }
    config.targets.push({
        app_name: pkg,
        enabled: true,
        kernel_assisted_evasion: false,
        start_up_delay_ms: 0,
        injected_libraries: defaultLibs(),
        child_gating: { enabled: false, mode: "freeze", injected_libraries: [] }
    });
    renderTargets();
}

// ── Modal ────────────────────────────────────────────────────────────────────
function showAppList() {
    document.getElementById("app-modal").style.display = "flex";
    document.getElementById("app-search").value = "";
    renderAppList();
}

function closeAppModal() {
    document.getElementById("app-modal").style.display = "none";
}

function renderAppList() {
    var list = document.getElementById("app-list");
    var search = document.getElementById("app-search").value.toLowerCase();

    var filtered = allApps.filter(function (a) {
        var label = (appLabels[a] || "").toLowerCase();
        return a.toLowerCase().indexOf(search) !== -1 || label.indexOf(search) !== -1;
    });

    if (filtered.length === 0) {
        list.innerHTML = '<div class="empty">No apps found</div>';
        return;
    }

    list.innerHTML = "";
    filtered.forEach(function (app) {
        var row = document.createElement("div");
        row.className = "app-row";
        var label = getAppLabel(app);
        row.innerHTML = '<div><strong>' + label + '</strong></div>' +
            '<div class="app-label">' + app + '</div>';
        row.onclick = function () {
            addTarget(app);
            closeAppModal();
        };
        list.appendChild(row);
    });
}

// ── Init ─────────────────────────────────────────────────────────────────────
window.onload = function () {
    if (typeof ksu === "undefined") {
        document.body.innerHTML = '<div style="text-align:center;padding:40px;color:#f44336;">' +
            'This page must be opened in KernelSU Manager.</div>';
        return;
    }

    document.getElementById("btn-add").onclick = showAppList;
    document.getElementById("btn-save").onclick = saveConfig;
    document.getElementById("btn-reload").onclick = function () {
        loadConfig();
        loadGadgetConfig();
        refreshGadgetBinary();
    };
    document.getElementById("btn-save-gadget").onclick = saveGadgetConfig;
    document.getElementById("btn-install-gadget").onclick = installGadget;
    document.getElementById("btn-remove-gadget").onclick = removeGadget;
    document.getElementById("btn-scan-gadget").onclick = scanGadgetCandidates;
    document.getElementById("btn-close-modal").onclick = closeAppModal;
    document.getElementById("app-search").oninput = renderAppList;

    loadConfig();
    loadGadgetConfig();
    refreshGadgetBinary();
    fetchApps();
};
