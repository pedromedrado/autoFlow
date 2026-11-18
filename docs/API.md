# API Fase 1
Todas as operações usam HTTPS e JSON. Cookie __Host-AutoFlow HttpOnly/Secure/SameSite=Strict, duração absoluta de 8h. Não há tokens no localStorage.
- GET /api/health: processo ativo; não testa conexão SQL.
- GET /api/auth/csrf: cria cookie CSRF e retorna token. Enviar X-CSRF-TOKEN nos POST.
- POST /api/auth/login: {email,password}. 200, 400, 401 ou 429. Bloqueio após cinco falhas e limite por IP.
- GET /api/auth/me: perfil, concessionária, papéis e permissões. 401 sem sessão.
- POST /api/auth/logout: encerra sessão; exige CSRF.
- GET /api/dealership: concessionária da sessão.
- GET /api/team: membros da concessionária; exige workshop.manage.
- GET /api/audit: últimos 100 eventos da concessionária; exige workshop.manage.
Não confiar em cabeçalhos de proxy sem configurar proxies conhecidos. Usuários só são provisionados pelo seed local nesta fase; não há cadastro público.

## Catálogo e abertura de OS

- GET /api/operations/stores, /services e /orders: Master, Consultor e Gerente consultam registros da própria concessionária.
- POST /api/operations/stores e /services: Master cadastra lojas e serviços. TMO em minutos e preço em reais.
- POST /api/operations/orders: Master ou Consultor informa loja, cliente, veículo, placa e IDs de serviços. A API registra os serviços, o TMO e os preços da abertura.

No SQL Server, a migration OperationsCatalog cria as tabelas. No ambiente local,
o perfil AutoFlow-Isolado usa uma cópia do SQLite de teste com as novas tabelas.
Para um SQLite novo, o seed de Development cria o esquema completo.
