# Deploy na VPS (Docker) — Clareza

App Next.js (standalone) em container Docker, atrás de reverse proxy com HTTPS.
Mesmo padrão dos outros projetos NexIA na VPS (`/opt/apps/...`).

## Pré-requisitos
- VPS com Docker + Docker Compose.
- Um subdomínio apontando pra VPS (ex: `clareza.nexialab.com.br`).
- Reverse proxy (Caddy/Nginx/Traefik) já rodando na VPS.
- **Chave NOVA do Supabase** (`sb_secret_...`) — a legada (`eyJ...`) foi desativada.
- Credenciais Brevo (API key + remetente verificado), se quiser email.

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
- `NEXT_PUBLIC_APP_URL=https://clareza.nexialab.com.br`
- Brevo (opcional p/ email): `BREVO_API_KEY`, `BREVO_SENDER_EMAIL`, `BREVO_SENDER_NAME=Clareza`

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
clareza.nexialab.com.br {
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
- Sem `NEXT_PUBLIC_APP_URL` correto, os links dos emails saem como localhost.
- Sem Brevo configurado, o app funciona mas emails só ficam logados.
