import { usePreferredDark } from "@vueuse/core";
import { watchEffect } from "vue";

function applyTheme(dark: boolean): void {
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.style.colorScheme = dark ? "dark" : "light";
}

/** Keep `.dark` in sync with the WebView / system color scheme. */
export function useSystemTheme() {
  const isDark = usePreferredDark();

  watchEffect(() => {
    applyTheme(isDark.value);
  });

  return { isDark };
}
