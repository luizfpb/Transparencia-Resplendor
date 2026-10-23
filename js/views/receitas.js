import { html, formatBRL, formatCompacto, formatPct, formatVariacao, normalizarBusca } from '../util.js';
import { anoAnterior, variacao, variacaoReal, NOMES_CURTOS_FONTE } from '../model.js';
import { card, botaoAjuda } from '../ui.js';
import { grafico, blocoGrafico, eixos, cores } from '../charts.js';

const DESTAQUES = [
  ['fpm', 'FPM', 'Fundo de Participação dos Municípios (União)'],
  ['fundeb', 'FUNDEB', 'Fundo da educação básica'],
  ['icms', 'ICMS (cota-parte)', '25% do ICMS arrecadado pelo Estado, repartido pelos municípios'],
  ['iss', 'ISS', 'Imposto municipal sobre serviços'],
  ['cfem', 'CFEM', 'Royalties da mineração'],
  ['ipva', 'IPVA (cota-parte)', '50% do IPVA dos veículos emplacados no município'],
  ['irrf', 'IRRF', 'Imposto de renda retido dos servidores municipais'],
  ['itbi', 'ITBI', 'Imposto municipal na venda de imóveis'],
  ['iptu', 'IPTU', 'Imposto municipal sobre imóveis urbanos'],
];

