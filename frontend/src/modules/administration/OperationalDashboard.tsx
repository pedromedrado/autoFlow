import { RefreshCw as Refresh, Download, Eye, EllipsisVertical as More, ChevronDown, ClipboardList, Timer, CircleCheck, TriangleAlert, Wallet, BadgeCheck } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Accordion, AccordionDetails, AccordionSummary, Alert, Box, Button, Chip, Drawer, Grid2 as Grid, LinearProgress, Menu, MenuItem, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TablePagination, TableRow, TextField, Tooltip, Typography } from '@mui/material';
import { api } from '../../services/api';
import { toOperationalOrder, finalStatus, statuses, type Order, type RegisteredOrder } from './operationalData';

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const date = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
const day = (value: Date) => value.toLocaleDateString('sv-SE');
const blank = { number: '', client: '', plate: '', vehicle: '', consultant: '', manager: '', mechanic: '', status: '', min: '', max: '' };
const fields = { number: 'Número da OS', client: 'Cliente', plate: 'Placa', vehicle: 'Veículo', consultant: 'Consultor', manager: 'Chefe de oficina', mechanic: 'Mecânico' } as const;
const metricIcons = [ClipboardList, Timer, CircleCheck, TriangleAlert, Wallet, BadgeCheck].map(Icon => <Icon size={18} strokeWidth={1.75} />);
const columns = ['OS', 'Abertura', 'Cliente', 'Veículo', 'Placa', 'Consultor', 'Chefe de oficina', 'Mecânicos', 'Serviços', 'Valor total', 'Situação', 'Ações'];
const complete = (order: Order) => finalStatus(order.status);
const valueLabel = (order: Order) => complete(order) ? 'Valor final' : 'Valor previsto';
const label = (value: Date | null) => value ? date.format(value) : '—';

function Status({ order }: { order: Order }) {
  return <Stack direction="row" gap={.5} flexWrap="wrap">
    <Chip size="small" label={order.status} color={complete(order) ? 'success' : order.status === 'Em andamento' ? 'warning' : 'default'} />
    {order.delayed && <Chip size="small" label="Atrasada" color="error" />}
  </Stack>;
}

