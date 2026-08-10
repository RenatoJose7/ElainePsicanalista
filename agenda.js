// Fonte de disponibilidade do MVP. Cada sessão ocupa blocos consecutivos de 15 minutos.
window.ELAINNE_AGENDA = {
  dias: [
    { id: "seg", rotulo: "SEG", data: "10", completo: "Segunda-feira, 10 ago", periodo: "semana" },
    { id: "ter", rotulo: "TER", data: "11", completo: "Terça-feira, 11 ago", periodo: "semana" },
    { id: "qua", rotulo: "QUA", data: "12", completo: "Quarta-feira, 12 ago", periodo: "semana" },
    { id: "qui", rotulo: "QUI", data: "13", completo: "Quinta-feira, 13 ago", periodo: "semana" },
    { id: "sex", rotulo: "SEX", data: "14", completo: "Sexta-feira, 14 ago", periodo: "semana" },
    { id: "sab", rotulo: "SÁB", data: "15", completo: "Sábado, 15 ago", periodo: "sabado" }
  ],
  janelas: { semana: { inicio: "19:00", fim: "22:00" }, sabado: { inicio: "08:00", fim: "12:00" } }
};

window.criarHorariosDisponiveis = (dia, duracao, reservas = []) => {
  const janela = window.ELAINNE_AGENDA.janelas[dia.periodo];
  const minutos = (horario) => { const [hora, minuto] = horario.split(":").map(Number); return hora * 60 + minuto; };
  const texto = (valor) => `${String(Math.floor(valor / 60)).padStart(2, "0")}:${String(valor % 60).padStart(2, "0")}`;
  const inicio = minutos(janela.inicio), fim = minutos(janela.fim), slots = [];
  for (let horario = inicio; horario + duracao <= fim; horario += 15) {
    const finalDaSessao = horario + duracao;
    if (!reservas.some((reserva) => reserva.dayId === dia.id && horario < reserva.end && finalDaSessao > reserva.start)) slots.push({ inicio: horario, fim: finalDaSessao, texto: texto(horario) });
  }
  return slots;
};
