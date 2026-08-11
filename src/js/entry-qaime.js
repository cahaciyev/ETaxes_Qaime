import { initSidebar } from "./common/sidebar.js";
import { initTheme } from "./common/theme.js";
import { initQaimePage } from "./pages/qaimePage.js";

document.addEventListener("DOMContentLoaded", () => {
  initSidebar();
  initTheme();
  initQaimePage();
});
