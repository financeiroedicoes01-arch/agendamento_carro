# Aplicativo de agendamento de carros — Edições Shalom

**Especificação consolidada da primeira versão**  
**Versão:** 1.0 — 26/11/2026  
**Nome comercial do aplicativo:** a definir  
**Finalidade deste documento:** orientar o desenvolvimento posterior no VS Code. Não contém código, SQL, projeto implementado ou configurações executadas.

## 1. Objetivo e contexto

Criar um aplicativo para solicitar, autorizar e acompanhar o uso dos carros da Edições Shalom, com controle de disponibilidade, retirada, devolução, quilometragem, abastecimentos, problemas e acidentes.

O uso será pelo celular, por um link no navegador, em Android e iPhone. A organização começa com dois carros, um setor e seis casas comunitárias. Cada carro pertence a um setor ou a uma casa comunitária; uma dessas unidades pode possuir vários carros.

O cadastro de usuários será livre, sem um limite de pessoas definido como regra do aplicativo. Isso não significa capacidade ilimitada dos serviços de infraestrutura.

### Decisões vigentes

| Tema | Decisão final |
|---|---|
| Hospedagem | Netlify |
| Banco e serviços de dados | Supabase |
| Acesso | E-mail e senha ou conta Google |
| Liberação de usuário | Pode solicitar após se cadastrar, sem aprovação administrativa |
| Avisos da primeira versão | Central pelo sino e notificações push autorizadas pelo usuário |
| WhatsApp | Adiado para uma etapa futura |
| E-mail para avisos de reservas | Não será usado como alternativa ao push |
| Painel de indicadores | Não faz parte da primeira versão |
| Identidade visual | Seguir a Edições Shalom, com referência em https://livrariashalom.org/ |

As decisões acima substituem a ideia inicial de enviar todos os avisos pelo WhatsApp. O Brevo foi avaliado, mas não foi escolhido como serviço obrigatório desta primeira versão.

## 2. Pessoas e permissões

Qualquer pessoa cadastrada poderá solicitar um carro de qualquer setor ou casa comunitária. O solicitante será sempre o motorista da própria viagem.

### 2.1 Motorista

- Solicitar um carro específico ou aceitar qualquer carro disponível no período desejado.
- Acompanhar os próprios pedidos pendentes, viagens agendadas e histórico.
- Solicitar alteração de reserva ou prorrogação de viagem.
- Cancelar sua reserva antes da retirada, sem aprovação.
- Registrar a retirada e a devolução, com horários reais e quilometragem.
- Informar abastecimentos, problemas e acidentes no encerramento.
- Consultar o calendário de todos os carros, vendo apenas os períodos ocupados das reservas de outras pessoas.

### 2.2 Responsável principal por veículo

- Um responsável principal por carro; uma pessoa pode ser responsável por vários carros.
- Visualizar e decidir os pedidos que envolvam seus carros.
- Consultar motorista, destino, horários e histórico dos usos desses carros.
- Aprovar ou recusar solicitações, alterações e prorrogações.
- Cancelar reservas aprovadas de seus carros, avisando os motoristas.
- Agendar para si o uso de um carro sob sua responsabilidade sem precisar de aprovação de outra pessoa.
- Criar corridas recorrentes para si nos carros sob sua responsabilidade.
- Incluir responsáveis temporários por períodos determinados.
- Bloquear e liberar seus carros por manutenção.
- Acompanhar e resolver ocorrências.
- Corrigir quilometragens registradas incorretamente.
- Registrar retirada ou devolução esquecida pelo motorista, com horários, quilometragem e justificativa.

Para usar um carro que não esteja sob sua responsabilidade, a pessoa segue o fluxo comum de solicitação e aprovação.

### 2.3 Responsável temporário

O responsável principal pode incluir responsáveis temporários para períodos de ausência. Os temporários têm poder de aprovação e recusa durante a vigência da atribuição. O principal continua podendo decidir nesse mesmo período.

Os temporários também poderão criar corridas recorrentes nos carros atribuídos, limitadas ao período da substituição. Uma decisão de um responsável vale para os demais responsáveis daquele veículo no respectivo pedido.

### 2.4 Administrador geral

Gerencia os cadastros: usuários, setores, casas comunitárias, carros e responsáveis principais.

