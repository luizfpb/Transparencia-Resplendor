import { html, formatBRL, formatCompacto, formatPct, formatVariacao } from '../util.js';
import { anoAnterior, variacaoReal, NOMES_CIDADAOS } from '../model.js';
import { card, abrirModal, tornarOrdenavel } from '../ui.js';
import { grafico, blocoGrafico, eixos, cores, tabelaHTML } from '../charts.js';

export function render(el, { data, ano }) {
  const d = data.anos[ano];
  const desp = d.despesa;
  const p = anoAnterior(data, ano);

  el.innerHTML = String(html`
    <div class="section-grid">
      ${card({
        titulo: 'Os três estágios da despesa',
        subtitulo: 'Quanto foi comprometido, entregue e efetivamente pago',
        ajuda: 'estagios',
        classe: 'span-5',
        corpo: html`
          <ol class="stages">
            <li><span class="stage-label">Empenhado</span><span class="stage-bar"><span style="width:100%"></span></span><span class="stage-val">${formatCompacto(desp.empenhada)}</span></li>
            <li><span class="stage-label">Liquidado</span><span class="stage-bar"><span style="width:${(desp.liquidada / desp.empenhada) * 100}%"></span></span><span class="stage-val">${formatCompacto(desp.liquidada)}</span></li>
            <li><span class="stage-label">Pago</span><span class="stage-bar"><span style="width:${(desp.paga / desp.empenhada) * 100}%"></span></span><span class="stage-val">${formatCompacto(desp.paga)}</span></li>
          </ol>
          <p class="note">${formatCompacto(desp.empenhada - desp.paga)} (${formatPct(((desp.empenhada - desp.paga) / desp.empenhada) * 100)}) ficaram para pagar no ano seguinte como restos a pagar.</p>`,
      })}

      ${card({
        titulo: 'Por tipo de gasto',
        subtitulo: 'Folha de pagamento, custeio, obras e dívida',
        ajuda: 'elemento',
        classe: 'span-7',
        corpo: blocoGrafico('gNaturezas', 220),
      })}

      ${card({
        titulo: 'Por área de governo',
        subtitulo: 'Clique numa linha para ver as subfunções',
        ajuda: 'funcao',
        classe: 'span-12',
        corpo: html`<div class="table-responsive"><table class="data-table" id="tabelaFuncoes">
          <thead><tr>
            <th scope="col" data-ordem="codigo">Cód.</th>
            <th scope="col" data-ordem="nome">Área</th>
            <th scope="col" class="num" data-ordem="empenhado" aria-sort="descending">Empenhado</th>
            <th scope="col" class="num" data-ordem="pago">Pago</th>
            <th scope="col" class="num" data-ordem="pct">% do total</th>
            <th scope="col" class="num" data-ordem="pc">Por habitante</th>
            ${p ? html`<th scope="col" class="num" data-ordem="vr">Real vs ${p.ano}</th>` : ''}
          </tr></thead>
          <tbody id="funcoesCorpo"></tbody></table></div>`,
      })}
    </div>`);

  const c = cores();
  const nat = desp.naturezas;
  grafico('gNaturezas', {
    type: 'bar',
    data: { labels: nat.map((n) => n.nome), datasets: [{ label: 'Empenhado', data: nat.map((n) => n.empenhado), backgroundColor: c.serie[0], maxBarThickness: 24 }] },
    options: {
      indexAxis: 'y',
      scales: eixos({ horizontal: true, formatoX: (v) => formatCompacto(v) }),
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: (x) => ` ${formatBRL(x.raw)} (${formatPct((x.raw / desp.empenhada) * 100)})` } } },
    },
  }, {
    descricao: `Despesa por natureza: ${nat.map((n) => `${n.nome} ${formatPct((n.empenhado / desp.empenhada) * 100)}`).join('; ')}`,
    tabela: { colunas: ['Tipo', 'Empenhado', 'Pago', '%'], linhas: nat.map((n) => [n.nome, formatBRL(n.empenhado), formatBRL(n.pago), formatPct((n.empenhado / desp.empenhada) * 100)]) },
  });

  const linhas = desp.funcoes.map((f) => {
    const fa = p?.despesa.funcoes.find((x) => x.codigo === f.codigo);
    return { ...f, pct: (f.empenhado / desp.empenhada) * 100, pc: f.empenhado / d.populacao, vr: fa ? variacaoReal(data, f.empenhado, ano, fa.empenhado, p.ano) : null };
  });
  const corpo = document.getElementById('funcoesCorpo');
  const desenhar = () => {
    corpo.innerHTML = String(html`${linhas.map((f) => html`
      <tr class="clickable" tabindex="0" data-codigo="${f.codigo}" aria-label="${f.nome}: ver subfunções">
        <td class="mono muted">${f.codigo}</td>
        <td class="strong">${f.nome}</td>
        <td class="num strong">${formatBRL(f.empenhado)}</td>
        <td class="num">${formatBRL(f.pago)}</td>
        <td class="num">${formatPct(f.pct)}</td>
        <td class="num">${formatBRL(f.pc)}</td>
        ${p ? html`<td class="num ${f.vr > 0 ? 'up' : f.vr < 0 ? 'down' : ''}">${f.vr == null ? 'novo' : formatVariacao(f.vr)}</td>` : ''}
      </tr>`)}`);
  };
  desenhar();
  tornarOrdenavel(document.getElementById('tabelaFuncoes'), (chave, dir) => {
    linhas.sort((a, b) => (typeof a[chave] === 'string' ? a[chave].localeCompare(b[chave]) : (a[chave] ?? -Infinity) - (b[chave] ?? -Infinity)) * dir);
    desenhar();
  });
  const abrir = (tr) => tr && el.dispatchEvent(new CustomEvent('detalhar-funcao', { bubbles: true, detail: tr.dataset.codigo }));
  corpo.addEventListener('click', (e) => abrir(e.target.closest('tr[data-codigo]')));
  corpo.addEventListener('keydown', (e) => { if (e.key === 'Enter') abrir(e.target.closest('tr[data-codigo]')); });
}

