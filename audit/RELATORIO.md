# Auditoria técnica — Tarefas da Ana / Clareza

Data: 06/09/2026. Repositório: `gestor-tarefas-ana`. Commit examinado: `29b79ec`.

O projeto compila, mas tem falhas de autorização, execução de HTML não confiável e perda de gravações. A prioridade é proteger os dados e tornar o salvamento confiável antes de ajustes visuais.

Foram registrados **32 achados**, agrupando manifestações da mesma causa. Foram reproduzidos **13 cenários nas rotas reais com banco simulado e 5 cenários na interface real com APIs simuladas**. O código funcional não foi alterado; os arquivos adicionados estão em `audit/`.

## Escopo e limites

Inventário: 119 arquivos em `src`, incluindo 55 arquivos de rotas HTTP. Revisão de autenticação, autorização, tarefas, projetos, grupos, workspaces, conteúdo, comentários, anexos, notas, rotinas, notificações, captura de voz, exportação, cache, configuração e SQL versionado. Verificações: TypeScript, ESLint, build de produção, auditoria npm e Chrome automatizado.

As reproduções não consultam nem modificam o banco real: o script de rotas carrega os handlers TypeScript e substitui o Supabase por memória; o navegador carrega o build real e intercepta todas as APIs com dados fictícios. Os testes **confirmam defeitos existentes**, não são testes de regressão aprovando uma correção.

Não foram verificados o esquema/RLS efetivamente aplicado no Supabase, a configuração do proxy de produção, backups, logs reais, entrega Slack, chamadas de IA, upload real nem desempenho sob carga. Não há alegação de exploração ocorrida em produção. Os resultados antigos em `test-results/` não foram tratados como falhas atuais.

## Verificações executadas

| Verificação | Resultado | Evidência |
|---|---|---|
| TypeScript | Passou; também passou na etapa TypeScript do build | `build.log` |
| Build de produção | Passou com rede liberada; primeira tentativa bloqueada no download Google Fonts | `build.log` |
| ESLint | 24 erros e 30 avisos | `eslint.json` |
| npm audit | 17 pacotes sinalizados: 11 high, 5 moderate, 1 low | `dependencies.json` |
| Reproduções nas rotas | 13 comportamentos defeituosos confirmados | `reproduction-results.json`, `reproduce.cjs` |
| Navegador | 5 comportamentos defeituosos confirmados | `browser-results.json`, `browser.cjs`, PNGs |

## Achados e correções propostas

**F01 — Crítica: execução de JavaScript em descrição de tarefa (XSS persistente).**

Em `src/components/task-manager.tsx:1034`, `RichEditor` atribui a descrição diretamente a `innerHTML`. A API aceita HTML sem sanitização; a exportação também o interpola em HTML. `next.config.ts` permite scripts inline e o token fica no `localStorage`. Um editor com acesso à tarefa pode salvar conteúdo que executa no navegador de outro participante, inclusive administrador. **B01** confirmou a execução de um marcador inofensivo no editor real; não houve leitura/exfiltração de credenciais. Corrigir com sanitização por lista permitida na entrada/renderização, inclusive exportação, e proteção de sessão. A conversão markdown também precisa escapar aspas em atributos, além de `<`, `>` e `&` (`src/lib/utils.ts`).

**F02 — Alta: exportação lê tarefas sem verificar acesso.**

`src/app/api/tasks/[id]/export/route.ts:41` exige somente autenticação. Um usuário sem vínculo com o projeto consegue obter descrição, título, responsável e metadados conhecendo o ID, inclusive de tarefa pessoal. **A01** verificou que `userCanAccessProject` negava o acesso, enquanto a exportação retornava 200 com o texto privado. Usar a mesma autorização de recurso em todas as rotas de tarefa, antes de consultar os detalhes.

**F03 — Alta: comentários de tarefas não são isolados.**

`src/app/api/tasks/[id]/comments/route.ts` lista comentários para qualquer autenticado e permite comentar verificando apenas a existência da tarefa. **A02** confirmou a leitura de conversa privada por usuário sem vínculo. Aplicar autorização de tarefa tanto no GET quanto no POST e bloquear leitura de recursos excluídos.

**F04 — Alta: listagem de grupos expõe todos os projetos.**

`src/app/api/task-groups/route.ts:29` devolve todos os grupos; o comentário diz que o filtro é feito no cliente. Isso expõe nomes e IDs de projetos inacessíveis a qualquer autenticado. **A03** reproduziu. Filtrar no servidor pelos projetos efetivamente autorizados, incluindo privacidade pessoal e exclusões.