O perfil administrativo, por si só, não concede autoridade para aprovar, recusar ou cancelar solicitações, nem acesso geral a detalhes de viagens e ocorrências. Se uma pessoa também atuar como motorista ou responsável de um carro, terá as permissões correspondentes a essa atuação.

### 2.5 Matriz de acesso

| Ação | Motorista | Responsável ativo pelo veículo | Administrador, apenas nessa função |
|---|---|---|---|
| Consultar calendário e períodos ocupados | Sim | Sim | Como usuário cadastrado |
| Consultar detalhes de viagens | Apenas as próprias | Dos veículos sob sua responsabilidade | Sem acesso adicional pelo perfil |
| Solicitar carro | Sim | Sim | Como usuário cadastrado |
| Aprovar/recusar pedido | Não | Somente dos seus veículos | Não |
| Agendar uso próprio sem aprovação | Não | Dos seus veículos | Não |
| Criar recorrência | Não | Dos seus veículos, respeitada a vigência | Não |
| Cancelar antes da retirada | Própria reserva | Reserva de seus veículos | Não |
| Registrar retirada/devolução | Própria viagem | Também pode suprir esquecimento do motorista | Não |
| Corrigir quilometragem | Pode ajustar a sugestão na saída | Pode corrigir registro incorreto | Não |
| Acompanhar ocorrências pendentes | Registra no encerramento | Dos seus veículos | Não |
| Gerenciar cadastros gerais | Não | Inclui temporários de seus carros | Sim |

## 3. Cadastros

### 3.1 Usuário

- Nome completo.
- E-mail.
- Número de WhatsApp.
- Vínculo com setor ou casa comunitária.
- Acesso por e-mail e senha ou conta Google.

Não será necessário cadastrar ou validar CNH. O número de WhatsApp permanece no cadastro como definido, embora o envio automático por esse canal tenha sido adiado.

### 3.2 Setores e casas comunitárias

Representam as unidades de vínculo dos usuários e de propriedade dos carros. A unidade deve ser identificada como setor ou casa comunitária. Os nomes reais do setor e das seis casas serão preenchidos no cadastro inicial.

### 3.3 Carro

- Nome de identificação.
- Modelo.
- Placa.
- Setor ou casa comunitária de propriedade.
- Responsável principal.
- Foto.

O local habitual de retirada e devolução não será incluído no cadastro.

### 3.4 Atribuição temporária de responsabilidade

Deve identificar veículo, pessoa indicada e período de vigência. O aplicativo deve aplicar as permissões apenas durante esse período e preservar quem tomou cada decisão.

## 4. Solicitação de uso

Cada solicitação terá:

- Motorista identificado automaticamente pelo usuário conectado.
- Destino.
- Data e horário de saída.
- Data e horário previstos de retorno.
- Escolha de um carro específico ou de qualquer carro disponível no período.

A finalidade da viagem não foi definida como campo obrigatório. Uma reserva pode atravessar vários dias.

Não haverá antecedência mínima, duração máxima ou limite de agendamento futuro definidos como regra de negócio. Nos pedidos que exigem aprovação, cabe ao responsável avaliar cada caso.

Pedidos pendentes não bloqueiam o período. Podem coexistir vários pedidos para um mesmo carro e horário; a confirmação respeitará a disponibilidade no momento da decisão.

## 5. Aprovação, recusa e escolha de veículo

### 5.1 Pedido para um carro específico

1. O pedido chega aos responsáveis ativos daquele veículo.
2. Basta a decisão de um deles.
3. O primeiro aceite ou recusa válido encerra a decisão para os demais responsáveis desse carro.
4. Na aprovação, o período fica reservado e os outros pedidos conflitantes para esse carro são recusados automaticamente.
5. O motorista recebe a confirmação ou recusa definitiva.

O motivo da recusa não será obrigatório.

### 5.2 Pedido para qualquer carro disponível

O pedido é único, com vários veículos candidatos. Cada responsável recebe somente a parte que envolve um carro sob sua responsabilidade.

