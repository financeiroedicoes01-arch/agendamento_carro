# Agendamento de carros · Edições Shalom

Aplicação web responsiva para solicitar, aprovar e acompanhar o uso dos carros. Implementação da especificação v1, com React, TypeScript, Supabase e publicação preparada para Netlify.

## Instalação de produção

Endereço: **https://agendamentocar.netlify.app**. Publicação verificada em 26/11/2026, com página inicial, arquivos do aplicativo e recursos PWA respondendo com HTTP 200. A função `maintenance` foi publicada com agenda a cada minuto. As três migrações foram aplicadas no Supabase e a revisão de segurança ficou sem alertas.

Antes de confirmar o primeiro cadastro ou recuperar uma senha, configure o Site URL como `https://agendamentocar.netlify.app` e inclua `https://agendamentocar.netlify.app/**` na lista Redirect URLs do Supabase. O e-mail administrativo indicado é `financeiroedicoes01@comshalom.org`; o perfil é concedido após confirmar esse endereço. A conta e a senha ainda devem ser criadas pelo próprio usuário. O Google continua pendente da configuração do provedor.

## Testar agora

As dependências já estão instaladas neste projeto. No PowerShell:

```powershell
npm.cmd run dev
```

Abra **http://127.0.0.1:5173**. Com o `.env` configurado, essa tela usa o Supabase real. Para explorar dados fictícios, habilite `VITE_DEMO_MODE=true` somente no ambiente de demonstração e escolha **Explorar demonstração**. Troque o perfil na faixa superior para testar motorista, responsáveis e administrador. Os carros, nomes, placas e unidades dessa demonstração são fictícios. Os dados ficam no IndexedDB desse navegador e não são enviados para o Supabase. Para reiniciar, limpe os dados do site no navegador.

A demonstração executa a mesma migração PostgreSQL da aplicação, usando PGlite e adaptadores locais de autenticação e arquivos. Ela é habilitada automaticamente apenas no desenvolvimento sem conexão configurada. O build de produção padrão exclui o banco de demonstração e pede a configuração da instalação. `VITE_DEMO_MODE=true` habilita explicitamente uma publicação de demonstração.

## Funcionalidades

- Cadastro livre, login por e-mail/senha e Google, recuperação de senha e complementação do perfil.
- Solicitação para um carro ou qualquer disponível; candidatos e decisões por veículo, sem recusas parciais ao motorista.
- Aprovação atômica, conflitos de veículo e motorista e confirmação do uso próprio de um responsável.
- Alterações e prorrogações com reserva original preservada até a decisão.
- Retirada, devolução, quilometragem, comprovantes de abastecimento e ocorrências com fotos privadas.
- Registros esquecidos e correções por responsáveis, com autoria e justificativa no histórico.
- Calendário por dia, semana e mês, cores por carro e privacidade dos detalhes de terceiros.
- Manutenção com cancelamento das reservas atingidas; viagens em andamento permanecem abertas.
- Responsabilidades temporárias e recorrências com geração gradual, datas com conflitos e edição/cancelamento de futuras ocorrências.
- Cadastros administrativos sem autoridade operacional adicional.
- Responsáveis principais podem cadastrar carros vinculados a si, editar e excluir os próprios carros em **Veículos**. A exclusão inativa o carro e preserva o histórico; solicitações pendentes, viagens abertas e recorrências devem ser resolvidas antes. A transferência do responsável principal continua administrativa, e responsáveis temporários mantêm apenas suas permissões operacionais.
- Central de avisos com leitura, Web Push com VAPID, instalação na Tela de Início e função agendada para expiração, lembretes, atrasos e recorrências.

Não há dashboard de indicadores, WhatsApp automático, e-mail de avisos de reservas, pagamentos, rastreamento nem sincronização offline.

## Instalar com dados reais

1. Esta instalação usa o projeto Supabase **agendamento_carro**, referência `naspszjjsibdjvjzfccw`. As três migrações iniciais de `supabase/migrations/` já foram aplicadas nesse projeto, incluindo regras de acesso, arquivos privados e provisionamento administrativo. Para habilitar a gestão de carros pelos responsáveis principais, aplique também `20261127160411_manager_vehicle_management.sql` antes de publicar a interface atualizada. O projeto financeiro não foi alterado.
2. Em uma nova instalação, aplique todas as migrações de `supabase/migrations/` pelo SQL Editor ou pela CLI, em ordem. Use sempre `--workdir .` com a CLI: esta pasta está dentro de um repositório maior e não deve usar a configuração Supabase da pasta pai. Confira `npx supabase db --help` e os comandos da versão instalada antes de executar alterações remotas. A configuração local fica em `supabase/config.jsonc`.
3. Copie `.env.example` para `.env.local` e preencha `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` com a URL e a chave publicável do projeto. Não coloque a chave de serviço em variáveis `VITE_`.
4. Em Supabase Auth, configure a URL do aplicativo, redirecionamentos permitidos, confirmação de e-mail, recuperação de senha e Google. Para desenvolvimento, autorize `http://127.0.0.1:5173`. Use o callback OAuth fornecido pelo Supabase na configuração do Google. O cadastro não depende de aprovação administrativa; confirmação de endereço é uma configuração de autenticação separada.
5. Nesta instalação, crie a conta com **financeiroedicoes01@comshalom.org** e confirme o endereço por e-mail. Essa indicação está cadastrada em uma tabela privada e concede administração uma única vez, somente depois da verificação do endereço. Metadados editáveis não concedem administração. Em outra instalação, o responsável pelo banco pode promover explicitamente uma conta administrativa:

   ```sql
   update public.profiles
   set is_admin = true
   where email = 'SEU_EMAIL_CADASTRADO';
   ```

