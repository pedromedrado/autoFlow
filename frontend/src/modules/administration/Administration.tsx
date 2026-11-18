import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Avatar, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, MenuItem, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TablePagination, TableRow, Tab, Tabs, TextField, Tooltip, Typography, useMediaQuery, useTheme } from '@mui/material';
import Add from '@mui/icons-material/PersonAddAlt1';
import Groups from '@mui/icons-material/GroupsOutlined';
import Store from '@mui/icons-material/StorefrontOutlined';
import Lock from '@mui/icons-material/LockOutlined';
import LinkIcon from '@mui/icons-material/HubOutlined';
import Search from '@mui/icons-material/Search';
import { isAxiosError } from 'axios';
import { Pencil, Trash2 } from 'lucide-react';
import { api, mutate } from '../../services/api';

const profiles = {
  Master: { label: 'Master', access: 'Gestão de usuários e perfis' },
  Consultant: { label: 'Consultor técnico', access: 'Consultar e abrir ordens de serviço' },
  Manager: { label: 'Gerente de oficina', access: 'Consultar ordens e gerenciar a oficina' },
  Mechanic: { label: 'Mecânico', access: 'Executar serviços atribuídos' },
} as const;
type Role = keyof typeof profiles;
type OperationalRole = Exclude<Role, 'Master'>;
type Member = { id: string; displayName: string; email: string; role: Role; storeId: string | null };
type StoreOption = { id: string; name: string; city: string };
type Draft = { id?: string; displayName: string; email: string; role: OperationalRole; storeId: string; password: string };
const roles: OperationalRole[] = ['Consultant', 'Manager', 'Mechanic'];
const emptyDraft: Draft = { displayName: '', email: '', role: 'Consultant', storeId: '', password: '' };
const endpoint = '/administration/users';