/** Modal com as subfunções de uma área. Usado por várias abas. */
export function detalharFuncao({ data, ano }, codigo) {
  const d = data.anos[ano];
  const f = d.despesa.funcoes.find((x) => x.codigo === codigo);
  if (!f) return;
  const p = anoAnterior(data, ano);
  const fa = p?.despesa.funcoes.find((x) => x.codigo === codigo);
  const vr = fa ? variacaoReal(data, f.empenhado, ano, fa.empenhado, p.ano) : null;
  const subs = f.subfuncoes ?? [];
  abrirModal(`${f.codigo} – ${f.nome} (${ano})`, html`
    <p class="modal-lead">${NOMES_CIDADAOS[f.codigo] ?? f.nome}</p>
    <div class="mini-kpis">
      <div><span>Empenhado</span><strong>${formatBRL(f.empenhado)}</strong></div>
      <div><span>Pago</span><strong>${formatBRL(f.pago)}</strong></div>
      <div><span>% do orçamento</span><strong>${formatPct((f.empenhado / d.despesa.empenhada) * 100)}</strong></div>
      <div><span>Por habitante</span><strong>${formatBRL(f.empenhado / d.populacao)}</strong></div>
      ${vr != null ? html`<div><span>Variação real vs ${p.ano}</span><strong>${formatVariacao(vr)}</strong></div>` : ''}
    </div>
    ${subs.length ? html`<h3 class="modal-section">Subfunções</h3>
      <div class="table-responsive">${tabelaHTML({
        colunas: ['Subfunção', 'Empenhado', 'Liquidado', 'Pago', '% da área'],
        linhas: subs.map((s) => [`${s.codigo === 'demais' ? '' : `${f.codigo}.${s.codigo} – `}${s.nome}`, formatBRL(s.empenhado), formatBRL(s.liquidado), formatBRL(s.pago), formatPct((s.empenhado / f.empenhado) * 100)]),
      })}</div>` : ''}
    <p class="help-source">Fonte: DCA ${ano}, Anexo I-E (Despesas por Função e Subfunção).</p>`);
}
