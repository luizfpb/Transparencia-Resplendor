// Cálculos sobre data/resplendor.json. Funções puras, sem DOM — cobertas por tests/model.test.mjs.

export function anos(data) {
  return Object.keys(data.anos).sort();
}

export function anoAnterior(data, ano) {
  const lista = anos(data);
  const i = lista.indexOf(String(ano));
  return i > 0 ? data.anos[lista[i - 1]] : null;
}

export function variacao(atual, anterior) {
  if (atual == null || anterior == null || anterior === 0) return null;
  return ((atual - anterior) / Math.abs(anterior)) * 100;
}

/** Fator para converter valores nominais de `ano` a preços do ano-base do IPCA. */
export function fatorIPCA(data, ano) {
  return data.meta.ipca.fatores[String(ano)] ?? null;
}

export function corrigir(data, valor, ano) {
  const f = fatorIPCA(data, ano);
  return valor == null || f == null ? null : valor * f;
}

/** Variação real (descontada a inflação) entre dois anos. */
export function variacaoReal(data, atual, anoAtual, anterior, anoAnteriorRef) {
  return variacao(corrigir(data, atual, anoAtual), corrigir(data, anterior, anoAnteriorRef));
}

export function kpis(data, ano) {
  const d = data.anos[String(ano)];
  const p = anoAnterior(data, ano);
  const receita = d.receita.liquida;
  const despesa = d.despesa.empenhada;
  const pop = d.populacao;
  const res = {
    receita,
    receitaBruta: d.receita.bruta,
    despesaEmpenhada: despesa,
    despesaLiquidada: d.despesa.liquidada,
    despesaPaga: d.despesa.paga,
    resultado: d.resultado_orcamentario,
    resultadoPct: receita ? (d.resultado_orcamentario / receita) * 100 : null,
    populacao: pop,
    despesaPorHabitante: pop ? despesa / pop : null,
    receitaPorHabitante: pop ? receita / pop : null,
    pagoSobreEmpenhado: despesa ? (d.despesa.paga / despesa) * 100 : null,
    execucaoReceita: d.indicadores.previsao_atualizada ? (receita / d.indicadores.previsao_atualizada) * 100 : null,
    anoAnterior: p ? p.ano : null,
    varReceita: null,
    varReceitaReal: null,
    varDespesa: null,
    varDespesaReal: null,
  };
  if (p) {
    res.varReceita = variacao(receita, p.receita.liquida);
    res.varReceitaReal = variacaoReal(data, receita, ano, p.receita.liquida, p.ano);
    res.varDespesa = variacao(despesa, p.despesa.empenhada);
    res.varDespesaReal = variacaoReal(data, despesa, ano, p.despesa.empenhada, p.ano);
  }
  return res;
}

// ---------------------------------------------------------------------------
// Fluxo do dinheiro (Sankey)
// ---------------------------------------------------------------------------

/** Rótulos curtos dos grupos de receita, para eixos e diagramas. */
export const NOMES_CURTOS_FONTE = {
  fpm: 'FPM (União)',
  estado: 'ICMS, IPVA e IPI (Estado)',
  fundeb: 'FUNDEB',
  sus: 'SUS (União e Estado)',
  royalties: 'Royalties',
  proprios: 'Tributos próprios',
  outras: 'Outras receitas',
};

/**
 * Monta fontes → tesouro → destinos com os dois lados balanceados.
 * Receitas são líquidas (sem a dedução do FUNDEB, que voltaria como receita
 * duplicada) e despesas são empenhadas, a mesma base do resultado orçamentário.
 */
