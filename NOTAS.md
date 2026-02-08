# Notas do projeto (Resumo)

## URLs
- Painel Admin: https://admin.testandoapp.com
- API: https://api.testandoapp.com
- Site público: https://testandoapp.com

## Repositórios
- Painel: https://github.com/Marcelo520/painel-admin-v5
- Backend: https://github.com/Marcelo520/rh-recruta-backend

## Backend (Coolify)
- Porta: 3001
- Variáveis em **Production Environment Variables**:
  - PORT=3001
  - DB_HOST=...
  - DB_PORT=5432
  - DB_NAME=rh_recruta
  - DB_USER=...
  - DB_PASSWORD=...
  - ADMIN_USER=... (definido no Coolify)
  - ADMIN_PASSWORD=... (definido no Coolify)
  - JWT_SECRET=... (definido no Coolify)

## Banco (PostgreSQL)
- Banco: rh_recruta
- Tabelas usadas: clientes, instalacoes, notificacoes, documentos, operadores, operadores_usuarios

## Permissões no painel
- **Admin**:
  - Vê tudo (operadores/instaladores)
  - Cria operadores e instaladores
  - Exclui clientes, operadores e instaladores
  - Troca senha de instaladores
- **Operador**:
  - Vê apenas seus instaladores
  - Cria instaladores
  - Troca senha e exclui instaladores
  - Não cria/exclui operadores
  - Não exclui clientes
- **Instalador**:
  - Vê apenas o próprio operador
  - Libera clientes
  - Não exclui clientes nem acessa área de operadores

## Login
- O login usa a API:
  - POST /api/auth/login
  - Retorna token + role (admin/operador/instalador)
- O painel guarda o token em localStorage:
  - adminAuthToken
  - adminAuthRole

## Observações
- Se aparecer “sessão expirou”, limpar o localStorage (adminAuthToken/adminAuthRole) e logar novamente.
- Se alterações não aparecerem, fazer **Redeploy** no Coolify.