**F05 — Alta: slides e comentários do Hub ignoram workspace.**

As rotas `content/[id]/slides`, `content/slides/[slideId]`, `content/slides/reorder` e `content/[id]/comments` verificam apenas `canAccessContent`. Diferentemente da rota principal `content/[id]`, elas não verificam o workspace do conteúdo. **A04** alterou um slide de outro workspace. Compartilhar um guard de conteúdo entre todos os subrecursos; na reordenação, validar também que todos os IDs pertencem ao mesmo conteúdo autorizado.

**F06 — Alta: transformar conteúdo em tarefa contorna permissões.**

`src/app/api/content/[id]/transform-to-task/route.ts` não verifica acesso ao conteúdo de origem, ao projeto de destino nem permissão de edição de tarefas. Pode criar uma tarefa atribuída ao solicitante em projeto privado, o que ainda pode conceder acesso posterior via regra de atribuição. **A05** confirmou a criação no destino recusado pelo helper de acesso. Validar origem, destino, papel e responsável; criar tarefa e vínculo em transação/idempotência para evitar duplicatas.

**F07 — Alta: autorização dos anexos diverge das restrições de projeto.**

`src/lib/auth.ts:assertTaskAccess` libera qualquer membro do workspace, sem observar `project_shares`. `src/lib/access.ts:userCanAccessProject` observa essa restrição. **A09** confirmou que o mesmo usuário é recusado por um helper e autorizado pelo outro. A divergência atinge leitura, envio e exclusão de anexos e menções. Unificar a política com os RPCs SQL; também esclarecer a regra para compartilhamento sem membership, que hoje diverge entre `access.ts` e `supabase-workspaces.sql`.

**F08 — Alta: privacidade pessoal aplicada apenas em algumas listagens.**

`src/app/api/dashboard/route.ts` consulta todos os projetos e tarefas para administradores, enquanto `/projects` e `/tasks` removem projetos pessoais de terceiros. **A10** mostrou um projeto pessoal e sua contagem no dashboard e sua ausência na listagem normal. Além disso, os helpers liberam admins antes de verificar a natureza pessoal do recurso, permitindo operações diretas. Aplicar a regra de privacidade prometida pela interface em autorização central, consultas, exportação e seleção de projetos da captura de voz.

**F09 — Alta: checklist e subtarefas podem desaparecer em salvamento.**

`src/app/api/tasks/[id]/route.ts` apaga todos os itens e depois insere a lista recebida, sem transação e sem verificar os erros dessas operações. **A06** simulou falha do INSERT: os itens anteriores desapareceram e a resposta foi 200. Gravar tarefa e filhos atomicamente, preservando os dados se qualquer etapa falhar. Não substituir checklist/subtarefas quando a edição é apenas de outro campo.

**F10 — Alta: gravações concorrentes de tarefa sobrescrevem alterações.**

`src/components/task-manager.tsx:3433` envia o objeto inteiro a cada edição, inclusive cada tecla de título/descrição; não há debounce, fila ou versão. O PUT também faz read-modify-write de todos os campos. Em rede lenta, uma requisição antiga pode terminar depois da nova, ou um colega pode sobrescrever campos que não editou. Na falha, a UI mantém o valor otimista sem reconciliar. Evidência de código; a inversão de gravações no banco real não foi executada. Enviar somente campos alterados, serializar por tarefa e usar controle de versão/conflito no servidor.

**F11 — Alta: sair de Anotações perde texto recente.**

`src/components/task-manager.tsx:2570` cancela o timer de 1500 ms ao desmontar `NotesTab`, sem salvar. **B03** digitou e navegou para Rotina: nenhuma requisição de atualização foi enviada. O método `saveNote` ainda limpa a marca de edição antes do sucesso e ignora falhas. Persistir o rascunho, finalizar gravações pendentes na navegação e mostrar/reter erros para nova tentativa.

**F12 — Alta: erros do banco parecem sucesso ou dados vazios.**

Exemplos: GET `/tasks`, `/projects`, `/workspaces`, `/dashboard`; PATCH/DELETE `/personal/tasks/[id]`; reordenação de grupos; marcação de notificações. **A08** fez a consulta de tarefas falhar e recebeu `200 []`. O usuário interpreta indisponibilidade como desaparecimento dos dados. Em `requireAuth`, falha da consulta de usuário vira 401 e pode apagar a sessão no cliente. Verificar `error` em cada operação e distinguir falha de infraestrutura de ausência/negativa de acesso.

