# Validação da Fase 1
- Backend: build bem-sucedido, zero avisos e erros de compilação.
- Frontend: TypeScript e Vite build aprovados; aviso de bundle principal acima de 500 kB.
- xUnit: seis casos aprovados (validação de login, permissões de mecânico e consultor, isolamento de leitura e guarda de escrita).
- Migration InitialIdentity gerada por EF Core, ainda não aplicada a um SQL Server.
- EF avisa sobre relacionamento obrigatório com Dealership filtrada: a busca pré-autenticação do Identity não usa Include da concessionária. A listagem de equipe aplica explicitamente o filtro da sessão. Novas consultas de usuários devem preservar essa restrição.
- Sem validação visual no navegador ou testes HTTP completos nesta entrega.
- Sem Docker/SQL Server disponível no ambiente; seed e fluxo real de login pendentes de execução com banco.