export function modeloFluxo(d, maxDestinos = 7) {
  const fontes = d.receita.grupos
    .filter((g) => g.liquido > 0)
    .map((g) => ({ id: g.id, nome: NOMES_CURTOS_FONTE[g.id] ?? g.nome, nomeCompleto: g.nome, valor: g.liquido, tipo: 'fonte' }))
    .sort((a, b) => b.valor - a.valor);

  const funcoes = d.despesa.funcoes.filter((f) => f.empenhado > 0);
  const principais = funcoes.slice(0, maxDestinos);
  const demais = funcoes.slice(maxDestinos).reduce((s, f) => s + f.empenhado, 0);
  const destinos = principais.map((f) => ({ id: `f${f.codigo}`, nome: f.nome, valor: f.empenhado, tipo: 'destino', codigo: f.codigo }));
  if (demais > 0) destinos.push({ id: 'demais', nome: `Demais ${funcoes.length - maxDestinos} áreas`, valor: demais, tipo: 'destino' });

  // As funções podem não somar exatamente o total empenhado (despesas intraorçamentárias).
  const totalFuncoes = destinos.reduce((s, x) => s + x.valor, 0);
  const despesa = d.despesa.empenhada;
  if (despesa - totalFuncoes > 1) destinos.push({ id: 'intra', nome: 'Despesas intraorçamentárias', valor: despesa - totalFuncoes, tipo: 'destino' });

  const receita = fontes.reduce((s, x) => s + x.valor, 0);
  const saldo = receita - despesa;
  if (saldo > 1) {
    destinos.push({ id: 'saldo', nome: 'Sobra do ano (superávit)', valor: saldo, tipo: 'saldo' });
  } else if (saldo < -1) {
    fontes.push({ id: 'caixa', nome: 'Caixa de anos anteriores', nomeCompleto: 'Caixa de anos anteriores (cobre o déficit)', valor: -saldo, tipo: 'deficit' });
  }
  const total = Math.max(receita, despesa);
  return { fontes, destinos, total, receita, despesa, saldo };
}

/**
 * Posições dos nós e das fitas. As fitas são empilhadas pelo valor acumulado
 * dos dois lados do nó central, então a soma das alturas é exatamente a altura
 * do nó central.
 */
export function layoutFluxo(modelo, { largura = 960, altura = 520, nodeW = 16, gap = 10, margemX = 4, margemY = 8 } = {}) {
  const util = (n) => altura - 2 * margemY - gap * Math.max(0, n - 1);
  const escala = Math.min(util(modelo.fontes.length), util(modelo.destinos.length)) / modelo.total;
  const hCentro = modelo.total * escala;
  const centro = { id: 'tesouro', nome: 'Cofre da Prefeitura', valor: modelo.total, tipo: 'centro', x: largura / 2 - nodeW / 2, y: (altura - hCentro) / 2, h: hCentro };

  function coluna(nos, x) {
    const hTotal = nos.reduce((s, n) => s + n.valor * escala, 0) + gap * (nos.length - 1);
    let y = (altura - hTotal) / 2;
    return nos.map((n) => {
      const no = { ...n, x, y, h: n.valor * escala };
      y += no.h + gap;
      return no;
    });
  }
  const fontes = coluna(modelo.fontes, margemX);
  const destinos = coluna(modelo.destinos, largura - margemX - nodeW);

  const links = [];
  let yc = centro.y;
  for (const f of fontes) {
    links.push({ de: f, para: centro, x0: f.x + nodeW, y0: f.y, x1: centro.x, y1: yc, h: f.h, valor: f.valor });
    yc += f.h;
  }
  yc = centro.y;
  for (const t of destinos) {
    links.push({ de: centro, para: t, x0: centro.x + nodeW, y0: yc, x1: t.x, y1: t.y, h: t.h, valor: t.valor });
    yc += t.h;
  }
  return { nos: [...fontes, centro, ...destinos], fontes, destinos, centro, links, nodeW, largura, altura };
}

export function caminhoFita({ x0, y0, x1, y1, h }) {
  const cx = (x0 + x1) / 2;
  return `M${x0},${y0} C${cx},${y0} ${cx},${y1} ${x1},${y1} L${x1},${y1 + h} C${cx},${y1 + h} ${cx},${y0 + h} ${x0},${y0 + h} Z`;
}

// ---------------------------------------------------------------------------
// Calculadora do cidadão
// ---------------------------------------------------------------------------