6. Entre como administrador, cadastre o setor e as seis casas com os nomes reais, os usuários responsáveis e os dois carros com suas fotos. Os usuários criam suas próprias contas; o administrador pode editar seus dados após o cadastro. Complete o próprio vínculo em **Meu perfil**.
7. Confirme o fuso em **Cadastros > Configurações**. O valor inicial é `America/Sao_Paulo`, seguindo o contexto deste projeto; ele pode ser ajustado para o fuso oficial da organização antes de criar recorrências.

Se o perfil inicial pedir um vínculo antes de existirem unidades, feche a janela, abra **Cadastros**, crie as unidades e depois complete o perfil.

## Publicar na Netlify

O arquivo `netlify.toml` configura build, fallback da aplicação, cabeçalhos e a função `maintenance` a cada minuto. O resultado estático fica em `dist/`.

Configure na Netlify:

| Variável                        | Uso                                                |
| ------------------------------- | -------------------------------------------------- |
| `VITE_SUPABASE_URL`             | URL pública do Supabase, incluída no build         |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Chave publicável, incluída no build                |
| `SUPABASE_URL`                  | URL do Supabase usada pela função agendada         |
| `SUPABASE_SERVICE_ROLE_KEY`     | Chave de serviço, **somente no servidor**          |
| `VITE_VAPID_PUBLIC_KEY`         | Chave pública de push, incluída no build           |
| `VAPID_PUBLIC_KEY`              | A mesma chave pública, usada no servidor           |
| `VAPID_PRIVATE_KEY`             | Chave privada de push, **somente no servidor**     |
| `VAPID_SUBJECT`                 | Contato de push, como `mailto:contato@dominio.org` |

Gere o par VAPID com `npm.cmd run push:keys` e guarde a chave privada nas variáveis da função. Não versione os valores. O servidor usa Web Push padrão; não exige Firebase, Brevo nem um provedor de e-mail para avisos de reservas.

Não defina `VITE_DEMO_MODE=true` na instalação real. Após alterar variáveis `VITE_`, gere um novo build.

Para republicar diretamente neste site com as credenciais locais:

```powershell
node scripts/configure-production.mjs
node scripts/netlify.mjs build --context production
node scripts/verify-production.mjs
node scripts/netlify.mjs deploy --no-build --prod --dir dist --functions netlify/functions --json
```

O helper transmite as credenciais pelo ambiente do processo, sem colocá-las nos argumentos da linha de comando. O verificador recusa um build sem a conexão pública configurada ou com valores privados presentes nos arquivos públicos. O plano atual da Netlify utiliza os escopos padrão das variáveis; somente os nomes `VITE_` são incluídos no navegador. A configuração remota não recebe o token de publicação da Netlify.

Como a publicação é direta, alterações locais ainda precisam ser publicadas novamente. O repositório GitHub vinculado não recebe automaticamente os arquivos deste projeto.

Em produção, verifique nos logs a execução da função agendada. Sem essa função configurada e executando, não há expiração agendada, lembretes, detecção periódica de atraso, continuidade das recorrências nem envio de push. Os comandos continuam revalidando disponibilidade e impedem aprovar pedidos cujo horário já passou.

Os avisos sempre ficam no sino. O push exige HTTPS, configuração VAPID e permissão por aparelho. No iPhone com iOS 16.4 ou posterior, adicione à Tela de Início e abra pelo ícone antes de autorizar. O aplicativo contém essa orientação no próprio sino. Push não garante entrega no minuto exato.

## Regras de implementação

