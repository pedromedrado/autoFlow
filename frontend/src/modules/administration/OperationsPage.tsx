import { useLocation } from 'react-router-dom';
import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, MenuItem, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography, useMediaQuery, useTheme } from '@mui/material';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { isAxiosError } from 'axios';
import { api, mutate } from '../../services/api';

type Store = { id: string; name: string; document: string; city: string };
type Service = { id: string; name: string; minutes: number; price: number };
type Order = { id: string; storeId: string; customer: string; vehicle: string; plate: string; consultant: string; status?: string; openedAt: string; items: Service[] };
type Area = 'stores' | 'services' | 'orders';
const labels = {
  stores: { title: 'Concessionárias & Lojas', action: 'Cadastrar loja', subtitle: 'Unidades vinculadas à sua concessionária.' },
  services: { title: 'Serviços & TMO', action: 'Cadastrar serviço', subtitle: 'Catálogo de serviços disponíveis na abertura de uma OS.' },
  orders: { title: 'Consultoria & OS', action: 'Abrir OS', subtitle: 'Acompanhe todas as ordens registradas na concessionária.' },
};
const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const parsePrice = (value: string) => Number(value.trim().replace(',', '.'));
function saveError(error: unknown) {
  if (!isAxiosError(error)) return 'Não foi possível salvar.';
  const response = error.response;
  if (typeof response?.data?.error === 'string') return response.data.error;
  if (!response) return 'A API local não respondeu. Verifique se ela está em execução.';
  if (response.status === 401 || response.status === 403) return 'Entre novamente com um perfil autorizado para salvar.';
  if (response.status === 404) return 'Reinicie a API com a versão atual para carregar as rotas de cadastro.';
  if (response.status === 400) return 'Confira os dados e tente novamente. Se a sessão expirou, entre de novo.';
  return 'O servidor não conseguiu salvar. Confira o erro no terminal da API.';
}
const total = (items: Service[]) => items.reduce((sum, item) => sum + item.price, 0);
const clean = { name: '', document: '', city: '', minutes: '', price: '', storeId: '', customer: '', vehicle: '', plate: '' };