export const NOMES_CIDADAOS = {
  '12': 'Educação (escolas, creches, merenda, transporte escolar)',
  '10': 'Saúde (postos, remédios, exames, agentes de saúde)',
  '15': 'Urbanismo (ruas, calçamento, iluminação, limpeza)',
  '04': 'Administração geral da Prefeitura',
  '26': 'Transporte (estradas rurais, pontes, frota)',
  '08': 'Assistência social (CRAS, CREAS, auxílios)',
  '09': 'Previdência dos servidores',
  '01': 'Câmara Municipal',
  '27': 'Esporte e lazer',
  '18': 'Meio ambiente',
  '20': 'Agricultura',
  '13': 'Cultura',
  '06': 'Segurança pública',
  '17': 'Saneamento',
  '16': 'Habitação',
  '28': 'Encargos especiais (dívidas, precatórios)',
};

/**
 * Reparte `valor` entre as funções na proporção da despesa empenhada.
 * As fatias somam exatamente `valor` (o arredondamento fica na última).
 */
export function calculadora(d, valor, maxItens = 7) {
  const funcoes = d.despesa.funcoes.filter((f) => f.empenhado > 0);
  const total = funcoes.reduce((s, f) => s + f.empenhado, 0);
  if (!total || !(valor > 0)) return [];
  const principais = funcoes.slice(0, maxItens - 1);
  const resto = funcoes.slice(maxItens - 1);
  const itens = principais.map((f) => ({ codigo: f.codigo, nome: NOMES_CIDADAOS[f.codigo] ?? f.nome, base: f.empenhado }));
  if (resto.length) itens.push({ codigo: 'demais', nome: `Demais ${resto.length} áreas (previdência, Câmara, esporte, meio ambiente e outras)`, base: resto.reduce((s, f) => s + f.empenhado, 0) });

  let acumulado = 0;
  return itens.map((it, i) => {
    const pct = (it.base / total) * 100;
    let parte = Math.round(valor * (it.base / total) * 100) / 100;
    if (i === itens.length - 1) parte = Math.round((valor - acumulado) * 100) / 100;
    acumulado += parte;
    return { codigo: it.codigo, nome: it.nome, pct, valor: parte };
  });
}

// ---------------------------------------------------------------------------
// Limites legais
// ---------------------------------------------------------------------------

export function statusPessoal(ind) {
  const v = ind.pessoal_pct;
  if (v == null) return { nivel: 'nd', rotulo: 'Não informado' };
  if (v > (ind.pessoal_limite ?? 54)) return { nivel: 'critico', rotulo: 'Acima do limite máximo' };
  if (v > (ind.pessoal_prudencial ?? 51.3)) return { nivel: 'alto', rotulo: 'Acima do limite prudencial' };
  if (v > (ind.pessoal_alerta ?? 48.6)) return { nivel: 'medio', rotulo: 'Acima do limite de alerta' };
  return { nivel: 'ok', rotulo: 'Dentro do limite' };
}

export function statusMinimo(aplicado, minimo, folgaAtencao = 1) {
  if (aplicado == null) return { nivel: 'nd', rotulo: 'Não informado' };
  if (aplicado < minimo) return { nivel: 'critico', rotulo: 'Abaixo do mínimo constitucional' };
  if (aplicado - minimo < folgaAtencao) return { nivel: 'medio', rotulo: 'Cumprido com folga mínima' };
  return { nivel: 'ok', rotulo: 'Mínimo cumprido' };
}

// ---------------------------------------------------------------------------
// Pontos de atenção (gerados a partir dos dados, nunca escritos à mão)
// ---------------------------------------------------------------------------