| Situação | Resultado |
|---|---|
| Um responsável aprova o carro A | O pedido é confirmado no carro A e deixa de aparecer como pendente para os demais carros |
| Um responsável recusa o carro A | A decisão vale para todos os responsáveis do carro A; o pedido continua aguardando os outros carros |
| Todos os carros candidatos são recusados | O motorista recebe a recusa definitiva |
| Um candidato perde disponibilidade por outra reserva aprovada | Esse carro não poderá confirmar o pedido naquele período |

Não enviar uma recusa ao motorista a cada recusa parcial. A notificação de resultado será de aceite ou de recusa definitiva. Encerrar a participação dos outros carros após um aceite não significa recusar outras reservas desses veículos.

### 5.3 Reservas do próprio responsável

O responsável ativo agenda para si um carro sob sua responsabilidade sem aprovação de terceiros. Essa confirmação continua obrigada a respeitar reservas existentes, bloqueios e conflitos do motorista.

## 6. Disponibilidade e conflitos

- Um carro não pode ter duas reservas confirmadas em períodos sobrepostos.
- Um motorista não pode ter reservas aprovadas de carros diferentes em períodos sobrepostos.
- Não haverá intervalo obrigatório entre reservas.
- Uma reserva que termina às 10h permite outra começando às 10h.
- Havendo distância de até 30 minutos entre o retorno anterior e a próxima saída, mostrar ao próximo solicitante um aviso de proximidade e possibilidade de atraso.
- Veículos bloqueados não podem ser confirmados para períodos atingidos pelo bloqueio.
- Chegando o horário previsto de saída sem decisão, o pedido pendente expira automaticamente.
- Se a reserva estiver aprovada e o motorista não registrar retirada, o carro continua reservado até o horário previsto de devolução.

As regras também devem ser verificadas quando duas pessoas aprovarem ao mesmo tempo. Apenas uma confirmação incompatível pode ser aceita. Essa verificação deve ocorrer no processamento central da reserva, e não depender apenas do que aparece no calendário do celular.

## 7. Alteração, prorrogação e cancelamento

### 7.1 Alteração de uma reserva aprovada

- O motorista solicita a alteração, sujeita a nova aprovação.
- A reserva original continua válida e seu horário permanece reservado enquanto não houver resposta.
- Se a alteração for recusada, a reserva original permanece.
- A aprovação deve trocar a reserva original pela nova condição de uma só vez, revalidando os conflitos.
- Enquanto uma alteração estiver pendente, os horários propostos não equivalem a uma nova reserva confirmada.

### 7.2 Prorrogação durante o uso

O motorista pode solicitar extensão do retorno após retirar o carro. A extensão depende de aprovação e de disponibilidade. A solicitação pendente não altera o retorno que está aprovado.

Se houver reserva seguinte incompatível, a prorrogação não pode ser confirmada sobre ela. Um atraso real será tratado como atraso, sem reescrever automaticamente a reserva seguinte.

### 7.3 Cancelamento

- Antes da retirada, o motorista cancela sua reserva sem aprovação.
- O responsável pode cancelar reservas aprovadas dos seus carros, com aviso ao motorista.
- O administrador não tem essa autoridade pelo perfil administrativo.
- Depois da retirada, a viagem exige registro de devolução para encerrar o uso.

## 8. Retirada, devolução e quilometragem

### 8.1 Retirada

O motorista informa a quilometragem de saída e o aplicativo registra o horário real. A última quilometragem de devolução será sugerida como valor inicial, permitindo ajuste pelo motorista.

A retirada pode ocorrer antes do horário previsto se o carro estiver disponível, sem viagem anterior em andamento, bloqueio ou conflito no intervalo antecipado. Também deve ser respeitada a disponibilidade do motorista.

### 8.2 Devolução

O motorista informa a quilometragem de retorno, registra a devolução e completa o encerramento com os abastecimentos e ocorrências aplicáveis. O horário real fica registrado.

Uma viagem em andamento não deve ser encerrada automaticamente apenas porque chegou o retorno previsto. Se o carro ainda não foi devolvido, o próximo motorista e os responsáveis devem ser avisados do atraso.

### 8.3 Esquecimentos e correções

O responsável pelo carro pode:

- Corrigir quilometragem registrada incorretamente.
- Registrar retirada ou devolução esquecida pelo motorista.
- Informar horários, quilometragem e justificativa nesses registros em nome do motorista.

