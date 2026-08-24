import { computed, reactive, ref } from "vue";
import {
  CONFIG_PATH,
  DEFAULT_GADGET_CONFIG,
  DEMO_PACKAGE,
  GADGET_BIN_PATH,
  GADGET_CONFIG_PATH,
  GADGET_DIR,
  defaultLibs,
} from "../constants";
import { exec, hasKsu, ksuCall, parseJsonArray, shellQuote, toast } from "../ksu";
import type {
  AppConfig,
  AppFilter,
  ChildGating,
  GadgetJsonStatus,
  PackageInfo,
  Tab,
  Target,
} from "../types";

function prettyJson(value: unknown): string {
  return JSON.stringify(value, null, 4);
}

function parseGadgetJson(raw: string): object {
  const parsed: unknown = JSON.parse(raw);
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new SyntaxError("Gadget config must be a JSON object");
  }
  return parsed;
}

function usableLabel(value: unknown, pkg: string): string {
  if (value == null) return pkg;
  const label = String(value).trim();
  if (!label || label === "null" || label === "undefined") return pkg;
  return label;
}

function emptyChild(): ChildGating {
  return { enabled: false, mode: "freeze", injected_libraries: [] };
}

function normalizeTarget(raw: Partial<Target>): Target | null {
  if (!raw.app_name) return null;
  return {
    app_name: raw.app_name,
    enabled: raw.enabled !== false,
    kernel_assisted_evasion: Boolean(raw.kernel_assisted_evasion),
    start_up_delay_ms: Number(raw.start_up_delay_ms) || 0,
    injected_libraries: Array.isArray(raw.injected_libraries) ? raw.injected_libraries : defaultLibs(),
    child_gating: {
      enabled: Boolean(raw.child_gating?.enabled),
      mode: raw.child_gating?.mode === "kill" || raw.child_gating?.mode === "inject"
        ? raw.child_gating.mode
        : "freeze",
      injected_libraries: Array.isArray(raw.child_gating?.injected_libraries)
        ? raw.child_gating.injected_libraries
        : [],
    },
  };
}

function stripDemo(cfg: AppConfig): AppConfig {
  return {
    targets: (cfg.targets || []).filter((t) => t.app_name && t.app_name !== DEMO_PACKAGE),
  };
}

