export { exec, getPackagesInfo, listPackages, toast } from "kernelsu";

export function shellQuote(value: string): string {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}
