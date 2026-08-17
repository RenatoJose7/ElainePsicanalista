// Fonte de disponibilidade do MVP. Cada sessao ocupa blocos consecutivos de 15 minutos.
const nomesCurtos = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SAB"];
const nomesCompletos = ["Domingo", "Segunda-feira", "Terca-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sabado"];
const meses = ["janeiro", "fevereiro", "marco", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const doisDigitos = (valor) => String(valor).padStart(2, "0");
const paraIso = (data) => `${data.getFullYear()}-${doisDigitos(data.getMonth() + 1)}-${doisDigitos(data.getDate())}`;

function proximosDiasDisponiveis() {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const dias = [];

  for (let deslocamento = 0; dias.length < 6 && deslocamento < 21; deslocamento += 1) {
    const data = new Date(hoje);
    data.setDate(hoje.getDate() + deslocamento);
    const diaDaSemana = data.getDay();
    if (diaDaSemana === 0) continue;

    const sabado = diaDaSemana === 6;
    const inicio = sabado ? "08:00" : "19:00";
    const fim = sabado ? "12:00" : "22:00";
    const agora = new Date();
    const fimDoDia = new Date(`${paraIso(data)}T${fim}:00`);
    if (data.getTime() === hoje.getTime() && agora >= fimDoDia) continue;

    dias.push({
      id: paraIso(data),
      iso: paraIso(data),
      rotulo: nomesCurtos[diaDaSemana],
      data: String(data.getDate()),
      completo: `${nomesCompletos[diaDaSemana]}, ${data.getDate()} de ${meses[data.getMonth()]}`,
      resumo: `${nomesCurtos[diaDaSemana]} ${data.getDate()}`,
      inicio,
      fim
    });
  }

  return dias;
}

window.ELAINNE_AGENDA = { dias: proximosDiasDisponiveis() };

window.criarHorariosDisponiveis = (dia, duracao, reservas = [], occupiedSlots = new Set()) => {
  const minutos = (horario) => {
    const [hora, minuto] = horario.split(":").map(Number);
    return hora * 60 + minuto;
  };
  const texto = (valor) => `${doisDigitos(Math.floor(valor / 60))}:${doisDigitos(valor % 60)}`;
  const inicio = minutos(dia.inicio);
  const fim = minutos(dia.fim);
  const agora = new Date();
  const slots = [];

  for (let horario = inicio; horario + duracao <= fim; horario += 15) {
    const finalDaSessao = horario + duracao;
    const horarioDoSlot = new Date(`${dia.iso}T${texto(horario)}:00`);
    const conflita = reservas.some((reserva) => reserva.dayId === dia.id && horario < reserva.end && finalDaSessao > reserva.start);
    const ocupadoNoBanco = Array.from({ length: duracao / 15 }, (_, index) => `${dia.id}T${texto(horario + index * 15)}`).some((key) => occupiedSlots.has(key));
    if (horarioDoSlot > agora && !conflita && !ocupadoNoBanco) slots.push({ inicio: horario, fim: finalDaSessao, texto: texto(horario) });
  }

  return slots;
};
