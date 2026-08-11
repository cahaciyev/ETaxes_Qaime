import { initSidebar } from "./common/sidebar.js";
import { initTheme } from "./common/theme.js";

const XLSX_SRC = "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js";

const routes = {
  "/index.html": {
    pageTitle: "Ana səhifə",
    needsXlsx: false,
    load: () => import("./pages/homePage.js").then(m => m.initHomePage)
  },
  "/": {
    pageTitle: "Ana səhifə",
    needsXlsx: false,
    load: () => import("./pages/homePage.js").then(m => m.initHomePage)
  },
  "/qaime.html": {
    pageTitle: "Qaimə paket",
    needsXlsx: true,
    load: () => import("./pages/qaimePage.js").then(m => m.initQaimePage)
  },
  "/voen.html": {
    pageTitle: "VÖEN yoxla",
    needsXlsx: false,
    load: () => import("./pages/voenPage.js").then(m => m.initVoenPage)
  }
};

function normalizePath(pathname) {
  return routes[pathname] ? pathname : "/index.html";
}

function ensureXlsx() {
  if (window.XLSX) return Promise.resolve();
  if (window.__xlsxLoading) return window.__xlsxLoading;
  window.__xlsxLoading = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = XLSX_SRC;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("xlsx kitabxanası yüklənmədi"));
    document.head.appendChild(s);
  });
  return window.__xlsxLoading;
}

function setActiveNav(path) {
  document.querySelectorAll(".nav-link").forEach(a => {
    a.classList.toggle("active", a.getAttribute("href") === path);
  });
}

async function renderRoute(rawPath, push) {
  const path = normalizePath(rawPath);
  const route = routes[path];

  if (path !== window.location.pathname) {
    let html;
    try {
      const resp = await fetch(path);
      html = await resp.text();
    } catch (e) {
      window.location.href = path; // fall back to a real navigation
      return;
    }
    const doc = new DOMParser().parseFromString(html, "text/html");
    const newRoot = doc.getElementById("viewRoot");
    const curRoot = document.getElementById("viewRoot");
    if (newRoot && curRoot) curRoot.innerHTML = newRoot.innerHTML;
    if (doc.title) document.title = doc.title;
  }

  const pageTitleEl = document.getElementById("pageTitle");
  if (pageTitleEl) pageTitleEl.textContent = route.pageTitle;
  setActiveNav(path);

  if (push) history.pushState({ path }, "", path);

  if (route.needsXlsx) {
    try { await ensureXlsx(); } catch (e) { /* page module surfaces the error itself */ }
  }

  const init = await route.load();
  init();
}

function onDocumentClick(e) {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const a = e.target.closest("a");
  if (!a || a.target === "_blank") return;
  const href = a.getAttribute("href");
  if (!href || !href.startsWith("/") || !routes[href]) return;
  if (href === window.location.pathname) { e.preventDefault(); return; }
  e.preventDefault();
  renderRoute(href, true);
}

window.addEventListener("popstate", () => renderRoute(window.location.pathname, false));
document.addEventListener("click", onDocumentClick);

document.addEventListener("DOMContentLoaded", () => {
  initSidebar();
  initTheme();
  renderRoute(window.location.pathname, false);
});
