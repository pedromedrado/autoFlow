import '@fontsource/inter/500.css';
import '@fontsource/inter/700.css';
import './consultantTypography.css';
import { useEffect, useState } from 'react';
import { Link, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Drawer, IconButton, InputAdornment, LinearProgress, MenuItem, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TablePagination, TableRow, TextField, Tooltip, Typography, ThemeProvider, createTheme } from '@mui/material';
import { Bell, CarFront, ChartNoAxesCombined, CircleCheck, CircleHelp, ClipboardList, FilePlus2, Gauge, LayoutDashboard, LogOut, Menu, PackageCheck, Plus, RefreshCw, Search, ShieldCheck, Store, Timer, TriangleAlert, Users, Wrench } from 'lucide-react';
import { api, mutate } from '../../services/api';
import { OperationsPage } from '../administration/OperationsPage';
import { toOperationalOrder, type RegisteredOrder, type Order } from '../administration/operationalData';

const consultantTheme = createTheme({
  palette: {
    primary: { main: '#004ac6' },
    background: { default: '#f8f9ff', paper: '#ffffff' },
    text: { primary: '#0b1c30', secondary: '#434655' },
  },
  typography: {
    fontFamily: 'Inter, sans-serif',
    fontSize: 13,
    body1: { fontSize: 13, lineHeight: '20px' },
    body2: { fontSize: 12, lineHeight: '18px' },
    caption: { fontSize: 11, lineHeight: '16px' },
    h5: { fontSize: 24, lineHeight: '32px', fontWeight: 600, letterSpacing: '-.02em' },
    button: { fontSize: 13, fontWeight: 500, lineHeight: '18px', letterSpacing: '-.005em', textTransform: 'none' },
  },
  shape: { borderRadius: 6 },
  components: {
    MuiButton: { defaultProps: { disableElevation: true } },
    MuiPaper: { defaultProps: { elevation: 0 } },
  },
});

const panelIsQueue = (path: string) => path === '/consultor/fila';

type Profile = { name: string; email: string };
type StoreOption = { id: string; name: string; city: string };
const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 2 });
const date = (value: Date) => value.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
const nav = [
  { path: '/consultor/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/consultoria-os', label: 'Ordens de Serviço', icon: ClipboardList },
  { path: '/consultor/clientes-veiculos', label: 'Clientes & Veículos', icon: Users },
  { path: '/consultor/catalogo', label: 'Orçamentos & TMO', icon: ClipboardList },
  { path: '/consultor/fila', label: 'Fila da Oficina', icon: Wrench },
  { path: '/consultor/garantia', label: 'Garantia & Alertas Stellantis', icon: ShieldCheck },
];

