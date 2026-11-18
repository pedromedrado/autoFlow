export const statuses = ['Aberta', 'Aguardando distribuição', 'Atribuída', 'Em andamento', 'Pausada', 'Aguardando peças', 'Aguardando conferência', 'Pronta', 'Finalizada', 'Liberada', 'Entregue', 'Cancelada'] as const;
export type Status = typeof statuses[number];
export const finalStatus = (status: Status) => ['Pronta', 'Finalizada', 'Liberada', 'Entregue'].includes(status);

export type RegisteredOrder = {
  id: string;
  storeId: string;
  customer: string;
  vehicle: string;
  plate: string;
  consultant: string;
  status?: Status;
  managerName?: string | null;
  openedAt: string;
  items: { id: string; name: string; minutes: number; price: number; mechanicId?: string | null; mechanicName?: string | null; startedAt?: string | null; completedAt?: string | null; pausedAt?: string | null; pausedSeconds?: number; status?: string; approvedAt?: string | null; report?: string | null; executionVersion?: number }[];
};

const parseDate = (value: string) => new Date(/(?:Z|[+-]\d{2}:\d{2})$/.test(value) ? value : value + 'Z');

export function toOperationalOrder(record: RegisteredOrder) {
  const opened = new Date(/(?:Z|[+-]\d{2}:\d{2})$/.test(record.openedAt) ? record.openedAt : record.openedAt + 'Z');
  return {
    id: record.id,
    storeId: record.storeId,
    number: record.id.slice(0, 8).toUpperCase(),
    opened,
    due: null as Date | null,
    finished: record.items.length && record.items.every(item => item.completedAt)
      ? new Date(Math.max(...record.items.map(item => +parseDate(item.completedAt!)))) : null,
    client: record.customer,
    vehicle: record.vehicle,
    plate: record.plate,
    consultant: record.consultant,
    manager: record.managerName ?? '',
    mechanics: [...new Set(record.items.map(item => item.mechanicName).filter((name): name is string => Boolean(name)))],
    count: record.items.length,
    amount: record.items.reduce((sum, item) => sum + item.price, 0),
    status: record.status ?? 'Aguardando distribuição' as Status,
    delayed: false,
    services: record.items.map(item => ({
      id: item.id,
      name: item.name,
      mechanic: item.mechanicName ?? '',
      minutes: item.minutes,
      start: item.startedAt ? parseDate(item.startedAt) : null,
      end: item.completedAt ? parseDate(item.completedAt) : null,
      total: item.price,
      status: item.status ?? (item.completedAt ? 'Concluído' : item.startedAt ? 'Em execução' : 'Aguardando início'),
      approvedAt: item.approvedAt ? parseDate(item.approvedAt) : null,
    })),
  };
}
export type Order = ReturnType<typeof toOperationalOrder>;
