import { html, formatBRL, formatCompacto, formatPct } from '../util.js';
import { anos, corrigir, variacao } from '../model.js';
import { card, botaoAjuda } from '../ui.js';
import { grafico, blocoGrafico, eixos, cores } from '../charts.js';

function linhas(c, series) {
  return series.map((s, i) => ({
    label: s.nome, data: s.dados, borderColor: c.serie[s.slot ?? i], backgroundColor: c.serie[s.slot ?? i],
    pointBackgroundColor: c.serie[s.slot ?? i], spanGaps: false,
  }));
}

export function render(el, { data, ano, estado, setEstado }) {
  const real = estado.valores === 'real';
  const lista = anos(data);
  const base = data.meta.ipca.ano_base;
  const c = cores();
  const v = (a, x) => (real ? corrigir(data, x, a) : x);
  const unidade = real ? `em R$ de ${base} (corrigido pelo IPCA)` : 'em valores nominais (da época)';
  const primeiro = lista[0];
  const ultimo = lista.at(-1);
  const rec0 = v(primeiro, data.anos[primeiro].receita.liquida);
  const rec1 = v(ultimo, data.anos[ultimo].receita.liquida);

  el.innerHTML = String(html`
    <div class="section-head with-controls">
      <div>
        <h2>${lista.length} anos de contas públicas (${primeiro}–${ultimo})</h2>
        <p>Valores ${unidade}. ${real ? html`Descontada a inflação, a receita ${rec1 >= rec0 ? 'cresceu' : 'caiu'} <strong>${formatPct(Math.abs(variacao(rec1, rec0)), 0)}</strong> no período.` : 'Use “corrigidos pela inflação” para comparar o poder de compra entre anos.'}</p>
      </div>
      <div class="segmented" role="radiogroup" aria-label="Tipo de valor">
        <button type="button" role="radio" aria-checked="${!real}" data-valores="nominal">Nominais</button>
        <button type="button" role="radio" aria-checked="${real}" data-valores="real">Corrigidos pela inflação</button>
        ${botaoAjuda('ipca')}
      </div>
    </div>

    <div class="section-grid">
      ${card({ titulo: 'Receita arrecadada × despesa empenhada', ajuda: 'resultado_orcamentario', classe: 'span-8', corpo: blocoGrafico('gHistTotais', 300) })}
      ${card({ titulo: 'Resultado do ano', subtitulo: 'Superávit (acima de zero) ou déficit (abaixo)', classe: 'span-4', corpo: blocoGrafico('gHistResultado', 300) })}
      ${card({ titulo: 'Gasto com pessoal (% da RCL)', ajuda: 'dtp', classe: 'span-6', corpo: blocoGrafico('gHistPessoal', 260) })}
      ${card({ titulo: 'Mínimos de educação e saúde', subtitulo: '% da receita de impostos', ajuda: 'mde', classe: 'span-6', corpo: blocoGrafico('gHistMinimos', 260) })}
      ${card({ titulo: 'Principais fontes de receita', classe: 'span-7', corpo: blocoGrafico('gHistFontes', 300) })}
      ${card({ titulo: 'Gasto por habitante', ajuda: 'per_capita', classe: 'span-5', corpo: blocoGrafico('gHistPerCapita', 300) })}
    </div>`);

  el.querySelectorAll('[data-valores]').forEach((b) => b.addEventListener('click', () => setEstado({ valores: b.dataset.valores })));

  const fmtTabela = (x) => (x == null ? '—' : formatBRL(x, { centavos: false }));
  const tooltipBRL = { callbacks: { label: (x) => ` ${x.dataset.label}: ${formatBRL(x.raw, { centavos: false })}` } };
  const tooltipPct = { callbacks: { label: (x) => ` ${x.dataset.label}: ${formatPct(x.raw, 2)}` } };
  const destaqueAno = (ctx) => (lista[ctx.dataIndex] === ano ? 7 : 4);

  // 1. Totais
  const rec = lista.map((a) => v(a, data.anos[a].receita.liquida));
  const desp = lista.map((a) => v(a, data.anos[a].despesa.empenhada));
  grafico('gHistTotais', {
    type: 'line',
    data: { labels: lista, datasets: linhas(c, [{ nome: 'Receita líquida', dados: rec }, { nome: 'Despesa empenhada', dados: desp }]).map((s) => ({ ...s, pointRadius: destaqueAno })) },
    options: { scales: eixos({ formatoY: (x) => formatCompacto(x) }), interaction: { mode: 'index', intersect: false }, plugins: { tooltip: tooltipBRL } },
  }, { descricao: `Receita e despesa de ${primeiro} a ${ultimo}, ${unidade}`, tabela: { colunas: ['Ano', 'Receita líquida', 'Despesa empenhada'], linhas: lista.map((a, i) => [a, fmtTabela(rec[i]), fmtTabela(desp[i])]) } });

  // 2. Resultado — cor pelo sinal
  const res = lista.map((a) => v(a, data.anos[a].resultado_orcamentario));
  grafico('gHistResultado', {
    type: 'bar',
    data: { labels: lista, datasets: [{ label: 'Resultado', data: res, backgroundColor: res.map((x) => (x < 0 ? c.negativo : c.positivo)), maxBarThickness: 22, borderSkipped: false }] },
    options: { scales: eixos({ formatoY: (x) => formatCompacto(x), minY: Math.min(0, ...res) * 1.1 }), plugins: { legend: { display: false }, tooltip: { callbacks: { label: (x) => ` ${x.raw < 0 ? 'Déficit' : 'Superávit'}: ${formatBRL(Math.abs(x.raw), { centavos: false })}` } } } },
  }, { descricao: `Resultado orçamentário por ano: ${lista.map((a, i) => `${a} ${formatCompacto(res[i])}`).join('; ')}`, tabela: { colunas: ['Ano', 'Resultado'], linhas: lista.map((a, i) => [a, fmtTabela(res[i])]) } });

  // 3. Pessoal
  const pes = lista.map((a) => data.anos[a].indicadores.pessoal_pct);
  grafico('gHistPessoal', {
    type: 'line',
    data: { labels: lista, datasets: linhas(c, [{ nome: 'Pessoal / RCL', dados: pes }]).map((s) => ({ ...s, pointRadius: destaqueAno })) },
    options: {
      scales: eixos({ formatoY: (x) => `${x}%`, minY: 35, maxY: 58 }),
      plugins: { legend: { display: false }, tooltip: tooltipPct, linhasRef: { linhas: [
        { valor: 54, rotulo: 'Máximo 54%', cor: c.critico, corTexto: c.tinta2 },
        { valor: 51.3, rotulo: 'Prudencial 51,3%', cor: c.serio, corTexto: c.tinta2 },
        { valor: 48.6, rotulo: 'Alerta 48,6%', cor: c.alerta, corTexto: c.tinta2 },
      ] } },
    },
  }, { descricao: 'Gasto com pessoal como percentual da receita corrente líquida, com limites de alerta, prudencial e máximo', tabela: { colunas: ['Ano', 'Pessoal / RCL'], linhas: lista.map((a, i) => [a, formatPct(pes[i], 2)]) } });

  // 4. Mínimos
  const mde = lista.map((a) => data.anos[a].indicadores.mde_pct);
  const asps = lista.map((a) => data.anos[a].indicadores.asps_pct);
  grafico('gHistMinimos', {
    type: 'line',
    data: { labels: lista, datasets: linhas(c, [{ nome: 'Educação (MDE)', dados: mde }, { nome: 'Saúde (ASPS)', dados: asps }]) },
    options: {
      scales: eixos({ formatoY: (x) => `${x}%`, minY: 10 }),
      interaction: { mode: 'index', intersect: false },
      plugins: { tooltip: tooltipPct, linhasRef: { linhas: [
        { valor: 25, rotulo: 'Mínimo educação 25%', cor: c.serie[0], corTexto: c.tinta2 },
        { valor: 15, rotulo: 'Mínimo saúde 15%', cor: c.serie[1], corTexto: c.tinta2 },
      ] } },
    },
  }, { descricao: 'Percentuais aplicados em educação e saúde, com os mínimos constitucionais', tabela: { colunas: ['Ano', 'Educação (MDE)', 'Saúde (ASPS)'], linhas: lista.map((a, i) => [a, formatPct(mde[i], 2), formatPct(asps[i], 2)]) } });

  // 5. Fontes
  const chaves = [['fpm', 'FPM'], ['fundeb', 'FUNDEB'], ['icms', 'ICMS'], ['cfem', 'CFEM'], ['iss', 'ISS']];
  const fontes = chaves.map(([k, nome]) => ({ nome, dados: lista.map((a) => v(a, data.anos[a].receita.destaques[k]?.liquido ?? null)) }));
  grafico('gHistFontes', {
    type: 'line',
    data: { labels: lista, datasets: linhas(c, fontes) },
    options: { scales: eixos({ formatoY: (x) => formatCompacto(x) }), interaction: { mode: 'index', intersect: false }, plugins: { tooltip: tooltipBRL } },
  }, { descricao: 'Evolução de FPM, FUNDEB, ICMS, CFEM e ISS', tabela: { colunas: ['Ano', ...chaves.map((k) => k[1])], linhas: lista.map((a, i) => [a, ...fontes.map((f) => fmtTabela(f.dados[i]))]) } });

  // 6. Por habitante
  const pc = (a, cod) => {
    const d = data.anos[a];
    const val = cod ? d.despesa.funcoes.find((f) => f.codigo === cod)?.empenhado : d.despesa.empenhada;
    return val == null ? null : v(a, val) / d.populacao;
  };
  const seriesPc = [{ nome: 'Total', dados: lista.map((a) => pc(a)) }, { nome: 'Saúde', dados: lista.map((a) => pc(a, '10')) }, { nome: 'Educação', dados: lista.map((a) => pc(a, '12')) }];
  grafico('gHistPerCapita', {
    type: 'line',
    data: { labels: lista, datasets: linhas(c, seriesPc) },
    options: { scales: eixos({ formatoY: (x) => formatCompacto(x) }), interaction: { mode: 'index', intersect: false }, plugins: { tooltip: tooltipBRL } },
  }, { descricao: 'Despesa por habitante: total, saúde e educação', tabela: { colunas: ['Ano', 'Total', 'Saúde', 'Educação', 'População'], linhas: lista.map((a, i) => [a, ...seriesPc.map((s) => fmtTabela(s.dados[i])), data.anos[a].populacao.toLocaleString('pt-BR')]) } });
}