export function ConsultantWorkspace({ user }: { user: Profile }) {
  const location = useLocation();
  const navigate = useNavigate();
  const cache = useQueryClient();
  const [mobile, setMobile] = useState(false);
  const [storeId, setStoreId] = useState('');
  const [search, setSearch] = useState('');
  const [scope, setScope] = useState('all');
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [help, setHelp] = useState(false);
  const [notice, setNotice] = useState(false);
  const stores = useQuery({ queryKey: ['operations', 'stores'], queryFn: async () => (await api.get<StoreOption[]>('/operations/stores')).data });
  const orders = useQuery({ queryKey: ['operations', 'orders'], queryFn: async () => (await api.get<RegisteredOrder[]>('/operations/orders')).data, refetchInterval: 15000 });
  const all = (orders.data ?? []).map(toOperationalOrder);
  const selected = all.find(order => order.id === selectedId) ?? null;
  const unit = all.filter(order => !storeId || order.storeId === storeId);
  const normalize = (value: string) => value.normalize('NFD').replace(/\p{Diacritic}/gu, '').trim().toLocaleLowerCase('pt-BR');
  const mine = unit.filter(order => normalize(order.consultant) === normalize(user.name));
  const filtered = (scope === 'mine' ? mine : unit).filter(order => (panelIsQueue(location.pathname) ? order.status === 'Aguardando distribuição' : true)).filter(order => [order.number, order.plate, order.client, order.vehicle, order.consultant].join(' ').toLowerCase().includes(search.toLowerCase().trim()));
  const pageIndex = Math.min(page, Math.max(0, Math.ceil(filtered.length / 4) - 1));
  const latest = [...unit].sort((a, b) => +b.opened - +a.opened).slice(0, 3);
  const store = stores.data?.find(item => item.id === storeId);
  const finishedServices = unit.flatMap(order => order.services).filter(service => service.end);
  const readyServices = finishedServices.filter(service => service.approvedAt);
  const readyOrders = unit.filter(order => order.status === 'Pronta');
  const today = new Date().toLocaleDateString('sv-SE');
  const total = unit.reduce((sum, order) => sum + order.amount, 0);
  const stats = [
    { title: 'Abertas hoje', value: unit.filter(order => order.opened.toLocaleDateString('sv-SE') === today).length, caption: 'na unidade', icon: FilePlus2 },
    { title: 'Oficina ativa', value: unit.filter(order => order.status === 'Em andamento').length, caption: 'em execução', icon: Wrench },
    { title: 'Aguard. chefe', value: unit.filter(order => order.status === 'Aguardando distribuição').length, caption: 'Aguardando distribuição', icon: Users },
    { title: 'Concluídas', value: unit.filter(order => order.services.length && order.services.every(service => service.end)).length, caption: finishedServices.length + ' serviços concluídos', icon: CircleCheck },
    { title: 'Gargalo / OS', value: '—', caption: 'Previsões não registradas', icon: TriangleAlert, tone: 'red' },
    { title: 'Prontas', value: readyOrders.length, caption: readyServices.length + ' serviços conferidos', icon: PackageCheck },
    { title: 'Retirada', value: '—', caption: 'Retirada não registrada', icon: ChartNoAxesCombined },
    { title: 'Ticket médio', value: currency.format(unit.length ? total / unit.length : 0), caption: 'Valor previsto', icon: Gauge, tone: 'blue' },
  ];
  const card = { border: '1px solid #edf0f8', borderRadius: '10px', boxShadow: '0 1px 2px #0b1c3005' };
  const panel = location.pathname;
  useEffect(() => {
    if (location.pathname === '/consultor/dashboard') {
      setSearch('');
      setPage(0);
      void cache.invalidateQueries({ queryKey: ['operations', 'orders'] });
    }
  }, [location.pathname, cache]);

  function orderCreated() {
    setSearch('');
    setStoreId('');
    setScope('mine');
    setPage(0);
    navigate('/consultor/dashboard', { replace: true });
  }

  function clearFilters() {
    setSearch('');
    setStoreId('');
    setScope('all');
    setPage(0);
  }

  function refresh() { void orders.refetch(); void stores.refetch(); }
  const menu = <Stack sx={{ height: '100%', p: 1.5, bgcolor: '#eff4ff' }}>
    <Stack direction="row" alignItems="center" gap={1} mb={3} px={.5}>
      <Box sx={{ p: .75, bgcolor: '#004ac6', color: 'white', borderRadius: 1, display: 'flex' }}><CarFront size={21} /></Box>
      <Box><Typography fontWeight={600}>AutoFlow</Typography><Typography sx={{ fontSize: 10, color: '#004ac6', letterSpacing: 1 }}>V2 STELLANTIS</Typography></Box>
      <Chip size="small" label="CORE" sx={{ ml: 'auto', fontSize: 10, borderRadius: .5 }} />
    </Stack>
    <Typography sx={{ fontSize: 10, color: '#545f73', letterSpacing: .7, px: 1, mb: .5 }}>NAVEGAÇÃO OPERACIONAL</Typography>
    {nav.map(({ path, label, icon: Icon }) => <Button key={path} component={Link} to={path} onClick={() => setMobile(false)}
      startIcon={<Icon size={17} />} sx={{ justifyContent: 'flex-start', textAlign: 'left', fontSize: 12, minHeight: 38, px: 1.25, mb: .25, borderRadius: 1, color: panel === path ? 'white' : '#1e293b', bgcolor: panel === path ? '#2563eb' : 'transparent', '&:hover': { bgcolor: panel === path ? '#1d4ed8' : '#e5eeff' } }}>{label}</Button>)}
    <Paper sx={{ ...card, mt: 'auto', p: 1.5 }}><Typography fontSize={11} fontWeight={600}>Gateway Stellantis</Typography><Typography fontSize={11} color="text.secondary" mt={.5}>Integração aguardando configuração.</Typography></Paper>
  </Stack>;

  return <ThemeProvider theme={consultantTheme}><Box sx={{ bgcolor: '#f8f9ff', color: '#0b1c30', minHeight: '100vh', fontSize: 13, fontFamily: 'Inter, sans-serif', '& .MuiButton-root': { textTransform: 'none', fontSize: 12 }, '& .MuiTableCell-root': { fontSize: 12, px: 1.25, py: 1.5 }, '& .MuiTypography-root': { fontVariantNumeric: 'tabular-nums' } }}>
    <Box sx={{ display: { xs: 'none', lg: 'block' }, width: 240, position: 'fixed', inset: '0 auto 0 0' }}>{menu}</Box>
    <Drawer open={mobile} onClose={() => setMobile(false)} slotProps={{ paper: { sx: { width: 240 } } }}>{menu}</Drawer>
    <Box sx={{ ml: { lg: '240px' } }}>
      <Stack component="header" direction="row" alignItems="center" gap={1.5} sx={{ minHeight: 60, px: { xs: 2, md: 3 }, bgcolor: '#fff', borderBottom: '1px solid #edf0f8', flexWrap: 'wrap', py: 1 }}>
        <IconButton aria-label="Abrir menu" onClick={() => setMobile(true)} sx={{ display: { lg: 'none' } }}><Menu size={20} /></IconButton>
        <Store size={17} color="#004ac6" />
        <TextField size="small" select aria-label="Unidade" value={storeId} onChange={e => { setStoreId(e.target.value); setPage(0); }} sx={{ minWidth: 170, '& fieldset': { border: 0 }, bgcolor: '#eff4ff' }}>
          <MenuItem value="">Todas as unidades</MenuItem>{stores.data?.map(item => <MenuItem key={item.id} value={item.id}>{item.name}</MenuItem>)}
        </TextField>
        <Chip size="small" label="INTOSV2 · Não configurado" sx={{ display: { xs: 'none', md: 'flex' }, fontFamily: '"JetBrains Mono", monospace', fontSize: 11, bgcolor: '#f8f9ff' }} />
        <TextField size="small" placeholder="Buscar por placa, cliente ou OS" value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} sx={{ flex: 1, minWidth: 180, maxWidth: 330, bgcolor: '#eff4ff', '& fieldset': { border: 0 } }} slotProps={{ input: { startAdornment: <InputAdornment position="start"><Search size={16} /></InputAdornment> } }} />
        <Box sx={{ flex: 1, display: { xs: 'none', md: 'block' } }} />
        <Tooltip title="Eventos de abertura"><IconButton aria-label="Eventos de abertura" onClick={() => setNotice(true)}><Bell size={18} /></IconButton></Tooltip>
        <Tooltip title="Ajuda"><IconButton aria-label="Ajuda" onClick={() => setHelp(true)}><CircleHelp size={18} /></IconButton></Tooltip>
        <Stack alignItems="flex-end" sx={{ display: { xs: 'none', sm: 'flex' } }}><Typography fontSize={12} fontWeight={600}>{user.name}</Typography><Typography fontSize={10}>Consultor Técnico</Typography></Stack>
        <Tooltip title="Sair"><IconButton aria-label="Sair" onClick={async () => { await mutate('/auth/logout'); cache.clear(); window.location.assign('/'); }}><LogOut size={18} /></IconButton></Tooltip>
      </Stack>
      <Box component="main" sx={{ p: { xs: 1.5, sm: 3, xl: 4 } }}>
        <Routes>
          <Route path="/" element={<Navigate to="/consultor/dashboard" replace />} />
          <Route path="/consultoria-os" element={<OperationsPage area="orders" canCreate onOrderCreated={orderCreated} />} />
          <Route path="/consultor/ordens-servico/*" element={<OperationsPage area="orders" canCreate onOrderCreated={orderCreated} />} />
          <Route path="*" element={<>
            <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" gap={2} mb={3}>
              <Box><Typography sx={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 11, color: '#004ac6', letterSpacing: .7 }}>BANCADA OPERACIONAL // STELLANTIS TECHHUB</Typography>
                <Typography component="h1" variant="h5" fontWeight={600} mt={.5}>Olá, {user.name} <Typography component="span" fontSize={12} color="text.secondary">(Consultor Técnico{store ? ' · ' + store.name : ''})</Typography></Typography></Box>
              <Stack direction="row" gap={1} alignItems="center"><Button variant="outlined" startIcon={<RefreshCw size={15} />} onClick={refresh} disabled={orders.isFetching}>Atualizar OS</Button><Button variant="contained" component={Link} to="/consultoria-os?nova=1" startIcon={<Plus size={16} />}>Nova Ordem de Serviço (+ OS)</Button></Stack>
            </Stack>
            {orders.isError && <Alert severity="error" sx={{ mb: 2 }} action={<Button onClick={refresh}>Tentar novamente</Button>}>Não foi possível carregar as ordens de serviço.</Alert>}
            {panel === '/consultor/catalogo' ? <OperationsPage area="services" canCreate={false} /> :
              panel === '/consultor/garantia' ? <Paper sx={{ ...card, p: 3 }}><Typography variant="h6">Garantia & Alertas Stellantis</Typography><Alert severity="info" sx={{ mt: 2 }}>INTOSV2_STELLANTIS e alertas de garantia aguardam configuração e integração.</Alert></Paper> :
                panel === '/consultor/clientes-veiculos' ? <Paper sx={{ ...card, p: 2 }}><Typography variant="h6" mb={2}>Clientes & Veículos</Typography><TableContainer><Table><TableHead><TableRow><TableCell>Cliente</TableCell><TableCell>Veículo</TableCell><TableCell>Placa</TableCell><TableCell>OS</TableCell></TableRow></TableHead><TableBody>{filtered.map(order => <TableRow key={order.id}><TableCell>{order.client}</TableCell><TableCell>{order.vehicle}</TableCell><TableCell>{order.plate}</TableCell><TableCell><Button onClick={() => setSelectedId(order.id)}>#{order.number}</Button></TableCell></TableRow>)}</TableBody></Table></TableContainer>{!filtered.length && <Typography>Nenhum atendimento cadastrado.</Typography>}</Paper> : <>
                  <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2,1fr)', sm: 'repeat(4,1fr)', lg: 'repeat(8,1fr)' }, gap: 1, mb: 2.5 }}>
                    {stats.map(({ title, value, caption, icon: Icon, tone }) => <Paper key={title} sx={{ ...card, p: 1.5, minHeight: 124, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', bgcolor: tone === 'red' ? '#fceef0' : tone === 'blue' ? '#e8efff' : '#fff' }}>
                      <Stack direction="row" justifyContent="space-between" gap={.5}><Typography sx={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: .4, color: tone === 'red' ? '#ba1a1a' : '#545f73' }}>{title}</Typography><Icon size={15} color={tone === 'red' ? '#ba1a1a' : '#004ac6'} /></Stack>
                      <Box><Typography fontWeight={700} sx={{ fontSize: title === 'Ticket médio' ? 16 : 23 }}>{orders.isPending ? '—' : value}</Typography><Typography fontSize={10} color="text.secondary" mt={.5}>{caption}</Typography></Box>
                    </Paper>)}
                  </Box>
                  <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'minmax(0,1fr) 230px' }, gap: 2 }}>
                    <Stack spacing={2} sx={{ minWidth: 0 }}>
                      <Paper sx={{ ...card, overflow: 'hidden' }}>
                        <Stack direction={{ xs: 'column', md: 'row' }} gap={2} justifyContent="space-between" p={2}>
                          <Box><Typography fontSize={15} fontWeight={600}>Ordens de Serviço em Atendimento Imediato</Typography><Typography variant="body2" fontSize={12} color="text.secondary">Atendimentos registrados na concessionária.</Typography></Box>
                          <Box role="group" aria-label="Visões das ordens de serviço" sx={{
                            display: 'grid', gridTemplateColumns: '78px 116px 106px', width: 308, maxWidth: '100%',
                            height: 46, p: '4px', bgcolor: '#eff4ff', borderRadius: '4px', flexShrink: 0,
                            alignSelf: { xs: 'flex-start', md: 'center' }, boxSizing: 'border-box',
                            '@media (max-width: 359px)': { gridTemplateColumns: 'minmax(0,78fr) minmax(0,116fr) minmax(0,106fr)' },
                            '& .MuiButton-root': { minWidth: 0, width: '100%', height: 38, p: 0, borderRadius: '3px', fontSize: 11, lineHeight: '16px', letterSpacing: 0, textTransform: 'none' }
                          }}>
                            <Button aria-pressed={scope === 'mine'} variant={scope === 'mine' ? 'contained' : 'text'} onClick={() => { setScope('mine'); setPage(0); }}>
                              <Box component="span" sx={{ whiteSpace: 'nowrap', fontWeight: scope === 'mine' ? 600 : 400 }}>Minhas<br />OS {mine.length}</Box>
                            </Button>
                            <Button aria-pressed={scope === 'all'} variant={scope === 'all' ? 'contained' : 'text'} onClick={() => { setScope('all'); setPage(0); }}>
                              <Box component="span" sx={{ whiteSpace: 'nowrap', fontWeight: scope === 'all' ? 600 : 400, color: scope === 'all' ? 'inherit' : '#0b1c30' }}>Todas da<br />Unidade {unit.length}</Box>
                            </Button>
                            <Tooltip title="A classificação de urgência e retorno ainda não está disponível nos registros de OS.">
                              <Box component="span" sx={{ display: 'flex', alignItems: 'center', minWidth: 0 }}>
                                <Button disabled aria-label="Urgentes e retorno indisponível" sx={{ gap: '8px', '&.Mui-disabled': { color: '#d00000' } }}>
                                  <Box component="span" sx={{ width: 4, height: 4, borderRadius: '50%', bgcolor: '#e88491', flexShrink: 0 }} />
                                  <Box component="span" sx={{ whiteSpace: 'nowrap', fontWeight: 400 }}>Urgentes /<br />Retorno</Box>
                                  <Box component="span" sx={{ fontSize: 11 }}>—</Box>
                                </Button>
                              </Box>
                            </Tooltip>
                          </Box>
                        </Stack>
                        <Stack direction="row" alignItems="center" gap={1} mx={2} mb={1.5} p={1} sx={{ bgcolor: '#f8f9ff', flexWrap: 'wrap' }}><Typography fontSize={10}>FILTROS</Typography><TextField size="small" label="Busca" value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} /><Typography fontSize={11} fontFamily='"JetBrains Mono", monospace'>{filtered.length} OS encontradas</Typography></Stack>
                        <TableContainer sx={{ display: { xs: 'none', md: 'block' } }}><Table sx={{ minWidth: 650 }} size="small">
                          <TableHead><TableRow sx={{ bgcolor: '#eff4ff' }}>{['OS & identificação', 'Veículo / placa', 'Cliente', 'Entrada / previsão', 'Status & progresso', 'Especialistas atribuídos'].map(title => <TableCell key={title} sx={{ fontSize: '10px !important', textTransform: 'uppercase', letterSpacing: .4 }}>{title}</TableCell>)}</TableRow></TableHead>
                          <TableBody>{[...filtered].sort((a, b) => +b.opened - +a.opened).slice(pageIndex * 4, pageIndex * 4 + 4).map(order => <TableRow key={order.id} hover>
                            <TableCell><Button sx={{ p: 0, minWidth: 0 }} onClick={() => setSelectedId(order.id)}>#{order.number}</Button><Typography fontSize={10} sx={{ bgcolor: '#eff4ff', mt: .5, p: .5 }}>{order.services.map(item => item.name).join(' + ')}</Typography></TableCell>
                            <TableCell>{order.vehicle}<Typography fontSize={11} fontFamily='"JetBrains Mono", monospace' color="text.secondary" mt={.5}>{order.plate}</Typography></TableCell>
                            <TableCell>{order.client}<Typography fontSize={10} color="text.secondary" mt={.5}>{order.consultant}</Typography></TableCell>
                            <TableCell><Typography fontSize={11} fontFamily='"JetBrains Mono", monospace'>{date(order.opened)}</Typography><Typography fontSize={10} color="text.secondary">Previsão não registrada</Typography></TableCell>
                            <TableCell><Chip size="small" label={order.status} sx={{ bgcolor: '#e5eeff', color: '#004ac6', fontSize: 11 }} /><LinearProgress variant="determinate" value={order.count ? order.services.filter(service => service.end).length * 100 / order.count : 0} sx={{ my: 1 }} /><Typography fontSize={10}>{order.services.filter(service => service.end).length}/{order.count} serviços concluídos</Typography></TableCell>
                            <TableCell><Typography fontSize={11} color="text.secondary">{order.mechanics.length ? order.mechanics.join(', ') : 'Pendente de atribuição pelo chefe'}</Typography><Typography fontSize={11} fontFamily='"JetBrains Mono", monospace' mt={.5}>{currency.format(order.amount)}</Typography></TableCell>
                          </TableRow>)}</TableBody>
                        </Table></TableContainer>
                        <Stack sx={{ display: { xs: 'flex', md: 'none' }, px: 2 }} spacing={1}>{[...filtered].sort((a, b) => +b.opened - +a.opened).slice(pageIndex * 4, pageIndex * 4 + 4).map(order => <Paper key={order.id} sx={{ p: 1.5, bgcolor: '#f8f9ff' }}><Button onClick={() => setSelectedId(order.id)}>#{order.number}</Button><Typography fontSize={13}>{order.client}</Typography><Typography fontSize={12}>{order.vehicle} · {order.plate}</Typography><Typography fontSize={11}>{date(order.opened)} · {order.consultant}</Typography><Typography fontSize={12}>{currency.format(order.amount)} · {order.status}</Typography></Paper>)}</Stack>
                        {orders.isPending ? <Typography p={2} fontSize={12}>Carregando OS…</Typography> : !filtered.length && <Typography p={2} fontSize={12} color="text.secondary">Nenhuma ordem corresponde à seleção. <Button onClick={clearFilters}>Limpar filtros e ver todas</Button></Typography>}
                        <TablePagination component="div" count={filtered.length} page={pageIndex} rowsPerPage={4} rowsPerPageOptions={[]} onPageChange={(_, p) => setPage(p)} labelDisplayedRows={({ from, to, count }) => `${from}–${to} de ${count}`} sx={{ bgcolor: '#fafcff' }} />
                      </Paper>
                      <Paper sx={{ ...card, p: 2 }}><Stack direction="row" gap={1} alignItems="center"><Gauge size={19} color="#004ac6" /><Box><Typography fontWeight={600} fontSize={15}>Carga prevista • TMO por atendimento</Typography><Typography fontSize={11} color="text.secondary">Tempo padrão dos serviços cadastrados nas OS.</Typography></Box></Stack>
                        <Stack spacing={1.5} mt={2}>{unit.slice(0, 5).map(order => {
                          const minutes = order.services.reduce((sum, item) => sum + item.minutes, 0);
                          const max = Math.max(1, ...unit.map(item => item.services.reduce((sum, service) => sum + service.minutes, 0)));
                          return <Stack key={order.id} direction="row" gap={1.5} alignItems="center"><Typography fontFamily='"JetBrains Mono", monospace' fontSize={11}>#{order.number}</Typography><LinearProgress variant="determinate" value={minutes / max * 100} sx={{ flex: 1, height: 5, borderRadius: 1 }} /><Typography fontFamily='"JetBrains Mono", monospace' fontSize={11}>{minutes} min</Typography></Stack>;
                        })}{!unit.length && <Typography fontSize={12} color="text.secondary">Nenhum serviço registrado.</Typography>}</Stack>
                      </Paper>
                    </Stack>
                    <Stack spacing={2}>
                      <Paper sx={{ ...card, p: 2 }}><Stack direction="row" gap={.75} alignItems="center" mb={1.5}><Bell size={17} color="#004ac6" /><Typography fontWeight={600} fontSize={15}>Feed da Oficina</Typography></Stack>
                        <EventFeed orders={latest} onOpen={order => setSelectedId(order.id)} />
                        <Button fullWidth component={Link} to="/consultoria-os" sx={{ bgcolor: '#e5eeff', mt: 1.5 }}>Ver histórico de atendimentos</Button>
                      </Paper>
                      <Paper sx={{ ...card, p: 2 }}><Stack direction="row" gap={1} alignItems="center"><ShieldCheck size={19} color="#004ac6" /><Typography fontSize={15} fontWeight={600}>Barramento Stellantis</Typography></Stack><Typography fontSize={11} color="text.secondary" mt={1}>Monitor de APIs corporativas e validação de garantia.</Typography>
                        {['INTOSV2 Global', 'Garantia FIAT / Jeep', 'Campanhas / recalls'].map(title => <Box key={title} sx={{ bgcolor: '#eff4ff', borderRadius: 1, p: 1.25, mt: 1 }}><Typography fontSize={12} fontWeight={600}>{title}</Typography><Typography fontFamily='"JetBrains Mono", monospace' fontSize={10} color="text.secondary" mt={.5}>Aguardando integração</Typography></Box>)}
                      </Paper>
                      <Paper sx={{ ...card, p: 1.5 }}><Typography fontSize={10} letterSpacing={.6} color="text.secondary" mb={1}>AÇÕES RÁPIDAS DE BALCÃO</Typography><Stack gap={.75}><Button component={Link} to="/consultoria-os?nova=1" startIcon={<Plus size={15} />} sx={{ bgcolor: '#eff4ff' }}>Abrir ordem de serviço</Button><Button component={Link} to="/consultor/catalogo" startIcon={<Timer size={15} />} sx={{ bgcolor: '#eff4ff' }}>Consultar serviços e TMO</Button><Button onClick={refresh} startIcon={<RefreshCw size={15} />} sx={{ bgcolor: '#eff4ff' }}>Atualizar atendimentos</Button></Stack></Paper>
                    </Stack>
                  </Box>
                </>}
          </>} />
        </Routes>
      </Box>
    </Box>
    <Dialog open={selected !== null} onClose={() => setSelectedId(null)} fullWidth maxWidth="sm">{selected && <><DialogTitle>OS #{selected.number}</DialogTitle><DialogContent><Stack spacing={1.5}><Chip size="small" label={selected.status} sx={{ alignSelf: 'flex-start', bgcolor: '#e5eeff', color: '#004ac6' }} /><Typography variant="body2" color="text.secondary">{selected.status === 'Aguardando distribuição' ? 'Pendente de distribuição pelo chefe de oficina.' : 'Serviços atribuídos à equipe da oficina.'}</Typography><Typography>{selected.client}</Typography><Typography>{selected.vehicle} · {selected.plate}</Typography><Typography variant="body2">Aberta em {date(selected.opened)} por {selected.consultant}</Typography>{selected.services.map(service => <Paper key={service.id} sx={{ p: 1.5, bgcolor: '#eff4ff' }}><Typography fontSize={13}>{service.name}</Typography><Typography fontSize={12}>{service.minutes} min · {currency.format(service.total)}</Typography>
                  <Chip size="small" label={service.approvedAt ? 'Pronto · Conferido pelo chefe' : service.end ? 'Concluído · Aguardando conferência' : service.status} color={service.end ? 'success' : 'default'} sx={{ mt: .75 }} />
                  {service.end && <Typography variant="caption" display="block" mt={.5}>Conclusão · {date(service.end)}</Typography>}</Paper>)}<Typography fontWeight={600}>Valor previsto {currency.format(selected.amount)}</Typography></Stack></DialogContent><DialogActions><Button onClick={() => setSelectedId(null)}>Fechar</Button><Button component={Link} to="/consultoria-os" onClick={() => setSelectedId(null)}>Abrir lista de OS</Button></DialogActions></>}</Dialog>
    <Dialog open={notice} onClose={() => setNotice(false)} fullWidth><DialogTitle>Eventos registrados</DialogTitle><DialogContent><EventFeed orders={latest} onOpen={order => { setNotice(false); setSelectedId(order.id); }} /></DialogContent><DialogActions><Button onClick={() => setNotice(false)}>Fechar</Button></DialogActions></Dialog>
    <Dialog open={help} onClose={() => setHelp(false)} fullWidth><DialogTitle>Área do Consultor</DialogTitle><DialogContent><Typography>Use Ordens de Serviço para cadastrar e acompanhar atendimentos. O catálogo mostra os serviços disponíveis com TMO e preço. O seletor de unidade e a busca filtram o dashboard.</Typography></DialogContent><DialogActions><Button onClick={() => setHelp(false)}>Fechar</Button></DialogActions></Dialog>
  </Box></ThemeProvider>;
}

function EventFeed({ orders, onOpen }: { orders: Order[]; onOpen: (order: Order) => void }) {
  return <Stack spacing={1}>{orders.map(order => <Box key={order.id} sx={{ p: 1.25, bgcolor: '#eff4ff', borderRadius: 1 }}>
    <Typography fontFamily='"JetBrains Mono", monospace' fontSize={10} color="#006242">{date(order.opened)}</Typography>
    <Typography fontSize={12} mt={.5}>OS <Button sx={{ p: 0, minWidth: 0 }} onClick={() => onOpen(order)}>#{order.number}</Button> aberta para {order.client}.</Typography>
    <Typography fontSize={10} color="text.secondary" mt={.5}>{order.consultant} · {order.vehicle}</Typography>
  </Box>)}{!orders.length && <Typography fontSize={12} color="text.secondary">Nenhuma abertura registrada.</Typography>}</Stack>;
}