export function Administration() {
  const queryClient = useQueryClient();
  const compactForm = useMediaQuery(useTheme().breakpoints.down('sm'));
  const [search, setSearch] = useState('');
  const [store, setStore] = useState('');
  const [role, setRole] = useState<Role | ''>('');
  const [tab, setTab] = useState(0);
  const [page, setPage] = useState(0);
  const pageSize = 6;
  const dealership = useQuery({
    queryKey: ['dealership'],
    queryFn: async () => (await api.get<{ name: string }>('/dealership')).data,
  });
  const unit = dealership.data?.name;
  const stores = useQuery({
    queryKey: ['operations', 'stores'],
    queryFn: async () => (await api.get<StoreOption[]>('/operations/stores')).data,
  });
  const storeNames = new Map((stores.data ?? []).map(location => [location.id, location.name]));
  const [deleting, setDeleting] = useState<Member | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const members = useQuery({
    queryKey: ['administration', 'users'],
    queryFn: async () => (await api.get<Member[]>(endpoint)).data,
  });
  const save = useMutation({
    mutationFn: async ({ id, password, storeId, ...fields }: Draft) => {
      const payload = { ...fields, storeId: storeId || null };
      const { data } = await api.get<{ token: string }>('/auth/csrf');
      const options = { headers: { 'X-CSRF-TOKEN': data.token } };
      if (id) await api.put(endpoint + '/' + encodeURIComponent(id), payload, options);
      else await api.post(endpoint, { ...payload, password }, options);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['administration', 'users'] });
      await queryClient.invalidateQueries({ queryKey: ['team'] });
      setDraft(null);
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) => mutate(endpoint + '/' + encodeURIComponent(id), undefined, 'DELETE'),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['administration', 'users'] });
      await queryClient.invalidateQueries({ queryKey: ['team'] });
      setPage(0);
      setDeleting(null);
    },
  });
  const visible = (members.data ?? []).filter(member =>
    (!role || member.role === role) &&
    (!store || (member.storeId ?? 'unassigned') === store) &&
    (member.displayName + ' ' + member.email).toLowerCase().includes(search.trim().toLowerCase()));
  const error = isAxiosError(save.error) ? save.error.response?.data?.error : undefined;

  function open(member?: Member) {
    save.reset();
    if (member && member.role !== 'Master') {
      setDraft({ ...member, role: member.role, storeId: member.storeId ?? '', password: '' });
    } else setDraft(emptyDraft);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (draft) save.mutate(draft);
  }

  return (
    <Stack spacing={{ xs: 1.5, md: 2 }} sx={{ '& .MuiPaper-root': { borderRadius: 1.5 } }}>
      <Typography variant="caption" fontWeight={600} color="text.secondary">
        ADMINISTRAÇÃO &nbsp; › &nbsp; GESTÃO CORPORATIVA &nbsp; › &nbsp;
        <Box component="span" color="primary.main">USUÁRIOS E CONCESSIONÁRIAS</Box>
      </Typography>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'center' }} gap={2}>
        <Box>
          <Typography component="h1" variant="h5" fontWeight={700} sx={{ fontSize: { xs: 20, md: 24 } }}>Administração de Usuários e Rede de Concessionárias</Typography>
          <Typography variant="body2" color="text.secondary" mt={0.75}>
            Controle de perfis web e acessos da concessionária.
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<Add />} onClick={() => open()} sx={{ alignSelf: 'flex-start', whiteSpace: 'nowrap' }}>Novo usuário</Button>
      </Stack>
      <Stack direction="row" flexWrap="wrap" gap={1}>
        <Chip size="small" label={unit ?? 'Unidade atual'} />
        <Chip size="small" color="primary" label="Administrador Master" />
      </Stack>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' }, gap: 1.5 }}>
        {[
          { label: 'Total de colaboradores', value: members.data?.length, icon: <Groups fontSize="small" /> },
          { label: 'Lojas cadastradas', value: stores.data?.length, icon: <Store fontSize="small" /> },
          { label: 'Consultores técnicos', value: members.data?.filter(user => user.role === 'Consultant').length, icon: <Groups fontSize="small" /> },
          { label: 'Mecânicos', value: members.data?.filter(user => user.role === 'Mechanic').length, icon: <Groups fontSize="small" /> },
        ].map(metric => (
          <Paper key={metric.label} sx={{ p: { xs: 1.25, sm: 1.75 }, minHeight: 76 }}>
            <Stack direction="row" justifyContent="space-between" gap={1}>
              <Box>
                <Typography variant="caption" color="text.secondary" textTransform="uppercase" fontWeight={600}>{metric.label}</Typography>
                <Typography variant="h5" fontWeight={700}>{metric.value ?? '—'}</Typography>
              </Box>
              <Avatar variant="rounded" sx={{ width: 34, height: 34, bgcolor: '#edf2ff', color: 'primary.main' }}>{metric.icon}</Avatar>
            </Stack>
          </Paper>
        ))}
      </Box>

      <Tabs value={tab} onChange={(_, value: number) => setTab(value)} variant="scrollable" scrollButtons="auto" aria-label="Áreas da administração"
        sx={{ minHeight: 36, '& .MuiTabs-indicator': { display: 'none' }, '& .MuiTabs-flexContainer': { gap: 1 }, '& .MuiTab-root': { minHeight: 36, bgcolor: 'background.paper', borderRadius: 1, px: 1.5, textTransform: 'none' }, '& .MuiTab-root.Mui-selected': { bgcolor: 'primary.main', color: 'white' } }}>
        <Tab icon={<Groups fontSize="small" />} iconPosition="start" label="Usuários e perfis" />
        <Tab icon={<Store fontSize="small" />} iconPosition="start" label="Concessionárias" />
        <Tab icon={<LinkIcon fontSize="small" />} iconPosition="start" label="Integrações" />
        <Tab icon={<Lock fontSize="small" />} iconPosition="start" label="Políticas de acesso" />
      </Tabs>

      {tab === 0 && <Paper sx={{ overflow: 'hidden' }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} flexWrap="wrap" alignItems={{ sm: 'center' }} gap={1} p={1.5}>
          <TextField label="Buscar por nome ou e-mail" size="small" value={search}
            onChange={e => { setSearch(e.target.value); setPage(0); }}
            slotProps={{ input: { startAdornment: <Search fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} /> } }}
            sx={{ width: { xs: '100%', sm: 320 } }} />
          <TextField select label="Perfil" size="small" value={role}
            onChange={e => { setRole(e.target.value as Role | ''); setPage(0); }} sx={{ minWidth: { sm: 160 } }}>
            <MenuItem value="">Todos os perfis</MenuItem>
            {Object.entries(profiles).map(([key, profile]) => <MenuItem value={key} key={key}>{profile.label}</MenuItem>)}
          </TextField>
          <TextField select label="Concessionária / loja" size="small" value={store}
            onChange={e => { setStore(e.target.value); setPage(0); }} sx={{ minWidth: { sm: 190 } }}>
            <MenuItem value="">Todas as lojas</MenuItem>
            <MenuItem value="unassigned">Sem loja vinculada</MenuItem>
            {(stores.data ?? []).map(location => <MenuItem key={location.id} value={location.id}>{location.name}</MenuItem>)}
          </TextField>
        </Stack>
        {members.isError && <Alert severity="error">Não foi possível carregar os usuários.</Alert>}
        <TableContainer sx={{ display: { xs: 'none', sm: 'block' } }}>
          <Table size="small" aria-label="Usuários e perfis" sx={{
            minWidth: 720,
            '& .MuiTableCell-head': { bgcolor: '#edf2ff', color: 'text.secondary', fontSize: 11, textTransform: 'uppercase', fontWeight: 700 },
            '& .MuiTableRow-root:nth-of-type(even)': { bgcolor: '#f8faff' },
          }}>
            <TableHead><TableRow><TableCell>Colaborador</TableCell><TableCell>Perfil de acesso</TableCell><TableCell>Concessionária</TableCell><TableCell>Acessos web</TableCell><TableCell align="right" aria-label="Ações disponíveis" sx={{ width: 84 }} /></TableRow></TableHead>
            <TableBody>
              {visible.slice(page * pageSize, (page + 1) * pageSize).map(member => (
                <TableRow key={member.id} hover>
                  <TableCell>
                    <Stack direction="row" alignItems="center" gap={1.25} py={0.5}>
                      <Avatar variant="rounded" sx={{ width: 32, height: 32, bgcolor: '#e4edff', color: '#2058cf', fontSize: 12, fontWeight: 700 }}>
                        {member.displayName.trim().split(/\s+/).slice(0, 2).map(word => word[0]).join('').toUpperCase()}
                      </Avatar>
                      <Box>
                        <Typography variant="body2" fontWeight={700}>{member.displayName}</Typography>
                        <Typography variant="caption" color="text.secondary">{member.email}</Typography>
                      </Box>
                    </Stack>
                  </TableCell>
                  <TableCell><Chip size="small" label={profiles[member.role]?.label ?? member.role} sx={{ bgcolor: '#e4edff', color: '#21428b', fontWeight: 600 }} /></TableCell>
                  <TableCell>{member.storeId ? storeNames.get(member.storeId) ?? '—' : 'Sem loja vinculada'}</TableCell>
                  <TableCell>{profiles[member.role]?.access ?? '—'}</TableCell>
                  <TableCell align="right">{member.role === 'Master' ? '—' : <Stack direction="row" justifyContent="flex-end" gap={.5}>
                    <Tooltip title="Alterar"><IconButton size="small" color="primary" onClick={() => open(member)} aria-label={'Alterar ' + member.displayName}><Pencil size={16} /></IconButton></Tooltip>
                    <Tooltip title="Excluir"><IconButton size="small" color="error" onClick={() => { remove.reset(); setDeleting(member); }} aria-label={'Excluir ' + member.displayName}><Trash2 size={16} /></IconButton></Tooltip>
                  </Stack>}</TableCell>
                </TableRow>
              ))}
              {!members.isError && visible.length === 0 && <TableRow><TableCell colSpan={5}>{members.isPending ? 'Carregando usuários…' : 'Nenhum usuário encontrado.'}</TableCell></TableRow>}
            </TableBody>
          </Table>
        </TableContainer>
        <Stack sx={{ display: { xs: 'flex', sm: 'none' }, px: 1.5, pb: 1.5 }} spacing={1}>
          {visible.slice(page * pageSize, (page + 1) * pageSize).map(member => (
            <Paper key={member.id} sx={{ p: 1.25 }}>
              <Stack direction="row" alignItems="flex-start" justifyContent="space-between" gap={1}>
                <Box sx={{ minWidth: 0, overflowWrap: 'anywhere' }}>
                  <Typography variant="body2" fontWeight={700}>{member.displayName}</Typography>
                  <Typography variant="caption" color="text.secondary">{member.email}</Typography>
                </Box>
                {member.role !== 'Master' && <Stack direction="row">
                  <Tooltip title="Alterar"><IconButton sx={{ width: 40, height: 40 }} color="primary" aria-label={'Alterar ' + member.displayName} onClick={() => open(member)}><Pencil size={16} /></IconButton></Tooltip>
                  <Tooltip title="Excluir"><IconButton sx={{ width: 40, height: 40 }} color="error" aria-label={'Excluir ' + member.displayName} onClick={() => { remove.reset(); setDeleting(member); }}><Trash2 size={16} /></IconButton></Tooltip>
                </Stack>}
              </Stack>
              <Chip size="small" label={profiles[member.role]?.label ?? member.role} sx={{ mt: 1, bgcolor: '#e4edff' }} />
              <Typography display="block" variant="caption" color="text.secondary" mt={.75}>{member.storeId ? storeNames.get(member.storeId) ?? '—' : 'Sem loja vinculada'}</Typography>
              <Typography variant="caption">{profiles[member.role]?.access ?? '—'}</Typography>
            </Paper>
          ))}
          {!members.isError && !visible.length && <Typography variant="body2" color="text.secondary">{members.isPending ? 'Carregando usuários…' : 'Nenhum usuário encontrado.'}</Typography>}
        </Stack>
        <TablePagination component="div" count={visible.length} page={page} rowsPerPage={pageSize} rowsPerPageOptions={[]} onPageChange={(_, value) => setPage(value)}
          labelDisplayedRows={({ from, to, count }) => `Exibindo ${from}–${to} de ${count} colaboradores`}
          getItemAriaLabel={type => type === 'next' ? 'Próxima página' : 'Página anterior'} />
      </Paper>}

      {(tab === 0 || tab === 1) && <Stack spacing={1}>
        <Box>
          <Typography variant="subtitle1" fontWeight={700}>Rede de concessionárias AutoFlow</Typography>
          <Typography variant="body2" color="text.secondary">Unidade vinculada à sua sessão.</Typography>
        </Box>
        <Paper sx={{ p: 2 }}>
          <Stack direction="row" alignItems="center" gap={1.5}>
            <Avatar variant="rounded" sx={{ bgcolor: '#edf2ff', color: 'primary.main' }}><Store /></Avatar>
            <Box>
              <Typography fontWeight={700}>{unit ?? (dealership.isError ? 'Unidade indisponível' : 'Carregando unidade…')}</Typography>
              <Typography variant="body2" color="text.secondary">{members.data?.length ?? '—'} colaboradores vinculados</Typography>
            </Box>
          </Stack>
        </Paper>
      </Stack>}

      {(tab === 0 || tab === 2) && <Paper sx={{ p: 2 }}>
        <Stack direction="row" alignItems="center" gap={1.25}>
          <Avatar variant="rounded" sx={{ bgcolor: '#e7f6f1', color: '#147b60' }}><LinkIcon /></Avatar>
          <Box>
            <Typography fontWeight={700}>Integrações da concessionária</Typography>
            <Typography variant="body2" color="text.secondary">Nenhuma integração externa configurada nesta versão.</Typography>
          </Box>
        </Stack>
      </Paper>}

      {tab === 3 && <Paper sx={{ p: 2 }}>
        <Typography variant="subtitle1" fontWeight={700} mb={1.5}>Acessos por perfil</Typography>
        <Stack spacing={1}>
          {Object.entries(profiles).map(([key, profile]) => (
            <Box key={key} sx={{ bgcolor: '#f4f7ff', p: 1.5, borderRadius: 1 }}>
              <Typography variant="body2" fontWeight={700}>{profile.label}</Typography>
              <Typography variant="body2" color="text.secondary">{profile.access}</Typography>
            </Box>
          ))}
        </Stack>
      </Paper>}

      <Dialog open={deleting !== null} onClose={() => { if (!remove.isPending) setDeleting(null); }}>
        <DialogTitle>Excluir usuário</DialogTitle>
        <DialogContent>
          <Typography>Confirma a exclusão de {deleting?.displayName}?</Typography>
          {remove.isError && <Alert severity="error" sx={{ mt: 1 }}>Não foi possível excluir o usuário.</Alert>}
        </DialogContent>
        <DialogActions>
          <Button disabled={remove.isPending} onClick={() => setDeleting(null)}>Cancelar</Button>
          <Button color="error" variant="contained" disabled={remove.isPending} onClick={() => { if (deleting) remove.mutate(deleting.id); }}>Excluir</Button>
        </DialogActions>
      </Dialog>
      <Dialog open={draft !== null} fullScreen={compactForm} fullWidth maxWidth="sm" onClose={() => { if (!save.isPending) setDraft(null); }}>
        {draft && (
          <form onSubmit={submit}>
            <DialogTitle>{draft.id ? 'Alterar usuário' : 'Novo usuário'}</DialogTitle>
            <DialogContent>
              <Stack spacing={2} pt={1}>
                {save.isError && <Alert severity="error">{error ?? 'Não foi possível salvar o usuário.'}</Alert>}
                <TextField required label="Nome completo" value={draft.displayName} onChange={e => setDraft({ ...draft, displayName: e.target.value })} inputProps={{ maxLength: 160 }} />
                <TextField required type="email" label="E-mail" value={draft.email} onChange={e => setDraft({ ...draft, email: e.target.value })} inputProps={{ maxLength: 254 }} />
                <TextField select label="Perfil web" value={draft.role} onChange={e => setDraft({ ...draft, role: e.target.value as OperationalRole })} helperText={profiles[draft.role].access}>
                  {roles.map(profile => <MenuItem key={profile} value={profile}>{profiles[profile].label}</MenuItem>)}
                </TextField>
                <TextField select label="Concessionária / loja" value={draft.storeId}
                  onChange={e => setDraft({ ...draft, storeId: e.target.value })}
                  disabled={stores.isPending || stores.isError}
                  helperText={stores.isError ? 'Não foi possível carregar as lojas.' : stores.isPending ? 'Carregando lojas…' : stores.data?.length ? 'Selecione uma unidade cadastrada.' : 'Cadastre uma unidade em Concessionárias & Lojas.'}>
                  <MenuItem value="">Sem loja vinculada</MenuItem>
                  {(stores.data ?? []).map(location => <MenuItem key={location.id} value={location.id}>{location.name} · {location.city}</MenuItem>)}
                </TextField>
                {!draft.id && <TextField required type="password" autoComplete="new-password" label="Senha inicial" value={draft.password} onChange={e => setDraft({ ...draft, password: e.target.value })} inputProps={{ minLength: 12, maxLength: 128 }} helperText="Use 12 caracteres ou mais, com maiúscula, minúscula, número e símbolo." />}
              </Stack>
            </DialogContent>
            <DialogActions>
              <Button disabled={save.isPending} onClick={() => setDraft(null)}>Cancelar</Button>
              <Button disabled={save.isPending} type="submit" variant="contained">{save.isPending ? 'Salvando…' : 'Salvar usuário'}</Button>
            </DialogActions>
          </form>
        )}
      </Dialog>
    </Stack>
  );
}
