const header = document.querySelector(".header");
const menuToggle = document.querySelector(".menu-toggle");
const menuLinks = document.querySelectorAll(".menu a");
const fadeElements = document.querySelectorAll(".fade");
const faqCards = document.querySelectorAll(".faq-card");

const setHeaderState = () => header.classList.toggle("scrolled", window.scrollY > 18);
setHeaderState();
window.addEventListener("scroll", setHeaderState, { passive: true });

menuToggle?.addEventListener("click", () => {
  const isOpen = header.classList.toggle("menu-open");
  menuToggle.setAttribute("aria-expanded", String(isOpen));
});

menuLinks.forEach((link) => link.addEventListener("click", () => {
  header.classList.remove("menu-open");
  menuToggle?.setAttribute("aria-expanded", "false");
}));

document.querySelectorAll('a[href^="#"]').forEach((anchor) => anchor.addEventListener("click", (event) => {
  const target = document.querySelector(anchor.getAttribute("href"));
  if (!target) return;
  event.preventDefault();
  target.scrollIntoView({ behavior: "smooth", block: "start" });
}));

faqCards.forEach((card) => {
  const button = card.querySelector(".faq-question");
  button?.addEventListener("click", () => {
    const isActive = card.classList.toggle("active");
    button.setAttribute("aria-expanded", String(isActive));
  });
});

if ("IntersectionObserver" in window) {
  const observer = new IntersectionObserver((entries) => entries.forEach((entry) => {
    if (entry.isIntersecting) { entry.target.classList.add("visible"); observer.unobserve(entry.target); }
  }), { threshold: 0.16 });
  fadeElements.forEach((element) => observer.observe(element));
} else {
  fadeElements.forEach((element) => element.classList.add("visible"));
}

// Mantém o valor e o destino do agendamento sincronizados com a duração selecionada.
const prices = window.ELAINNE_PRICING;
document.querySelectorAll(".plan-choice").forEach((card) => {
  const type = card.classList.contains("featured") ? "casal" : "individual";
  card.querySelectorAll(".duration").forEach((button) => {
    button.dataset.price = prices[type][button.dataset.duration];
  });
  const activeDuration = card.querySelector(".duration.active");
  const price = activeDuration ? prices[type][activeDuration.dataset.duration] : prices[type][60];
  card.querySelector(".price-value").textContent = price.toFixed(2).replace(".", ",");
});

document.querySelectorAll(".duration").forEach((button) => button.addEventListener("click", () => {
  const card = button.closest(".plan-choice");
  card.querySelectorAll(".duration").forEach((item) => item.classList.toggle("active", item === button));
  card.querySelector(".price-value").textContent = Number(button.dataset.price).toFixed(2).replace(".", ",");
}));

// O rascunho mantém a URL limpa. Não é usado para validar preço ou pagamento.
document.querySelectorAll(".booking-link").forEach((link) => link.addEventListener("click", () => {
  const card = link.closest(".plan-choice");
  const type = link.dataset.bookingType;
  const duration = type === "casal" ? 60 : Number(card.querySelector(".duration.active").dataset.duration);
  const draft = { type, duration, package: link.dataset.bookingPackage === "true" };
  sessionStorage.setItem("elainne_booking_draft", JSON.stringify(draft));
}));
