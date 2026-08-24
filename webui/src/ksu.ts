import type { ExecResult } from "./types";

let callbackId = 0;

export function hasKsu(): boolean {
  return typeof window.ksu !== "undefined";
}

export function toast(message: string): void {
  window.ksu?.toast?.(message);
}

export function ksuCall(name: string, args: unknown[] = []): unknown {
  const bridge = window.ksu as unknown as Record<string, unknown> | undefined;
  const fn = bridge?.[name];
  if (typeof fn !== "function") return null;
  try {
    return (fn as (...a: unknown[]) => unknown).apply(bridge, args);
  } catch {
    return null;
  }
}

export function exec(cmd: string): Promise<ExecResult> {
  return new Promise((resolve) => {
    if (!window.ksu?.exec) {
      resolve({ errno: 1, stdout: "", stderr: "ksu.exec unavailable" });
      return;
    }
    const name = `_ksu_cb_${++callbackId}`;
    window[name] = (errno: number, stdout: string, stderr: string) => {
      delete window[name];
      resolve({ errno, stdout: stdout ?? "", stderr: stderr ?? "" });
    };
    window.ksu.exec(cmd, "{}", name);
  });
}

export function shellQuote(value: string): string {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

export function parseJsonArray(raw: unknown): unknown[] {
  if (raw == null || raw === "") return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw !== "string") return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
