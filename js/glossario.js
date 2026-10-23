// Textos dos botões "Como ler este número". Cada entrada: título, explicação e onde conferir.

export const GLOSSARIO = {
  receita_liquida: {
    titulo: 'Receita arrecadada (líquida)',
    texto: 'Tudo o que entrou nos cofres no ano, já descontados os 20% de FPM, ICMS, IPVA e outros repasses que a lei manda depositar no FUNDEB. Esse dinheiro volta depois como “receita do FUNDEB”. Somar os dois contaria o mesmo real duas vezes, por isso usamos o valor líquido.',
    fonte: 'DCA, Anexo I-C (Receitas Brutas − Deduções). Confere com “Receitas Realizadas” do RREO, Anexo 14.',
  },
  despesa_empenhada: {
    titulo: 'Despesa empenhada',
    texto: 'Empenhar é reservar dinheiro do orçamento para um compromisso: um contrato, uma compra, uma folha de pagamento. É o primeiro dos três estágios da despesa (empenho → liquidação → pagamento) e a base legal para apurar se a Prefeitura gastou mais do que arrecadou.',
    fonte: 'DCA, Anexo I-D (coluna Despesas Empenhadas).',
  },
  estagios: {
    titulo: 'Empenhado, liquidado e pago',
    texto: 'Empenhado: a despesa foi autorizada e reservada. Liquidado: o serviço foi prestado ou o produto entregue, e a Prefeitura conferiu. Pago: o dinheiro saiu da conta. O que foi empenhado e não pago até 31/12 vira “restos a pagar” para o ano seguinte.',
    fonte: 'Lei 4.320/1964, arts. 58 a 65.',
  },
  resultado_orcamentario: {
    titulo: 'Resultado orçamentário',
    texto: 'Receita arrecadada menos despesa empenhada no ano. Positivo é superávit (sobrou dinheiro); negativo é déficit (comprometeu mais do que entrou). Um déficit não é ilegal por si só se for coberto por sobras de caixa de anos anteriores, mas déficits repetidos esgotam essa reserva.',
    fonte: 'RREO Simplificado, Anexo 14 (Superávit/Déficit Orçamentário). Recalculado a partir da DCA.',
  },
  per_capita: {
    titulo: 'Valor por habitante',
    texto: 'Despesa empenhada dividida pela população do ano. Serve para comparar com outras cidades de tamanhos diferentes. Usamos a estimativa oficial do IBGE ou, para 2022 e 2023, o Censo 2022.',
    fonte: 'IBGE: Estimativas da População (tabela 6579) e Censo 2022 (tabela 9514).',
  },
  rcl: {
    titulo: 'Receita Corrente Líquida (RCL)',
    texto: 'A soma das receitas correntes dos últimos 12 meses, descontadas as transferências obrigatórias e as contribuições dos servidores à previdência. É a régua que a Lei de Responsabilidade Fiscal usa para os limites de pessoal e de dívida.',
    fonte: 'RGF Simplificado, Anexo 06; RREO, Anexo 03.',
  },
  dtp: {
    titulo: 'Despesa total com pessoal',
    texto: 'Salários, encargos, contratos temporários, terceirização de mão de obra e aposentadorias do Executivo, medidos como percentual da RCL. A LRF fixa três degraus: alerta (48,6%), prudencial (51,3%; proíbe aumentos e novas contratações) e máximo (54%; obriga cortes).',
    fonte: 'LC 101/2000, arts. 19, 20, 22 e 59. RGF Simplificado, Anexo 06.',
  },
  mde: {
    titulo: 'Educação: manutenção e desenvolvimento do ensino (MDE)',
    texto: 'A Constituição obriga o município a aplicar pelo menos 25% da receita de impostos (incluindo FPM, ICMS e IPVA transferidos) em educação. O percentual não é a fatia da educação no gasto total, e sim a razão entre o gasto em MDE com recursos de impostos e essa base de impostos.',
    fonte: 'Constituição Federal, art. 212. RREO Simplificado, Anexo 14.',
  },
  fundeb70: {
    titulo: 'FUNDEB na remuneração dos profissionais',
    texto: 'Pelo menos 70% do dinheiro do FUNDEB precisa pagar os profissionais da educação básica em efetivo exercício (até 2020, a regra era de 60% para o magistério).',
    fonte: 'Lei 14.113/2020, art. 26. RREO Simplificado, Anexo 14.',
  },
  asps: {
    titulo: 'Saúde: ações e serviços públicos de saúde (ASPS)',
    texto: 'O município deve aplicar pelo menos 15% da receita de impostos e transferências constitucionais em saúde pública. Como no caso da educação, a base de cálculo é a receita de impostos, não o orçamento inteiro.',
    fonte: 'LC 141/2012, art. 7º. RREO Simplificado, Anexo 14.',
  },
  restos_a_pagar: {
    titulo: 'Restos a pagar',
    texto: 'Despesas empenhadas que não foram pagas até 31 de dezembro. “Processados” já foram entregues (liquidados) e só falta pagar. “Não processados” nem foram entregues ainda. Quando uma despesa não processada é cancelada no ano seguinte, ela tinha sido empenhada mas nunca aconteceu.',
    fonte: 'RREO Simplificado, Anexo 14; DCA, Anexos I-F e I-G.',
  },
  previsao: {
    titulo: 'Previsão de receita',
    texto: 'Quanto a Prefeitura estimou arrecadar no orçamento (Lei Orçamentária Anual), já com as atualizações do ano. Comparar com o que foi realmente arrecadado mostra se o orçamento foi realista.',
    fonte: 'RREO Simplificado, Anexo 14 (Previsão Atualizada).',
  },
  proprios: {
    titulo: 'Tributos próprios',
    texto: 'Impostos e taxas que a própria Prefeitura cobra: ISS (serviços), IPTU (imóveis urbanos), ITBI (venda de imóveis), IRRF retido dos servidores, taxas e contribuição de iluminação pública. O IPVA e o ICMS são estaduais, e o município recebe uma cota-parte deles.',
    fonte: 'DCA, Anexo I-C, contas 1.1 e 1.2.',
  },
  funcao: {
    titulo: 'Função e subfunção',
    texto: 'Classificação nacional que diz “para que” o dinheiro foi gasto. A função é a área (12 = Educação, 10 = Saúde); a subfunção detalha o serviço (12.361 = Ensino Fundamental, 10.301 = Atenção Básica). Todos os municípios do país usam os mesmos códigos.',
    fonte: 'Portaria MOG 42/1999. DCA, Anexo I-E.',
  },
  elemento: {
    titulo: 'Elemento de despesa',
    texto: 'Classificação que diz “o quê” foi comprado: salários (11), material de consumo (30), serviços de empresas (39), obras (51), equipamentos (52) etc. Complementa a função: a Educação, por exemplo, gasta em salários, merenda e transporte.',
    fonte: 'Portaria Interministerial STN/SOF 163/2001. DCA, Anexo I-D.',
  },
  fluxo: {
    titulo: 'Como ler o fluxo do dinheiro',
    texto: 'À esquerda, de onde veio cada real (valores líquidos). No centro, o cofre da Prefeitura. À direita, para onde foi (despesa empenhada por área). A espessura de cada faixa é proporcional ao valor. Se a Prefeitura empenhou mais do que arrecadou, a diferença aparece à esquerda como “caixa de anos anteriores”; se sobrou, aparece à direita como “sobra do ano”.',
    fonte: 'DCA, Anexos I-C e I-E.',
  },
  ipca: {
    titulo: 'Valores corrigidos pela inflação',
    texto: 'Um real de 2015 comprava mais do que um real de hoje. Para comparar anos, multiplicamos cada valor pela inflação acumulada (IPCA) até o ano-base, usando a média anual do índice. Assim, um crescimento “real” significa que a Prefeitura passou a ter mais poder de compra, e não apenas números maiores.',
    fonte: 'Banco Central, série SGS 433 (IPCA mensal).',
  },
  inconsistencias: {
    titulo: 'Inconsistências na declaração',
    texto: 'Os demonstrativos são preenchidos pela própria Prefeitura e enviados ao Tesouro. Às vezes há linhas trocadas ou valores repetidos. Quando a correção é inequívoca (por exemplo, o percentual mínimo legal identifica qual linha é qual), corrigimos e avisamos; quando não é, marcamos o dado como não confiável.',
    fonte: 'Comparação entre RREO, RGF e DCA do mesmo exercício.',
  },
  caixa: {
    titulo: 'Caixa e equivalentes',
    texto: 'Dinheiro em contas bancárias e aplicações de liquidez imediata em 31 de dezembro. Parte dele pode estar vinculada a finalidades específicas (FUNDEB, SUS, convênios) e não pode ser usada livremente.',
    fonte: 'DCA, Anexo I-AB (Balanço Patrimonial).',
  },
  lrf: {
    titulo: 'Lei de Responsabilidade Fiscal',
    texto: 'A LC 101/2000 obriga os governos a planejar, não gastar mais do que arrecadam de forma recorrente e respeitar limites de pessoal e de dívida. Junto com os mínimos constitucionais de saúde e educação, são as regras que o Tribunal de Contas verifica todo ano.',
    fonte: 'LC 101/2000; Constituição Federal, arts. 198 e 212.',
  },
  dcl: {
    titulo: 'Dívida consolidada líquida',
    texto: 'Dívidas de longo prazo menos o dinheiro em caixa. Quando é negativa, a Prefeitura tem mais dinheiro disponível do que dívidas. O Senado limita a dívida a 1,2 vez a RCL.',
    fonte: 'RGF Simplificado, Anexo 06; Resolução do Senado 40/2001.',
  },
};
