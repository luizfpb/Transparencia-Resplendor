import { html, formatBRL, formatPct, formatNumero } from '../util.js';
import { tabelaVizinhos, ranking } from '../model.js';
import { card, tornarOrdenavel } from '../ui.js';
import { grafico, blocoGrafico, eixos, cores } from '../charts.js';

const METRICAS = [
  { chave: 'receitaPc', nome: 'Receita por habitante', fmt: (v) => formatBRL(v, { centavos: false }), desc: 'Quanto o município arrecada por morador (receita líquida).' },
  { chave: 'despesaPc', nome: 'Despesa por habitante', fmt: (v) => formatBRL(v, { centavos: false }), desc: 'Despesa empenhada dividida pela população.' },
  { chave: 'saudePc', nome: 'Saúde por habitante', fmt: (v) => formatBRL(v, { centavos: false }), desc: 'Despesa empenhada na função Saúde por morador.' },
  { chave: 'educacaoPc', nome: 'Educação por habitante', fmt: (v) => formatBRL(v, { centavos: false }), desc: 'Despesa empenhada na função Educação por morador.' },
  { chave: 'investimentoPc', nome: 'Investimento por habitante', fmt: (v) => formatBRL(v, { centavos: false }), desc: 'Obras e equipamentos (grupo 4.4) por morador.' },
  { chave: 'pessoalPct', nome: 'Pessoal (% da RCL)', fmt: (v) => formatPct(v, 2), desc: 'Gasto com pessoal do Executivo sobre a receita corrente líquida. Limite: 54%.' },
  { chave: 'propriosPct', nome: 'Tributos próprios (% da receita)', fmt: (v) => formatPct(v), desc: 'Peso de ISS, IPTU, ITBI e taxas na receita. Maior significa menos dependência de repasses.' },
  { chave: 'fpmPct', nome: 'Dependência do FPM (% da receita)', fmt: (v) => formatPct(v), desc: 'Peso do Fundo de Participação dos Municípios na receita.' },
  { chave: 'royaltiesPct', nome: 'Royalties (% da receita)', fmt: (v) => formatPct(v), desc: 'Peso de CFEM, compensações hídricas e de petróleo na receita.' },
  { chave: 'resultadoPct', nome: 'Resultado orçamentário (% da receita)', fmt: (v) => formatPct(v), desc: 'Superávit (positivo) ou déficit (negativo) em relação à receita.' },
];

let metricaAtual = 'receitaPc';

export function render(el, { data, ano }) {
  const { ano: anoComp, linhas } = tabelaVizinhos(data, ano);
  if (!linhas.length) {
    el.innerHTML = '<p class="empty">Comparação regional indisponível.</p>';
    return;
  }

  el.innerHTML = String(html`
    <div class="section-head with-controls">
      <div>
        <h2>Resplendor e os vizinhos em ${anoComp}</h2>
        <p>${linhas.length - 1} municípios mineiros do Vale do Rio Doce, com os mesmos demonstrativos oficiais.${anoComp !== String(ano) ? html` <strong>Exibindo ${anoComp}</strong>: a comparação cobre só os anos mais recentes.` : ''}</p>
      </div>
      <label class="select-label">Indicador
        <select id="metricaSelect" class="filter-select">${METRICAS.map((m) => html`<option value="${m.chave}" ${m.chave === metricaAtual ? 'selected' : ''}>${m.nome}</option>`)}</select>
      </label>
    </div>

    <div class="section-grid">
      ${card({ titulo: html`<span id="metricaTitulo"></span>`, subtitulo: html`<span id="metricaDesc"></span>`, classe: 'span-12', corpo: html`<p class="rank-callout" id="rankTexto" aria-live="polite"></p>${blocoGrafico('gVizinhos', 340)}` })}
      ${card({
        titulo: 'Tabela comparativa',
        subtitulo: 'Clique no cabeçalho para ordenar',
        classe: 'span-12',
        corpo: html`<div class="table-responsive"><table class="data-table" id="tabelaVizinhos">
          <thead><tr><th scope="col" data-ordem="nome">Município</th><th scope="col" class="num" data-ordem="populacao">População</th>
          ${METRICAS.map((m) => html`<th scope="col" class="num" data-ordem="${m.chave}">${m.nome}</th>`)}</tr></thead>
          <tbody id="vizinhosCorpo"></tbody></table></div>
          <p class="note">Educação (MDE) e saúde (ASPS) não entram na comparação: a maioria dos vizinhos não preenche esses percentuais no RREO Simplificado disponível na API do Tesouro.</p>`,
      })}
    </div>`);

  const c = cores();
  const desenharGrafico = () => {
    const m = METRICAS.find((x) => x.chave === metricaAtual);
    const ord = linhas.filter((l) => l[m.chave] != null).sort((a, b) => b[m.chave] - a[m.chave]);
    const r = ranking(linhas, m.chave);
    document.getElementById('metricaTitulo').textContent = m.nome;
    document.getElementById('metricaDesc').textContent = m.desc;
    const res = linhas.find((l) => l.destaque);
    const media = ord.reduce((s, l) => s + l[m.chave], 0) / ord.length;
    document.getElementById('rankTexto').innerHTML = r ? String(html`Resplendor: <strong>${m.fmt(res[m.chave])}</strong>, ${r.posicao}º de ${r.de}. A média do grupo é ${m.fmt(media)}.`) : 'Sem dado para Resplendor neste indicador.';
    // Ênfase: Resplendor em destaque, os demais em cinza.
    grafico('gVizinhos', {
      type: 'bar',
      data: { labels: ord.map((l) => l.nome), datasets: [{ label: m.nome, data: ord.map((l) => l[m.chave]), backgroundColor: ord.map((l) => (l.destaque ? c.serie[0] : c.neutro)), maxBarThickness: 26, borderSkipped: false }] },
      options: {
        indexAxis: 'y',
        scales: eixos({ horizontal: true, formatoX: (v) => m.fmt(v) }),
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: (x) => ` ${m.fmt(x.raw)}` } } },
      },
    }, {
      descricao: `${m.nome} por município: ${ord.map((l) => `${l.nome} ${m.fmt(l[m.chave])}`).join('; ')}`,
      tabela: { colunas: ['Município', m.nome], linhas: ord.map((l) => [l.nome, m.fmt(l[m.chave])]) },
    });
  };

  const corpo = document.getElementById('vizinhosCorpo');
  const desenharTabela = () => {
    corpo.innerHTML = String(html`${linhas.map((l) => html`<tr class="${l.destaque ? 'highlight' : ''}">
      <th scope="row">${l.nome}</th><td class="num">${formatNumero(l.populacao)}</td>
      ${METRICAS.map((m) => html`<td class="num">${l[m.chave] == null ? '—' : m.fmt(l[m.chave])}</td>`)}
    </tr>`)}`);
  };
  tornarOrdenavel(document.getElementById('tabelaVizinhos'), (chave, dir) => {
    linhas.sort((a, b) => (chave === 'nome' ? a.nome.localeCompare(b.nome) : (a[chave] ?? -Infinity) - (b[chave] ?? -Infinity)) * dir);
    desenharTabela();
  });
  document.getElementById('metricaSelect').addEventListener('change', (e) => { metricaAtual = e.target.value; desenharGrafico(); });
  desenharTabela();
  desenharGrafico();
}
