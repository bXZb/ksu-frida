export const CONFIG_PATH = "/data/local/tmp/libsec/config.json";
export const GADGET_CONFIG_PATH = "/data/local/tmp/libsec/libsecmon.config.so";
export const GADGET_BIN_PATH = "/data/local/tmp/libsec/libsecmon.so";
export const GADGET_DIR = "/data/local/tmp/libsec";
export const MODULE_RUNTIME_DIR = "/data/adb/modules/ksufrida/runtime";
export const DEMO_PACKAGE = "com.example.package";

export const DEFAULT_GADGET_CONFIG = {
  interaction: {
    type: "listen",
    address: "127.0.0.1",
    port: 27042,
    on_load: "resume",
  },
} as const;

export const GADGET_PRESETS = {
  listenLocal: {
    interaction: {
      type: "listen",
      address: "127.0.0.1",
      port: 27042,
      on_load: "resume",
    },
  },
  listenAll: {
    interaction: {
      type: "listen",
      address: "0.0.0.0",
      port: 27042,
      on_load: "resume",
    },
  },
  script: {
    interaction: {
      type: "script",
      path: "/data/local/tmp/libsec/on.js",
      on_change: "reload",
    },
  },
} as const;

export function defaultLibs(): { path: string }[] {
  return [{ path: GADGET_BIN_PATH }];
}
