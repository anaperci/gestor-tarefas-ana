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