function exportCsv(rows: Order[]) {
  const encode = (value: string | number) => '"' + String(value).replaceAll('"', '""') + '"';
  const content = [columns.slice(0, -1), ...rows.map(o => [o.number, label(o.opened), o.client, o.vehicle, o.plate, o.consultant, o.manager || 'Não informado', o.mechanics.join(', '), o.count, money.format(o.amount) + ' (' + valueLabel(o) + ')', o.status + (o.delayed ? ' / Atrasada' : '')])].map(row => row.map(encode).join(';')).join('\r\n');
  const url = URL.createObjectURL(new Blob(['\uFEFF', content], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'autoflow-ordens-servico.csv';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function OperationalDashboard() {
  const history = useLocation().pathname.endsWith('/ordens');
  const [now, setNow] = useState(() => new Date());
  const [period, setPeriod] = useState('30');
  const [range, setRange] = useState({ from: '', to: '' });
  const [draft, setDraft] = useState(blank);
  const [filters, setFilters] = useState(blank);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('recent');
  const [page, setPage] = useState(0);
  const [group, setGroup] = useState('day');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [storeId, setStoreId] = useState('');
  const [menu, setMenu] = useState<{ anchor: HTMLElement; order: Order } | null>(null);
  const unit = useQuery({ queryKey: ['dealership'], queryFn: async () => (await api.get<{ name: string }>('/dealership')).data });
  const orderQuery = useQuery({
    queryKey: ['operations', 'orders'],
    queryFn: async () => (await api.get<RegisteredOrder[]>('/operations/orders')).data,
    refetchInterval: 30_000,
  });
  const stores = useQuery({
    queryKey: ['operations', 'stores'],
    queryFn: async () => (await api.get<{ id: string; name: string }[]>('/operations/stores')).data,
  });
  const orders = useMemo(() => (orderQuery.data ?? []).map(toOperationalOrder), [orderQuery.data]);
  const selected = orders.find(order => order.id === selectedId) ?? null;
  const start = new Date(now);
  if (period === 'month') start.setDate(1);
  else if (period !== 'custom') start.setDate(start.getDate() - (Number(period) - 1));
  const from = period === 'custom' ? range.from : day(start);
  const to = period === 'custom' ? range.to : day(now);
  const invalidRange = Boolean(from && to && from > to);
  const normalize = (value: string) => value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
  const rows = orders.filter(o => {
    const opened = day(o.opened);
    const matchesFields = Object.keys(fields).every(key => {
      const field = key as keyof typeof fields;
      const value = field === 'mechanic' ? o.mechanics.join(' ') : o[field];
      return normalize(value).includes(normalize(filters[field]));
    });
    return (!storeId || o.storeId === storeId) && !invalidRange && (!from || opened >= from) && (!to || opened <= to) && matchesFields &&
      (!filters.status || o.status === filters.status) && (!filters.min || o.amount >= Number(filters.min)) &&
      (!filters.max || o.amount <= Number(filters.max)) &&
      (!history || normalize([o.number, o.client, o.vehicle, o.plate, o.consultant, o.manager, ...o.mechanics].join(' ')).includes(normalize(search)));
  }).sort((a, b) => history && sort === 'old' ? +a.opened - +b.opened : history && sort === 'value' ? b.amount - a.amount : +b.opened - +a.opened);
  const final = rows.filter(complete);
  const sum = (list: Order[]) => list.reduce((total, order) => total + order.amount, 0);
  const pageIndex = Math.min(page, Math.max(0, Math.ceil(rows.length / 10) - 1));
  const visible = rows.slice(history ? pageIndex * 10 : 0, history ? (pageIndex + 1) * 10 : 10);
  const delayed = rows.filter(o => o.delayed).length;
  const buckets = new Map<string, { opened: number; closed: number }>();
  function add(value: Date, field: 'opened' | 'closed') {
    const keyDate = new Date(value);
    if (group === 'week') keyDate.setDate(keyDate.getDate() - (keyDate.getDay() + 6) % 7);
    const key = group === 'month' ? day(keyDate).slice(0, 7) : day(keyDate);
    const bucket = buckets.get(key) ?? { opened: 0, closed: 0 };
    bucket[field]++;
    buckets.set(key, bucket);
  }
  rows.forEach(order => { add(order.opened, 'opened'); if (order.finished && (!from || day(order.finished) >= from) && (!to || day(order.finished) <= to)) add(order.finished, 'closed'); });
  const points = [...buckets.entries()].sort(([a], [b]) => a.localeCompare(b));
  const ceiling = Math.max(1, ...points.flatMap(([, point]) => [point.opened, point.closed]));
  const x = (i: number) => points.length === 1 ? 180 : 12 + i * 336 / Math.max(1, points.length - 1);
  const y = (value: number) => 101 - value * 86 / ceiling;
  function refresh() { setNow(new Date()); void unit.refetch(); void orderQuery.refetch(); void stores.refetch(); }
  function actions(order: Order) {
    return <Stack direction="row" gap={.5} alignItems="center">
      <Button size="small" startIcon={<Eye size={16} />} onClick={() => setSelectedId(order.id)} sx={{ whiteSpace: 'nowrap' }}>Ver detalhes</Button>
      <Button size="small" aria-label={`Ações da OS ${order.number}`} sx={{ minWidth: 30 }} onClick={e => setMenu({ anchor: e.currentTarget, order })}><More size={18} /></Button>
    </Stack>;
  }

  return <Stack spacing={2.5} sx={{ bgcolor: '#F9FAFB', color: '#1E293B', '& .MuiPaper-root': { borderColor: '#E5E7EB' } }}>
    <Typography variant="caption" color="primary" fontWeight={700}>ADMINISTRAÇÃO › OPERAÇÃO {history && '› HISTÓRICO'}</Typography>
    <Stack direction={{ xs: 'column', lg: 'row' }} alignItems={{ lg: 'center' }} justifyContent="space-between" gap={2}>
      <Box>
        <Typography component="h1" variant="h5" fontWeight={700}>{history ? 'Ordens de Serviço' : 'Dashboard Operacional'}</Typography>
        <Typography color="text.secondary" variant="body2">Acompanhe as Ordens de Serviço, equipes e resultados da concessionária.</Typography>
      </Box>
      <Stack direction="row" flexWrap="wrap" gap={1}>
        <TextField select size="small" label="Concessionária / loja" value={storeId} onChange={e => { setStoreId(e.target.value); setPage(0); }} sx={{ minWidth: 180 }}>
          <MenuItem value="">{unit.data?.name ?? 'Todas as lojas'}</MenuItem>
          {(stores.data ?? []).map(store => <MenuItem key={store.id} value={store.id}>{store.name}</MenuItem>)}
        </TextField>
        <TextField select size="small" label="Período" value={period} onChange={e => { setPeriod(e.target.value); setPage(0); }} sx={{ minWidth: 150 }}>
          <MenuItem value="1">Hoje</MenuItem><MenuItem value="7">Últimos 7 dias</MenuItem><MenuItem value="30">Últimos 30 dias</MenuItem><MenuItem value="month">Este mês</MenuItem><MenuItem value="custom">Personalizado</MenuItem>
        </TextField>
        <Button variant="outlined" startIcon={<Refresh size={18} />} onClick={refresh}>Atualizar</Button>
        <Button variant="contained" startIcon={<Download size={18} />} onClick={() => exportCsv(rows)} disabled={!rows.length}>Exportar relatório</Button>
      </Stack>
    </Stack>
    {orderQuery.isPending && <Alert severity="info">Carregando ordens de serviço…</Alert>}
    {orderQuery.isError && <Alert severity="error" action={<Button color="inherit" onClick={refresh}>Tentar novamente</Button>}>Não foi possível atualizar as ordens de serviço.</Alert>}
    {period === 'custom' && <Stack direction={{ xs: 'column', sm: 'row' }} gap={1.5}>
      <TextField type="date" size="small" label="De" value={range.from} onChange={e => { setRange({ ...range, from: e.target.value }); setPage(0); }} slotProps={{ inputLabel: { shrink: true } }} />
      <TextField type="date" size="small" label="Até" error={invalidRange} helperText={invalidRange ? 'A data final deve ser igual ou posterior à inicial.' : undefined} value={range.to} onChange={e => { setRange({ ...range, to: e.target.value }); setPage(0); }} slotProps={{ inputLabel: { shrink: true } }} />
    </Stack>}
    <Accordion disableGutters>
      <AccordionSummary expandIcon={<ChevronDown size={18} />}>Filtros avançados</AccordionSummary>
      <AccordionDetails>
        <Box component="form" onSubmit={e => { e.preventDefault(); setFilters(draft); setPage(0); }}>
          <Grid container spacing={1.5}>
            {Object.entries(fields).map(([key, name]) => <Grid key={key} size={{ xs: 12, sm: 6, md: 3 }}>
              <TextField fullWidth size="small" label={name} value={draft[key as keyof typeof fields]} onChange={e => setDraft({ ...draft, [key]: e.target.value })} />
            </Grid>)}
            <Grid size={{ xs: 12, sm: 6, md: 3 }}><TextField fullWidth select size="small" label="Situação" value={draft.status} onChange={e => setDraft({ ...draft, status: e.target.value })}><MenuItem value="">Todas</MenuItem>{statuses.map(status => <MenuItem key={status} value={status}>{status}</MenuItem>)}</TextField></Grid>
            {(['min', 'max'] as const).map(key => <Grid key={key} size={{ xs: 6, md: 3 }}><TextField fullWidth size="small" type="number" label={key === 'min' ? 'Valor mínimo' : 'Valor máximo'} value={draft[key]} onChange={e => setDraft({ ...draft, [key]: e.target.value })} slotProps={{ htmlInput: { min: 0, step: '.01' } }} /></Grid>)}
          </Grid>
          <Stack direction="row" gap={1} mt={2}><Button variant="contained" type="submit">Aplicar filtros</Button><Button onClick={() => { setDraft(blank); setFilters(blank); setSearch(''); setStoreId(''); setPeriod('30'); setRange({ from: '', to: '' }); setPage(0); }}>Limpar filtros</Button></Stack>
        </Box>
      </AccordionDetails>
    </Accordion>

    {!history && <>
      <Grid container spacing={1.5}>
        {([
          ['Total de OS', orderQuery.data ? rows.length : '—', 'Abertas no período', '#2563EB'],
          ['Em andamento', rows.filter(o => o.status === 'Em andamento').length, 'Serviços em execução', '#B45309'],
          ['Finalizadas', final.length, 'Inclui liberadas e entregues', '#047857'],
          ['Atrasadas', delayed, 'Acima da previsão', '#B91C1C'],
          ['Valor total das OS', money.format(sum(rows)), 'Previsto e final', '#1E293B'],
          ['Valor das finalizadas', money.format(sum(final)), 'Valor final', '#047857'],
        ] as const).map(([title, count, caption, color], index) => <Grid key={title} size={{ xs: 6, sm: 4, xl: 2 }}>
          <Paper sx={{ p: 1.75, height: '100%' }}><Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}><Typography variant="caption" fontWeight={700} color="text.secondary">{title}</Typography><Box sx={{ color, display: 'flex' }}>{metricIcons[index]}</Box></Stack><Typography variant="h6" fontWeight={700} color={color}>{count}</Typography><Typography variant="caption" color="text.secondary">{caption}</Typography></Paper>
        </Grid>)}
      </Grid>
      <Grid container spacing={1.5}>
        <Grid size={{ xs: 12, md: 5 }}><Paper sx={{ p: 2, height: '100%' }}>
          <Typography fontWeight={700} mb={1}>Situação das OS</Typography>
          {statuses.map(status => {
            const count = rows.filter(o => o.status === status).length;
            return <Stack key={status} direction="row" alignItems="center" gap={1} sx={{ py: .3 }}><Typography variant="caption" sx={{ width: 155 }}>{status}</Typography><LinearProgress aria-label={status} variant="determinate" value={rows.length ? count * 100 / rows.length : 0} color={finalStatus(status) ? 'success' : status === 'Em andamento' ? 'warning' : 'primary'} sx={{ flex: 1, borderRadius: 5 }} /><Typography variant="caption">{count}</Typography></Stack>;
          })}
          <Typography variant="caption" color="error.main">{delayed} atrasadas · indicador adicional</Typography>
        </Paper></Grid>
        <Grid size={{ xs: 12, md: 7 }}><Paper sx={{ p: 2, height: '100%' }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1}><Typography fontWeight={700}>Evolução das OS</Typography><TextField size="small" select label="Agrupar por" value={group} onChange={e => setGroup(e.target.value)} sx={{ minWidth: 112 }}><MenuItem value="day">Dia</MenuItem><MenuItem value="week">Semana</MenuItem><MenuItem value="month">Mês</MenuItem></TextField></Stack>
          {points.length ? <>
            <Box component="svg" viewBox="0 0 360 112" role="img" aria-label="Evolução de ordens abertas e concluídas" sx={{ width: '100%', mt: 2 }}>
              {[15, 58, 101].map(line => <line key={line} x1="10" x2="350" y1={line} y2={line} stroke="#E5E7EB" />)}
              {(['opened', 'closed'] as const).map(field => <g key={field} color={field === 'opened' ? '#2563EB' : '#047857'}>
                <polyline fill="none" stroke="currentColor" strokeWidth="2" points={points.map(([, point], i) => `${x(i)},${y(point[field])}`).join(' ')} />
                {points.map(([key, point], i) => <circle key={key} cx={x(i)} cy={y(point[field])} r="3" fill="currentColor"><title>{key} · {point[field]} {field === 'opened' ? 'abertas' : 'concluídas'}</title></circle>)}
              </g>)}
            </Box>
            <Stack direction="row" justifyContent="space-between"><Typography variant="caption">{points[0][0]}</Typography><Typography variant="caption">{points.at(-1)?.[0]}</Typography></Stack>
            <Stack direction="row" gap={1} mt={1}><Chip size="small" color="primary" label="Abertas" /><Chip size="small" color="success" label="Concluídas" /></Stack>
          </> : <Typography color="text.secondary" mt={2}>Sem ordens no período.</Typography>}
        </Paper></Grid>
      </Grid>
    </>}

    <Paper sx={{ overflow: 'hidden' }}>
      <Box p={2}>
        <Typography variant="h6" fontWeight={700}>{history ? 'Histórico de ordens de serviço' : 'Últimas 10 Ordens de Serviço'}</Typography>
        <Typography variant="body2" color="text.secondary">Consulte os atendimentos e acompanhe os responsáveis e valores.</Typography>
      </Box>
      {history && <Stack direction={{ xs: 'column', sm: 'row' }} gap={1.5} px={2} pb={2}>
        <TextField size="small" label="Pesquisar ordens" value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} />
        <TextField size="small" select label="Ordenar por" value={sort} onChange={e => { setSort(e.target.value); setPage(0); }} sx={{ minWidth: 150 }}><MenuItem value="recent">Mais recentes</MenuItem><MenuItem value="old">Mais antigas</MenuItem><MenuItem value="value">Maior valor</MenuItem></TextField>
      </Stack>}
      <TableContainer sx={{ display: { xs: 'none', md: 'block' } }}>
        <Table size="small" aria-label="Ordens de serviço" sx={{ minWidth: 1190 }}>
          <TableHead><TableRow sx={{ bgcolor: '#EDF2FF' }}>{columns.map(column => <TableCell key={column} sx={{ fontWeight: 700 }}>{column}</TableCell>)}</TableRow></TableHead>
          <TableBody>{visible.map(o => <TableRow key={o.number} hover>
            <TableCell><Button size="small" onClick={() => setSelectedId(o.id)}>{o.number}</Button></TableCell><TableCell>{label(o.opened)}</TableCell><TableCell>{o.client}</TableCell><TableCell>{o.vehicle}</TableCell><TableCell>{o.plate}</TableCell><TableCell>{o.consultant}</TableCell><TableCell>{o.manager || 'Não informado'}</TableCell>
            <TableCell>{o.mechanics.slice(0, 2).join(', ') || 'Não atribuídos'} {o.mechanics.length > 2 && <Tooltip title={o.mechanics.join(', ')}><Chip size="small" tabIndex={0} label={`+${o.mechanics.length - 2}`} /></Tooltip>}</TableCell>
            <TableCell>{o.count}</TableCell><TableCell sx={{ whiteSpace: 'nowrap' }}>{money.format(o.amount)}<Typography display="block" variant="caption" color="text.secondary">{valueLabel(o)}</Typography></TableCell><TableCell><Status order={o} /></TableCell><TableCell>{actions(o)}</TableCell>
          </TableRow>)}</TableBody>
        </Table>
      </TableContainer>
      <Stack display={{ xs: 'flex', md: 'none' }} spacing={1} p={1.5}>
        {visible.map(o => <Paper variant="outlined" key={o.number} sx={{ p: 1.5 }}>
          <Stack direction="row" justifyContent="space-between" gap={1}><Typography fontWeight={700}>#{o.number}</Typography><Status order={o} /></Stack>
          <Typography variant="body2" mt={1}>{o.vehicle} · {o.plate}</Typography><Typography variant="body2">{o.client} · {label(o.opened)}</Typography>
          <Typography variant="body2" color="text.secondary">Consultor {o.consultant} · Oficina {o.manager || 'Não informado'}</Typography><Typography variant="body2" color="text.secondary">Mecânicos: {o.mechanics.join(', ') || 'Não atribuídos'}</Typography>
          <Typography variant="body2" fontWeight={700} mt={1}>{money.format(o.amount)} · {valueLabel(o)} · {o.count} serviços</Typography>{actions(o)}
        </Paper>)}
      </Stack>
      {!orderQuery.isPending && !orderQuery.isError && !rows.length && <Typography color="text.secondary" p={2}>Nenhuma ordem corresponde aos filtros.</Typography>}
      {history ? <TablePagination component="div" count={rows.length} page={pageIndex} rowsPerPage={10} rowsPerPageOptions={[]} onPageChange={(_, p) => setPage(p)} labelDisplayedRows={({ from: first, to: last, count }) => `${first}–${last} de ${count}`} /> : <Box p={2}><Button component={Link} to="/administration/ordens" variant="outlined">Visualizar todas as Ordens de Serviço</Button></Box>}
      {history && <Box px={2} pb={2}><Button component={Link} to="/administration/dashboard">Voltar ao dashboard</Button></Box>}
    </Paper>
    <Menu anchorEl={menu?.anchor} open={menu !== null} onClose={() => setMenu(null)}>
      <MenuItem onClick={() => { if (menu) setSelectedId(menu.order.id); setMenu(null); }}>Ver detalhes</MenuItem>
      <MenuItem onClick={() => { if (menu) exportCsv([menu.order]); setMenu(null); }}>Exportar OS</MenuItem>
    </Menu>
    <Drawer anchor="right" open={selected !== null} onClose={() => setSelectedId(null)} slotProps={{ paper: { sx: { width: { xs: '100%', md: 860 }, maxWidth: '100vw' } } }}>
      {selected && <OrderDetails order={selected} onClose={() => setSelectedId(null)} />}
    </Drawer>
  </Stack>;
}

function OrderDetails({ order, onClose }: { order: Order; onClose: () => void }) {
  const done = order.services.filter(service => service.end).length;
  const timeline = [{ name: 'OS aberta', at: order.opened, actor: order.consultant }];
  return <Stack spacing={2} p={{ xs: 2, sm: 3 }}>
    <Stack direction="row" justifyContent="space-between" gap={1} alignItems="center"><Typography variant="h5" fontWeight={700}>Detalhes da OS #{order.number}</Typography><Button onClick={onClose}>Fechar</Button></Stack>
    <Status order={order} />
    <Typography>{order.client} · {order.vehicle} · {order.plate}</Typography>
    <Typography variant="body2">Abertura {label(order.opened)} · Previsão {label(order.due)}</Typography>
    <Typography variant="body2">{done} de {order.count} serviços concluídos</Typography>
    <LinearProgress aria-label="Progresso dos serviços" variant="determinate" value={order.count ? done / order.count * 100 : 0} />
    <Typography variant="h6">Equipe responsável</Typography>
    <Typography variant="body2">Consultor técnico {order.consultant} · Chefe de oficina {order.manager || 'Não informado'}</Typography>
    <Typography variant="body2">Mecânicos {order.mechanics.join(', ') || 'Não atribuídos'}</Typography>
    <Typography variant="h6">Serviços realizados</Typography>
    <TableContainer><Table size="small" sx={{ minWidth: 740 }}>
      <TableHead><TableRow>{['Serviço', 'Mecânico', 'TMO', 'Início', 'Conclusão', 'Tempo', 'Status', 'Valor do serviço'].map(name => <TableCell key={name}>{name}</TableCell>)}</TableRow></TableHead>
      <TableBody>{order.services.map(s => <TableRow key={s.id}><TableCell>{s.name}</TableCell><TableCell>{s.mechanic || 'Não atribuído'}</TableCell><TableCell>{s.minutes} min</TableCell><TableCell>{label(s.start)}</TableCell><TableCell>{label(s.end)}</TableCell><TableCell>{s.start && s.end ? Math.round((+s.end - +s.start) / 60_000) + ' min' : '—'}</TableCell><TableCell>{s.status}</TableCell><TableCell>{money.format(s.total)}</TableCell></TableRow>)}</TableBody>
    </Table></TableContainer>
    <Paper sx={{ p: 2 }}><Typography variant="h6" mb={1}>Resumo financeiro</Typography>

      <Typography variant="body2" fontWeight={700} mt={1}>{valueLabel(order)} {money.format(order.amount)}</Typography>
      <Typography variant="body2" color="text.secondary">{complete(order) ? 'Valor apurado' : 'Orçamento previsto'}</Typography>
    </Paper>
    <Typography variant="h6">Histórico de execução</Typography>
    {timeline.map(event => <Box key={event.name + +event.at} sx={{ borderLeft: '3px solid #2563EB', pl: 1.5 }}><Typography variant="body2" fontWeight={600}>{event.name}</Typography><Typography variant="caption" color="text.secondary">{label(event.at)} · {event.actor}</Typography></Box>)}
    <Typography variant="h6">Fotografias</Typography>
    <Grid container spacing={1}>{['Peças antigas', 'Peças novas', 'Antes do serviço', 'Depois do serviço'].map(name => <Grid key={name} size={{ xs: 6, sm: 3 }}><Paper sx={{ p: 1.5 }}><Typography variant="body2" fontWeight={600}>{name}</Typography><Typography variant="caption" color="text.secondary">Sem anexos registrados</Typography></Paper></Grid>)}</Grid>
    <Stack direction="row" gap={1} flexWrap="wrap"><Button onClick={onClose}>Voltar</Button><Button variant="outlined" onClick={() => exportCsv([order])}>Exportar CSV</Button><Button variant="contained" onClick={() => window.print()}>Imprimir / salvar PDF</Button></Stack>
    <Box component="style">{'@media print { body > #root { display:none !important; } .MuiDrawer-root { position:static !important; } .MuiDrawer-paper { position:static !important; width:100% !important; max-width:none !important; overflow:visible !important; } .MuiBackdrop-root, .MuiDrawer-paper button { display:none !important; } .MuiTableContainer-root { overflow:visible !important; } .MuiDrawer-paper table { min-width:0 !important; } }'}</Box>
  </Stack>;
}
