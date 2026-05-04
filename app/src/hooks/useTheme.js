import { useState, useCallback } from "react";

export function useTheme() {
  const [isDark, setIsDark] = useState(
    () => document.documentElement.getAttribute("data-theme") !== "light",
  );

  const toggle = useCallback(() => {
    const nextDark = !isDark;
    if (nextDark) {
      document.documentElement.removeAttribute("data-theme");
    } else {
      document.documentElement.setAttribute("data-theme", "light");
    }
    localStorage.setItem("theme", nextDark ? "dark" : "light");
    setIsDark(nextDark);
  }, [isDark]);

  return { isDark, toggle };
}
