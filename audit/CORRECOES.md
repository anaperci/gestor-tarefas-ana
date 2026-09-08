# Correções da auditoria — Clareza

Atualização de 08/09/2026. O relatório original registra o estado anterior às correções. Este documento descreve o código resultante e seus limites de validação.

## Mudanças

| Achado | Correção |
|---|---|
| F01 | Sanitização do HTML no servidor, editor e exportação; atributos escapados; autenticação em cookie HttpOnly. |
| F02–F03 | Exportação e comentários verificam acesso à tarefa antes de ler conteúdo. |
| F04 | Grupos são filtrados no servidor pelos projetos autorizados. |
| F05 | Slides, comentários e reordenação verificam o conteúdo pai e o workspace. |
| F06 | Transformação valida origem, destino, papel e responsável; criação e vínculo são transacionais e idempotentes. |
| F07–F08 | Projetos, tarefas, dashboard, anexos, menções e voz usam a autorização central; projetos pessoais de terceiros são privados também para administradores. |
| F09 | Tarefa, checklist e subtarefas são gravados na mesma transação, com rollback em qualquer falha. |
| F10 | Gravações por tarefa são ordenadas, enviam somente os campos alterados e conferem a versão do banco. Conflitos preservam rascunhos para revisão explícita. |
| F11 | Notas descarregam edições pendentes ao sair; notas, conteúdo e slides preservam rascunhos por usuário no navegador. |
| F12 | Consultas PostgREST usam throwOnError e tratamento central de falhas. Leituras malsucedidas não viram listas vazias e gravações malsucedidas não viram sucesso. |
| F13 | Login, instalação e endpoints de IA aplicam cotas atômicas persistidas no PostgreSQL. |
| F14 | Tokens incluem versão derivada do hash da senha; troca de senha invalida sessões anteriores e renova a sessão da troca pelo próprio usuário. |
| F15 | Instalação inicial desabilitada por padrão, com verificação fechada em falhas e bootstrap sob bloqueio transacional. |
| F16 | Compartilhamentos, membros e criação de workspace são transacionais. Reordenações e exclusões compostas também usam RPCs atômicos. |
| F17 | Next.js, React, Supabase, sanitização e dependências atualizados; runtime alinhado em Node 22. Auditoria npm sem vulnerabilidades reportadas. |
| F18 | `assignedTo: null` efetivamente remove o responsável. |
| F19 | Conteúdo sem workspace é pessoal e acessível ao criador; workspaces excluídos são removidos das permissões de listagem. |
| F20 | Conteúdo carrega todas as páginas; tarefas/projetos e filhos também são paginados, com lotes para evitar URLs de consulta excessivas. |
| F21 | Atalhos usam estado atual e atuam somente na visualização apropriada. |
| F22 | Trigger mantém status, checked e data de conclusão coerentes, inclusive em tarefas pessoais. |
| F23 | Prazos são datas civis e usam o dia de São Paulo; validação rejeita datas inexistentes. |
| F24 | Totais deixam de depender dos cortes visuais; conclusão semanal usa completed_at; rotina considera criação/exclusão e versiona futuras alterações de agenda. |
| F25 | SWR tem chaves por sessão; logout limpa caches e estado, cancela gravações enfileiradas e descarta respostas de sessões encerradas. |
| F26 | Microfone permitido na origem; cancelamento libera dispositivo e ignora resultado atrasado; MIME real é preservado; repetição da criação pula itens já confirmados. |
| F27 | Agenda acessível no menu, URLs de embed validadas e Calendar permitido na CSP. |
| F28 | Exportação usa a opção de impressão recebida no servidor e inclui checklist; HTML é sanitizado. |
| F29 | Migração consolidada e reaplicável inclui tabelas, colunas, RLS, funções, privilégios e bucket privado; scripts não contêm seeds de usuários/senhas. |
| F30 | Preferências e rascunhos malformados não impedem abrir a aplicação; filtros de conteúdo são separados por usuário/workspace. |
| F31 | Falhas de operações administrativas e de conteúdo são apresentadas; salvamento pendente conserva texto e oferece nova tentativa. |
| F32 | Testes antigos com credenciais fixas substituídos por regressões isoladas; artefatos gerados retirados do versionamento; lint e TypeScript verificados. |

Grupos têm URLs próprias `/grupos/<id>`, com botão para copiar o link. Projetos têm `/projetos/<id>`. Login preserva o destino, renomeação preserva o endereço, e recursos inexistentes ou inacessíveis apresentam mensagem clara.

## Validação

- ESLint sem erros ou avisos; TypeScript e build de produção aprovados.
- 8 testes unitários/de rotas: HTML seguro, datas civis, fila/versões, falhas reais do cliente PostgREST, revogação, origem de requisições, isolamento de subrecursos e timestamp PostgreSQL com fuso.
- PostgreSQL descartável: migração aplicada duas vezes; permissões do service role/anon, privacidade pessoal, rollback de checklist, conflitos, remoção de responsável, conclusão, quotas, workspace/membro, exclusão de grupo e transformação idempotente.
- 8 testes no Chrome: links, grupos vazios, acesso negado, login com destino, HTML seguro, políticas de microfone/Calendar, notas ao navegar, recuperação após falha e celular com preferências corrompidas.
- Backup privado anterior à migração: 23 tabelas do aplicativo, 623 registros. Arquivo não versionado e não exposto na aplicação.

## Limites

Não há como recuperar datas de conclusão e alterações antigas de agenda que nunca foram registradas; as novas colunas e versões preservam eventos futuros. Mensagens Slack, processamento pago de áudio/IA e envio real de anexos não são disparados pela suíte. O projeto Supabase é compartilhado com outros sistemas; os avisos globais e objetos desses sistemas ficam fora desta alteração. Rascunhos ficam no navegador onde a edição foi feita; não substituem backup do banco.

## Publicação

Publicado em `https://tarefas.anapaulaperci.com.br` com a revisão funcional `7a4bc32`. Migração aplicada e registrada no Supabase. Código sincronizado no GitHub e na VPS; imagem anterior preservada para rollback.

A checagem autenticada no container confirmou HTTP 200 em dez endpoints: sessão, projetos, tarefas, grupos, dashboard, workspaces, notas, rotina, histórico da rotina e conteúdo. A consulta anônima às tarefas respondeu 401; os projetos pessoais de terceiros não apareceram. A chamada de logout com a origem pública foi aceita. O banco confirmou zero divergências entre status e checked e ausência de privilégio de execução anônima no RPC de tarefas.

A URL pública de saúde respondeu 200, e o Chrome abriu a tela de login pelo caminho de grupo sem erros de JavaScript. Exemplo de grupo existente: `/grupos/tg-rotina-criacao`.
