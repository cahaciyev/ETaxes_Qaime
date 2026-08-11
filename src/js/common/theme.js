const THEME_KEY = "qaimeTheme";

export function initTheme() {
  const root = document.documentElement;
  let saved = null;
  try { saved = localStorage.getItem(THEME_KEY); } catch (e) { /* ignore */ }
  if (saved === "dark" || saved === "light") root.setAttribute("data-theme", saved);

  const toggle = document.getElementById("themeToggle");
  if (!toggle) return;
  syncToggle(toggle, currentTheme());

  toggle.addEventListener("click", () => {
    const next = currentTheme() === "dark" ? "light" : "dark";
    root.setAttribute("data-theme", next);
    try { localStorage.setItem(THEME_KEY, next); } catch (e) { /* ignore */ }
    syncToggle(toggle, next);
  });
}

function currentTheme() {
  const attr = document.documentElement.getAttribute("data-theme");
  if (attr) return attr;
  return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function syncToggle(toggle, theme) {
  toggle.setAttribute("aria-pressed", theme === "dark" ? "true" : "false");
  toggle.title = theme === "dark" ? "İşıqlı görünüşə keç" : "Tünd görünüşə keç";
}