- **Quinzenal = a cada 15 dias**, conforme confirmado pelo usuário.
- Recorrências mensais pulam meses sem o dia escolhido, como fevereiro para dia 31.
- Séries sem fim são regras contínuas com uma janela técnica de 90 dias. O agendador estende a janela diariamente; o usuário não tem um limite de agendamento futuro para pedidos individuais.
- O responsável cria recorrências para si. A alteração de destino/horários da série pertence ao motorista da série; responsáveis ativos podem encerrá-la. Para alterar apenas uma ocorrência, use a ação da própria viagem. As datas que conflitam em uma edição permanecem com a reserva válida anterior e são listadas no resultado.
- Pedidos sem candidatos disponíveis são recusados na criação com uma mensagem para escolher outro período. Não é criada lista de espera.
- Em pedido genérico, se o próprio solicitante é responsável por um candidato disponível, esse carro pode ser confirmado automaticamente. Outros candidatos são encerrados sem afetar pedidos alheios de seus veículos.
- Reservas usam intervalos `[saída, retorno)`: horários adjacentes são permitidos. O aplicativo avisa sobre retorno anterior a até 30 minutos da nova saída.
- A retirada antecipada ocupa também o período antecipado. Atrasos reais mantêm a viagem aberta e impedem uma nova retirada do carro enquanto não houver devolução.
- O calendário permite consultar usos concluídos dos veículos. Detalhes, fotos e histórico continuam limitados ao próprio motorista e aos responsáveis ativos.
- As imagens aceitam JPG, PNG e WebP de até 10 MB. São armazenadas em buckets privados e exibidas por URLs assinadas de curta duração.
- As alterações cadastrais inativam registros, preservando vínculos históricos. O administrador não pode retirar de si o próprio acesso administrativo.

## Segurança e consistência

Todos os dados expostos usam RLS. O cliente só tem leitura autorizada; as escritas operacionais passam por `app_command`. A função pública usa `SECURITY INVOKER`, e o processamento fica no esquema `private`, com autenticação, checagem de usuário ativo e autorização específica por ação. O esquema `private` não deve ser exposto no Data API.

Os comandos usam um lock transacional em ordem única, apropriado à frota inicial pequena. Duas exclusões GiST no PostgreSQL protegem também os intervalos de veículo e motorista, incluindo retiradas antecipadas. Aprovações, mudanças, manutenções e decisões de candidatos são transações únicas. As propostas não substituem a reserva antes do aceite. Não se confia em metadados editáveis do usuário para conceder administração.

Notificações têm chave única por destinatário e evento. A fila de push concede lotes por tempo limitado, usa `SKIP LOCKED`, registra entregas por aparelho, remove assinaturas expiradas e não reenvia a aparelhos já registrados como entregues. Provedores de push são validados antes do envio. Falhas de rede entre entrega e confirmação podem provocar nova tentativa; a mesma identificação da notificação é usada no aparelho. Não é possível garantir entrega exatamente uma vez por uma rede externa.

## Verificações

```powershell
npm.cmd run check
npm.cmd test
npm.cmd run test:e2e
npm.cmd run build
```

Os testes de banco executam PostgreSQL real compilado para WebAssembly (PGlite), com a migração completa e `btree_gist`. Exercitam permissões, RLS, exclusões, propostas, manutenção, km, fotos, recorrências e fila de push. Os adaptadores de Auth e Storage desses testes não substituem uma validação da integração hospedada.

Os testes de navegador usam o Chrome instalado e cobrem desktop e emulação de iPhone. O servidor de testes usa a porta 5174, cache próprio e somente dados fictícios, mesmo quando o `.env` local contém as credenciais reais. A configuração pode ser adaptada em `playwright.config.ts`. **Emulação de iPhone não é teste de Safari nem de entrega de push em um aparelho real.** Não foi executado um teste com duas conexões PostgreSQL independentes simultâneas; os testes verificam decisões concorrentes reprocessadas, exclusões do banco e rollback.

O login por Google depende da configuração do provedor no Supabase. O botão aparece somente quando o provedor está habilitado. Confirmação de e-mail e recuperação de senha dependem do Site URL e da lista de redirecionamentos permitidos; para esta instalação, use `https://agendamentocar.netlify.app` e autorize `https://agendamentocar.netlify.app/**`. A entrega de push em aparelhos reais ainda precisa ser conferida após a autorização no dispositivo.

## Arquivos

| Caminho                            | Conteúdo                                                         |
| ---------------------------------- | ---------------------------------------------------------------- |
| `src/`                             | Interface, formulários, calendário e cliente Supabase            |
| `src/demo/`                        | Adaptadores e dados fictícios, apenas para demonstração e testes |
| `supabase/migrations/`             | Migração versionada e regras de negócio                          |
| `netlify/functions/maintenance.ts` | Agendador e envio Web Push                                       |
| `public/sw.js`                     | Recebimento de push e abertura do aviso relacionado              |
| `tests/`                           | Testes de banco e de navegador                                   |
| `docs/especificacao-v1.md`         | Documento original fornecido como referência                     |

As fontes Outfit e Gabarito foram obtidas do Google Fonts, com licenças em `public/fonts/`. Azul principal `#01478d`, azul escuro `#063a6f` e fontes seguem a [referência visual fornecida](https://livrariashalom.org/). O ícone de carro identifica a aplicação; não pretende reproduzir um logotipo oficial.

Referências técnicas: [Supabase Auth](https://supabase.com/docs/guides/auth), [segurança dos arquivos](https://supabase.com/docs/guides/storage/security/access-control), [funções de banco](https://supabase.com/docs/guides/database/functions), [agendamento na Netlify](https://docs.netlify.com/build/functions/scheduled-functions/) e [Web Push no iOS](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/).