export function OperationsPage({ area, canCreate, canDelete = false, onOrderCreated }: { area: Area; canCreate: boolean; canDelete?: boolean; onOrderCreated?: () => void }) {
  const query = useQueryClient();
  const location = useLocation();
  const compactForm = useMediaQuery(useTheme().breakpoints.down('sm'));
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Store | Service | Order | null>(null);
  const [retained, setRetained] = useState<string[]>([]);
  const [deleting, setDeleting] = useState<{ id: string; name: string } | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(clean);
  const [selection, setSelection] = useState<string[]>([]);
  const [detail, setDetail] = useState<Order | null>(null);
  useEffect(() => {
    if (area === 'orders' && canCreate && new URLSearchParams(location.search).get('nova') === '1') {
      setEditing(null);
      setRetained([]);
      setForm(clean);
      setSelection([]);
      setOpen(true);
    }
  }, [area, canCreate, location.search]);

  const stores = useQuery({ queryKey: ['operations', 'stores'], queryFn: async () => (await api.get<Store[]>('/operations/stores')).data, enabled: area !== 'services' });
  const services = useQuery({ queryKey: ['operations', 'services'], queryFn: async () => (await api.get<Service[]>('/operations/services')).data, enabled: area !== 'stores' });
  const orders = useQuery({ queryKey: ['operations', 'orders'], queryFn: async () => (await api.get<Order[]>('/operations/orders')).data, enabled: area === 'orders' });
  const current = area === 'stores' ? stores : area === 'services' ? services : orders;
  const save = useMutation({
    mutationFn: async () => {
      const data = area === 'stores' ? { name: form.name, document: form.document, city: form.city } :
        area === 'services' ? { name: form.name, minutes: Number(form.minutes), price: parsePrice(form.price) } :
          { storeId: form.storeId, customer: form.customer, vehicle: form.vehicle, plate: form.plate, serviceIds: selection, ...(editing ? { itemIds: retained } : {}) };
      return mutate('/operations/' + area + (editing ? '/' + editing.id : ''), data, editing ? 'PUT' : 'POST');
    },
    onSuccess: async (response) => {
      const createdOrder = area === 'orders' && !editing;
      if (area === 'orders') {
        const saved = response.data as Order | undefined;
        if (saved?.id) {
          query.setQueryData<Order[]>(['operations', 'orders'], current => [
            saved, ...(current ?? []).filter(order => order.id !== saved.id),
          ]);
        }
      }
      setSearch('');
      setOpen(false);
      await query.invalidateQueries({ queryKey: ['operations', area] });
      if (createdOrder) onOrderCreated?.();
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) => mutate('/operations/' + area + '/' + id, undefined, 'DELETE'),
    onSuccess: async () => {
      await query.invalidateQueries({ queryKey: ['operations', area] });
      setDeleting(null);
    },
  });
  const existingItems = editing && 'items' in editing ? editing.items : [];
  const selected = (services.data ?? []).filter(service => selection.includes(service.id));
  const columns = area === 'stores' ? ['Loja', 'CNPJ', 'Cidade', 'Ações'] : area === 'services' ? ['Serviço', 'TMO', 'Valor', 'Ações'] :
    ['OS', 'Abertura', 'Cliente', 'Veículo / placa', 'Loja', 'Responsável', 'Valor previsto', 'Situação', 'Ações'];
  const unitName = (id: string) => stores.data?.find(store => store.id === id)?.name ?? '—';
  const rows = area === 'stores' ? (stores.data ?? []).map(s => ({ id: s.id, cells: [s.name, s.document, s.city] })) :
    area === 'services' ? (services.data ?? []).map(s => ({ id: s.id, cells: [s.name, s.minutes + ' min', money.format(s.price)] })) :
      (orders.data ?? []).map(o => ({ id: o.id, cells: [o.id.slice(0, 8).toUpperCase(), new Date(o.openedAt.endsWith('Z') ? o.openedAt : o.openedAt + 'Z').toLocaleString('pt-BR'), o.customer, o.vehicle + ' · ' + o.plate, unitName(o.storeId), o.consultant, money.format(total(o.items)), o.status ?? 'Aguardando distribuição'] }));
  const visible = rows.filter(row => row.cells.join(' ').toLowerCase().includes(search.trim().toLowerCase()));
  function field(key: keyof typeof clean, label: string, type = 'text', maxLength = 160) {
    return <TextField required size="small" label={label} type={type} value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })}
      slotProps={{ htmlInput: key === 'price' ? { inputMode: 'decimal', pattern: '[0-9]+([,.][0-9]{1,2})?' } : type === 'number' ? { min: key === 'minutes' ? 1 : 0, step: key === 'minutes' ? 1 : .01 } : { maxLength } }} />;
  }
  function openEdit(record: Store | Service | Order) {
    save.reset();
    setEditing(record);
    setSelection([]);
    if ('items' in record) {
      setForm({ ...clean, storeId: record.storeId, customer: record.customer, vehicle: record.vehicle, plate: record.plate });
      setRetained(record.items.map(item => item.id));
    } else if ('document' in record) {
      setForm({ ...clean, name: record.name, document: record.document, city: record.city });
      setRetained([]);
    } else {
      setForm({ ...clean, name: record.name, minutes: String(record.minutes), price: String(record.price) });
      setRetained([]);
    }
    setOpen(true);
  }

  function renderActions(row: { id: string; cells: string[] }) {
    return <Stack direction="row" gap={.5} flexWrap="wrap">
            {area === 'orders' && <Button size="small" onClick={() => setDetail(orders.data?.find(o => o.id === row.id) ?? null)}>Ver detalhes</Button>}
            {canCreate && <Button size="small" startIcon={<Pencil size={15} />} onClick={() => {
              const record = (area === 'orders' ? orders.data : area === 'stores' ? stores.data : services.data)?.find(item => item.id === row.id);
              if (record) openEdit(record);
            }}>Alterar</Button>}
            {canDelete && <Button size="small" color="error" startIcon={<Trash2 size={15} />} onClick={() => {
              remove.reset();
              setDeleting({ id: row.id, name: row.cells[0] });
            }}>Excluir</Button>}
          </Stack>;
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    save.mutate();
  }
  return <Stack spacing={{ xs: 1.5, md: 2 }}>
    <Typography variant="caption" color="primary" fontWeight={700}>AUTOFLOW › {area === 'orders' ? 'OPERAÇÃO' : 'ADMINISTRAÇÃO'}</Typography>
    <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={2}>
      <div><Typography variant="h5" component="h1" fontWeight={700}>{labels[area].title}</Typography><Typography variant="body2" color="text.secondary">{labels[area].subtitle}</Typography></div>
      {canCreate && <Button variant="contained" startIcon={<Plus size={18} />} onClick={() => { setEditing(null); setRetained([]); setForm(clean); setSelection([]); save.reset(); setOpen(true); }}>{labels[area].action}</Button>}
    </Stack>
    <Paper>
      <Stack p={2}><TextField size="small" label="Pesquisar" value={search} onChange={e => setSearch(e.target.value)} sx={{ maxWidth: 350 }} /></Stack>
      {current.isError && <Alert severity="error">Não foi possível carregar o cadastro.</Alert>}
      <TableContainer sx={{ display: { xs: 'none', sm: 'block' } }}><Table size="small" aria-label={labels[area].title} sx={{ minWidth: area === 'orders' ? 960 : 440 }}>
        <TableHead><TableRow sx={{ bgcolor: '#edf2ff' }}>{columns.map(column => <TableCell key={column} sx={{ fontWeight: 700 }}>{column}</TableCell>)}</TableRow></TableHead>
        <TableBody>{visible.map(row => <TableRow hover key={row.id}>
          {row.cells.map((cell, index) => <TableCell key={index}>{cell}</TableCell>)}
          <TableCell>{renderActions(row)}</TableCell>
        </TableRow>)}</TableBody>
      </Table></TableContainer>
      {!current.isError && visible.length === 0 && <Typography p={2} color="text.secondary">{current.isPending ? 'Carregando…' : 'Nenhum registro encontrado.'}</Typography>}
      <Stack sx={{ display: { xs: 'flex', sm: 'none' }, px: 1.5, pb: 1.5 }} spacing={1}>
        {visible.map(row => (
          <Paper key={row.id} sx={{ p: 1.25 }}>
            <Typography variant="body2" fontWeight={700} mb={.5}>{row.cells[0]}</Typography>
            {row.cells.slice(1).map((cell, index) => (
              <Typography key={columns[index + 1]} display="block" variant="caption" color="text.secondary">
                {columns[index + 1]} · {cell}
              </Typography>
            ))}
            {renderActions(row)}
          </Paper>
        ))}
      </Stack>
    </Paper>

    <Dialog open={open} fullScreen={compactForm} onClose={() => { if (!save.isPending) setOpen(false); }} fullWidth maxWidth="sm">
      <form onSubmit={submit}>
        <DialogTitle>{editing ? (area === "orders" ? "Alterar OS" : area === "stores" ? "Alterar loja" : "Alterar serviço") : labels[area].action}</DialogTitle>
        <DialogContent><Stack spacing={2} pt={1}>
          {save.isError && <Alert severity="error">{saveError(save.error)}</Alert>}
          {area === 'stores' && <>{field('name', 'Nome da loja')}{field('document', 'CNPJ', 'text', 24)}{field('city', 'Cidade', 'text', 120)}</>}
          {area === 'services' && <>{field('name', 'Descrição do serviço')}{field('minutes', 'TMO em minutos', 'number')}{field('price', 'Preço (R$)')}</>}
          {area === 'orders' && <>
            {field('customer', 'Cliente')}{field('vehicle', 'Veículo / modelo')}{field('plate', 'Placa', 'text', 10)}
            <TextField required size="small" select label="Loja" value={form.storeId} onChange={e => setForm({ ...form, storeId: e.target.value })}>
              {(stores.data ?? []).map(store => <MenuItem key={store.id} value={store.id}>{store.name}</MenuItem>)}
            </TextField>
            {stores.isError || services.isError ? <Alert severity="error">Não foi possível carregar lojas e serviços.</Alert> :
              stores.isPending || services.isPending ? <Typography variant="body2">Carregando lojas e serviços…</Typography> :
                (!stores.data?.length || !services.data?.length) && <Alert severity="info">Peça ao Master para cadastrar uma loja e pelo menos um serviço.</Alert>}
            {existingItems.length > 0 && <>
              <Typography fontWeight={600}>Serviços já registrados</Typography>
              <Stack>
                {existingItems.map(item => <FormControlLabel key={item.id}
                  control={<Checkbox checked={retained.includes(item.id)} onChange={(_, checked) => setRetained(ids => checked ? [...ids, item.id] : ids.filter(id => id !== item.id))} />}
                  label={item.name + ' · ' + item.minutes + ' min · ' + money.format(item.price)} />)}
              </Stack>
            </>}
            <Typography fontWeight={600}>{editing ? 'Adicionar serviços do catálogo' : 'Serviços da OS'}</Typography>
            <Stack sx={{ maxHeight: 190, overflowY: 'auto' }}>
              {(services.data ?? []).map(service => <FormControlLabel key={service.id}
                control={<Checkbox checked={selection.includes(service.id)} onChange={(_, checked) => setSelection(items => checked ? [...items, service.id] : items.filter(id => id !== service.id))} />}
                label={service.name + ' · ' + service.minutes + ' min · ' + money.format(service.price)} />)}
            </Stack>
            <Typography fontWeight={700}>Valor previsto {money.format(total([...selected, ...existingItems.filter(item => retained.includes(item.id))]))}</Typography>
          </>}
        </Stack></DialogContent>
        <DialogActions><Button disabled={save.isPending} onClick={() => setOpen(false)}>Cancelar</Button><Button type="submit" variant="contained" disabled={save.isPending || (area === 'orders' && (!selection.length && !retained.length || !form.storeId))}>{save.isPending ? 'Salvando…' : 'Salvar'}</Button></DialogActions>
      </form>
    </Dialog>
    <Dialog open={deleting !== null} onClose={() => { if (!remove.isPending) setDeleting(null); }}>
      <DialogTitle>Excluir {area === 'orders' ? 'ordem de serviço' : area === 'stores' ? 'loja' : 'serviço'}</DialogTitle>
      <DialogContent>
        <Typography>Confirma a exclusão de {deleting?.name}?</Typography>
        {area === 'services' && <Typography variant="body2" color="text.secondary">As ordens já registradas mantêm esse serviço e seu valor original.</Typography>}
        {remove.isError && <Alert severity="error" sx={{ mt: 1 }}>{saveError(remove.error)}</Alert>}
      </DialogContent>
      <DialogActions>
        <Button disabled={remove.isPending} onClick={() => setDeleting(null)}>Cancelar</Button>
        <Button color="error" variant="contained" disabled={remove.isPending} onClick={() => { if (deleting) remove.mutate(deleting.id); }}>Excluir</Button>
      </DialogActions>
    </Dialog>
    <Dialog open={detail !== null} fullScreen={compactForm} onClose={() => setDetail(null)} fullWidth maxWidth="sm">
      {detail && <>
        <DialogTitle>OS #{detail.id.slice(0, 8).toUpperCase()}</DialogTitle>
        <DialogContent><Stack spacing={1.5}><Typography>{detail.customer} · {detail.vehicle} · {detail.plate}</Typography>
          <Typography color="text.secondary">{unitName(detail.storeId)} · Responsável {detail.consultant}</Typography>
          <Typography fontWeight={700}>Serviços selecionados</Typography>
          {detail.items.map(item => <Typography key={item.id}>{item.name} · {item.minutes} min · {money.format(item.price)}</Typography>)}
          <Typography fontWeight={700}>Valor previsto {money.format(total(detail.items))}</Typography></Stack></DialogContent>
        <DialogActions><Button onClick={() => setDetail(null)}>Fechar</Button></DialogActions>
      </>}
    </Dialog>
  </Stack>;
}
