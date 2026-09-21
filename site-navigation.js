const header = document.querySelector(".header");
const toggle = document.querySelector(".menu-toggle");

toggle?.addEventListener("click", () => {
  const open = header.classList.toggle("menu-open");
  toggle.setAttribute("aria-expanded", String(open));
  toggle.setAttribute("aria-label", open ? "Fechar menu" : "Abrir menu");
});

document.querySelectorAll(".menu a").forEach((link) => link.addEventListener("click", () => {
  header?.classList.remove("menu-open");
  toggle?.setAttribute("aria-expanded", "false");
  toggle?.setAttribute("aria-label", "Abrir menu");
}));
