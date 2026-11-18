type TimedService = {
  startedAt?: string | null;
  completedAt?: string | null;
  pausedAt?: string | null;
  pausedSeconds?: number;
};

function timestamp(value: string): number {
  return new Date(/(?:Z|[+-]\d{2}:\d{2})$/.test(value) ? value : value + 'Z').getTime();
}

export function effectiveSeconds(service: TimedService, now = Date.now()): number {
  if (!service.startedAt) return 0;
  const start = timestamp(service.startedAt);
  const end = service.completedAt ? timestamp(service.completedAt) :
    service.pausedAt ? timestamp(service.pausedAt) : now;
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0;
  return Math.max(0, Math.floor((end - start) / 1000) - (service.pausedSeconds ?? 0));
}

export function formatExecutionTime(seconds: number): string {
  const value = Math.max(0, Math.floor(seconds));
  return [Math.floor(value / 3600), Math.floor(value % 3600 / 60), value % 60]
    .map(part => String(part).padStart(2, '0')).join(':');
}

export function formatExecutionDateTime(value?: string | null): string {
  if (!value) return '—';
  const time = timestamp(value);
  if (!Number.isFinite(time)) return '—';
  return new Date(time).toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}
