export function initSidebar() {
  const sidebar = document.getElementById("sidebar");
  const menuBtn = document.getElementById("menuToggle");
  const backdrop = document.getElementById("sidebarBackdrop");
  if (!sidebar || !menuBtn || !backdrop) return;

  function open() {
    sidebar.classList.add("open");
    backdrop.classList.add("show");
    menuBtn.setAttribute("aria-expanded", "true");
  }
  function close() {
    sidebar.classList.remove("open");
    backdrop.classList.remove("show");
    menuBtn.setAttribute("aria-expanded", "false");
  }

  menuBtn.addEventListener("click", () => {
    sidebar.classList.contains("open") ? close() : open();
  });
  backdrop.addEventListener("click", close);
  sidebar.querySelectorAll("a.nav-link").forEach(a => a.addEventListener("click", close));
  window.addEventListener("keydown", e => { if (e.key === "Escape") close(); });
}