A identidade de quem fez ou corrigiu o registro deve ser preservada, distinguindo o motorista da pessoa que registrou a informação.

## 9. Abastecimentos

O abastecimento faz parte de uma viagem. Uma viagem pode conter vários abastecimentos.

Cada abastecimento contém:

- Valor total.
- Foto do comprovante.

Não foram solicitados litros, tipo de combustível ou controle independente de abastecimento fora de viagens. Os abastecimentos são informados no encerramento da viagem.

## 10. Problemas e acidentes

No encerramento, o motorista seleciona:

- “Não houve problemas nem acidentes”; ou
- Registra ocorrência do tipo “Problema” ou “Acidente”.

Cada ocorrência contém descrição, data e horário do fato, local e fotos obrigatórias.

O responsável pelo carro recebe um aviso e decide se o veículo precisa ser bloqueado. O registro da ocorrência não bloqueia o carro automaticamente.

Os responsáveis acompanham as ocorrências dos seus veículos com os estados:

| Estado | Uso |
|---|---|
| Pendente | Ocorrência registrada e ainda sem tratamento concluído |
| Em resolução | Providências em andamento |
| Resolvido | Tratamento encerrado |

Haverá espaço para registrar as providências tomadas. A aba operacional é de ocorrências pendentes, incluindo as que estão em resolução. As resolvidas devem permanecer preservadas no histórico, sem exigir um painel de indicadores.

## 11. Bloqueios por manutenção

- O responsável pode bloquear um veículo por manutenção.
- O bloqueio pode ter término definido ou continuar até a liberação manual.
- Reservas aprovadas atingidas pelo bloqueio são canceladas automaticamente, com aviso aos respectivos motoristas.
- Novas confirmações devem respeitar os bloqueios.
- Uma viagem que já começou continua exigindo registro de devolução; o bloqueio não deve apagar o uso em andamento.

## 12. Corridas recorrentes

Disponíveis aos responsáveis apenas nos carros sob sua responsabilidade. O motorista comum faz solicitações individuais nesta versão.

### Repetições

- Diariamente.
- Semanalmente, em dias escolhidos.
- Quinzenalmente.
- Mensalmente.

A recorrência pode continuar sem data final até ser encerrada pelo responsável. Para responsável temporário, suas ocorrências ficam limitadas à vigência da atribuição.

### Conflitos e mudanças

- Criar as reservas disponíveis e informar as datas que ficaram de fora por conflito.
- Cada ocorrência confirmada respeita os conflitos de veículo e motorista e os bloqueios de manutenção.
- Permitir alterar ou cancelar somente uma ocorrência ou todas as futuras.
- Preservar o histórico das viagens anteriores.

Uma recorrência sem fim será representada por uma regra contínua. A estratégia de geração gradual das ocorrências futuras será definida na implementação; não significa criar uma quantidade infinita de registros no cadastro inicial.

## 13. Telas e navegação no celular

| Tela/área | Público | Conteúdo e ações |
|---|---|---|
| Acesso e cadastro | Todos | E-mail e senha, conta Google e dados do usuário |
| Minhas viagens | Todos que atuem como motoristas | Pedidos aguardando retorno, agendamentos, viagens em andamento, histórico e ações da própria viagem |
| Solicitações pendentes | Responsáveis | Pedidos dos seus carros, alterações e prorrogações aguardando decisão |
| Calendário | Todos | Agenda dos carros por dia, semana e mês; vários carros juntos, identificados por cores |
| Ocorrências pendentes | Responsáveis | Problemas e acidentes dos seus carros, com tratamento e providências |
| Cadastros | Administrador | Usuários, unidades, veículos e responsáveis principais |
| Central no sino | Cada usuário | Notificações individuais, leitura e acesso ao item relacionado |

### Entrada após login

- Motorista: “Minhas viagens”.
- Responsável: “Solicitações pendentes”, mantendo acesso às próprias viagens.
- A entrada específica do administrador pode direcionar aos cadastros como escolha de implementação; não foi definida como regra operacional nas perguntas.

### Privacidade no calendário

Os usuários comuns veem os períodos ocupados dos carros, sem nome ou destino de outros motoristas. O próprio motorista consulta seus detalhes e os responsáveis consultam os detalhes dos seus veículos.

