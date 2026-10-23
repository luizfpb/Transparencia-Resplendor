import { html, formatBRL, formatCompacto, formatPct, normalizarBusca } from '../util.js';
import { card, tornarOrdenavel } from '../ui.js';
import { grafico, blocoGrafico, eixos, cores } from '../charts.js';

const GRUPO = { '3.1': 'Pessoal', '3.2': 'Juros', '3.3': 'Custeio', '4.4': 'Investimento', '4.5': 'Inversão', '4.6': 'Dívida' };

export function render(el, { data, ano }) {
  const d = data.anos[ano];
  const desp = d.despesa;
  const ind = d.indicadores;
  const elementos = desp.elementos.filter((e) => e.empenhado > 0);
  const top = elementos.slice(0, 10);

  el.innerHTML = String(html`
    <div class="section-grid">
      ${card({
        titulo: 'Em que o dinheiro foi gasto',
        subtitulo: 'Os 10 maiores elementos de despesa: salários, serviços de empresas, materiais, obras',
        ajuda: 'elemento',
        classe: 'span-7',
        corpo: blocoGrafico('gElementos', 360),
      })}

      ${card({
        titulo: 'Restos a pagar',
        subtitulo: `Despesas de ${ano} que ficaram para ${Number(ano) + 1}`,
        ajuda: 'restos_a_pagar',
        classe: 'span-5',
        corpo: html`
          <dl class="kv">
            <div><dt>Processados (entregues, falta pagar)</dt><dd>${formatBRL(desp.rp_processados_inscritos)}</dd></div>
            <div><dt>Não processados (nem entregues)</dt><dd>${formatBRL(desp.rp_nao_processados_inscritos)}</dd></div>
          </dl>
          ${ind.rp_nao_processados_inscritos ? html`
            <h4 class="kv-title">Herdados de ${Number(ano) - 1} e cancelados em ${ano}</h4>
            <dl class="kv">
              <div><dt>Não processados recebidos</dt><dd>${formatBRL(ind.rp_nao_processados_inscritos)}</dd></div>
              <div><dt>Cancelados</dt><dd>${formatBRL(ind.rp_nao_processados_cancelados)}${ind.rp_nao_processados_cancelados ? html` <small>(${formatPct((ind.rp_nao_processados_cancelados / ind.rp_nao_processados_inscritos) * 100)})</small>` : ''}</dd></div>
            </dl>` : ''}
          <p class="note">Cancelar um resto a pagar não processado significa que a despesa foi empenhada, mas o serviço ou a compra nunca aconteceu.</p>`,
      })}

      ${card({
        titulo: 'Todos os elementos de despesa',
        classe: 'span-12',
        extra: html`<label class="search-box"><span class="visually-hidden">Buscar elemento</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input type="search" id="buscaElemento" placeholder="Buscar: material, obras, diárias…"></label>`,
        corpo: html`<div class="table-responsive tall"><table class="data-table" id="tabelaElementos">
          <thead><tr>
            <th scope="col" data-ordem="codigo">Código</th><th scope="col" data-ordem="nome">Elemento</th><th scope="col" data-ordem="grupo">Grupo</th>
            <th scope="col" class="num" data-ordem="empenhado" aria-sort="descending">Empenhado</th><th scope="col" class="num" data-ordem="liquidado">Liquidado</th>
            <th scope="col" class="num" data-ordem="pago">Pago</th><th scope="col" class="num" data-ordem="pct">% do total</th>
          </tr></thead><tbody id="elementosCorpo"></tbody></table></div>`,
      })}

      ${card({
        titulo: 'Quer conferir cada nota de empenho?',
        subtitulo: 'Fornecedores, contratos e licitações individuais',
        classe: 'span-12 callout',
        corpo: html`
          <p>Este painel usa apenas dados que podem ser baixados automaticamente e auditados. As notas de empenho individuais, com credor, CNPJ e valor, são publicadas pelo Tribunal de Contas de Minas Gerais, cujo sistema exige acesso manual. Para consultar:</p>
          <ul class="link-list">
            <li><a href="https://fiscalizandocomtce.tce.mg.gov.br" target="_blank" rel="noopener"><strong>Fiscalizando com o TCE-MG</strong></a>: busque por “Resplendor” para ver empenhos, fornecedores e licitações.</li>
            <li><a href="https://dadosabertos.tce.mg.gov.br" target="_blank" rel="noopener"><strong>Dados abertos do TCE-MG</strong></a>: arquivos completos do SICOM por município e ano.</li>
            <li><a href="https://www.resplendor.mg.gov.br" target="_blank" rel="noopener"><strong>Portal da Transparência da Prefeitura</strong></a>: obrigatório pela LC 131/2009, com atualização em tempo real.</li>
            <li><a href="https://www.gov.br/acessoainformacao" target="_blank" rel="noopener"><strong>Pedido via Lei de Acesso à Informação</strong></a>: qualquer cidadão pode pedir cópia de contratos e notas, e a Prefeitura tem 20 dias para responder.</li>
          </ul>`,
      })}
    </div>`);

  const c = cores();
  grafico('gElementos', {
    type: 'bar',
    data: { labels: top.map((e) => e.nome), datasets: [{ label: 'Empenhado', data: top.map((e) => e.empenhado), backgroundColor: c.serie[0], maxBarThickness: 22 }] },
    options: {
      indexAxis: 'y',
      scales: { ...eixos({ horizontal: true, formatoX: (v) => formatCompacto(v) }), y: { ...eixos({ horizontal: true }).y, ticks: { color: c.tinta2, autoSkip: false, callback(v) { const s = this.getLabelForValue(v); return s.length > 38 ? `${s.slice(0, 37)}…` : s; } } } },
      plugins: { legend: { display: false }, tooltip: { callbacks: { title: (x) => top[x[0].dataIndex].nome, label: (x) => ` ${formatBRL(x.raw)} (${formatPct((x.raw / desp.empenhada) * 100)})` } } },
    },
  }, {
    descricao: `Maiores elementos de despesa: ${top.map((e) => `${e.nome} ${formatCompacto(e.empenhado)}`).join('; ')}`,
    tabela: { colunas: ['Elemento', 'Empenhado', '%'], linhas: top.map((e) => [e.nome, formatBRL(e.empenhado), formatPct((e.empenhado / desp.empenhada) * 100)]) },
  });

  const linhas = elementos.map((e) => ({ ...e, grupo: GRUPO[e.grupo] ?? e.grupo, pct: (e.empenhado / desp.empenhada) * 100 }));
  const corpo = document.getElementById('elementosCorpo');
  const busca = document.getElementById('buscaElemento');
  const desenhar = () => {
    const q = normalizarBusca(busca.value.trim());
    const vis = q ? linhas.filter((e) => normalizarBusca(`${e.codigo} ${e.nome} ${e.grupo}`).includes(q)) : linhas;
    corpo.innerHTML = vis.length ? String(html`${vis.map((e) => html`<tr>
      <td class="mono muted">${e.codigo}</td><td class="strong">${e.nome}</td><td><span class="tag">${e.grupo}</span></td>
      <td class="num strong">${formatBRL(e.empenhado)}</td><td class="num">${formatBRL(e.liquidado)}</td><td class="num">${formatBRL(e.pago)}</td><td class="num">${formatPct(e.pct, 2)}</td>
    </tr>`)}`) : '<tr><td colspan="7" class="empty">Nenhum elemento encontrado.</td></tr>';
  };
  busca.addEventListener('input', desenhar);
  tornarOrdenavel(document.getElementById('tabelaElementos'), (chave, dir) => {
    linhas.sort((a, b) => (typeof a[chave] === 'string' ? a[chave].localeCompare(b[chave]) : a[chave] - b[chave]) * dir);
    desenhar();
  });
  desenhar();
}
