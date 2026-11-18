import { effectiveSeconds, formatExecutionTime, formatExecutionDateTime } from './executionTime';
import '@fontsource/inter/500.css';
import '@fontsource/inter/700.css';
import '../consultants/consultantTypography.css';
import { useEffect, useState } from 'react';
import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Avatar, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Drawer, IconButton, InputAdornment, LinearProgress, MenuItem, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, ThemeProvider, Tooltip, Typography, createTheme } from '@mui/material';
import { Bell, CheckCheck, ClipboardCheck, ClipboardList, Clock3, Download, GitFork, KanbanSquare, LayoutDashboard, LogOut, Menu, Search, Settings, ShieldCheck, Store, TriangleAlert, Users, Warehouse, Wrench, Zap } from 'lucide-react';
import { isAxiosError } from 'axios';
import { api, mutate } from '../../services/api';
import type { RegisteredOrder } from '../administration/operationalData';

const theme = createTheme({
  palette: { primary: { main: '#2563eb' }, background: { default: '#f8f9ff', paper: '#fff' }, text: { primary: '#0b1c30', secondary: '#545f73' } },
  typography: { fontFamily: 'Inter, sans-serif', fontSize: 13, body1: { fontSize: 13, lineHeight: '20px' }, body2: { fontSize: 12, lineHeight: '18px' }, h5: { fontSize: 24, fontWeight: 600, lineHeight: '32px', letterSpacing: '-.02em' }, button: { fontSize: 12, fontWeight: 500, textTransform: 'none' } },
  shape: { borderRadius: 6 },
  components: { MuiPaper: { defaultProps: { elevation: 0 } }, MuiButton: { defaultProps: { disableElevation: true } } },
});
type Mechanic = { id: string; name: string; storeId: string | null };
type StoreOption = { id: string; name: string };
type Profile = { name: string };
const navigation = [
  ['/gerente/dashboard', 'Dashboard do Chefe', LayoutDashboard],
  ['/gerente/fila', 'Fila de OS & Triagem', ClipboardList],
  ['/gerente/distribuicao', 'Distribuição Fracionada', GitFork],
  ['/gerente/mapa-oficina', 'Mapa de Boxes', Warehouse],
  ['/gerente/kanban', 'Kanban de Produção', KanbanSquare],
  ['/gerente/conferencia', 'Qualidade & Liberação', ShieldCheck],
  ['/gerente/mecanicos', 'Equipe & TMO', Users],
] as const;
const card = { border: '1px solid #edf0f8', borderRadius: '9px', boxShadow: '0 1px 2px #0b1c3005' };
const mono = { fontFamily: '"JetBrains Mono", monospace', fontSize: 11 };
const code = (order: RegisteredOrder) => order.id.slice(0, 8).toUpperCase();
const tmo = (order: RegisteredOrder) => order.items.reduce((sum, service) => sum + service.minutes, 0);
const duration = (minutes: number) => minutes >= 60 ? Math.floor(minutes / 60) + 'h ' + String(minutes % 60).padStart(2, '0') + 'm' : minutes + 'm';
const pending = (order: RegisteredOrder) => order.items.some(item => !item.mechanicId);
const state = (order: RegisteredOrder) => order.status ?? (pending(order) ? 'Aguardando distribuição' : 'Atribuída');

