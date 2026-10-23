import { html, formatBRL, formatPct } from '../util.js';
import { card } from '../ui.js';
import { tabelaHTML } from '../charts.js';
import { desenharFluxo, criarTooltip } from '../sankey.js';

export function render(el, { data, ano }) {
  const d = data.anos[ano];
  el.innerHTML = String(card({
    titulo: `O caminho do dinheiro em ${ano}`,
    subtitulo: 'De onde veio cada real (esquerda) e em que área foi comprometido (direita). A espessura é proporcional ao valor.',
    ajuda: 'fluxo',
    corpo: html`
      <p class="hint">Passe o mouse ou navegue com Tab pelas barras para destacar um caminho. Clique numa área à direita para ver o detalhamento.</p>
      <p class="scroll-hint" aria-hidden="true">Arraste o diagrama para o lado para ver os destinos →</p>
      <div class="sankey-container" id="sankeyBox">
        <svg class="sankey-svg" id="sankeySvg" role="group" aria-label="Diagrama do fluxo do dinheiro"></svg>
      </div>
      <details class="table-toggle"><summary>Ver dados em tabela</summary><div class="table-responsive" id="sankeyTabela"></div></details>`,
  }));

  const box = document.getElementById('sankeyBox');
  const modelo = desenharFluxo(document.getElementById('sankeySvg'), d, {
    tooltip: criarTooltip(box),
    aoSelecionarDestino: (codigo) => el.dispatchEvent(new CustomEvent('detalhar-funcao', { bubbles: true, detail: codigo })),
  });

  const linha = (n) => [n.nome, formatBRL(n.valor), formatPct((n.valor / modelo.total) * 100)];
  document.getElementById('sankeyTabela').innerHTML = String(html`
    <h4 class="table-title">Entradas</h4>
    ${tabelaHTML({ colunas: ['Origem', 'Valor', '% do total'], linhas: modelo.fontes.map(linha) })}
    <h4 class="table-title">Saídas</h4>
    ${tabelaHTML({ colunas: ['Destino', 'Valor', '% do total'], linhas: modelo.destinos.map(linha) })}`);
}
