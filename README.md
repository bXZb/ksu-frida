# KsuFrida

Frida gadget injection module for KernelSU/Magisk via Zygisk.

- Gadget is not embedded into the APK — APK integrity/signature checks still pass
- No ptrace — avoids ptrace-based detection
- Library remapping hides injected libraries from /proc/self/maps
- Configurable injection delay, child gating, and multiple library injection
- WebUI for managing targets and installing a gadget from KernelSU Manager
- **No gadget is bundled.** You supply your own `.so` (official, rusda, ajeossida, Phantom-Frida, …)

## Prerequisites

- Rooted device with KernelSU or Magisk
- Zygisk enabled (on KernelSU this is typically [ZygiskNext](https://github.com/Dr-TSNG/ZygiskNext))
- A Frida **gadget** shared library matching the target ABI (`android-arm` / `android-arm64`). This is not `frida-server`.

## Quick Start

1. Download the latest release from the [Releases](https://github.com/bXZb/ksu-frida/releases) page
2. Install the ZIP via KernelSU/Magisk Manager
3. Reboot
4. Install a gadget (see below)
5. Add target apps

### Install a gadget

Push a gadget onto the device, then either use WebUI or copy it manually:

```shell
adb push frida-gadget-*-android-arm64.so /sdcard/Download/
```

**WebUI (KernelSU):** Modules → KsuFrida → WebUI → **Gadget Binary** → Scan device / paste path → Install.

**Manual:**

```shell
adb shell su -c 'cp /sdcard/Download/frida-gadget-android-arm64.so /data/local/tmp/libsec/libsecmon.so'
adb shell su -c 'chmod 644 /data/local/tmp/libsec/libsecmon.so'
```

`.so.xz` files are accepted in WebUI if `busybox`/`unxz` is present. Reinstalling the module does **not** unpack or overwrite `libsecmon.so`.

Use a **patched gadget** (rusda, ajeossida, Phantom-Frida, strongR/hluda, …) if the target scans for stock Frida strings, thread names, or `memfd` names. KsuFrida only loads and remaps whatever `.so` you install; it does not patch Frida itself.

### Option A: WebUI (KernelSU only)

Open KernelSU Manager → Modules → KsuFrida → WebUI.

- Add target apps, delay, child gating
- Install / remove the gadget `.so`
- Optionally clear `injected_libraries` on all targets when installing or removing the gadget
- Fresh installs start with an empty target list (no demo app)

### Option B: Manual config

```shell
adb shell su -c 'printf "%s\n" "{ \"targets\": [] }" > /data/local/tmp/libsec/config.json'
```

Then add a real package in WebUI, or edit `config.json` (see [advanced config](docs/advanced_config.md)).

### Connecting

The default gadget config uses **listen mode** on `127.0.0.1:27042` with `on_load: resume` (so the app is not blocked until a Frida client attaches). After opening the target app:

```shell
adb forward tcp:27042 tcp:27042
frida -H 127.0.0.1:27042 -n Gadget -l your_script.js
```

Stealth / patched gadgets often rename `Gadget`. Use `frida-ps -H 127.0.0.1:27042` or attach by PID if `-n Gadget` fails.

## Configuration

Config files are stored at `/data/local/tmp/libsec/` (mirrored under `/data/adb/modules/ksufrida/runtime/`):

| File | Purpose |
|------|---------|
| `config.json` | Target apps, delay, child gating settings (empty `targets` on first install) |
| `libsecmon.config.so` | Frida gadget config (listen/script mode) |
| `libsecmon.so` | Frida gadget binary (**you install this**) |

Example `config.json`:
```json
{
    "targets": [
        {
            "app_name": "com.example.app",
            "enabled": true,
            "kernel_assisted_evasion": false,
            "start_up_delay_ms": 0,
            "injected_libraries": [
                { "path": "/data/local/tmp/libsec/libsecmon.so" }
            ],
            "child_gating": {
                "enabled": false,
                "mode": "freeze",
                "injected_libraries": []
            }
        }
    ]
}
```

Leave `injected_libraries` empty to inject nothing for that target.

`kernel_assisted_evasion` remaps the Zygisk injector mapping after the gadget starts. It does not talk to a kernel driver.

## Building

Requires JDK 17+, Android NDK, and Node.js 20+ (WebUI is Vue 3, built into `webroot/` at assemble time).

```shell
./gradlew :module:assembleRelease
```

Output ZIP will be in the `out/` directory. The ZIP does not contain a Frida gadget.

To iterate on the WebUI alone:

```shell
cd webui
npm install
npm run dev
```

`npm run dev` has no `window.ksu` — open the built page from KernelSU Manager to talk to the device.

## Credits

- [lico-n](https://github.com/lico-n) — Original author of [ZygiskFrida](https://github.com/lico-n/ZygiskFrida)
- [electrondefuser](https://github.com/electrondefuser) — Library remapper, child gating, advanced config system
- [xDL](https://github.com/hexhacking/xDL)
- Inspired by [Zygisk-Il2CppDumper](https://github.com/Perfare/Zygisk-Il2CppDumper)