Os históricos solicitados devem estar acessíveis pelas próprias viagens e pela agenda/detalhes dos veículos administrados. Não será criado um dashboard com totais, gráficos ou indicadores nesta versão.

## 14. Notificações

### 14.1 Central dentro do aplicativo

Usar um sino no topo da tela, com contador de avisos não lidos. Ao tocar, abrir a lista com data, horário e indicação de leitura. Cada item leva à solicitação, viagem ou ocorrência correspondente, respeitando as permissões.

O aviso deve ficar registrado nessa central mesmo quando o usuário não tiver ativado push.

### 14.2 Push no celular

- Android e iPhone devem ser atendidos nos navegadores e versões compatíveis.
- O usuário ativa as notificações e concede a permissão no dispositivo.
- No iPhone, orientar a adicionar o aplicativo à Tela de Início, abrir pelo ícone e autorizar os avisos. O suporte documentado começa no iOS 16.4.
- O aplicativo continua acessível pelo link; não será exigida distribuição nas lojas de aplicativos.
- Sem ativação de push, a pessoa acompanha os avisos apenas pelo sino.
- Não haverá envio automático por e-mail como alternativa.
- Push depende da conexão e das condições do aparelho; a entrega no minuto exato não é garantida.

### 14.3 Eventos

| Evento | Destinatário |
|---|---|
| Nova solicitação | Responsáveis ativos dos veículos candidatos |
| Pedido de alteração ou prorrogação | Responsáveis dos veículos envolvidos |
| Aprovação ou recusa definitiva | Motorista solicitante |
| Cancelamento pelo responsável ou por manutenção | Motorista afetado |
| Cancelamento pelo motorista | Responsáveis do carro, se já houver veículo confirmado |
| Retirada prevista em 10 minutos | Motorista |
| Devolução prevista em 10 minutos | Motorista |
| Devolução atrasada | Responsáveis e próximo motorista com reserva aprovada |
| Problema ou acidente registrado | Responsáveis ativos pelo veículo |

O aviso de proximidade de até 30 minutos também deve aparecer ao solicitar uma reserva nessa condição. Evitar duplicar notificações quando houver mais de um responsável ou quando um pedido tiver vários carros candidatos.

## 15. Fluxos para revisão

| Fluxo | Sequência esperada |
|---|---|
| Solicitação comum | Cadastro/login → escolha de período e carro/opção de qualquer disponível → pedido pendente → decisão → confirmação ou encerramento |
| Uso do carro | Reserva aprovada → retirada e km de saída → uso → devolução e km de retorno → abastecimentos/ocorrências → histórico |
| Alteração | Reserva válida → proposta de alteração → original permanece reservada → aprovação substitui condições ou recusa mantém o original |
| Ocorrência | Encerramento com problema/acidente e fotos → aviso ao responsável → tratamento → resolução, com bloqueio manual se necessário |
| Manutenção | Bloqueio → cancelamento das reservas afetadas e avisos → impedimento de confirmações → liberação |

## 16. Estrutura técnica conceitual

Esta seção organiza uma proposta de implementação. As plataformas Netlify e Supabase foram escolhidas pelo usuário; a distribuição interna de componentes abaixo é uma recomendação técnica, sem código ou banco criado.

| Componente | Responsabilidade prevista |
|---|---|
| Aplicação web publicada na Netlify | Interface móvel, calendário, formulários, central no sino e orientação de ativação de push |
| Supabase Auth | Login por e-mail e senha e Google |
| Banco PostgreSQL do Supabase | Cadastros, pedidos, candidatos, decisões, reservas, viagens, recorrências e históricos |
| Supabase Storage | Fotos dos carros, comprovantes e imagens das ocorrências |
| Permissões no banco e nos arquivos | Restringir leitura e alteração conforme motorista, responsável e administrador |
| Processamento no servidor/banco | Confirmar reservas e alterações, verificar conflitos e concluir decisões de maneira consistente |
| Rotinas agendadas | Expiração de pedidos, lembretes, identificação de atrasos e geração futura de recorrências |
| Serviço de Web Push | Enviar avisos aos dispositivos que autorizaram notificações |

