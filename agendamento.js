const readDraft = () => {
  try { return JSON.parse(sessionStorage.getItem("elainne_booking_draft") || "{}"); }
  catch { return {}; }
};

const savedDraft = readDraft();
const type = savedDraft.type === "casal" ? "casal" : "individual";
const duration = type === "casal" ? 60 : Number(savedDraft.duration) || 30;
const state = {
  type,
  duration,
  unitPrice: window.ELAINNE_PRICING[type][duration],
  sessions: savedDraft.package ? 4 : 1,
  schedules: [],
  activeSession: 0,
  activeDayId: window.ELAINNE_AGENDA.dias[0]?.id
};

const money = (value) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const discount = () => ({ 1: 0, 2: .04, 3: .07, 4: .1 }[state.sessions] || 0);
const label = () => state.type === "casal" ? "Terapia de casal · 60 min" : `Terapia individual · ${state.duration} min`;
const total = () => state.unitPrice * state.sessions * (1 - discount());
const activeDay = () => window.ELAINNE_AGENDA.dias.find((dia) => dia.id === state.activeDayId);

function showStep(step) {
  document.querySelectorAll(".booking-step").forEach((el) => el.classList.toggle("active", Number(el.dataset.step) === step));
  document.querySelectorAll(".booking-progress span").forEach((el, index) => el.classList.toggle("active", index + 1 === step));
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function updatePackage() {
  document.querySelector("#session-count").textContent = state.sessions;
  document.querySelector("#session-plural").textContent = state.sessions > 1 ? "ões" : "";
  document.querySelector("#booking-service-name").textContent = label();
  document.querySelector("#booking-unit-price").textContent = money(state.unitPrice);
  document.querySelector("#package-total").textContent = money(total());
  document.querySelector("#package-detail").textContent = `${state.sessions} sess${state.sessions > 1 ? "ões" : "ão"}${discount() ? ` · ${Math.round(discount() * 100)}% de desconto` : " · sem desconto"}`;
}

function renderTabs() {
  document.querySelector("#session-tabs").innerHTML = Array.from({ length: state.sessions }, (_, index) => {
    const reserva = state.schedules[index];
    return `<button type="button" class="session-tab ${index === state.activeSession ? "active" : ""} ${reserva ? "selected" : ""}" data-session="${index}"><span>Sessão ${index + 1}</span>${reserva ? `<small>✓ ${reserva.resumo}</small>` : ""}</button>`;
  }).join("");
  document.querySelector("#agenda-help").textContent = state.sessions === 1
    ? "Selecione o melhor dia e horário para você."
    : "Agende cada sessão do seu pacote em ordem cronológica antes de continuar.";
}

function scheduleStatus() {
  const saved = state.schedules.filter(Boolean).length;
  document.querySelector("#schedule-status").textContent = saved === state.sessions
    ? "Todos os horários foram escolhidos."
    : `${saved} de ${state.sessions} horário${state.sessions > 1 ? "s" : ""} escolhido${saved === 1 ? "" : "s"}.`;
  document.querySelector('[data-step="2"] .booking-next').disabled = saved !== state.sessions;
}

function horarioEmData(dia, horario) {
  return new Date(`${dia.iso}T${String(Math.floor(horario / 60)).padStart(2, "0")}:${String(horario % 60).padStart(2, "0")}:00`).getTime();
}

function renderTimes() {
  const dia = activeDay();
  const reservas = state.schedules.filter((reserva, index) => reserva && index !== state.activeSession);
  const selected = state.schedules[state.activeSession];
  const anterior = state.schedules.slice(0, state.activeSession).filter(Boolean).at(-1);
  const proxima = state.schedules.slice(state.activeSession + 1).find(Boolean);
  const horarios = window.criarHorariosDisponiveis(dia, state.duration, reservas).filter((horario) => {
    const inicio = horarioEmData(dia, horario.inicio);
    const fim = horarioEmData(dia, horario.fim);
    return (!anterior || inicio >= anterior.timestampEnd) && (!proxima || fim <= proxima.timestampStart);
  });

  document.querySelector("#time-slots").innerHTML = horarios.length
    ? horarios.map((horario) => {
      const isSelected = selected?.dayId === dia.id && selected.start === horario.inicio;
      return `<button type="button" class="time-slot ${isSelected ? "active" : ""}" aria-pressed="${isSelected}" data-start="${horario.inicio}" data-end="${horario.fim}">${horario.texto}</button>`;
    }).join("")
    : '<p class="no-times">Não há horários compatíveis neste dia. Escolha uma data posterior para manter a ordem das sessões.</p>';
}

function renderAvailability() {
  document.querySelector("#calendar-days").innerHTML = window.ELAINNE_AGENDA.dias.map((dia) => `<button type="button" class="day-slot ${dia.id === state.activeDayId ? "active" : ""}" data-day-id="${dia.id}"><span>${dia.rotulo}</span><strong>${dia.data}</strong></button>`).join("");
  renderTimes();
}

document.querySelectorAll("[data-count]").forEach((button) => button.addEventListener("click", () => {
  state.sessions = Math.min(4, Math.max(1, state.sessions + (button.dataset.count === "plus" ? 1 : -1)));
  state.schedules = Array(state.sessions).fill(null);
  state.activeSession = 0;
  updatePackage();
  renderTabs();
  renderTimes();
  scheduleStatus();
}));

document.querySelectorAll(".booking-next").forEach((button) => button.addEventListener("click", () => {
  const step = Number(button.closest(".booking-step").dataset.step);
  if (step === 1) {
    renderTabs();
    renderTimes();
    showStep(2);
    return;
  }
  document.querySelector("#checkout-service").textContent = `${state.sessions} ${state.sessions > 1 ? "sessões" : "sessão"} · ${label()}`;
  document.querySelector("#checkout-total").textContent = money(total());
  document.querySelector("#checkout-schedules").textContent = state.schedules.map((slot, index) => `Sessão ${index + 1}: ${slot.texto}`).join(" · ");
  showStep(3);
}));

document.querySelectorAll(".booking-back").forEach((button) => button.addEventListener("click", () => showStep(Number(button.closest(".booking-step").dataset.step) - 1)));
document.querySelector("#session-tabs").addEventListener("click", (event) => {
  const tab = event.target.closest("[data-session]");
  if (!tab) return;
  state.activeSession = Number(tab.dataset.session);
  renderTabs();
  renderTimes();
});
document.querySelector("#calendar-days").addEventListener("click", (event) => {
  const button = event.target.closest(".day-slot");
  if (!button) return;
  state.activeDayId = button.dataset.dayId;
  renderAvailability();
});
document.querySelector("#time-slots").addEventListener("click", (event) => {
  const button = event.target.closest(".time-slot");
  if (!button) return;
  const day = activeDay();
  const start = Number(button.dataset.start);
  const end = Number(button.dataset.end);
  state.schedules[state.activeSession] = {
    dayId: day.id,
    start,
    end,
    timestampStart: horarioEmData(day, start),
    timestampEnd: horarioEmData(day, end),
    resumo: `${day.resumo} · ${button.textContent}`,
    texto: `${day.completo}, ${button.textContent}`
  };
  state.activeSession = Math.min(state.sessions - 1, state.activeSession + 1);
  renderTabs();
  renderTimes();
  scheduleStatus();
});

document.querySelector(".payment-button").addEventListener("click", async () => {
  const button = document.querySelector(".payment-button");
  const feedback = document.querySelector(".payment-feedback");
  const customer = {
    name: document.querySelector("#customer-name").value,
    email: document.querySelector("#customer-email").value,
    phone: document.querySelector("#customer-phone").value
  };
  feedback.textContent = "";
  button.disabled = true;
  button.textContent = "Preparando pagamento...";
  try {
    const response = await fetch("/api/checkout-pro", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: state.type, duration: state.duration, sessions: state.sessions, schedules: state.schedules, customer })
    });
    const result = await response.json();
    if (!response.ok || !result.checkoutUrl) throw new Error(result.error || "Não foi possível iniciar o pagamento.");
    window.location.assign(result.checkoutUrl);
  } catch (error) {
    feedback.textContent = error.message;
    button.disabled = false;
    button.innerHTML = '<i class="fa-brands fa-pix"></i> Ir para pagamento seguro';
  }
});

renderAvailability();
updatePackage();
renderTabs();
scheduleStatus();
