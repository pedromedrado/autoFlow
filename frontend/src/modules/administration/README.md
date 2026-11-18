# Administração

A rota /administration exige a permissão users.manage, exclusiva do perfil Master.
Use a página para consultar, criar e editar usuários operacionais da concessionária.
Os acessos são definidos pelo perfil e validados pela API.

Para provisionar o Master de teste, execute o seed existente em Development com
o banco isolado e a variável Seed__Password definida. O usuário inicial é
master@autoflow.local. O seed preserva contas existentes.
