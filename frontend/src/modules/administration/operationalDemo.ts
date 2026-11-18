export const statuses = ['Aberta', 'Aguardando distribuição', 'Em andamento', 'Pausada', 'Aguardando peças', 'Aguardando conferência', 'Finalizada', 'Liberada', 'Entregue', 'Cancelada'] as const;
export type Status = typeof statuses[number];
const fixtures: [string, string, string, string, string, string[], number, number, Status][] = [
  ['João Silva', 'Fiat Pulse 2025', 'ABC1D23', 'Pedro', 'Roberto', ['Carlos', 'Rafael', 'Marcos'], 3, 1250, 'Em andamento'],
  ['Maria Oliveira', 'Jeep Compass 2024', 'DEF2G45', 'Ana', 'Roberto', ['Rafael', 'João'], 4, 2890, 'Finalizada'],
  ['Lucas Pereira', 'Fiat Argo 2023', 'GHI3J67', 'Pedro', 'Marcos', ['João'], 2, 780, 'Finalizada'],
  ['Fernanda Costa', 'Jeep Renegade 2025', 'JKL4M89', 'Ana', 'Roberto', ['Carlos', 'Rafael'], 3, 1890, 'Aguardando conferência'],
  ['Ricardo Almeida', 'Fiat Toro 2024', 'MNO5P12', 'Bruno', 'Marcos', ['Carlos'], 2, 950, 'Em andamento'],
  ['Juliana Martins', 'Peugeot 208 2025', 'PQR6S34', 'Pedro', 'Roberto', ['João'], 1, 420, 'Liberada'],
  ['André Souza', 'Citroën C3 2024', 'STU7V56', 'Ana', 'Marcos', ['Carlos', 'João'], 3, 1450, 'Aguardando peças'],
  ['Patrícia Lima', 'Jeep Commander 2025', 'VWX8Y78', 'Bruno', 'Roberto', ['Rafael', 'Marcos'], 4, 3750, 'Entregue'],
  ['Eduardo Rocha', 'Fiat Strada 2023', 'YZA9B90', 'Pedro', 'Marcos', ['Carlos'], 2, 680, 'Aguardando distribuição'],
  ['Camila Ferreira', 'Ram Rampage 2025', 'BCD0E21', 'Ana', 'Roberto', ['João', 'Rafael'], 3, 2450, 'Finalizada'],
];
const serviceNames = ['Troca de óleo', 'Troca de pastilhas', 'Alinhamento', 'Diagnóstico eletrônico'];
export const finalStatus = (status: Status) => ['Finalizada', 'Liberada', 'Entregue'].includes(status);
export function demoOrders(now = new Date()) {
  return fixtures.map(([client, vehicle, plate, consultant, manager, mechanics, count, amount, status], index) => {
    const opened = new Date(now.getTime() - (index + 1) * 86_400_000);
    const due = new Date(opened.getTime() + 5 * 86_400_000);
    const finished = finalStatus(status) ? new Date(opened.getTime() + 4 * 3_600_000) : null;
    const distributed = status !== 'Aguardando distribuição';
    const allServicesDone = Boolean(finished) || status === 'Aguardando conferência';
    const services = Array.from({ length: count }, (_, i) => {
      const total = Math.floor(amount / count) + (i === 0 ? amount % count : 0);
      const minutes = [40, 60, 45, 30][i];
      const start = distributed && (allServicesDone || i === 0 || (index === 0 && i === 1)) ? new Date(opened.getTime() + (i + 1) * 900_000) : null;
      const end = start && (allServicesDone || (i === 0 && index !== 4)) ? new Date(start.getTime() + minutes * 60_000) : null;
      return { name: serviceNames[i], mechanic: distributed ? mechanics[i % mechanics.length] : 'A definir', minutes, start, end, labor: Math.floor(total * .6), parts: total - Math.floor(total * .6), total };
    });
    return { number: `2026-${1045 - index}`, opened, due, finished, client, vehicle, plate, consultant, manager, mechanics, count, amount, status, services, delayed: !finished && due < now };
  });
}
export type Order = ReturnType<typeof demoOrders>[number];
