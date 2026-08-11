import { initSidebar } from "./common/sidebar.js";
import { initTheme } from "./common/theme.js";
import { initHomePage } from "./pages/homePage.js";

document.addEventListener("DOMContentLoaded", () => {
  initSidebar();
  initTheme();
  initHomePage();
});