O Firebase Cloud Messaging é uma opção de serviço de envio sem cobrança por mensagem, ainda não uma escolha obrigatória. A hospedagem, o armazenamento de fotos e as demais rotinas seguem os limites dos respectivos planos.

### 16.1 Grupos de dados sugeridos

| Grupo | Conteúdo |
|---|---|
| Usuários e perfis | Dados pessoais, identidade de acesso e função administrativa |
| Unidades | Setores e casas comunitárias |
| Veículos | Identificação, propriedade e responsável principal |
| Responsabilidades temporárias | Pessoa, carro, período e autor da atribuição |
| Solicitações | Motorista, destino, período e modalidade de escolha de carro |
| Candidatos e decisões | Carros envolvidos e decisões individuais por veículo |
| Reservas/viagens | Veículo confirmado, período aprovado, horários reais e quilometragens |
| Pedidos de alteração | Propostas separadas das condições que permanecem aprovadas |
| Recorrências | Regra de repetição e vínculo com as ocorrências geradas |
| Bloqueios | Período de indisponibilidade, com término opcional |
| Abastecimentos | Vínculo com viagem, valor e comprovante |
| Ocorrências | Tipo, descrição, data/hora, local, fotos, situação e providências |
| Notificações e dispositivos | Avisos por destinatário, leitura e autorização de push |
| Histórico de ações | Decisões, correções e registros feitos em nome de outra pessoa |

Essa é uma divisão conceitual, sem nomes definitivos de tabelas ou esquema SQL. Uma solicitação com vários carros não deve gerar várias reservas independentes para o mesmo motorista.

### 16.2 Consistência necessária

- Confirmar a disponibilidade ao gravar a decisão, inclusive em aprovações simultâneas.
- Separar condições aprovadas de propostas de alteração pendentes.
- Aplicar permissões no banco e no armazenamento de fotos, além da interface.
- Não atribuir poder operacional global ao administrador.
- Evitar confirmações, recorrências e avisos duplicados em reprocessamentos.
- Guardar horários previstos e reais separadamente.
- Preservar os registros após mudanças cadastrais e correções.
- Definir o fuso da organização e converter corretamente os horários usados nas rotinas agendadas.

## 17. Cenários de aceitação

Os cenários abaixo consolidam comportamentos a verificar no desenvolvimento; não representam testes já executados.

1. Usuário recém-cadastrado consegue solicitar carro de outra unidade sem liberação administrativa.
2. O solicitante é automaticamente o motorista; não existe seleção de outro motorista.
3. Dois pedidos pendentes para o mesmo carro e horário podem coexistir.
4. Apenas um pedido conflitante é confirmado, mesmo com aprovações simultâneas.
5. Em pedido para A e B, recusar A mantém B pendente e não envia recusa parcial ao motorista.
6. Aceitar B encerra a participação de A sem criar outra reserva.
7. Uma decisão de um responsável encerra a decisão dos demais responsáveis daquele mesmo carro no pedido.
8. Um responsável agenda para si um carro seu sem aprovação; para carro de outro responsável, precisa solicitar.
9. Um motorista não consegue confirmar dois carros no mesmo horário.
10. Reservas que se encontram às 10h são permitidas, com aviso de proximidade de até 30 minutos.
11. Pedido sem decisão expira na saída prevista.
12. Reserva aprovada sem retirada mantém o período ocupado até a devolução prevista.
13. Proposta de alteração mantém o horário original reservado até a decisão; recusar não perde a reserva original.
14. Prorrogação em andamento depende de aprovação e não pode sobrepor uma reserva confirmada seguinte.
15. Cancelar antes da retirada não exige aprovação; depois de retirar, é preciso registrar devolução.
16. Retirada antecipada só ocorre com veículo e motorista disponíveis em todo o intervalo antecipado.
17. Uma viagem sem devolução permanece em andamento e gera o aviso de atraso apropriado.
18. O responsável consegue suprir registro esquecido e corrigir quilometragem, preservando autoria e justificativa.
19. Vários abastecimentos ficam vinculados à mesma viagem, cada um com valor e comprovante.
20. Encerrar exige declarar ausência de problemas/acidentes ou registrar a ocorrência com as fotos obrigatórias.
21. Uma ocorrência avisa os responsáveis sem bloquear automaticamente o veículo.
22. Bloqueio por manutenção sem término cancela as reservas afetadas, avisa os motoristas e impede confirmações até a liberação.
23. Recorrência respeita conflitos e lista as datas não criadas; temporário não cria ocorrências fora de sua vigência.
24. Alterar uma ocorrência ou todas as futuras não altera o histórico passado.
25. Motorista comum vê só os horários ocupados de terceiros; responsável vê detalhes dos seus carros.
26. Administrador gerencia cadastros e não consegue aprovar, recusar ou cancelar pelo perfil administrativo.
27. Notificações respeitam os destinatários; sem push, os avisos permanecem no sino sem disparar e-mail.
28. No iPhone compatível, a orientação de Tela de Início e autorização permite ativar o push.

