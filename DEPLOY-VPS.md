# Deploy na VPS (Docker) — Clareza

App Next.js (standalone) em container Docker, atrás de reverse proxy com HTTPS.
Mesmo padrão dos outros projetos NexIA na VPS (`/opt/apps/...`).

## Pré-requisitos
- VPS com Docker + Docker Compose.
- Um subdomínio apontando pra VPS (produção: `tarefas.anapaulaperci.com.br` → 76.13.226.25, DNS-only na Cloudflare).
- Reverse proxy (Caddy/Nginx/Traefik) já rodando na VPS.
- **Chave NOVA do Supabase** (`sb_secret_...`) — a legada (`eyJ...`) foi desativada.

## 1. Subir o código
```bash
sudo mkdir -p /opt/apps/clareza && cd /opt/apps/clareza
git clone https://github.com/anaperci/gestor-tarefas-ana.git .
# ou: git pull, se já clonado
```

## 2. Criar o .env.production
Copie de `.env.production.example` e preencha:
```bash
cp .env.production.example .env.production
nano .env.production
```
Obrigatórios:
- `NEXT_PUBLIC_SUPABASE_URL=https://ydnwqptkrftonunyjzoc.supabase.co`
- `SUPABASE_SERVICE_ROLE_KEY=sb_secret_...`   ← chave NOVA
- `JWT_SECRET=` (gere com `openssl rand -base64 48`)
- `NEXT_PUBLIC_APP_URL=https://tarefas.anapaulaperci.com.br`

## 3. Build + subir
```bash
docker compose --env-file .env.production up -d --build
docker compose logs -f app    # conferir "Ready"
```
O container expõe `127.0.0.1:3000` (só local — o proxy publica via HTTPS).

## 4. Reverse proxy
Apontar o subdomínio pra `127.0.0.1:3000`.

Caddy (exemplo):
```
tarefas.anapaulaperci.com.br {
    reverse_proxy 127.0.0.1:3000
}
```

## 5. Atualizar (deploys futuros)
```bash
cd /opt/apps/clareza
git pull
docker compose --env-file .env.production up -d --build
```

## Notas
- Migrations SQL rodam no Supabase (SQL Editor), não na VPS.
- O acesso é por nome de usuário e senha. Não há recuperação por email: quem esquecer a senha depende de um admin redefinir na tela de usuários.

## Correções de setembro de 2026

Runtime: Node 22. As credenciais entram somente no runtime, pelo `.env.production`; o Docker não copia arquivos de ambiente para a imagem.

Antes de publicar, execute `npm ci`, `npm run lint`, `npm test`, `npm run test:db`, `npm run build` e `npm run test:e2e`. O teste de banco usa PostgreSQL descartável (PGlite) e o navegador usa dados fictícios, sem chamar integrações externas. Chrome é necessário para o Playwright.

A migração `supabase/migrations/20260908124122_audit_reliability.sql` inclui o esquema do aplicativo, sem usuários ou senhas pré-definidas. Faça backup e aplique-a no projeto vinculado antes do novo container:

```sh
supabase db query --linked --file supabase/migrations/20260908124122_audit_reliability.sql
```

O SQL pode ser reaplicado. `ALLOW_SETUP=false` é o padrão; habilite apenas para criar o primeiro administrador em banco vazio. Sessões antigas exigem novo login após esta atualização, devido à mudança para cookie HttpOnly e revogação após troca de senha.

Links permanentes: `/grupos/<id>` e `/projetos/<id>`. Eles exigem login e respeitam as permissões do recurso. Renomear um grupo mantém seu endereço.

Gravações conflitantes mantêm o rascunho no navegador, por usuário. O botão “Revisar e tentar novamente” permite reaplicar explicitamente a edição após consultar a versão atual. Datas históricas de conclusão que não foram registradas anteriormente não são inventadas; a contagem semanal passa a usar conclusões registradas após a migração. Alterações futuras de dias da rotina passam a ter histórico próprio.