export function render(el, { data, ano }) {
  const d = data.anos[ano];
  const p = anoAnterior(data, ano);
  const r = d.receita;

  el.innerHTML = String(html`
    <div class="section-grid">
      ${card({
        titulo: 'Bruta, dedução e líquida',
        subtitulo: 'Por que a receita aparece com dois valores',
        ajuda: 'receita_liquida',
        classe: 'span-5',
        corpo: html`
          <dl class="equation">
            <div><dt>Receita bruta arrecadada</dt><dd>${formatBRL(r.bruta)}</dd></div>
            <div class="minus"><dt>Dedução obrigatória para o FUNDEB</dt><dd>− ${formatBRL(r.deducoes_fundeb)}</dd></div>
            ${r.outras_deducoes ? html`<div class="minus"><dt>Outras deduções</dt><dd>− ${formatBRL(r.outras_deducoes)}</dd></div>` : ''}
            <div class="result"><dt>Receita líquida</dt><dd>${formatBRL(r.liquida)}</dd></div>
          </dl>
          <p class="note">A Prefeitura deposita 20% do FPM, ICMS, IPVA e outros repasses no FUNDEB, e o fundo devolve conforme o número de alunos. Em ${ano} voltaram ${formatBRL(r.destaques.fundeb.liquido)}, ${r.destaques.fundeb.liquido >= r.deducoes_fundeb ? html`<strong>${formatCompacto(r.destaques.fundeb.liquido - r.deducoes_fundeb)} a mais</strong> do que saiu` : html`<strong>${formatCompacto(r.deducoes_fundeb - r.destaques.fundeb.liquido)} a menos</strong> do que saiu`}.</p>`,
      })}

      ${card({
        titulo: 'Principais receitas',
        subtitulo: p ? `Variação sobre ${p.ano}, nominal e descontada a inflação (real)` : 'Valores do exercício',
        classe: 'span-7',
        corpo: html`
          <div class="table-responsive">
            <table class="data-table">
              <thead><tr><th scope="col">Receita</th><th scope="col" class="num">Valor líquido</th>${p ? html`<th scope="col" class="num">Nominal</th><th scope="col" class="num">Real ${botaoAjuda('ipca')}</th>` : ''}</tr></thead>
              <tbody>${DESTAQUES.filter(([k]) => r.destaques[k]?.liquido > 0).map(([k, nome, desc]) => {
                const v = r.destaques[k].liquido;
                const va = p?.receita.destaques[k]?.liquido;
                const vn = p ? variacao(v, va) : null;
                const vr = p ? variacaoReal(data, v, ano, va, p.ano) : null;
                return html`<tr>
                  <th scope="row"><span class="cell-title">${nome}</span><span class="cell-sub">${desc}</span></th>
                  <td class="num strong">${formatBRL(v)}</td>
                  ${p ? html`<td class="num">${formatVariacao(vn)}</td><td class="num ${vr > 0 ? 'up' : vr < 0 ? 'down' : ''}">${formatVariacao(vr)}</td>` : ''}
                </tr>`;
              })}</tbody>
            </table>
          </div>`,
      })}

      ${card({
        titulo: 'Composição da receita líquida',
        classe: 'span-12',
        corpo: blocoGrafico('gReceitasGrupos', 280),
      })}

      ${card({
        titulo: 'Todas as contas de receita',
        subtitulo: 'Classificação oficial completa, como declarada no Balanço Anual (DCA)',
        classe: 'span-12',
        extra: html`
          <div class="toolbar">
            <label class="search-box"><span class="visually-hidden">Buscar receita</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input type="search" id="buscaReceita" placeholder="Buscar: IPTU, SUS, convênio…">
            </label>
            <label class="checkbox"><input type="checkbox" id="todosNiveis"> Todos os níveis</label>
          </div>`,
        corpo: html`<div class="table-responsive tall"><table class="data-table tree" id="tabelaArvore">
          <thead><tr><th scope="col">Código</th><th scope="col">Conta</th><th scope="col" class="num">Bruto</th><th scope="col" class="num">Dedução FUNDEB</th><th scope="col" class="num">Líquido</th><th scope="col" class="num">% da receita</th></tr></thead>
          <tbody id="arvoreCorpo"></tbody></table></div>
          <p class="table-count" id="arvoreContagem" aria-live="polite"></p>`,
      })}
    </div>`);

  const c = cores();
  const grupos = [...r.grupos].filter((g) => g.liquido > 0).sort((a, b) => b.liquido - a.liquido);
  grafico('gReceitasGrupos', {
    type: 'bar',
    data: { labels: grupos.map((g) => NOMES_CURTOS_FONTE[g.id] ?? g.nome), datasets: [{ label: 'Receita líquida', data: grupos.map((g) => g.liquido), backgroundColor: c.serie[0], maxBarThickness: 24 }] },
    options: {
      indexAxis: 'y',
      scales: eixos({ horizontal: true, formatoX: (v) => formatCompacto(v) }),
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: (x) => ` ${formatBRL(x.raw)} (${formatPct((x.raw / r.liquida) * 100)})`, afterLabel: (x) => grupos[x.dataIndex].desc } } },
    },
  }, {
    descricao: `Composição da receita: ${grupos.map((g) => `${g.nome} ${formatPct((g.liquido / r.liquida) * 100)}`).join('; ')}`,
    tabela: { colunas: ['Origem', 'Bruto', 'Dedução FUNDEB', 'Líquido', '%'], linhas: grupos.map((g) => [g.nome, g.bruto != null ? formatBRL(g.bruto) : '—', g.deducao_fundeb != null ? formatBRL(g.deducao_fundeb) : '—', formatBRL(g.liquido), formatPct((g.liquido / r.liquida) * 100)]) },
  });

  const corpo = document.getElementById('arvoreCorpo');
  const busca = document.getElementById('buscaReceita');
  const todos = document.getElementById('todosNiveis');
  const atualizar = () => {
    const q = normalizarBusca(busca.value.trim());
    const linhas = r.arvore.filter((l) => (q ? normalizarBusca(`${l.codigo} ${l.nome}`).includes(q) : todos.checked || l.nivel <= 3));
    corpo.innerHTML = String(html`${linhas.map((l) => html`
      <tr class="lvl-${Math.min(l.nivel, 6)}">
        <td class="mono muted">${l.codigo}</td>
        <td><span class="indent" style="--nivel:${q ? 0 : l.nivel - 1}">${l.nome}</span></td>
        <td class="num">${formatBRL(l.bruto)}</td>
        <td class="num muted">${l.deducao ? `− ${formatBRL(l.deducao)}` : ''}</td>
        <td class="num strong">${formatBRL(l.bruto - l.deducao)}</td>
        <td class="num muted">${formatPct(((l.bruto - l.deducao) / r.liquida) * 100, 2)}</td>
      </tr>`)}`);
    document.getElementById('arvoreContagem').textContent = linhas.length
      ? `${linhas.length} de ${r.arvore.length} contas exibidas`
      : 'Nenhuma conta encontrada para essa busca.';
  };
  busca.addEventListener('input', atualizar);
  todos.addEventListener('change', atualizar);
  atualizar();
}
