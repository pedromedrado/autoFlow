# AutoFlow — Fase 1
Base local de um SaaS de ordens de serviço, com React/TypeScript/MUI e ASP.NET Core 8/Identity/EF Core/SQL Server. O escopo segue a instrução de implementar a Fase 1 quando o repositório estiver vazio.

## Requisitos
.NET SDK 8 ou superior, runtime ASP.NET Core 8 para execução local, Node 20.19+ e SQL Server 2022 (ou Docker). SDKs mais novos compilam net8.0, mas não substituem o runtime 8.

## Executar (PowerShell na raiz)

Em um clone novo, copie `backend/AutoFlow.API/Properties/launchSettings.example.json` para `launchSettings.json` na mesma pasta. A configuração local não é versionada.
1. Copie `.env.example` para `.env` e defina SQL_PASSWORD forte. Execute `docker compose up -d db` ou use seu SQL Server.
2. Configure `$env:ConnectionStrings__Database='Server=localhost,1433;Database=AutoFlow;User Id=sa;Password=SUA_SENHA;TrustServerCertificate=True'`. TrustServerCertificate apenas local; produção requer certificado válido e conta SQL de privilégio mínimo.
3. `dotnet restore AutoFlow.sln`
4. `dotnet tool restore`
5. `dotnet ef database update --project backend/AutoFlow.Infrastructure --startup-project backend/AutoFlow.API`
6. `$env:ASPNETCORE_ENVIRONMENT='Development'`; `$env:Seed__Password='SUA_SENHA_FORTE'`; `dotnet run --project backend/AutoFlow.API -- --seed`
7. `dotnet dev-certs https --trust`; `dotnet run --project backend/AutoFlow.API --launch-profile https`
8. Em outro terminal: `cd frontend`; `npm ci`; `npm run dev -- --host localhost`.
9. Abra http://localhost:5173. Proxy Vite encaminha /api para HTTPS local. Em produção, servir frontend e API na mesma origem HTTPS; não usar proxy de desenvolvimento.

Usuários seed: consultant@autoflow.local, manager@autoflow.local, mechanic@autoflow.local; senha exclusivamente a definida em Seed__Password. Sem credenciais fixas no código. Remova a variável após o seed.

## Verificação
`dotnet test AutoFlow.sln` e `npm run build --prefix frontend`.
Os testes de EF InMemory verificam filtros e guardas de escrita, sem substituir testes de integração SQL/HTTP. O teste de fluxo com SQL requer infraestrutura disponível.

## Segurança e operação
Perfis têm permissões determinadas no servidor. Cookies expiram em oito horas; logout invalida o cookie no cliente. Rotação do security stamp do Identity permite revogar sessões. SQL não deve ficar publicamente exposto. Em múltiplas instâncias, persistir e proteger as chaves de Data Protection compartilhadas. Não registrar corpos de login ou segredos. Configuração sensível vem de ambiente/secret manager.

## Pendências
Fases 2–6 descritas em docs/PHASES.md. Não há OS, portal do cliente, uploads, relatórios, notificações, Dapper, Hangfire ou SignalR operacional nesta fase. A auditoria estruturada é base para os próximos módulos. Cadastro e gestão de usuários em produção, recuperação de senha e testes completos HTTP permanecem pendentes.
