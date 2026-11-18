import '@fontsource/inter/500.css';
import '@fontsource/inter/700.css';
import '../consultants/consultantTypography.css';
import { useEffect, useState } from 'react';
import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Avatar, Box, Button, Checkbox, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Drawer, FormControlLabel, IconButton, InputAdornment, LinearProgress, MenuItem, Paper, Stack, TextField, ThemeProvider, Tooltip, Typography, createTheme } from '@mui/material';
import { ArrowRight, BookOpen, Camera, CarFront, CheckCheck, CircleCheck, Clock3, ClipboardList, Gauge, Headset, List, LogOut, Menu, Moon, Palette, Pause, Play, RefreshCw, Search, ShieldCheck, Siren, Timer, UserRound, Wrench } from 'lucide-react';
import { isAxiosError } from 'axios';
import { api, mutate } from '../../services/api';

type Service = {
  id: string; name: string; minutes: number; status: string; executionVersion: number;
  startedAt: string | null; completedAt: string | null; pausedAt: string | null;
  pausedSeconds: number; effectiveSeconds: number; pauseReason: string | null; report: string | null; expectedAt: string | null; approvedAt: string | null;
};
type AssignedOrder = {
  id: string; customer: string; vehicle: string; plate: string; consultant: string; managerName: string | null;
  openedAt: string; status: string; totalServices: number; completedServices: number; items: Service[];
};
type Profile = { name: string };
const theme = createTheme({
  palette: { primary: { main: '#004ac6' }, background: { default: '#f8f9ff', paper: '#fff' }, text: { primary: '#0b1c30', secondary: '#434655' }, success: { main: '#006242' }, error: { main: '#ba1a1a' } },
  typography: { fontFamily: 'Inter, sans-serif', fontSize: 13, body1: { fontSize: 13, lineHeight: '20px' }, body2: { fontSize: 12, lineHeight: '18px' }, h5: { fontSize: 24, lineHeight: '32px', fontWeight: 600, letterSpacing: '-.02em' }, button: { fontSize: 13, fontWeight: 500, textTransform: 'none' } },
  shape: { borderRadius: 8 },
  components: { MuiPaper: { defaultProps: { elevation: 0 } }, MuiButton: { defaultProps: { disableElevation: true } } },
});
const card = { border: '1px solid #edf0f8', borderRadius: 2, boxShadow: '0 1px 2px #0b1c3005' };
const mono = { fontFamily: '"JetBrains Mono", monospace', fontSize: 11 };
const toDate = (value: string) => new Date(/(?:Z|[+-]d{2}:d{2})$/.test(value) ? value : value + 'Z');
const date = (value: string | null) => value ? toDate(value).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—';
const number = (order: AssignedOrder) => order.id.slice(0, 8).toUpperCase();
function elapsed(seconds: number) {
  const value = Math.max(0, Math.floor(seconds));
  return [Math.floor(value / 3600), Math.floor(value % 3600 / 60), value % 60].map(item => String(item).padStart(2, '0')).join(':');
}
function errorText(error: unknown) {
  if (isAxiosError(error) && typeof error.response?.data?.error === 'string') return error.response.data.error;
  return 'Não foi possível concluir a operação. Atualize os dados e tente novamente.';
}

