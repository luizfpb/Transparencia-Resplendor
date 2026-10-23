import { html, formatBRL, formatPct } from '../util.js';
import { statusPessoal, statusMinimo } from '../model.js';
import { card, selo, botaoAjuda } from '../ui.js';

/** Barra de progresso com marcas de limite posicionadas na mesma escala do valor. */
function medidor(valor, escalaMax, marcas, nivel) {
  const pos = (v) => `${Math.min(100, (v / escalaMax) * 100)}%`;
  return html`
    <div class="gauge" role="img" aria-label="${valor == null ? 'Não informado' : `${formatPct(valor, 2)}${marcas.map((m) => `; ${m.rotulo} ${formatPct(m.valor)}`).join('')}`}">
      <div class="gauge-track">
        ${valor != null ? html`<div class="gauge-fill ${nivel}" style="width:${pos(valor)}"></div>` : ''}
        ${marcas.map((m) => html`<span class="gauge-mark ${m.tipo}" style="left:${pos(m.valor)}" title="${m.rotulo}: ${formatPct(m.valor)}"></span>`)}
      </div>
      <div class="gauge-legend">${marcas.map((m) => html`<span class="gauge-legend-item ${m.tipo}">${m.rotulo} ${formatPct(m.valor)}</span>`)}</div>
    </div>`;
}

function cartao({ titulo, ajuda, descricao, valor, nivel, rotulo, medidorHtml, rodape }) {
  return html`
    <article class="lrf-card">
      <header class="lrf-head">
        <h3>${titulo} ${botaoAjuda(ajuda)}</h3>
        ${selo(nivel, rotulo)}
      </header>
      <p class="lrf-desc">${descricao}</p>
      <div class="lrf-value tabular-nums">${valor == null ? 'Não informado' : formatPct(valor, 2)}</div>
      ${medidorHtml}
      ${rodape ? html`<p class="lrf-foot">${rodape}</p>` : ''}
    </article>`;
}

export function render(el, { data, ano }) {
  const d = data.anos[ano];
  const ind = d.indicadores;
  const sp = statusPessoal(ind);
  const mdeMin = ind.mde_min ?? 25;
  const aspsMin = ind.asps_min ?? 15;
  const fMin = ind.fundeb_profissionais_min ?? 70;
  const sm = statusMinimo(ind.mde_pct, mdeMin);
  const sa = statusMinimo(ind.asps_pct, aspsMin);
  const sf = statusMinimo(ind.fundeb_profissionais_pct, fMin, 2);
  const dclNeg = ind.divida_consolidada_liquida != null && ind.divida_consolidada_liquida <= 0;

  el.innerHTML = String(html`
    <div class="section-head">
      <h2>Os limites da lei em ${ano} ${botaoAjuda('lrf')}</h2>
      <p>Índices declarados pela Prefeitura no RREO e no RGF Simplificados enviados ao Tesouro Nacional.</p>
    </div>

    ${ind.inconsistencias?.length ? html`<div class="banner warning" role="note">${ind.inconsistencias.map((t) => html`<p>${t}</p>`)}</div>` : ''}

    <div class="lrf-grid">
      ${cartao({
        titulo: 'Gasto com pessoal',
        ajuda: 'dtp',
        descricao: html`Folha do Executivo como % da receita corrente líquida (RCL de ${formatBRL(ind.rcl, { centavos: false })}). Teto: ${formatPct(ind.pessoal_limite ?? 54)}.`,
        valor: ind.pessoal_pct, nivel: sp.nivel, rotulo: sp.rotulo,
        medidorHtml: medidor(ind.pessoal_pct, 60, [
          { valor: ind.pessoal_alerta ?? 48.6, rotulo: 'Alerta', tipo: 'alerta' },
          { valor: ind.pessoal_prudencial ?? 51.3, rotulo: 'Prudencial', tipo: 'prudencial' },
          { valor: ind.pessoal_limite ?? 54, rotulo: 'Máximo', tipo: 'maximo' },
        ], sp.nivel),
        rodape: ind.pessoal_valor ? `Despesa total com pessoal: ${formatBRL(ind.pessoal_valor)}` : null,
      })}

      ${cartao({
        titulo: 'Educação (MDE)',
        ajuda: 'mde',
        descricao: html`Mínimo constitucional de ${formatPct(mdeMin, 0)} da receita de impostos e transferências aplicado em manutenção e desenvolvimento do ensino.`,
        valor: ind.mde_pct, nivel: sm.nivel, rotulo: sm.rotulo,
        medidorHtml: medidor(ind.mde_pct, 40, [{ valor: mdeMin, rotulo: 'Mínimo', tipo: 'minimo' }], sm.nivel),
        rodape: ind.mde_pct != null ? `Folga de ${(ind.mde_pct - mdeMin).toFixed(2).replace('.', ',')} ponto percentual sobre o mínimo.` : null,
      })}

      ${cartao({
        titulo: 'Saúde (ASPS)',
        ajuda: 'asps',
        descricao: html`Mínimo legal de ${formatPct(aspsMin, 0)} da receita de impostos e transferências aplicado em ações e serviços públicos de saúde.`,
        valor: ind.asps_pct, nivel: sa.nivel, rotulo: sa.rotulo,
        medidorHtml: medidor(ind.asps_pct, 40, [{ valor: aspsMin, rotulo: 'Mínimo', tipo: 'minimo' }], sa.nivel),
        rodape: ind.asps_pct != null ? `Folga de ${(ind.asps_pct - aspsMin).toFixed(2).replace('.', ',')} pontos percentuais sobre o mínimo.` : null,
      })}

      ${cartao({
        titulo: 'FUNDEB nos salários da educação',
        ajuda: 'fundeb70',
        descricao: html`Pelo menos ${formatPct(fMin, 0)} do FUNDEB deve remunerar os profissionais da educação básica.`,
        valor: ind.fundeb_profissionais_pct, nivel: sf.nivel, rotulo: sf.rotulo,
        medidorHtml: medidor(ind.fundeb_profissionais_pct, 120, [{ valor: fMin, rotulo: 'Mínimo', tipo: 'minimo' }], sf.nivel),
      })}
    </div>

    <div class="section-grid" style="margin-top:1.5rem">
      ${card({
        titulo: 'Dívida e equilíbrio',
        classe: 'span-12',
        corpo: html`<div class="mini-kpis wide">
          <div><span>Dívida consolidada líquida ${botaoAjuda('dcl')}</span><strong>${formatBRL(ind.divida_consolidada_liquida)}</strong>
            <small>${ind.divida_consolidada_liquida == null ? '' : dclNeg ? 'Negativa: há mais dinheiro em caixa do que dívidas' : `Limite do Senado: ${formatBRL(ind.divida_limite)}`}</small></div>
          <div><span>Resultado orçamentário ${botaoAjuda('resultado_orcamentario')}</span><strong class="${d.resultado_orcamentario < 0 ? 'down' : 'up'}">${formatBRL(d.resultado_orcamentario)}</strong>
            <small>${d.resultado_orcamentario < 0 ? 'Déficit: empenhou mais do que arrecadou' : 'Superávit: arrecadou mais do que empenhou'}</small></div>
          <div><span>Resultado primário</span><strong>${formatBRL(ind.resultado_primario)}</strong><small>Receitas menos despesas, sem juros nem dívida</small></div>
          <div><span>Caixa livre após restos a pagar</span><strong>${formatBRL(ind.caixa_liquida_apos_rp)}</strong><small>Do RGF; negativo indica compromissos sem cobertura</small></div>
        </div>`,
      })}
    </div>`);
}