**F13 — Alta: login sem limitação de tentativas no aplicativo.**

`src/lib/rate-limit.ts` implementa um limitador, mas não há chamada a `consumeRateLimit` nas rotas; `/auth/login` valida senhas indefinidamente. A existência de proteção adicional no proxy não foi verificada. Aplicar limites por conta e origem, com armazenamento adequado à implantação, inclusive nos endpoints caros de IA. Não foi realizado teste de força bruta.

**F14 — Alta: trocar senha não revoga tokens emitidos.**

`src/lib/auth.ts:generateToken` emite JWT por 30 dias. A troca de senha altera somente `password_hash`; `requireAuth` verifica assinatura e existência do usuário, sem versão de sessão ou data de revogação. Um token anterior continua utilizável após redefinição de senha. Implementar revogação/versionamento por usuário/sessão. A releitura do papel e a rejeição de usuário soft-deleted já existem e são pontos positivos.

**F15 — Alta, condicionada à falha de consulta/instalação: setup abre quando a contagem falha.**

`src/app/api/setup/route.ts` não verifica o erro da contagem. `count = null` é tratado como instalação vazia e não impede o INSERT de administrador. A contagem seguida de INSERT também não é atômica durante o primeiro setup. Não foi criado usuário real. Falhar de forma fechada e executar o bootstrap como operação única, autorizada e atômica.

**F16 — Alta: substituir compartilhamentos pode ampliar acesso após falha.**

`src/app/api/projects/[id]/share/route.ts` apaga a lista antes de inserir a nova. Uma falha posterior deixa o projeto sem restrições; em `supabase-workspaces.sql`, ausência de shares libera membros do workspace. O mesmo padrão em `workspaces/[id]/members` pode remover o acesso da equipe, e exclusão de projeto/grupo pode ficar parcialmente aplicada. Evidência de código, sem falha injetada nesses endpoints. Usar transações e verificar todas as etapas; deduplicar IDs antes de gravar.

**F17 — Alta: dependências com avisos de segurança conhecidos.**