export function alertas(data, ano) {
  const d = data.anos[String(ano)];
  const p = anoAnterior(data, ano);
  const ind = d.indicadores;
  const k = kpis(data, ano);
  const out = [];
  const fmt = (v) => `R$ ${(Math.abs(v) / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} milhões`;

  if (d.resultado_orcamentario < 0) {
    const caixaAnt = p?.balanco?.caixa;
    const coberto = caixaAnt != null && caixaAnt >= -d.resultado_orcamentario;
    out.push({
      nivel: 'alto',
      titulo: `Déficit orçamentário de ${fmt(d.resultado_orcamentario)}`,
      texto: `A Prefeitura empenhou (comprometeu) mais despesas do que arrecadou em ${ano}. `
        + (caixaAnt != null
          ? `O caixa no fim de ${p.ano} era de ${fmt(caixaAnt)}, ${coberto ? 'suficiente para cobrir a diferença — é o uso de sobras de anos anteriores' : 'insuficiente para cobrir a diferença'}.`
          : 'Verifique se havia sobra de caixa de anos anteriores para cobrir a diferença.'),
      ajuda: 'resultado_orcamentario',
    });
  } else if (k.resultadoPct != null && k.resultadoPct > 8) {
    out.push({
      nivel: 'info',
      titulo: `Sobra de ${fmt(d.resultado_orcamentario)} (${k.resultadoPct.toFixed(1).replace('.', ',')}% da receita)`,
      texto: 'Arrecadou bem mais do que gastou. Sobras altas e recorrentes podem indicar serviços que deixaram de ser prestados ou receitas extraordinárias guardadas para obras futuras.',
      ajuda: 'resultado_orcamentario',
    });
  }

  const sp = statusPessoal(ind);
  if (['medio', 'alto', 'critico'].includes(sp.nivel)) {
    out.push({
      nivel: sp.nivel === 'medio' ? 'medio' : 'alto',
      titulo: `Gasto com pessoal ${sp.rotulo.toLowerCase()}`,
      texto: `A despesa com pessoal chegou a ${ind.pessoal_pct.toFixed(2).replace('.', ',')}% da receita corrente líquida (limite: ${ind.pessoal_limite ?? 54}%). Acima do alerta, o Tribunal de Contas notifica; acima do prudencial, ficam proibidos aumentos e novas contratações.`,
      ajuda: 'dtp',
    });
  }

  const mde = statusMinimo(ind.mde_pct, ind.mde_min ?? 25);
  if (mde.nivel !== 'ok' && mde.nivel !== 'nd') {
    out.push({
      nivel: mde.nivel === 'critico' ? 'alto' : 'medio',
      titulo: `Educação: ${mde.rotulo.toLowerCase()} (${ind.mde_pct.toFixed(2).replace('.', ',')}%)`,
      texto: `A Constituição exige aplicar ao menos ${ind.mde_min ?? 25}% da receita de impostos em manutenção e desenvolvimento do ensino. A folga foi de apenas ${(ind.mde_pct - (ind.mde_min ?? 25)).toFixed(2).replace('.', ',')} ponto percentual.`,
      ajuda: 'mde',
    });
  }
  const asps = statusMinimo(ind.asps_pct, ind.asps_min ?? 15);
  if (asps.nivel === 'critico' || asps.nivel === 'medio') {
    out.push({ nivel: asps.nivel === 'critico' ? 'alto' : 'medio', titulo: `Saúde: ${asps.rotulo.toLowerCase()}`, texto: `Aplicado: ${ind.asps_pct}% (mínimo de 15%).`, ajuda: 'asps' });
  }

  const insc = ind.rp_nao_processados_inscritos;
  const canc = ind.rp_nao_processados_cancelados;
  if (insc && canc && canc / insc > 0.3) {
    out.push({
      nivel: 'medio',
      titulo: `${Math.round((canc / insc) * 100)}% dos restos a pagar não processados foram cancelados`,
      texto: `De ${fmt(insc)} em despesas empenhadas e não entregues herdadas do ano anterior, ${fmt(canc)} foram canceladas em ${ano}. Cancelamentos altos podem indicar empenhos feitos sem necessidade real — e inflam a despesa empenhada do ano em que foram registrados.`,
      ajuda: 'restos_a_pagar',
    });
  }

  if (k.execucaoReceita != null && k.execucaoReceita < 92) {
    out.push({
      nivel: 'medio',
      titulo: `Arrecadou ${k.execucaoReceita.toFixed(1).replace('.', ',')}% do que previa`,
      texto: `A previsão atualizada de receita era de ${fmt(ind.previsao_atualizada)}, mas entraram ${fmt(k.receita)}. Orçamentos superestimados autorizam gastos que depois não têm cobertura.`,
      ajuda: 'previsao',
    });
  }

  for (const inc of ind.inconsistencias ?? []) {
    out.push({ nivel: 'medio', titulo: 'Inconsistência na declaração oficial', texto: inc, ajuda: 'inconsistencias' });
  }

  const proprios = d.receita.proprios_pct;
  if (proprios != null && proprios < 15) {
    out.push({
      nivel: 'info',
      titulo: `Só ${proprios.toFixed(1).replace('.', ',')}% da receita vem de tributos próprios`,
      texto: 'O restante depende de repasses da União e do Estado (FPM, ICMS, FUNDEB, SUS). Quedas na economia nacional chegam rápido ao caixa da cidade.',
      ajuda: 'proprios',
    });
  }

  if (!out.some((a) => a.nivel === 'alto' || a.nivel === 'medio')) {
    out.unshift({ nivel: 'ok', titulo: 'Nenhum limite legal em risco neste ano', texto: 'Pessoal, educação e saúde dentro das regras da LRF e da Constituição, sem déficit orçamentário.', ajuda: 'lrf' });
  }
  const ordem = { alto: 0, medio: 1, ok: 2, info: 3 };
  return out.sort((a, b) => ordem[a.nivel] - ordem[b.nivel]);
}

