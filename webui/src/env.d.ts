/// <reference types="vite/client" />

declare module "*.vue" {
  import type { DefineComponent } from "vue";
  const component: DefineComponent<object, object, unknown>;
  export default component;
}

interface KsuBridge {
  exec(cmd: string, options: string, callback: string): void;
  toast(msg: string): void;
  listPackages?(type: string): string;
  listUserPackages?(): string;
  listSystemPackages?(): string;
  listAllPackages?(): string;
  getPackagesInfo?(packagesJson: string): string;
}

interface Window {
  ksu?: KsuBridge;
  [key: string]: unknown;
}
