# Slack — grupos Criação

No Painel Admin → Slack, use **Criação · todos os projetos**. Conecte uma única URL de Incoming Webhook do canal desejado. O webhook determina o canal; o nome informado na tela serve para identificação. A URL nunca é retornada pelas APIs de configuração.

A regra reconhece grupos chamados “Criação”, ignorando acentos, maiúsculas e espaços nas extremidades, em qualquer projeto. Novas tarefas criadas pela interface, API ou diretamente no banco entram na mesma fila. “Nova tarefa” também é notificada. Inserções anteriores à instalação não são reenviadas automaticamente. Entrar no grupo após criar a tarefa também agenda a primeira notificação; editar o título não gera novos avisos.

O banco registra tarefa e notificação na mesma transação. Há uma espera inicial de 10 segundos para permitir a edição do título. O worker verifica a fila a cada 5 segundos, inclui o projeto e o link da tarefa na mensagem, e respeita os erros/limites retornados pelo Slack. Uma tarefa excluída ou retirada de Criação antes do envio é cancelada na fila. Projetos pessoais não enviam notificações.

O painel apresenta pendências, falhas e o último envio confirmado. Sem webhook, os registros ficam pendentes. Falhas temporárias são repetidas com intervalo crescente; webhooks inválidos ou revogados exigem corrigir a conexão. Salvar uma conexão reativa os envios pendentes/com falha. O botão **Enviar mensagem de teste** envia uma mensagem explicitamente identificada como teste.

## Publicação

1. Aplicar `supabase/migrations/20260908151735_slack_creation_notifications.sql` após a migração de auditoria.
A migração aproveita uma conexão anterior de Criação quando existe um único webhook identificável, inclusive de projeto excluído. Conexões globais existentes são preservadas.

2. Definir `SLACK_WORKER_SECRET` aleatório no `.env.production` da VPS (`openssl rand -hex 32`), sem versionar o valor.
3. Executar `docker compose --env-file .env.production up -d --build` para publicar o app e o serviço `slack-worker`.
4. Conectar o webhook em Painel Admin → Slack e usar o botão de teste.

O worker recebe somente o segredo de acesso ao endpoint interno. Consultas e credenciais do banco permanecem no aplicativo. Tabelas e funções da fila não podem ser acessadas por `anon`/`authenticated` do Supabase.

A fila evita duplicação normal por tarefa e usa leases para recuperar processos interrompidos. Incoming webhooks não oferecem uma confirmação transacional junto ao nosso banco: se o Slack aceitar a mensagem e a confirmação local falhar, uma nova tentativa pode duplicá-la. O sistema preserva o envio pendente em vez de descartá-lo silenciosamente.

Documentação consultada: [Incoming webhooks](https://docs.slack.dev/messaging/sending-messages-using-incoming-webhooks/) e [limites e Retry-After](https://docs.slack.dev/apis/web-api/rate-limits/).

## Verificação em produção — 08/09/2026

O webhook de “criação” foi recuperado do projeto excluído “Lancamento Academy” e conectado à regra global. Publicação funcional `f73c251`, migração registrada e worker ativo.

A tarefa `task-6895db50-c546-4a18-819e-14bb297eb4f5` foi criada como “Nova tarefa” em Criação/Rotina, renomeada para “Teste automático da integração Slack — Criação”, enviada e depois concluída. O Slack respondeu positivamente; a fila registrou `sent`, uma tentativa e confirmação em `2026-09-08T15:36:30.752Z`. Não é necessário cadastrar outro webhook para ativar a regra.

Lint, TypeScript, 12 testes unitários/de rotas, os testes PostgreSQL e 10 testes de navegador passaram. O endpoint interno recusou chamadas sem o segredo (401), a saúde pública respondeu normalmente e não surgiram novos alertas de segurança do Supabase.