// ---------------------------------------------------------------------------
// Série histórica e comparação regional
// ---------------------------------------------------------------------------

export function serie(data, extrator, { real = false } = {}) {
  return anos(data).map((a) => {
    const v = extrator(data.anos[a]);
    return { ano: a, valor: real ? corrigir(data, v, a) : v };
  });
}

export function metricasMunicipio(d) {
  const rec = d.receita.liquida;
  const pop = d.populacao;
  const grupo = (id) => d.receita.grupos.find((g) => g.id === id)?.liquido ?? 0;
  const invest = d.despesa.naturezas.find((n) => n.codigo === '4.4')?.empenhado ?? 0;
  const funcao = (cod) => d.despesa.funcoes.find((f) => f.codigo === cod)?.empenhado ?? 0;
  return {
    populacao: pop,
    receitaPc: pop ? rec / pop : null,
    despesaPc: pop ? d.despesa.empenhada / pop : null,
    propriosPct: rec ? (grupo('proprios') / rec) * 100 : null,
    fpmPct: rec ? (grupo('fpm') / rec) * 100 : null,
    royaltiesPct: rec ? (grupo('royalties') / rec) * 100 : null,
    pessoalPct: d.indicadores.pessoal_pct,
    investimentoPc: pop ? invest / pop : null,
    saudePc: pop ? funcao('10') / pop : null,
    educacaoPc: pop ? funcao('12') / pop : null,
    resultadoPct: rec ? (d.resultado_orcamentario / rec) * 100 : null,
  };
}

export function anoVizinhos(data, ano) {
  const disponiveis = Object.keys(data.vizinhos ?? {}).sort();
  if (!disponiveis.length) return null;
  return disponiveis.includes(String(ano)) ? String(ano) : disponiveis[disponiveis.length - 1];
}

export function tabelaVizinhos(data, ano) {
  const a = anoVizinhos(data, ano);
  if (!a || !data.anos[a]) return { ano: a, linhas: [] };
  const linhas = [{ ibge: String(data.meta.ente.ibge), nome: data.meta.ente.nome, destaque: true, ...metricasMunicipio(data.anos[a]) }];
  for (const [ibge, m] of Object.entries(data.vizinhos[a])) linhas.push({ ibge, nome: m.nome, destaque: false, ...metricasMunicipio(m) });
  return { ano: a, linhas };
}

/** Posição (1 = maior) de Resplendor numa métrica entre os municípios comparados. */
export function ranking(linhas, chave) {
  const validas = linhas.filter((l) => l[chave] != null).sort((x, y) => y[chave] - x[chave]);
  const pos = validas.findIndex((l) => l.destaque);
  return pos < 0 ? null : { posicao: pos + 1, de: validas.length };
}