function exportOrders(orders: RegisteredOrder[]) {
  const quote = (value: string | number) => '"' + String(value).replaceAll('"', '""') + '"';
  const lines = [['OS', 'Veículo', 'Placa', 'Consultor', 'Serviço', 'Mecânico', 'TMO (min)', 'Situação'], ...orders.flatMap(order => order.items.map(service => [code(order), order.vehicle, order.plate, order.consultant, service.name, service.mechanicName ?? 'Não atribuído', service.minutes, state(order)]))];
  const url = URL.createObjectURL(new Blob(['﻿' + lines.map(line => line.map(quote).join(';')).join('\r\n')], { type: 'text/csv;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'autoflow-distribuicao.csv';
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function ManagerWorkspace({ user }: { user: Profile }) {
  const location = useLocation();
  const cache = useQueryClient();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);
  const [menuOpen, setMenuOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [storeId, setStoreId] = useState('');
  const [selected, setSelected] = useState<RegisteredOrder | null>(null);
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [confirm, setConfirm] = useState(false);
  const [review, setReview] = useState<{ order: RegisteredOrder; item: RegisteredOrder['items'][number] } | null>(null);
  const [info, setInfo] = useState<'settings' | 'alerts' | null>(null);
  const ordersQuery = useQuery({ queryKey: ['operations', 'orders'], queryFn: async () => (await api.get<RegisteredOrder[]>('/operations/orders')).data, refetchInterval: 15000 });
  const mechanicsQuery = useQuery({ queryKey: ['workshop', 'mechanics'], queryFn: async () => (await api.get<Mechanic[]>('/workshop/mechanics')).data, refetchInterval: 30000 });
  const helpRequests = useQuery({
    queryKey: ['workshop', 'help'],
    queryFn: async () => (await api.get<{ id: string; name: string; createdAt: string }[]>('/workshop/help')).data,
    refetchInterval: 15000,
  });
  const stores = useQuery({ queryKey: ['operations', 'stores'], queryFn: async () => (await api.get<StoreOption[]>('/operations/stores')).data });
  const orders = (ordersQuery.data ?? []).filter(order => (!storeId || order.storeId === storeId) && [code(order), order.customer, order.vehicle, order.plate, order.consultant, ...order.items.map(item => item.mechanicName ?? '')].join(' ').toLowerCase().includes(search.trim().toLowerCase()));
  const mechanics = (mechanicsQuery.data ?? []).filter(mechanic => !storeId || !mechanic.storeId || mechanic.storeId === storeId);
  const waiting = orders.filter(pending);
  const assigned = orders.filter(order => state(order) === 'Atribuída');
  const tasks = (ordersQuery.data ?? []).filter(order => !storeId || order.storeId === storeId).flatMap(order => order.items.map(item => ({ ...item, order })));
  const workload = (id: string) => tasks.filter(task => task.mechanicId === id && !task.completedAt);
  const completedServices = tasks.filter(item => item.completedAt);
  const readyServices = completedServices.filter(item => item.approvedAt);
  const inspectionServices = completedServices.filter(item => !item.approvedAt);
  const readyOrders = orders.filter(order => state(order) === 'Pronta');
  const available = mechanics.filter(mechanic => !workload(mechanic.id).length);
  const dashboard = location.pathname === '/gerente/dashboard';
  const queue = location.pathname === '/gerente/fila' || location.pathname === '/gerente/distribuicao';
  const map = location.pathname === '/gerente/mapa-oficina' || location.pathname === '/gerente/mecanicos';
  const kanban = location.pathname === '/gerente/kanban';
  const quality = location.pathname === '/gerente/conferencia';
  const distribution = useMutation({
    mutationFn: () => mutate('/workshop/orders/' + selected!.id + '/assignments', {
      items: selected!.items.map(item => ({ itemId: item.id, mechanicId: assignments[item.id] || null, previousMechanicId: item.mechanicId ?? null })),
    }, 'PUT'),
    onSuccess: async () => {
      setConfirm(false);
      setSelected(null);
      await cache.invalidateQueries({ queryKey: ['operations', 'orders'] });
      await cache.invalidateQueries({ queryKey: ['workshop', 'mechanics'] });
    },
  });
  const approve = useMutation({
    mutationFn: () => mutate('/workshop/services/' + review!.item.id + '/approve', { version: review!.item.executionVersion ?? 0 }),
    onSuccess: async () => {
      setReview(null);
      await cache.invalidateQueries({ queryKey: ['operations', 'orders'] });
      await cache.invalidateQueries({ queryKey: ['mechanic', 'orders'] });
    },
  });
  const approvalError = isAxiosError(approve.error) ? approve.error.response?.data?.error : undefined;
  function openReview(order: RegisteredOrder, item: RegisteredOrder['items'][number]) {
    approve.reset();
    setReview({ order, item });
  }
  const error = isAxiosError(distribution.error) ? distribution.error.response?.data?.error : undefined;
  function select(order: RegisteredOrder) {
    distribution.reset();
    setConfirm(false);
    setSelected(order);
    setAssignments(Object.fromEntries(order.items.map(item => [item.id, item.mechanicId ?? ''])));
  }
  function refresh() {
    void ordersQuery.refetch();
    void mechanicsQuery.refetch();
    void stores.refetch();
    void helpRequests.refetch();
  }
  const sidebar = <Stack sx={{ height: '100%', bgcolor: '#eff4ff', p: 1.5 }}>
    <Stack direction="row" alignItems="center" gap={1} sx={{ px: .5, height: 48, mb: 1.5 }}>
      <Avatar variant="rounded" sx={{ width: 29, height: 29, bgcolor: '#2563eb' }}><Wrench size={18} /></Avatar>
      <Box><Typography fontSize={16} fontWeight={600}>AutoFlow</Typography><Typography color="primary" fontSize={11} letterSpacing={.6} fontWeight={700}>OFICINA V2</Typography></Box>
      <Chip size="small" label="LOCAL" sx={{ ml: 'auto', height: 22, ...mono }} />
    </Stack>
    <TextField select size="small" label="Unidade" value={storeId} onChange={e => setStoreId(e.target.value)} sx={{ bgcolor: '#fff', mb: 2.5 }}>
      <MenuItem value="">Todas as lojas</MenuItem>{stores.data?.map(store => <MenuItem key={store.id} value={store.id}>{store.name}</MenuItem>)}
    </TextField>
    <Typography fontSize={11} color="text.secondary" fontWeight={600} letterSpacing={.5} mb={.5} px={1}>OPERAÇÕES DE CHÃO</Typography>
    {navigation.map(([path, label, Icon]) => <Button key={path} component={Link} to={path} onClick={() => setMenuOpen(false)} startIcon={<Icon size={17} />}
      sx={{ justifyContent: 'flex-start', py: 1, px: 1.25, mb: .25, color: location.pathname === path ? '#fff' : '#434655', bgcolor: location.pathname === path ? '#2563eb' : 'transparent', borderRadius: 1, fontSize: 13, fontWeight: location.pathname === path ? 600 : 400, '&:hover': { bgcolor: location.pathname === path ? '#1d4ed8' : '#e5eeff' } }}>{label}</Button>)}
    <Box sx={{ mt: 'auto', pt: 3 }}>
      <Paper sx={{ p: 1.25, bgcolor: '#e5eeff', mb: 1.5 }}><Typography sx={mono}>INTOSV2</Typography><Typography fontSize={11} color="text.secondary">Aguardando configuração</Typography></Paper>
      <Stack direction="row" alignItems="center" gap={1}><Avatar sx={{ bgcolor: '#004ac6', width: 32, height: 32, fontSize: 13 }}>{user.name[0]}</Avatar><Box sx={{ flex: 1 }}><Typography fontSize={12} fontWeight={600}>{user.name}</Typography><Typography fontSize={10}>Chefe de Oficina</Typography></Box>
        <Tooltip title="Sair"><IconButton aria-label="Sair" onClick={async () => { await mutate('/auth/logout'); cache.clear(); window.location.assign('/'); }}><LogOut size={17} /></IconButton></Tooltip>
      </Stack>
    </Box>
  </Stack>;

  const queuePanel = <Paper sx={{ ...card, p: 2, minWidth: 0 }}>
    <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1} mb={1.5}><Stack direction="row" alignItems="center" gap={1} flexWrap="wrap"><Box sx={{ width: 9, height: 9, bgcolor: '#ba1a1a', borderRadius: '50%' }} /><Typography fontSize={16} fontWeight={600}>{dashboard ? 'Fila Prioritária para Despacho' : 'Fila de OS & Distribuição'}</Typography><Chip label={waiting.length + ' pendências'} size="small" sx={{ height: 21, bgcolor: '#ffdad6', color: '#93000a', fontSize: 11 }} /></Stack></Stack>
    <TableContainer><Table size="small" sx={{ minWidth: 570 }} aria-label="Fila de distribuição">
      <TableHead><TableRow sx={{ bgcolor: '#eff4ff' }}>{['OS / veículo', 'Placa', 'Consultor', 'Serviço solicitado', 'TMO prev.', 'Alocação / situação', ''].map((title, i) => <TableCell key={i} sx={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#545f73', px: 1 }}>{title}</TableCell>)}</TableRow></TableHead>
      <TableBody>{(dashboard ? waiting.slice(0, 4) : orders).map(order => <TableRow key={order.id} hover>
        <TableCell sx={{ verticalAlign: 'top' }}><Button onClick={() => select(order)} sx={{ p: 0, minWidth: 0, fontWeight: 700 }}>#{code(order)}</Button><Typography variant="body2">{order.vehicle}</Typography></TableCell>
        <TableCell sx={{ verticalAlign: 'top' }}><Box component="span" sx={{ ...mono, bgcolor: '#e5eeff', p: .25 }}>{order.plate}</Box></TableCell>
        <TableCell sx={{ verticalAlign: 'top', color: 'text.secondary' }}>{order.consultant}</TableCell>
        <TableCell sx={{ verticalAlign: 'top' }}><Stack spacing={.5}>{order.items.map(item => <Box key={item.id}>
          <Typography variant="body2">{item.name}</Typography>
          {item.completedAt && !item.approvedAt ? <Button color="success" size="small" sx={{ p: 0 }} onClick={() => openReview(order, item)}>Concluído · Conferir</Button> : <Typography fontSize={10} color={item.approvedAt ? 'success.main' : 'text.secondary'}>{item.status ?? 'Aguardando início'}</Typography>}
        </Box>)}</Stack></TableCell>
        <TableCell sx={{ ...mono, fontWeight: 700, verticalAlign: 'top' }}>{duration(tmo(order))}</TableCell>
        <TableCell sx={{ verticalAlign: 'top' }}><Typography fontSize={11} color={pending(order) ? '#ba1a1a' : '#006242'}>{pending(order) ? 'Pendente do chefe' : state(order)}</Typography></TableCell>
        <TableCell sx={{ verticalAlign: 'top' }}><Button variant={pending(order) ? 'contained' : 'outlined'} size="small" sx={{ borderRadius: .5, minWidth: 70 }} onClick={() => select(order)}>{pending(order) ? 'Distribuir' : 'Reatribuir'}</Button></TableCell>
      </TableRow>)}</TableBody>
    </Table></TableContainer>
    {!ordersQuery.isPending && (dashboard ? !waiting.length : !orders.length) && <Typography py={3} fontSize={12} color="text.secondary">Nenhuma OS aguardando nesta seleção.</Typography>}
    <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1} mt={2}><Typography fontSize={11} color="text.secondary">Atualização automática a cada 15 segundos</Typography><Button component={Link} to="/gerente/fila">Ver todas as {orders.length} ordens →</Button></Stack>
  </Paper>;
  const mapPanel = <Paper sx={{ ...card, p: 2 }}>
    <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={1} mb={2}><Box><Typography fontSize={16} fontWeight={600}>Mapa Operacional da Oficina ({mechanics.length} técnicos)</Typography><Typography variant="body2" color="text.secondary">Tempo efetivo dos serviços por mecânico, descontando as pausas.</Typography></Box><Stack direction="row" gap={1} alignItems="center"><Chip size="small" label={(mechanics.length - available.length) + ' com tarefas'} color="primary" variant="outlined" /><Chip size="small" label={available.length + ' disponíveis'} color="success" variant="outlined" /></Stack></Stack>
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2,minmax(0,1fr))', xl: 'repeat(4,minmax(0,1fr))' }, gap: 2 }}>
      {mechanics.map((mechanic, index) => {
        const services = workload(mechanic.id);
        const technicianServices = tasks.filter(service => service.mechanicId === mechanic.id);
        return <Box key={mechanic.id} sx={{ p: 2.5, height: 280, boxSizing: 'border-box', minWidth: 0, overflow: 'hidden', bgcolor: services.length ? '#eff4ff' : '#fff', border: services.length ? '1px solid transparent' : '1px dashed #80bbaa', borderRadius: 2, display: 'flex', flexDirection: 'column' }}>
          <Stack direction="row" justifyContent="space-between"><Typography sx={{ ...mono, fontWeight: 700 }}>T-{String(index + 1).padStart(2, '0')}</Typography><Box sx={{ mt: .4, width: 7, height: 7, borderRadius: '50%', bgcolor: services.length ? '#2563eb' : '#007d55' }} /></Stack>
          <Typography fontSize={16} fontWeight={600} mt={2}>{mechanic.name}</Typography><Typography fontSize={12} color="text.secondary">{services.length ? services.length + ' serviços atribuídos' : 'Disponível para atribuição'}</Typography>
          <Box tabIndex={0} role="region" aria-label={'Serviços de ' + mechanic.name} sx={{ flex: 1, minHeight: 0, overflowY: 'auto', mt: 1, pr: .75, scrollbarWidth: 'thin', scrollbarColor: '#b7c8ed transparent', '&::-webkit-scrollbar': { width: 5 }, '&::-webkit-scrollbar-thumb': { bgcolor: '#b7c8ed', borderRadius: 3 } }}>
          {technicianServices.map(service => <Box key={service.id} sx={{ mt: 1, pt: 1, borderTop: '1px solid #dfe7f4', display: 'grid', gridTemplateColumns: '1fr auto', columnGap: 1 }}>
            <Button size="small" sx={{ p: 0, justifyContent: 'flex-start', fontSize: 12, gridColumn: '1 / -1' }} onClick={() => select(service.order)}>#{code(service.order)}</Button>
            <Typography fontSize={12} color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>{service.name}</Typography>
            <Box sx={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'auto minmax(0,1fr)', columnGap: 1, rowGap: .5, mt: 1 }}>
              <Typography variant="caption" color="text.secondary">Iniciado em:</Typography><Typography sx={{ ...mono, fontSize: 10, textAlign: 'right' }}>{formatExecutionDateTime(service.startedAt)}</Typography>
              <Typography variant="caption" color="text.secondary">Finalizado em:</Typography><Typography sx={{ ...mono, fontSize: 10, textAlign: 'right' }}>{formatExecutionDateTime(service.completedAt)}</Typography>
              <Typography variant="caption" color="text.secondary">Realizado em:</Typography><Typography sx={{ ...mono, fontSize: 10, textAlign: 'right' }}>{service.startedAt ? formatExecutionTime(effectiveSeconds(service, now)) : 'Não iniciado'}</Typography>
            </Box>
          </Box>)}
          </Box>
        </Box>;
      })}
    </Box>
    {!mechanics.length && <Typography py={2} variant="body2" color="text.secondary">{mechanicsQuery.isPending ? 'Carregando mecânicos…' : 'Cadastre mecânicos em Usuários e Perfis para distribuir os serviços.'}</Typography>}
  </Paper>;
  const qualityPanel = <Paper sx={{ ...card, p: { xs: 2, md: 2.5 }, width: '100%', boxSizing: 'border-box' }}>
    <Stack direction={{ xs: 'column', sm: 'row' }} gap={2} alignItems={{ sm: 'center' }} justifyContent="space-between">
      <Box><Stack direction="row" gap={1} alignItems="center"><ClipboardCheck size={20} color="#2563eb" /><Typography fontSize={18} fontWeight={600}>Auditoria Técnica Final</Typography></Stack>
      <Typography variant="body2" color="text.secondary" mt={.75}>Conferência do chefe de oficina antes da entrega ao consultor.</Typography></Box>
      <Stack direction="row" gap={1} flexWrap="wrap"><Chip size="small" label={inspectionServices.length + ' para conferir'} color="primary" variant="outlined" /><Chip size="small" label={readyServices.length + ' prontos'} color="success" variant="outlined" /></Stack>
    </Stack>
    <Stack gap={1.5} mt={2.5}>
      {[...inspectionServices, ...readyServices].map(service => <Box key={service.id} sx={{ p: { xs: 2, md: 2.5 }, bgcolor: service.approvedAt ? '#f0faf5' : '#f3f6ff', border: '1px solid', borderColor: service.approvedAt ? '#d9eee2' : '#e4eafa', borderRadius: 2, display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'minmax(0,1.4fr) minmax(0,1fr) auto auto' }, gap: { xs: 1.5, md: 3 }, alignItems: 'center' }}>
        <Box><Typography sx={{ ...mono, color: 'primary.main', mb: .5 }}>OS #{code(service.order)}</Typography><Typography fontSize={16} fontWeight={600}>{service.order.vehicle}</Typography></Box>
        <Box><Typography fontSize={14} fontWeight={500}>{service.name}</Typography><Typography variant="body2" color="text.secondary" mt={.5}>{service.mechanicName ?? 'Mecânico não informado'}</Typography></Box>
        <Box sx={{ pr: { md: 2 }, borderRight: { md: '1px solid #dce4f1' } }}><Typography variant="caption" color="text.secondary">Tempo realizado</Typography><Typography sx={{ ...mono, fontSize: 18, fontWeight: 600, mt: .5 }}>{formatExecutionTime(effectiveSeconds(service, now))}</Typography></Box>
        {service.approvedAt ? <Chip size="small" color="success" variant="outlined" label="Pronto · Conferido" /> : <Button variant="contained" size="medium" startIcon={<CheckCheck size={17} />} sx={{ justifySelf: { xs: 'start', md: 'end' }, whiteSpace: 'nowrap', boxShadow: 'none', borderRadius: 1.5, px: 2, py: 1 }} onClick={() => openReview(service.order, service)}>Conferir serviço</Button>}
      </Box>)}
      {!inspectionServices.length && !readyServices.length && <Typography variant="body2" color="text.secondary" py={2}>Nenhum serviço concluído aguardando conferência.</Typography>}
    </Stack>
    <Typography variant="caption" display="block" mt={2} color="text.secondary">Responsável · {user.name}</Typography>
  </Paper>;
  const loadPanel = <Paper sx={{ ...card, p: 2 }}>
    <Stack direction="row" justifyContent="space-between" gap={1}><Typography fontSize={16} fontWeight={600}>Balanço de Carga Horária de Produção</Typography><Chip label="TMO previsto" size="small" sx={{ bgcolor: '#e5eeff', ...mono }} /></Stack>
    <Typography variant="body2" color="text.secondary" mb={3}>Tempo padrão dos serviços ainda atribuídos por técnico.</Typography>
    <Stack gap={2}>{mechanics.map(mechanic => {
      const minutes = workload(mechanic.id).reduce((sum, item) => sum + item.minutes, 0);
      const max = Math.max(1, ...mechanics.map(m => workload(m.id).reduce((sum, item) => sum + item.minutes, 0)));
      return <Box key={mechanic.id}><Stack direction="row" justifyContent="space-between" mb={.5}><Typography fontSize={12}>{mechanic.name}</Typography><Typography sx={mono}>{duration(minutes)}</Typography></Stack><LinearProgress variant="determinate" value={minutes * 100 / max} sx={{ height: 5, borderRadius: 1, bgcolor: '#eff4ff' }} /></Box>;
    })}{!mechanics.length && <Typography variant="body2" color="text.secondary">Aguardando cadastro de mecânicos.</Typography>}</Stack>
  </Paper>;

  return <ThemeProvider theme={theme}><Box sx={{ minHeight: '100vh', bgcolor: '#f8f9ff', color: '#0b1c30', '& .MuiTableCell-root': { fontSize: 12, py: 2, px: 1 }, '& .MuiTypography-root': { fontVariantNumeric: 'tabular-nums' } }}>
    <Box component="nav" sx={{ position: 'fixed', inset: '0 auto 0 0', width: 256, display: { xs: 'none', lg: 'block' } }}>{sidebar}</Box>
    <Drawer open={menuOpen} onClose={() => setMenuOpen(false)} slotProps={{ paper: { sx: { width: 256 } } }}>{sidebar}</Drawer>
    <Box sx={{ ml: { lg: '256px' } }}>
      <Stack component="header" direction="row" alignItems="center" gap={2} sx={{ px: { xs: 1.5, md: 4 }, height: 64, bgcolor: '#f8f9ff', borderBottom: '1px solid #edf0f8' }}>
        <IconButton aria-label="Abrir menu" onClick={() => setMenuOpen(true)} sx={{ display: { lg: 'none' } }}><Menu size={20} /></IconButton>
        <TextField size="small" placeholder="Buscar OS, placa ou técnico..." value={search} onChange={e => setSearch(e.target.value)} sx={{ width: { xs: '100%', sm: 290 }, bgcolor: '#fff', '& fieldset': { border: 0 } }} slotProps={{ input: { startAdornment: <InputAdornment position="start"><Search size={16} /></InputAdornment> } }} />
        <Typography variant="caption" sx={{ display: { xs: 'none', md: 'block' }, whiteSpace: 'nowrap' }}>TÉCNICOS COM TAREFAS <strong>{mechanics.length - available.length}/{mechanics.length}</strong></Typography>
        <Box flex={1} />
        <Chip label="Stellantis · Não configurado" size="small" sx={{ display: { xs: 'none', xl: 'flex' }, bgcolor: '#eff4ff', fontSize: 10 }} />
        <Tooltip title="Pendências da oficina"><IconButton aria-label="Pendências" onClick={() => setInfo('alerts')}><Bell size={19} /></IconButton></Tooltip>
        <Tooltip title="Configuração da operação"><IconButton aria-label="Configuração" onClick={() => setInfo('settings')}><Settings size={19} /></IconButton></Tooltip>
        <Avatar sx={{ width: 32, height: 32, bgcolor: '#004ac6', fontSize: 13 }}>{user.name[0]}</Avatar>
      </Stack>
      <Box component="main" sx={{ px: { xs: 1.5, sm: 3, lg: 4 }, py: 2 }}>
        <Routes><Route path="/" element={<Navigate to="/gerente/dashboard" replace />} /></Routes>
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'center' }} gap={2} mb={2}>
          <Box><Stack direction="row" gap={1} alignItems="center" flexWrap="wrap"><Typography variant="h5" component="h1">Painel Executivo do Chefe</Typography><Chip label="OPERAÇÃO LOCAL" size="small" sx={{ ...mono, bgcolor: '#e5eeff', height: 23 }} /></Stack><Stack direction="row" alignItems="center" gap={.75} mt={1}><Clock3 size={13} /><Typography variant="caption" color="text.secondary">{stores.data?.find(store => store.id === storeId)?.name ?? 'Todas as unidades'} · {new Date().toLocaleDateString('pt-BR')}</Typography></Stack></Box>
          <Stack direction="row" gap={1}><Button variant="outlined" startIcon={<Download size={16} />} onClick={() => exportOrders(orders)} disabled={!orders.length} sx={{ bgcolor: '#fff' }}>Exportar distribuição</Button><Button variant="contained" startIcon={<Zap size={16} />} component={Link} to="/gerente/distribuicao">Despacho Rápido</Button></Stack>
        </Stack>
        {(ordersQuery.isError || mechanicsQuery.isError) && <Alert severity="error" sx={{ mb: 2 }} action={<Button onClick={refresh}>Atualizar</Button>}>Não foi possível carregar os dados da oficina. Confira se a API atual está em execução.</Alert>}
        {ordersQuery.isPending && <LinearProgress sx={{ mb: 2 }} />}
        {(dashboard || location.pathname === '/') && <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(3,minmax(0,1fr))', sm: 'repeat(5,minmax(0,1fr))', lg: 'repeat(9,minmax(0,1fr))' }, gap: .5, mb: 2 }}>
          {[
            ['OS recebidas', orders.length, 'Na unidade', '#0b1c30'],
            ['Triagem', waiting.length, 'Aguardando chefe', '#ba1a1a'],
            ['Atribuídas', assigned.length, 'Aguardando execução', '#004ac6'],
            ['Risco TMO', '—', 'Previsão não registrada', '#ba1a1a'],
            ['Prontas', readyOrders.length, readyServices.length + ' serviços prontos', '#006242'],
            ['CQ chefe', inspectionServices.length, 'Serviços para conferir', '#004ac6'],
            ['Mecânicos', available.length + '/' + mechanics.length, 'Sem tarefas atribuídas', '#0b1c30'],
            ['TMO global', duration(tasks.reduce((sum, task) => sum + task.minutes, 0)), 'Tempo previsto', '#006242'],
            ['Tempo médio', orders.length ? duration(Math.round(tasks.reduce((sum, task) => sum + task.minutes, 0) / orders.length)) : '—', 'Previsto por OS', '#0b1c30'],
          ].map(([title, value, caption, color]) => <Paper key={title} sx={{ ...card, p: 1, minHeight: 94, borderRadius: .75 }}><Typography sx={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: .4, color: String(color) }}>{title}</Typography><Typography sx={{ fontSize: 21, fontWeight: 600, my: .5, color: String(color) }}>{ordersQuery.isPending ? '—' : value}</Typography><Typography fontSize={10} color="text.secondary">{caption}</Typography></Paper>)}
        </Box>}
        <Stack spacing={2}>
          {(dashboard || queue) && <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'minmax(0,2.05fr) minmax(260px,1fr)' }, gap: 2 }}>
            {queuePanel}
            <Paper sx={{ ...card, p: 2, display: 'flex', flexDirection: 'column' }}>
              <Stack direction="row" alignItems="center" gap={.75}><TriangleAlert size={17} color="#ba1a1a" /><Typography fontSize={16} fontWeight={600}>Gargalos em Tempo Real</Typography></Stack><Typography variant="body2" color="text.secondary" mt={1}>Pendências que aguardam distribuição do chefe.</Typography>
              <Stack gap={1} mt={1.5}>
                {(helpRequests.data ?? []).slice(0, 3).map(request => <Box key={request.id} sx={{ bgcolor: '#ffefef', p: 1.25, borderRadius: .5 }}>
                  <Typography fontSize={10} color="error.main">MECÂNICO SOLICITOU SUPORTE</Typography><Typography fontSize={12} fontWeight={600}>{request.name}</Typography>
                  <Typography variant="caption">{new Date(request.createdAt).toLocaleString('pt-BR')}</Typography>
                </Box>)}
                {waiting.slice(0, 3).map(order => <Box key={order.id} sx={{ bgcolor: '#eff4ff', p: 1.25, borderRadius: .5 }}>
                <Typography fontSize={10} color="#ba1a1a">AGUARDANDO DISTRIBUIÇÃO</Typography><Typography fontSize={12} fontWeight={600} my={.5}>{order.vehicle} · #{code(order)}</Typography><Typography fontSize={12} color="text.secondary">{order.items.filter(item => !item.mechanicId).length} serviços sem mecânico atribuído.</Typography><Button size="small" onClick={() => select(order)} sx={{ p: 0, mt: 1 }}>Distribuir serviços</Button>
              </Box>)}{!waiting.length && <Typography variant="body2" color="text.secondary">Nenhuma pendência de distribuição.</Typography>}</Stack>
              <Button onClick={refresh} sx={{ mt: 'auto', pt: 2 }}>Atualizar oficina</Button>
            </Paper>
          </Box>}
          {(dashboard || queue || quality) && qualityPanel}
          {(dashboard || map) && mapPanel}
          {kanban && <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2,minmax(0,1fr))' }, gap: 2 }}>{['Aguardando distribuição', 'Atribuído'].map(column => <Paper key={column} sx={{ ...card, p: 2 }}><Typography fontWeight={600} mb={2}>{column}</Typography><Stack spacing={1}>{tasks.filter(task => column === 'Atribuído' ? task.mechanicId : !task.mechanicId).map(task => <Paper key={task.id} sx={{ p: 1.5, bgcolor: '#eff4ff' }}><Typography fontSize={12} fontWeight={600}>{task.name}</Typography><Typography variant="body2">#{code(task.order)} · {task.order.vehicle}</Typography><Typography variant="caption">{task.mechanicName ?? 'Aguardando chefe'} · {duration(task.minutes)}</Typography><Button fullWidth size="small" onClick={() => select(task.order)}>Gerenciar distribuição</Button></Paper>)}</Stack></Paper>)}</Box>}
          {(dashboard || map) && loadPanel}
        </Stack>
      </Box>
    </Box>

    <Dialog open={selected !== null} onClose={() => { if (!distribution.isPending) setSelected(null); }} fullWidth maxWidth="md">
      {selected && <><DialogTitle>Distribuição Fracionada · OS #{code(selected)}</DialogTitle><DialogContent>
        <Typography variant="body2" mb={2}>{selected.customer} · {selected.vehicle} · {selected.plate}</Typography>
        <Alert severity="info" sx={{ mb: 2 }}>Cada serviço pode ter um mecânico diferente. Serviços sem responsável continuam pendentes do chefe.</Alert>
        {mechanicsQuery.isError && <Alert severity="error">Não foi possível carregar os mecânicos.</Alert>}
        {distribution.isError && <Alert severity="error" sx={{ mb: 2 }}>{typeof error === 'string' ? error : 'Não foi possível salvar a distribuição.'}</Alert>}
        <Stack spacing={1.5}>{selected.items.map(item => <Paper key={item.id} variant="outlined" sx={{ p: 1.5 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} gap={2} alignItems={{ sm: 'center' }}>
            <Box flex={1}><Typography fontSize={13} fontWeight={600}>{item.name}</Typography><Typography variant="caption">TMO {duration(item.minutes)}{item.mechanicName ? ' · Atual ' + item.mechanicName : ''}</Typography></Box>
            <TextField select size="small" label="Mecânico responsável" slotProps={{ inputLabel: { shrink: true }, select: { displayEmpty: true } }} value={assignments[item.id] ?? ''} disabled={distribution.isPending || mechanicsQuery.isPending} onChange={e => setAssignments(current => ({ ...current, [item.id]: e.target.value }))} sx={{ minWidth: { sm: 270 } }}>
              <MenuItem value="">Aguardando atribuição</MenuItem>
              {(mechanicsQuery.data ?? []).map(mechanic => <MenuItem key={mechanic.id} value={mechanic.id}>{mechanic.name} · {mechanic.storeId ? stores.data?.find(store => store.id === mechanic.storeId)?.name ?? 'Loja vinculada' : 'Sem loja vinculada'} · {(ordersQuery.data ?? []).flatMap(order => order.items).filter(service => service.mechanicId === mechanic.id).length} tarefas</MenuItem>)}
              {item.mechanicId && !(mechanicsQuery.data ?? []).some(mechanic => mechanic.id === item.mechanicId) && <MenuItem value={item.mechanicId} disabled>{item.mechanicName} · indisponível</MenuItem>}
            </TextField>
          </Stack>
        </Paper>)}</Stack>
      </DialogContent><DialogActions><Button disabled={distribution.isPending} onClick={() => setSelected(null)}>Cancelar</Button><Button variant="contained" disabled={distribution.isPending || mechanicsQuery.isPending || mechanicsQuery.isError} onClick={() => {
        const changed = selected.items.some(item => item.mechanicId && item.mechanicId !== (assignments[item.id] || null));
        if (changed) setConfirm(true);
        else distribution.mutate();
      }}>{distribution.isPending ? 'Salvando…' : 'Salvar distribuição'}</Button></DialogActions></>}
    </Dialog>
    <Dialog open={review !== null} onClose={() => { if (!approve.isPending) setReview(null); }} fullWidth maxWidth="sm">
      <DialogTitle>Conferir serviço concluído</DialogTitle>
      <DialogContent>{review && <Stack spacing={1.5}>
        <Typography fontWeight={600}>{review.item.name}</Typography>
        <Typography variant="body2">OS #{code(review.order)} · {review.order.vehicle} · {review.order.plate}</Typography>
        <Typography variant="body2">Mecânico · {review.item.mechanicName ?? 'Não informado'}</Typography>
        <Typography variant="body2">Conclusão · {review.item.completedAt ? new Date(review.item.completedAt.endsWith('Z') ? review.item.completedAt : review.item.completedAt + 'Z').toLocaleString('pt-BR') : 'Não informada'}</Typography>
        <Paper variant="outlined" sx={{ p: 1.5 }}><Typography variant="caption">Relatório do mecânico</Typography><Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{review.item.report ?? 'Não informado'}</Typography></Paper>
        <Alert severity="info">Ao confirmar a conferência, este serviço ficará pronto. A OS ficará pronta quando todos os serviços forem conferidos.</Alert>
        {approve.isError && <Alert severity="error">{typeof approvalError === 'string' ? approvalError : 'Não foi possível confirmar. Atualize os dados e tente novamente.'}</Alert>}
      </Stack>}</DialogContent>
      <DialogActions><Button disabled={approve.isPending} onClick={() => setReview(null)}>Voltar</Button><Button disabled={approve.isPending} color="success" variant="contained" onClick={() => approve.mutate()}>{approve.isPending ? 'Salvando…' : 'Conferir e marcar como pronto'}</Button></DialogActions>
    </Dialog>
    <Dialog open={confirm} onClose={() => { if (!distribution.isPending) setConfirm(false); }}><DialogTitle>Confirmar reatribuição</DialogTitle><DialogContent><Typography>A distribuição atual será atualizada com os responsáveis selecionados.</Typography></DialogContent><DialogActions><Button disabled={distribution.isPending} onClick={() => setConfirm(false)}>Voltar</Button><Button disabled={distribution.isPending} variant="contained" onClick={() => distribution.mutate()}>Confirmar</Button></DialogActions></Dialog>
    <Dialog open={info !== null} onClose={() => setInfo(null)}><DialogTitle>{info === 'alerts' ? 'Pendências da Oficina' : 'Configuração da Operação'}</DialogTitle><DialogContent><Typography>{info === 'alerts' ? waiting.length + ' ordens aguardam atribuição. ' + (helpRequests.data?.length ?? 0) + ' solicitações de suporte registradas pelos mecânicos.' : 'As lojas e os mecânicos são cadastrados pelo Master. As integrações Stellantis e os boxes físicos aguardam configuração.'}</Typography></DialogContent><DialogActions><Button onClick={() => setInfo(null)}>Fechar</Button></DialogActions></Dialog>
  </Box></ThemeProvider>;
}