## 18. Itens fora do escopo inicial

- Aplicativo nativo distribuído pela App Store ou Google Play.
- Validação de CNH.
- Agendamento comum em nome de outro motorista.
- Solicitações recorrentes de motoristas comuns.
- WhatsApp automático e envio de avisos de reservas por e-mail.
- Dashboard de indicadores, gráficos, relatórios gerenciais e exportações não solicitadas.
- Local habitual de retirada/devolução no cadastro do carro.
- Aprovação administrativa de novos usuários.
- Aprovação, recusa ou cancelamento global por administrador.
- Bloqueio automático do carro somente pelo registro de uma ocorrência.
- Pagamentos, reembolsos, custos de reparos, rastreamento e integração com Omie.

## 19. Definições de implementação ainda em aberto

Os requisitos funcionais acima estão consolidados. Os itens seguintes não foram escolhidos na conversa e não devem ser apresentados como decisões já aprovadas:

| Item | Tratamento previsto |
|---|---|
| Nome do aplicativo | Definir posteriormente |
| Cores exatas, fontes e arquivos de marca | Extrair/validar a partir da referência visual, sem inventar códigos de cor neste documento |
| Nomes do setor, casas, usuários responsáveis e dados dos dois carros | Preencher no cadastro inicial |
| Framework da interface | Escolher no início do desenvolvimento |
| Provedor específico de push | Selecionar na implementação; FCM é uma opção avaliada |
| Quinzenal | Precisar se significa a cada 14 dias, a cada 15 dias ou duas datas no mês |
| Recorrência mensal em dias que não existem em todos os meses | Definir a regra para datas como dia 31 |
| Horizonte de geração de recorrências sem fim | Escolher uma janela técnica e rotina de continuidade |
| Edição de série quando houver novos conflitos | Preservar reservas válidas e definir o tratamento das alterações que não puderem ser aplicadas |
| Ausência de veículos disponíveis ao criar pedido genérico | Definir a mensagem e a experiência de tentativa sem candidatos; não presumir uma lista de espera aprovada |
| Fuso oficial da organização | Confirmar na configuração inicial |
| Funcionamento sem internet | Não foi aprovado um modo offline; definir a necessidade antes de acrescentar sincronização |
| Autenticação por e-mail | Configurar recuperação de senha e eventual confirmação de endereço, sem confundir isso com avisos de reservas ou aprovação administrativa |

## 20. Referências para o desenvolvimento

Consultadas em 26/11/2026. Servem para orientar as configurações futuras; não significam integração já realizada.

- Identidade visual: https://livrariashalom.org/
- Supabase Auth: https://supabase.com/docs/guides/auth
- Login Google: https://supabase.com/docs/guides/auth/social-sign-in/auth-google
- Permissões no banco: https://supabase.com/docs/guides/database/postgres/row-level-security
- Permissões de arquivos: https://supabase.com/docs/guides/storage/security/access-control
- Rotinas agendadas na Netlify: https://docs.netlify.com/build/functions/scheduled-functions/
- Web Push no iPhone/iPad: https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/
- Visão geral de Web Push: https://web.dev/articles/push-notifications-overview
- Firebase Cloud Messaging: https://firebase.google.com/products/cloud-messaging/

**Resultado desta etapa:** especificação funcional e orientação técnica para planejar o desenvolvimento. Nenhum código de aplicação foi gerado e nenhum ambiente, banco ou serviço foi alterado.