`npm audit` sinalizou 17 pacotes (11 high, 5 moderate, 1 low), incluindo `next`, `ws`, `sharp` e DiceBear. Isso é contagem de pacotes afetados/transitivos, não de ataques demonstrados. O projeto fixa Next 16.1.6. Atualizar o lockfile e componentes relacionados de forma coordenada, com build e regressão; evitar atualização forçada sem revisão. A aplicabilidade de cada aviso depende do uso: por exemplo, o [aviso do Next sobre Server Actions](https://github.com/vercel/next.js/security/advisories/GHSA-m99w-x7hq-7vfj) exige ao menos uma Server Action; não se deve inferir exploração apenas da versão. O [aviso do DiceBear](https://github.com/dicebear/dicebear/security/advisories/GHSA-gcr2-9v8m-gq45) também está documentado pelo mantenedor. Lista completa em `dependencies.json`.

**F18 — Média: não é possível remover o responsável com `null`.**

O schema do PUT de tarefa aceita `assignedTo: null`, mas a gravação usa `body.assignedTo ?? task.assigned_to`. **A07** confirmou manutenção do responsável anterior. Distinguir `undefined` de `null`, como já é feito para `estimateHours`. Ao mover tarefa, revalidar também o responsável existente contra o destino, mesmo quando ele não muda.

**F19 — Média: conteúdo pode ser criado e ficar inacessível ao próprio autor.**

POST `/content` aceita workspace ausente ou sem membership; GET/PUT `/content/[id]` exigem workspace acessível para não-admin. `/content` independente monta o board sem workspace. **A12** criou uma ideia sem workspace e recebeu 403 ao reabri-la com o mesmo usuário. O PUT também permite mover conteúdo sem validar o destino. Definir destino acessível obrigatório ou regra explícita para conteúdo pessoal/global.

**F20 — Média: lista de conteúdos para silenciosamente em 50 itens.**

GET `/content` tem limite padrão 50; `api.getContentItems` não oferece offset/limit e o board não carrega páginas seguintes. **A13** cadastrou 51 itens fictícios e recebeu 50. Implementar paginação visível/infinita com total/continuação. `/tasks` e outras listas sem paginação também dependem do limite de resposta configurado no Supabase; o valor real não foi consultado.

**F21 — Média: atalho N usa estado antigo e conflita com o dashboard.**

`src/components/task-manager.tsx:3651` memoriza o handler só por `canEdit`, congelando `addTask` antes de carregar projetos. `DashboardView` mantém outro listener de N. **B04** mostrou o popover com projeto disponível e, simultaneamente, o aviso falso de que nenhum projeto existe (`shortcut-n.png`). Tornar o handler atual e ativar apenas um conjunto de atalhos por tela. No board de conteúdo há outro listener que também precisa de escopo.

**F22 — Média: conclusão usa dois estados independentes.**

Em `TaskRow`, marcar checkbox muda apenas `checked`; alterar status muda apenas `status`. O Kanban também altera só o status, enquanto o dashboard e a área pessoal usam regras diferentes. Uma tarefa riscada pode continuar em “A Fazer” e contar como atrasada. Definir uma única semântica de conclusão e normalizar no servidor. Evidência direta dos handlers; não foi modificado nenhum dado real.

**F23 — Média: datas são exibidas um dia antes e vencem cedo.**

`src/components/kanban/kanban-board.tsx:formatDate` usa `new Date('YYYY-MM-DD')` e formata em horário local. Com `TZ=America/Sao_Paulo`, `2026-09-06` exibiu **05 de set.** A comparação com o instante atual marca como atrasada uma tarefa que vence hoje. Dashboard e rotinas também usam o timezone do servidor, sem timezone explícito. Tratar prazo como data civil e padronizar o fuso em servidor/cliente.

**F24 — Média: métricas do dashboard e de rotinas têm recortes incorretos.**

No dashboard, o caminho de editor usa todas as tarefas do RPC como `weekly_stats`; **A11** incluiu tarefa concluída em 2020. A UI chama isso de “minhas tarefas”, mas não filtra responsável. Para admin, `updated_at` não representa a data de conclusão. Contagens de hoje/atrasadas são calculadas depois de cortes de 7/5 itens. `/routines/history` usa a quantidade atual de rotinas ativas para todos os dias e ignora o calendário de cada rotina. Separar totais da amostra exibida, usar data de conclusão e calcular rotina elegível por dia.

**F25 — Alta: cache compartilhado entre sessões e estados sem sincronização.**

`src/lib/use-dashboard-data.ts` usa a chave fixa `/dashboard`; os hooks de conteúdo também omitem o usuário nas chaves. `handleLogout` limpa parte do estado e o token, mas não o cache SWR nem `detailTask`. Ao entrar com outra conta sem recarregar a página, pode haver exibição transitória de dados da sessão anterior. Evidência de código; troca de contas reais não foi executada. Além disso, criar/concluir tarefa no dashboard revalida só SWR e deixa a lista principal em `TaskManager` desatualizada. Isolar/limpar cache por sessão e compartilhar invalidação entre as telas.

**F26 — Média: captura de voz bloqueada; cancelamento e repetição incompletos.**

`next.config.ts` envia `microphone=()` enquanto `VoiceCapture` chama `getUserMedia`. **B02** confirmou que a política efetiva do documento nega microfone. Permitir a própria origem. O `close/reset` não para MediaRecorder/trilhas; depois de corrigir a política, fechar durante gravação continuará capturando. `createAll` pode duplicar itens ao repetir após falha parcial. Adicionar cleanup, cancelamento e controle dos itens já criados. Essas duas últimas manifestações foram revisadas no código, sem gravação/chamada real de IA.

**F27 — Média: agenda embutida bloqueada pela CSP.**

`AgendaTab` aceita iframe de Google Calendar, mas `next.config.ts` não define `frame-src`; a política recai em `default-src 'self'`, bloqueando a origem do Google. Liberar apenas as origens suportadas e validar URL/protocolo antes de persistir. Evidência de configuração; integração com calendário real não foi realizada.

**F28 — Média: exportação não abre impressão automaticamente e omite checklist.**

`src/lib/api.ts:exportarTarefa` busca `?print=1`, transforma o HTML em blob e abre a URL blob. O script do documento consulta `location.search`, que já não contém `print=1`; por isso não chama `window.print`. Também não consulta/renderiza o checklist, apesar da descrição da função prometer esse conteúdo. Incorporar a decisão de imprimir ao HTML gerado, incluir os itens e reservar a janela antes do fetch para evitar bloqueio de popup.

**F29 — Média: SQL versionado não reproduz toda a aplicação.**

As rotas de rotinas gravam `routine_items.days`, mas nenhum SQL versionado cria/adiciona essa coluna. As rotas Slack usam `slack_channels`, sem CREATE TABLE correspondente no repositório. `supabase-task-groups.sql` pressupõe o projeto `proj-1` e pode falhar em instalação com banco vazio. Não existe cadeia automatizada de migrações com teste de instalação limpa. Registrar mudanças faltantes, separar seeds específicos da equipe e validar a aplicação em banco descartável. Não é afirmação de ausência dessas estruturas em produção.

**F30 — Média: configuração local corrompida derruba a aplicação.**

`src/components/task-manager.tsx:3204` faz `JSON.parse` de `nexia-group-order` durante render sem tratamento. **B05** reproduziu erro de aplicação após salvar JSON inválido. Recuperar para padrão e validar a estrutura lida. A preferência de ordenação também deveria ser contextualizada por usuário/workspace quando aplicável.

**F31 — Média: falhas de salvamento não são recuperáveis em vários editores.**

`ContentBoard.flush` faz await da API sem catch nas chamadas por timer; o estado pode ficar em “saving” após falha, sem aviso/retry. `CarouselSlideEditor.salvar` limpa `sujoRef` antes da confirmação. `AdminPanel` tem catches vazios em criar usuário, trocar senha/papel/avatar e compartilhar. Uma operação rejeitada parece não responder. Tratar rejeições, manter o rascunho até confirmação, indicar estado de erro e permitir nova tentativa. Validar também o caso de senha própria na tela admin, cujo endpoint exige `currentPassword`.

**F32 — Média: a suíte existente e os controles de qualidade não refletem a versão atual.**

`tests/ordum.spec.ts` espera marca Ordum, toggle de tema e botão “Dashboard”, enquanto a interface atual é Clareza, light-only e usa “Minha Área”. Há credenciais em texto no teste e em seeds SQL: não foram usadas/reproduzidas neste relatório; devem ser removidas do código e trocadas caso ainda válidas. `playwright.config.ts` reaproveita qualquer servidor na porta 3000, com risco de testar outro projeto. ESLint falha com 24 erros/30 avisos; não existe script de teste no package.json. Reescrever testes com fixtures isoladas, servidor dedicado, matriz admin/editor/viewer e checks no CI. Parte dos erros de lint é regra de hooks/compiler, não 24 bugs de usuário independentes.

## Ordem de execução proposta

1. **Proteção de dados:** F01–F08, F12–F17 e F25. Centralizar autorização de recurso e privacidade; sanitizar HTML; fechar setup em falha; proteger/revogar sessões; atualizar dependências com regressão.
2. **Confiabilidade de gravação:** F09–F11, F16, F18, F19 e F31. Transações, envio de alterações pontuais, controle de concorrência e recuperação de rascunho.
3. **Consistência da interface:** F20–F28 e F30. Paginação, atalhos, datas, conclusão, métricas, cache, voz, agenda e exportação.
4. **Sustentação:** F29 e F32. Migrações reprodutíveis, fixtures, testes de autorização e falhas de banco/rede, CI e verificação controlada em staging.

Critérios mínimos de aceite: usuário sem acesso recebe 403/404 em todos os recursos; projeto pessoal permanece privado inclusive para outro admin; falha de INSERT preserva checklist anterior; digitação rápida e navegação não perdem texto; logout elimina dados da sessão anterior; status/conclusão e datas concordam em todas as telas; build, lint e testes de regressão passam.

## Como reproduzir

Na raiz do projeto, com as dependências já instaladas:

```sh
node audit/reproduce.cjs
```

Para as reproduções da interface, após `npm run build`, em um terminal:

```sh
npm run start -- --hostname 127.0.0.1 --port 3017
```

Em outro terminal, com Google Chrome instalado:

```sh
node audit/browser.cjs
```

O teste intercepta `/api/*` e bloqueia origens externas. A mensagem do Next sobre `output: standalone` apareceu com `next start`, mas o servidor local funcionou; a implantação Docker usa `server.js` conforme o Dockerfile. Os scripts falharão quando os defeitos correspondentes forem corrigidos: converter então suas asserções para o comportamento esperado.

O backend usa chave de serviço. RLS habilitado não corrige uma rota que faz consulta privilegiada sem autorização; a documentação explica que `service_role` ignora RLS. Isso sustenta a necessidade dos guards centralizados acima. [Documentação oficial do Supabase](https://supabase.com/docs/guides/database/postgres/row-level-security).