export function MechanicWorkspace({ user }: { user: Profile }) {
  const cache = useQueryClient();
  const location = useLocation();
  const [mobile, setMobile] = useState(false);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [panel, setPanel] = useState<'manual' | 'evidence' | 'theme' | null>(null);
  const [dense, setDense] = useState(false);
  const [action, setAction] = useState<{ service: Service; action: string } | null>(null);
  const [reason, setReason] = useState('Aguardando peça');
  const [report, setReport] = useState('');
  const [checked, setChecked] = useState(false);
  const [clock, setClock] = useState(() => new Date());
  useEffect(() => { const timer = setInterval(() => setClock(new Date()), 1000); return () => clearInterval(timer); }, []);
  const orders = useQuery({ queryKey: ['mechanic', 'orders'], queryFn: async () => (await api.get<AssignedOrder[]>('/mechanic/orders')).data, refetchInterval: 15000 });
  const execute = useMutation({
    mutationFn: () => mutate('/mechanic/services/' + action!.service.id + '/execution', { action: action!.action, version: action!.service.executionVersion, reason, report, checklistConfirmed: checked }),
    onSuccess: async () => {
      setAction(null);
      await cache.invalidateQueries({ queryKey: ['mechanic', 'orders'] });
      await cache.invalidateQueries({ queryKey: ['operations', 'orders'] });
    },
  });
  const help = useMutation({ mutationFn: () => mutate('/mechanic/help'), onSuccess: () => cache.invalidateQueries({ queryKey: ['workshop', 'help'] }) });
  const list = orders.data ?? [];
  const services = list.flatMap(order => order.items.map(service => ({ ...service, order })));
  const active = services.filter(service => service.status === 'Em execução');
  const paused = services.filter(service => service.status === 'Pausado');
  const completed = services.filter(service => Boolean(service.completedAt));
  const pending = services.filter(service => service.status === 'Aguardando início');
  const inHistory = location.pathname === '/mecanico/historico';
  const inActive = location.pathname === '/mecanico/execucao';
  function seconds(service: Service) {
    if (!service.startedAt) return 0;
    const end = service.completedAt ? toDate(service.completedAt) : service.pausedAt ? toDate(service.pausedAt) : clock;
    return Math.max(0, Math.floor((+end - +toDate(service.startedAt)) / 1000) - service.pausedSeconds);
  }
  const workedSeconds = services.reduce((sum, service) => sum + seconds(service), 0);
  const plannedSeconds = services.reduce((sum, service) => sum + service.minutes * 60, 0);
  const filtered = list.filter(order =>
    [number(order), order.customer, order.vehicle, order.plate, ...order.items.map(item => item.name)].join(' ').toLowerCase().includes(search.trim().toLowerCase()) &&
    (!status || order.items.some(item => item.status === status)) &&
    (!inActive || order.items.some(item => item.status === 'Em execução' || item.status === 'Pausado')) &&
    (!inHistory || order.items.some(item => Boolean(item.completedAt))));
  const selected = list.find(order => order.id === selectedId);
  const navigation = [
    ['/mecanico/dashboard', 'Dashboard de OS', List],
    ['/mecanico/execucao', 'Execução Ativa', Wrench],
    ['/mecanico/historico', 'Histórico & Produtividade', Gauge],
  ] as const;
  const sidebar = <Stack sx={{ height: '100%', bgcolor: '#fff' }}>
    <Stack direction="row" alignItems="center" gap={1.5} p={2} sx={{ bgcolor: '#eff4ff' }}>
      <Avatar variant="rounded" sx={{ width: 40, height: 40, bgcolor: '#004ac6', fontSize: 18, fontWeight: 700 }}>AF</Avatar>
      <Box><Stack direction="row" gap={.5}><Typography fontSize={16} fontWeight={700}>AutoFlow</Typography><Chip size="small" label="STELLANTIS" sx={{ height: 21, bgcolor: '#d5e0f8', fontSize: 10 }} /></Stack><Typography fontSize={10} letterSpacing={.7}>OFICINA CONCESSIONÁRIA</Typography></Box>
    </Stack>
    <Box p={2}><Paper sx={{ p: 1.5, bgcolor: '#eff4ff' }}><Stack direction="row" gap={1.5} alignItems="center">
      <Avatar sx={{ bgcolor: '#004ac6', width: 40, height: 40 }}><Wrench size={19} /></Avatar><Box><Typography fontSize={16} fontWeight={600}>{user.name}</Typography><Typography fontSize={12} color="text.secondary">Mecânico</Typography><Chip size="small" label={active.length ? 'Em execução' : 'Disponível'} sx={{ mt: .5, height: 21, bgcolor: '#d3e4fe', color: '#006242', fontSize: 11 }} /></Box>
    </Stack></Paper></Box>
    <Stack gap={.75} px={1.5}>
      {navigation.map(([path, text, Icon]) => <Button key={path} component={Link} to={path} onClick={() => setMobile(false)} startIcon={<Icon size={19} />} sx={{ justifyContent: 'flex-start', p: 1.5, minHeight: 46, fontSize: 13, color: location.pathname === path ? '#fff' : '#0b1c30', bgcolor: location.pathname === path ? '#2563eb' : 'transparent', '&:hover': { bgcolor: location.pathname === path ? '#1d4ed8' : '#eff4ff' } }}>{text}</Button>)}
      <Button startIcon={<BookOpen size={19} />} sx={{ justifyContent: 'flex-start', p: 1.5, minHeight: 46, color: '#0b1c30' }} onClick={() => setPanel('manual')}>Manual Técnico & Torque</Button>
      <Button startIcon={<Headset size={19} />} sx={{ justifyContent: 'flex-start', p: 1.5, minHeight: 46, color: '#0b1c30' }} onClick={() => help.mutate()} disabled={help.isPending}>Acionar Suporte/Chefe</Button>
    </Stack>
    <Box sx={{ mt: 'auto', p: 2, bgcolor: '#eff4ff' }}><Paper sx={{ p: 1.5, mb: 2 }}><Typography fontSize={12} fontWeight={600}>Stellantis INTOSV2</Typography><Typography fontSize={11} color="text.secondary">Aguardando configuração</Typography></Paper><Stack direction="row" justifyContent="space-between"><Button startIcon={<Palette size={15} />} onClick={() => setPanel('theme')} sx={{ bgcolor: '#fff' }}>Tema</Button><Button color="error" startIcon={<LogOut size={15} />} onClick={async () => { await mutate('/auth/logout'); cache.clear(); window.location.assign('/'); }} sx={{ bgcolor: '#fff' }}>Sair</Button></Stack></Box>
  </Stack>;

  const stats = [
    { label: 'OS atribuídas', value: list.length, caption: 'veículos', note: 'Serviços vinculados a você', icon: ClipboardList, progress: list.length ? 100 : 0 },
    { label: 'Pendentes', value: pending.length + paused.length, caption: 'serviços', note: 'Aguardando início ou retomada', icon: Clock3, progress: services.length ? (pending.length + paused.length) * 100 / services.length : 0 },
    { label: 'Em execução', value: active.length, caption: 'ativos', note: active[0]?.name ?? 'Nenhum serviço iniciado', icon: RefreshCw, progress: services.length ? active.length * 100 / services.length : 0, blue: true },
    { label: 'Finalizados', value: completed.length, caption: 'serviços', note: 'Aguardando conferência do chefe', icon: CircleCheck, progress: services.length ? completed.length * 100 / services.length : 0, green: true },
    { label: 'Tempo excedido', value: active.filter(service => seconds(service) > service.minutes * 60).length, caption: '', note: 'Tempo efetivo acima do TMO', icon: Timer, progress: 0, green: true },
    { label: 'Horas registradas', value: elapsed(workedSeconds), caption: '', note: 'Tempo efetivo registrado', icon: Clock3, progress: plannedSeconds ? Math.min(100, workedSeconds / plannedSeconds * 100) : 0, green: false },
  ];

  function chooseAction(service: Service, next: string) {
    execute.reset();
    setReason('Aguardando peça');
    setReport('');
    setChecked(false);
    setAction({ service, action: next });
  }

  return <ThemeProvider theme={theme}><Box sx={{ minHeight: '100vh', bgcolor: '#f8f9ff', color: '#0b1c30', '& .MuiTypography-root': { fontVariantNumeric: 'tabular-nums' } }}>
    <Box component="nav" sx={{ display: { xs: 'none', lg: 'block' }, position: 'fixed', inset: '0 auto 0 0', width: 288 }}>{sidebar}</Box>
    <Drawer open={mobile} onClose={() => setMobile(false)} slotProps={{ paper: { sx: { width: 288 } } }}>{sidebar}</Drawer>
    <Box sx={{ ml: { lg: '288px' } }}>
      <Stack direction="row" alignItems="center" gap={1.5} sx={{ minHeight: 64, px: { xs: 1.5, sm: 3 }, bgcolor: '#f8f9ff', py: .75, borderBottom: '1px solid #edf0f8' }}>
        <IconButton aria-label="Abrir menu" sx={{ display: { lg: 'none' } }} onClick={() => setMobile(true)}><Menu size={20} /></IconButton>
        <Stack direction="row" alignItems="center" gap={1} sx={{ bgcolor: '#eff4ff', borderRadius: 1, p: 1, display: { xs: 'none', md: 'flex' } }}><CarFront size={20} color="#004ac6" /><Typography variant="body2">POSTO<br /><strong>Não vinculado</strong></Typography><Typography variant="body2" color="text.secondary">Elevador<br />Não configurado</Typography></Stack>
        <Box sx={{ bgcolor: '#eff4ff', p: 1, display: { xs: 'none', xl: 'block' }, borderRadius: 1 }}><Typography variant="body2">Prisma ativo</Typography><Typography variant="caption">Não vinculado</Typography></Box>
        <Stack direction="row" gap={1} alignItems="center" sx={{ bgcolor: '#eff4ff', borderRadius: 1, p: 1, display: { xs: 'none', md: 'flex' } }}><Gauge size={18} color="#006242" /><Typography variant="body2">TMO atribuído<br /><strong>{services.reduce((sum, service) => sum + service.minutes, 0)} min</strong></Typography></Stack>
        <Typography sx={{ ...mono, ml: 'auto', display: { xs: 'none', sm: 'block' } }}>{clock.toLocaleTimeString('pt-BR')}</Typography>
        <Button variant="contained" color="error" startIcon={<Siren size={21} />} disabled={help.isPending} onClick={() => help.mutate()} sx={{ fontWeight: 700, minHeight: 46, ml: { xs: 'auto', sm: 0 } }}>CHAMAR<br />CHEFE</Button>
        <Tooltip title={user.name}><Avatar sx={{ bgcolor: '#004ac6', width: 32, height: 32 }}><UserRound size={18} /></Avatar></Tooltip>
      </Stack>
      <Box component="main" sx={{ px: { xs: 1.5, sm: 3 }, pb: 3 }}>
        <Typography sx={{ fontSize: 10, letterSpacing: .7, textTransform: 'uppercase', mt: 1 }}>STELLANTIS DEALER WORKSHOP / OPERAÇÕES DE PISTA / <Box component="span" color="primary.main" fontWeight={700}>{user.name}</Box></Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} gap={1} mb={3} mt={.5}>
          <Typography component="h1" variant="h5" sx={{ fontSize: { xs: 22, md: 26 }, fontWeight: 600 }}>Painel Operacional do Mecânico</Typography>
          <Stack direction="row" gap={1} alignItems="center"><Typography variant="caption" color="text.secondary">{orders.dataUpdatedAt ? 'Atualizado às ' + new Date(orders.dataUpdatedAt).toLocaleTimeString('pt-BR') : 'Carregando…'}</Typography><Button variant="outlined" startIcon={<RefreshCw size={16} />} sx={{ bgcolor: '#fff' }} onClick={() => orders.refetch()} disabled={orders.isFetching}>Atualizar</Button></Stack>
        </Stack>
        <Routes><Route path="/" element={<Navigate to="/mecanico/dashboard" replace />} /></Routes>
        {orders.isError && <Alert severity="error" sx={{ mb: 2 }}>Não foi possível carregar os serviços. Confira se a API atual está em execução.</Alert>}
        {help.isSuccess && <Alert severity="success" onClose={() => help.reset()} sx={{ mb: 2 }}>Solicitação registrada para o chefe de oficina.</Alert>}
        {help.isError && <Alert severity="error" onClose={() => help.reset()} sx={{ mb: 2 }}>{errorText(help.error)}</Alert>}
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2,minmax(0,1fr))', sm: 'repeat(3,minmax(0,1fr))', lg: 'repeat(6,minmax(0,1fr))' }, gap: 1.5, mb: 3 }}>
          {stats.map(metric => <Paper key={metric.label} sx={{ ...card, p: 1.5, minHeight: 138, bgcolor: metric.blue ? '#2563eb' : '#fff', color: metric.blue ? '#fff' : '#0b1c30', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <Stack direction="row" justifyContent="space-between" gap={1}><Typography fontSize={11} textTransform="uppercase" letterSpacing={.4}>{metric.label}</Typography><Box sx={{ p: .5, borderRadius: .5, bgcolor: metric.blue ? '#ffffff26' : metric.green ? '#bdf5dd' : '#eff4ff', color: metric.blue ? '#fff' : metric.green ? '#006242' : '#004ac6', display: 'flex', alignSelf: 'flex-start' }}><metric.icon size={19} /></Box></Stack>
            <Box><Typography component="span" fontSize={metric.label === 'Horas registradas' ? 20 : 27} fontWeight={700}>{orders.isPending ? '—' : metric.value}</Typography><Typography component="span" fontSize={11} ml={.5}>{metric.caption}</Typography></Box>
            <Typography fontSize={10} sx={{ opacity: .8, overflowWrap: 'anywhere' }}>{metric.note}</Typography>
            <LinearProgress variant="determinate" value={metric.progress} sx={{ height: 4, borderRadius: 1, bgcolor: metric.blue ? '#ffffff30' : '#dce9ff', '& .MuiLinearProgress-bar': { bgcolor: metric.blue ? '#fff' : metric.green ? '#006242' : '#004ac6' } }} />
          </Paper>)}
        </Box>
        <Paper sx={{ ...card, p: 1.5, mb: 2 }}>
          <Stack direction={{ xs: 'column', md: 'row' }} gap={1.5}>
            <TextField size="small" placeholder="Buscar por OS, veículo ou serviço" value={search} onChange={e => setSearch(e.target.value)} sx={{ flex: 1, bgcolor: '#eff4ff', '& fieldset': { border: 0 } }} slotProps={{ input: { startAdornment: <InputAdornment position="start"><Search size={18} /></InputAdornment> } }} />
            <TextField size="small" select label="Status do serviço" value={status} onChange={e => setStatus(e.target.value)} sx={{ minWidth: 220, bgcolor: '#eff4ff' }}><MenuItem value="">Todos ({list.length})</MenuItem>{['Aguardando início', 'Em execução', 'Pausado', 'Concluído', 'Pronto'].map(value => <MenuItem value={value} key={value}>{value}</MenuItem>)}</TextField>
            <Box sx={{ bgcolor: '#eff4ff', px: 1.5, display: 'flex', alignItems: 'center', gap: 1, minHeight: 40 }}><ShieldCheck size={17} color="#004ac6" /><Typography variant="body2">Chefe · {[...new Set(list.map(order => order.managerName).filter(Boolean))].join(', ') || 'Não informado'}</Typography></Box>
          </Stack>
          <Typography variant="caption" display="block" mt={1.25}>● Mostrando <strong>{filtered.length} ordens de serviço</strong> atribuídas a você · TMO total {services.reduce((sum, service) => sum + service.minutes, 0)} min</Typography>
        </Paper>
        <Stack spacing={1.5}>
          {filtered.map(order => {
            const running = order.items.find(service => service.status === 'Em execução');
            const done = order.items.every(service => Boolean(service.completedAt));
            const ownCompleted = order.items.filter(service => Boolean(service.completedAt)).length;
            const progress = order.totalServices ? Math.round(order.completedServices / order.totalServices * 100) : 0;
            return <Paper key={order.id} sx={{ ...card, overflow: 'hidden', borderLeft: '6px solid ' + (done ? '#006242' : running ? '#004ac6' : 'transparent') }}>
              <Box sx={{ p: dense ? 1.5 : 2, display: 'grid', gridTemplateColumns: { xs: '1fr', md: '56px minmax(180px,1fr)', xl: '64px minmax(200px,1fr) minmax(210px,280px) 150px' }, gap: 2, alignItems: 'center' }}>
                <Avatar variant="rounded" sx={{ width: 56, height: 64, bgcolor: done ? '#6ffbbe' : '#eff4ff', color: done ? '#006242' : running ? '#004ac6' : '#434655', display: { xs: 'none', md: 'flex' } }}>{done ? <CircleCheck size={30} /> : <CarFront size={30} />}</Avatar>
                <Box sx={{ minWidth: 0 }}>
                  <Stack direction="row" gap={.75} flexWrap="wrap" mb={.75}><Chip size="small" label={'#' + number(order)} sx={{ borderRadius: .5, bgcolor: running ? '#004ac6' : '#dce9ff', color: running ? '#fff' : '#004ac6', fontSize: 11, fontWeight: 700 }} /><Chip size="small" label={order.plate} sx={{ borderRadius: .75, bgcolor: '#213145', color: '#fff', fontSize: 11 }} />{done && <Chip size="small" icon={<CheckCheck size={14} />} label="Concluída pelo técnico" color="success" sx={{ height: 23 }} />}</Stack>
                  <Chip size="small" label={done ? order.status === 'Pronta' ? 'Pronta · Conferida pelo chefe' : 'Aguardando conferência' : running ? 'Em execução ativa' : order.items.some(service => service.status === 'Pausado') ? 'Serviço pausado' : 'Aguardando início'} sx={{ height: 23, bgcolor: '#dbe1ff', fontSize: 11, mb: .5 }} />
                  <Typography fontSize={20} fontWeight={600} sx={{ overflowWrap: 'anywhere' }}>{order.vehicle}</Typography>
                  <Stack direction="row" flexWrap="wrap" alignItems="center" gap={.75} mt={.5}><UserRound size={13} /><Typography variant="body2">Cliente · <strong>{order.customer}</strong></Typography><Typography color="text.secondary">•</Typography><Typography variant="body2">Consultor · {order.consultant}</Typography></Stack>
                  <Typography variant="body2" mt={.5}>♧ Chefe · {order.managerName ?? 'Não informado'}</Typography>
                </Box>
                <Box sx={{ p: 1.5, bgcolor: '#eff4ff', borderRadius: 2, gridColumn: { md: '2', xl: 'auto' } }}>
                  <Stack direction="row" justifyContent="space-between" mb={1}><Typography variant="body2" color={done ? 'success.main' : 'primary.main'} fontWeight={600}>Progresso geral</Typography><Typography variant="body2" fontWeight={600}>{progress}%</Typography></Stack>
                  <LinearProgress variant="determinate" value={progress} color={done ? 'success' : 'primary'} sx={{ height: 9, borderRadius: 5, mb: 1.25 }} />
                  <Typography variant="body2"><strong>{order.totalServices} serviços</strong> na OS · {order.completedServices} concluídos</Typography>
                  <Typography variant="caption">{order.items.length} atribuídos a você · {ownCompleted} concluídos</Typography>
                  <Stack direction="row" gap={.75} alignItems="center" mt={1}><Clock3 size={14} /><Typography variant="caption">Entrega prevista · Não informada</Typography></Stack>
                </Box>
                <Stack gap={1} sx={{ gridColumn: { md: '2', xl: 'auto' } }}>
                  {running && <Chip size="small" label={'Timer ativo ' + elapsed(seconds(running))} sx={{ bgcolor: '#d3e4fe', color: '#004ac6', fontSize: 10, fontWeight: 600 }} />}
                  <Button variant={running ? 'contained' : 'text'} size="large" startIcon={done ? <ClipboardList size={20} /> : <Wrench size={20} />} endIcon={<ArrowRight size={18} />} sx={{ bgcolor: running ? '#004ac6' : '#eff4ff', minHeight: 48, whiteSpace: 'nowrap', fontWeight: 600 }} onClick={() => setSelectedId(order.id)}>{done ? 'Ver detalhes' : 'Acessar OS'}</Button>
                </Stack>
              </Box>
              {running && <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={1} alignItems={{ sm: 'center' }} sx={{ px: 2, pb: 1.5 }}>
                <Typography variant="body2" color="primary.main">▷ Etapa atual · {running.name}</Typography><Stack direction="row" gap={.75}><Button size="small" startIcon={<BookOpen size={15} />} onClick={() => setPanel('manual')} sx={{ bgcolor: '#eff4ff' }}>Torque</Button><Button size="small" startIcon={<Camera size={15} />} onClick={() => { setSelectedId(order.id); setPanel('evidence'); }} sx={{ bgcolor: '#eff4ff' }}>Evidências</Button></Stack>
              </Stack>}
            </Paper>;
          })}
          {!orders.isError && !filtered.length && <Paper sx={{ ...card, p: 3 }}><Typography color="text.secondary">{orders.isPending ? 'Carregando ordens atribuídas…' : inHistory ? 'Nenhum serviço concluído na seleção.' : 'Nenhuma OS atribuída corresponde à seleção. O chefe de oficina pode distribuir serviços para você.'}</Typography></Paper>}
        </Stack>
        <Paper sx={{ p: 1.5, bgcolor: '#eff4ff', mt: 3 }}>
          <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" gap={2} alignItems={{ md: 'center' }}>
            <Stack direction="row" gap={1.5} alignItems="center"><Avatar variant="rounded" sx={{ bgcolor: '#fff', color: '#004ac6' }}><Wrench size={20} /></Avatar><Box><Typography fontWeight={500}>Bancada de execução</Typography><Typography variant="body2" color="text.secondary">{active.length ? active.length + ' serviços em execução.' : 'Abra uma OS para iniciar um serviço atribuído.'}</Typography></Box></Stack>
            <Stack direction="row" gap={1}><Tooltip title="Leitor físico ainda não configurado"><span><Button disabled sx={{ bgcolor: '#fff' }}>Ler Cartão NFC / Prisma</Button></span></Tooltip><Button startIcon={<Pause size={17} />} disabled={!active.length} onClick={() => { if (active[0]) chooseAction(active[0], 'pause'); }} sx={{ bgcolor: '#545f73', color: '#fff', '&:hover': { bgcolor: '#434655' } }}>Pausa / Almoço</Button></Stack>
          </Stack>
        </Paper>
      </Box>
    </Box>

    <Dialog open={selectedId !== null} fullWidth maxWidth="md" onClose={() => setSelectedId(null)}>
      {selected ? <><DialogTitle>Execução · OS #{number(selected)}</DialogTitle><DialogContent>
        <Typography mb={2}>{selected.customer} · {selected.vehicle} · {selected.plate}</Typography>
        <Stack spacing={1.5}>{selected.items.map(service => <Paper variant="outlined" sx={{ p: 2 }} key={service.id}>
          <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={1}><Box><Typography fontWeight={600}>{service.name}</Typography><Typography variant="caption">TMO {service.minutes} min · {service.status}</Typography></Box><Typography sx={{ ...mono, fontSize: 20 }}>{elapsed(seconds(service))}</Typography></Stack>
          <Typography variant="body2" color="text.secondary" my={1}>Início {date(service.startedAt)} · Previsão {date(service.expectedAt)} · Conclusão {date(service.completedAt)}</Typography>
          {service.pauseReason && <Typography variant="caption" display="block">Última pausa · {service.pauseReason}</Typography>}
          {service.report && <Typography variant="body2" sx={{ mt: 1, whiteSpace: 'pre-wrap' }}>{service.report}</Typography>}
          <Stack direction="row" gap={1} mt={1.5} flexWrap="wrap">
            {service.status === 'Aguardando início' && <Button variant="contained" startIcon={<Play size={16} />} onClick={() => chooseAction(service, 'start')}>Iniciar serviço</Button>}
            {service.status === 'Em execução' && <><Button variant="outlined" startIcon={<Pause size={16} />} onClick={() => chooseAction(service, 'pause')}>Pausar</Button><Button variant="contained" color="success" startIcon={<CircleCheck size={16} />} onClick={() => chooseAction(service, 'complete')}>Concluir serviço</Button></>}
            {service.status === 'Pausado' && <Button variant="contained" startIcon={<Play size={16} />} onClick={() => chooseAction(service, 'resume')}>Retomar</Button>}
          </Stack>
        </Paper>)}</Stack>
      </DialogContent><DialogActions><Button onClick={() => setSelectedId(null)}>Fechar</Button></DialogActions></> : <><DialogTitle>OS indisponível</DialogTitle><DialogContent>A atribuição pode ter sido alterada. Atualize a lista.</DialogContent><DialogActions><Button onClick={() => setSelectedId(null)}>Fechar</Button></DialogActions></>}
    </Dialog>
    <Dialog open={action !== null} onClose={() => { if (!execute.isPending) setAction(null); }} fullWidth maxWidth="sm">
      <DialogTitle>{action?.action === 'start' ? 'Iniciar serviço' : action?.action === 'pause' ? 'Pausar serviço' : action?.action === 'resume' ? 'Retomar serviço' : 'Concluir serviço'}</DialogTitle>
      <DialogContent><Stack gap={2} pt={1}><Typography>{action?.service.name}</Typography>
        {execute.isError && <Alert severity="error">{errorText(execute.error)}</Alert>}
        {action?.action === 'pause' && <TextField label="Motivo da pausa" value={reason} onChange={e => setReason(e.target.value)} multiline minRows={2} inputProps={{ maxLength: 1000 }} />}
        {action?.action === 'complete' && <><TextField required label="Relatório do serviço" value={report} onChange={e => setReport(e.target.value)} multiline minRows={3} inputProps={{ maxLength: 4000 }} /><FormControlLabel control={<Checkbox checked={checked} onChange={(_, value) => setChecked(value)} />} label="Confirmei a verificação e a conclusão deste serviço." /><Alert severity="info">A OS será encaminhada para conferência quando todos os serviços estiverem concluídos.</Alert></>}
        {(action?.action === 'start' || action?.action === 'resume') && <Typography variant="body2" color="text.secondary">O horário será registrado pela API.</Typography>}
      </Stack></DialogContent>
      <DialogActions><Button disabled={execute.isPending} onClick={() => setAction(null)}>Cancelar</Button><Button variant="contained" disabled={execute.isPending || action?.action === 'pause' && !reason.trim() || action?.action === 'complete' && (!checked || !report.trim())} onClick={() => execute.mutate()}>{execute.isPending ? 'Salvando…' : 'Confirmar'}</Button></DialogActions>
    </Dialog>
    <Dialog open={panel !== null} onClose={() => setPanel(null)} fullWidth maxWidth="sm">
      <DialogTitle>{panel === 'manual' ? 'Manual Técnico & Torque' : panel === 'evidence' ? 'Evidências do serviço' : 'Aparência'}</DialogTitle>
      <DialogContent>{panel === 'manual' ? <Typography>Não há manuais ou especificações de torque vinculados ao catálogo atual.</Typography> : panel === 'evidence' ? <Typography>Não há fotografias vinculadas a este serviço no cadastro atual.</Typography> : <FormControlLabel control={<Checkbox checked={dense} onChange={(_, value) => setDense(value)} />} label="Disposição compacta dos cards" />}</DialogContent>
      <DialogActions><Button onClick={() => setPanel(null)}>Fechar</Button></DialogActions>
    </Dialog>
  </Box></ThemeProvider>;
}