export function useFrida() {
  const available = hasKsu();
  const tab = ref<Tab>("targets");
  const config = reactive<AppConfig>({ targets: [] });
  const labels = reactive<Record<string, string>>({});
  const expanded = reactive<Record<string, boolean>>({});
  const appFilter = ref<AppFilter>("user");
  const apps = ref<string[]>([]);
  const packageCache = reactive<Record<AppFilter, string[]>>({
    user: [],
    system: [],
    all: [],
  });
  const fetchingApps = ref(false);
  const pickerOpen = ref(false);
  const pickerQuery = ref("");
  let pendingAppFetch: AppFilter | null = null;

  const gadgetInstalled = ref(false);
  const gadgetDetail = ref("Checking…");
  const gadgetJson = ref(prettyJson(DEFAULT_GADGET_CONFIG));
  const gadgetJsonStatus = ref<GadgetJsonStatus>("missing");
  const gadgetPath = ref("");
  const gadgetScan = ref<string[]>([]);
  const scanning = ref(false);
  const installing = ref(false);
  const clearLibsOnGadgetChange = ref(false);
  const busy = ref(false);

  const filteredApps = computed(() => {
    const q = pickerQuery.value.trim().toLowerCase();
    return apps.value.filter((pkg) => {
      const label = (labels[pkg] || "").toLowerCase();
      return !q || pkg.toLowerCase().includes(q) || label.includes(q);
    });
  });

  function labelOf(pkg: string): string {
    return labels[pkg] || pkg;
  }

  async function writeConfig(): Promise<boolean> {
    const json = prettyJson(config);
    const r = await exec(`echo ${shellQuote(json)} > ${CONFIG_PATH} && chmod 644 ${CONFIG_PATH}`);
    return r.errno === 0;
  }

  async function loadConfig(): Promise<void> {
    const r = await exec(`cat ${CONFIG_PATH}`);
    let stripped = false;
    if (r.errno === 0 && r.stdout.trim()) {
      try {
        const parsed = JSON.parse(r.stdout) as AppConfig;
        const before = Array.isArray(parsed.targets) ? parsed.targets.length : 0;
        const next = stripDemo({
          targets: (parsed.targets || []).map(normalizeTarget).filter((t): t is Target => t !== null),
        });
        stripped = before !== next.targets.length;
        config.targets = next.targets;
      } catch (e) {
        toast(`Config parse error: ${e instanceof Error ? e.message : String(e)}`);
        config.targets = [];
      }
    } else {
      config.targets = [];
    }
    if (stripped) await writeConfig();
  }

  async function saveConfig(): Promise<void> {
    if (await writeConfig()) toast("Config saved");
    else toast("Save failed");
  }

  async function loadGadgetConfig(): Promise<void> {
    const r = await exec(`cat ${GADGET_CONFIG_PATH}`);
    if (r.errno !== 0) {
      gadgetJsonStatus.value = "missing";
      gadgetJson.value = prettyJson(DEFAULT_GADGET_CONFIG);
      return;
    }
    try {
      gadgetJson.value = prettyJson(parseGadgetJson(r.stdout));
      gadgetJsonStatus.value = "ok";
    } catch (e) {
      gadgetJson.value = r.stdout;
      gadgetJsonStatus.value = "invalid";
      toast(`Gadget config parse error: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  async function saveGadgetConfig(): Promise<boolean> {
    let pretty: string;
    try {
      pretty = prettyJson(parseGadgetJson(gadgetJson.value));
    } catch (e) {
      gadgetJsonStatus.value = "invalid";
      toast(`Invalid JSON: ${e instanceof Error ? e.message : String(e)}`);
      return false;
    }
    gadgetJson.value = pretty;
    const r = await exec(`echo ${shellQuote(pretty)} > ${GADGET_CONFIG_PATH} && chmod 644 ${GADGET_CONFIG_PATH}`);
    if (r.errno === 0) {
      gadgetJsonStatus.value = "ok";
      toast("Gadget config saved");
      return true;
    }
    gadgetJsonStatus.value = "invalid";
    toast(`Failed: ${r.stderr}`);
    return false;
  }

  async function refreshGadgetBinary(): Promise<void> {
    const r = await exec(
      `if [ -f ${GADGET_BIN_PATH} ]; then stat -c '%s %y' ${GADGET_BIN_PATH} 2>/dev/null || ls -l ${GADGET_BIN_PATH}; else echo MISSING; fi`,
    );
    const text = (r.stdout || "").trim();
    gadgetInstalled.value = r.errno === 0 && text.length > 0 && !text.startsWith("MISSING");
    gadgetDetail.value = gadgetInstalled.value
      ? `${GADGET_BIN_PATH}  (${text})`
      : `No gadget at ${GADGET_BIN_PATH}`;
  }

  function clearAllInjectedLibraries(): void {
    for (const t of config.targets) {
      t.injected_libraries = [];
      if (t.child_gating) t.child_gating.injected_libraries = [];
    }
  }

  async function maybeClearLibraries(): Promise<void> {
    if (!clearLibsOnGadgetChange.value) return;
    clearAllInjectedLibraries();
    await saveConfig();
  }

  async function installGadget(): Promise<void> {
    const src = gadgetPath.value.trim();
    if (!src) {
      toast("Pick or enter a .so path first");
      return;
    }
    if (src.includes("\n") || src.includes(";")) {
      toast("Invalid path");
      return;
    }
    installing.value = true;
    const cmd =
      "set -e; " +
      `SRC=${shellQuote(src)}; ` +
      `DST=${shellQuote(GADGET_BIN_PATH)}; ` +
      `DIR=${shellQuote(GADGET_DIR)}; ` +
      'mkdir -p "$DIR"; ' +
      'if [ ! -f "$SRC" ]; then echo \'source not found\' >&2; exit 2; fi; ' +
      'case "$SRC" in ' +
      "  *.xz) " +
      "    UNXZ=''; " +
      "    for c in /data/adb/ksu/bin/busybox /data/adb/magisk/busybox /data/adb/ap/bin/busybox busybox unxz xz; do " +
      '      [ -x "$c" ] || command -v "$c" >/dev/null 2>&1 || continue; ' +
      '      UNXZ="$c"; break; ' +
      "    done; " +
      '    if [ -z "$UNXZ" ]; then echo \'no unxz/busybox found\' >&2; exit 3; fi; ' +
      '    if [ "$UNXZ" = xz ]; then xz -dc "$SRC" > "$DST"; ' +
      '    elif [ "$UNXZ" = unxz ]; then unxz -c "$SRC" > "$DST"; ' +
      '    else "$UNXZ" unxz -c "$SRC" > "$DST"; fi; ' +
      "    ;; " +
      '  *) cp -f "$SRC" "$DST" ;; ' +
      "esac; " +
      'chmod 644 "$DST"; ' +
      'HDR=$(od -An -N4 -tx1 "$DST" 2>/dev/null | tr -d \' \\n\'); ' +
      'if [ "$HDR" != "7f454c46" ]; then echo \'not an ELF .so\' >&2; rm -f "$DST"; exit 4; fi; ' +
      "echo OK";
    const r = await exec(cmd);
    installing.value = false;
    if (r.errno === 0 && (r.stdout || "").includes("OK")) {
      toast("Gadget installed");
      await maybeClearLibraries();
    } else {
      toast(`Install failed: ${(r.stderr || r.stdout || "unknown").trim()}`);
    }
    await refreshGadgetBinary();
  }

  async function removeGadget(): Promise<void> {
    const r = await exec(`rm -f ${GADGET_BIN_PATH}`);
    if (r.errno === 0) {
      toast("Gadget removed");
      await maybeClearLibraries();
    } else {
      toast(`Remove failed: ${r.stderr}`);
    }
    await refreshGadgetBinary();
  }

  async function scanGadgetCandidates(): Promise<void> {
    scanning.value = true;
    gadgetScan.value = [];
    const r = await exec(
      "find /sdcard/Download /sdcard/Downloads /storage/emulated/0/Download " +
        "/data/local/tmp /sdcard -maxdepth 3 -type f " +
        "\\( -name '*.so' -o -name '*.so.xz' \\) 2>/dev/null | head -n 80",
    );
    scanning.value = false;
    gadgetScan.value = (r.stdout || "")
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    if (gadgetScan.value.length === 0) toast("No .so files found under Download or /data/local/tmp");
  }

  function applyPackageInfos(infos: unknown[]): void {
    for (const item of infos) {
      const info = item as PackageInfo;
      if (!info || info.error || !info.packageName) continue;
      const label = usableLabel(info.appLabel || info.label, info.packageName);
      if (label !== info.packageName) labels[info.packageName] = label;
    }
  }

  function listPackagesViaKsu(type: AppFilter): string[] {
    let raw = ksuCall("listPackages", [type]);
    if (raw == null && type === "user") raw = ksuCall("listUserPackages");
    else if (raw == null && type === "system") raw = ksuCall("listSystemPackages");
    else if (raw == null && type === "all") raw = ksuCall("listAllPackages");
    const names = parseJsonArray(raw).filter((n): n is string => typeof n === "string" && n.length > 0);
    if (names.length === 0) return [];
    for (let i = 0; i < names.length; i += 80) {
      applyPackageInfos(parseJsonArray(ksuCall("getPackagesInfo", [JSON.stringify(names.slice(i, i + 80))])));
    }
    names.sort((a, b) => (labels[a] || a).localeCompare(labels[b] || b, undefined, { sensitivity: "base" }));
    return names;
  }

  async function listPackagesViaPm(type: AppFilter): Promise<string[]> {
    const flag = type === "system" ? "-s" : type === "all" ? "" : "-3";
    const cmd = flag ? `pm list packages ${flag}` : "pm list packages";
    const r = await exec(cmd);
    if (r.errno !== 0 || !r.stdout) return [];
    return r.stdout
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.startsWith("package:"))
      .map((line) => line.replace("package:", ""))
      .filter(Boolean);
  }

  async function fetchApps(type: AppFilter = appFilter.value): Promise<void> {
    if (fetchingApps.value) {
      pendingAppFetch = type;
      return;
    }
    fetchingApps.value = true;
    try {
      let requested: AppFilter | null = type;
      while (requested) {
        const current = requested;
        pendingAppFetch = null;
        let pkgs = listPackagesViaKsu(current);
        if (pkgs.length === 0) pkgs = await listPackagesViaPm(current);
        packageCache[current] = pkgs;
        if (appFilter.value === current) apps.value = pkgs;
        requested = pendingAppFetch;
      }
    } finally {
      fetchingApps.value = false;
    }
  }

  function setAppFilter(type: AppFilter): void {
    appFilter.value = type;
    if (packageCache[type]?.length) {
      apps.value = packageCache[type];
      return;
    }
    apps.value = [];
    void fetchApps(type);
  }

  function openPicker(): void {
    pickerOpen.value = true;
    pickerQuery.value = "";
    if (!apps.value.length && !fetchingApps.value) void fetchApps(appFilter.value);
  }

  function addTarget(pkg: string): void {
    if (config.targets.some((t) => t.app_name === pkg)) {
      toast("Already added");
      return;
    }
    config.targets.push({
      app_name: pkg,
      enabled: true,
      kernel_assisted_evasion: false,
      start_up_delay_ms: 0,
      injected_libraries: defaultLibs(),
      child_gating: emptyChild(),
    });
    pickerOpen.value = false;
  }

  function removeTarget(index: number): void {
    const pkg = config.targets[index]?.app_name;
    config.targets.splice(index, 1);
    if (pkg) delete expanded[pkg];
  }

  function toggleExpand(pkg: string): void {
    expanded[pkg] = !expanded[pkg];
  }

  async function saveAll(): Promise<void> {
    busy.value = true;
    await saveConfig();
    await saveGadgetConfig();
    busy.value = false;
  }

  async function reload(): Promise<void> {
    busy.value = true;
    packageCache.user = [];
    packageCache.system = [];
    packageCache.all = [];
    await Promise.all([loadConfig(), loadGadgetConfig(), refreshGadgetBinary(), fetchApps(appFilter.value)]);
    busy.value = false;
  }

  async function boot(): Promise<void> {
    if (!available) return;
    await Promise.all([loadConfig(), loadGadgetConfig(), refreshGadgetBinary(), fetchApps("user")]);
  }

  return {
    available,
    tab,
    config,
    labels,
    expanded,
    appFilter,
    apps,
    fetchingApps,
    pickerOpen,
    pickerQuery,
    filteredApps,
    gadgetInstalled,
    gadgetDetail,
    gadgetJson,
    gadgetJsonStatus,
    gadgetPath,
    gadgetScan,
    scanning,
    installing,
    clearLibsOnGadgetChange,
    busy,
    labelOf,
    saveAll,
    reload,
    boot,
    installGadget,
    removeGadget,
    scanGadgetCandidates,
    setAppFilter,
    openPicker,
    addTarget,
    removeTarget,
    toggleExpand,
    fetchApps,
  };
}
