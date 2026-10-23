// Camada fina sobre o Chart.js: cores do tema, padrões de marca e tabela acessível.

import { html } from './util.js';

const instancias = new Map();

export function cores() {
  const css = getComputedStyle(document.documentElement);
  const v = (n) => css.getPropertyValue(n).trim();
  return {
    serie: [1, 2, 3, 4, 5, 6, 7].map((i) => v(`--s${i}`)),
    tinta: v('--text-main'),
    tinta2: v('--text-secondary'),
    mudo: v('--text-muted'),
    grade: v('--chart-grid'),
    eixo: v('--chart-axis'),
    superficie: v('--bg-card'),
    neutro: v('--chart-neutral'),
    bom: v('--status-good'),
    alerta: v('--status-warning'),
    serio: v('--status-serious'),
    critico: v('--status-critical'),
    positivo: v('--s1'),
    negativo: v('--status-critical'),
  };
}

/** Linhas horizontais de referência (limites legais), desenhadas sobre a área do gráfico. */
const pluginReferencias = {
  id: 'linhasRef',
  afterDatasetsDraw(chart, _args, opcoes) {
    const linhas = opcoes?.linhas;
    if (!linhas?.length) return;
    const { ctx, chartArea, scales } = chart;
    const y = scales.y;
    ctx.save();
    for (const l of linhas) {
      const py = y.getPixelForValue(l.valor);
      if (py < chartArea.top || py > chartArea.bottom) continue;
      ctx.strokeStyle = l.cor;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(chartArea.left, py);
      ctx.lineTo(chartArea.right, py);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = l.corTexto ?? l.cor;
      ctx.font = '600 11px "Plus Jakarta Sans", system-ui, sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'bottom';
      ctx.fillText(l.rotulo, chartArea.right - 4, py - 3);
    }
    ctx.restore();
  },
};

let registrado = false;

function configurarPadroes() {
  const C = window.Chart;
  if (!C) return false;
  if (!registrado) {
    C.register(pluginReferencias);
    registrado = true;
  }
  const c = cores();
  C.defaults.font.family = '"Plus Jakarta Sans", system-ui, sans-serif';
  C.defaults.font.size = 12;
  C.defaults.color = c.tinta2;
  C.defaults.borderColor = c.grade;
  C.defaults.maintainAspectRatio = false;
  C.defaults.animation.duration = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 450;
  C.defaults.plugins.legend.labels.usePointStyle = true;
  C.defaults.plugins.legend.labels.boxWidth = 8;
  C.defaults.plugins.legend.labels.boxHeight = 8;
  C.defaults.plugins.legend.labels.color = c.tinta2;
  C.defaults.plugins.tooltip.backgroundColor = c.superficie;
  C.defaults.plugins.tooltip.titleColor = c.tinta;
  C.defaults.plugins.tooltip.bodyColor = c.tinta2;
  C.defaults.plugins.tooltip.borderColor = c.eixo;
  C.defaults.plugins.tooltip.borderWidth = 1;
  C.defaults.plugins.tooltip.padding = 10;
  C.defaults.plugins.tooltip.boxPadding = 4;
  C.defaults.plugins.tooltip.usePointStyle = true;
  C.defaults.elements.bar.borderRadius = 4;
  C.defaults.elements.bar.borderSkipped = 'start';
  C.defaults.elements.line.borderWidth = 2;
  C.defaults.elements.line.tension = 0.25;
  C.defaults.elements.point.radius = 4;
  C.defaults.elements.point.hoverRadius = 6;
  C.defaults.elements.point.borderWidth = 2;
  C.defaults.elements.point.borderColor = c.superficie;
  return true;
}

/** Eixos com grade em linha fina e cores de texto do tema. */
export function eixos({ formatoY, formatoX, horizontal = false, minY, maxY } = {}) {
  const c = cores();
  // Só define `callback` quando há formatador: `callback: undefined` apaga o padrão
  // do Chart.js e o eixo de categorias passa a mostrar índices (0, 1, 2…).
  const ticks = (base, fmt) => (fmt ? { ...base, callback: fmt } : base);
  const valor = { grid: { color: c.grade, drawTicks: false }, border: { display: false }, ticks: { color: c.mudo, padding: 8 } };
  const cat = { grid: { display: false }, border: { color: c.eixo }, ticks: { color: c.tinta2, padding: 6 } };
  if (horizontal) {
    return {
      x: { ...valor, ticks: ticks(valor.ticks, formatoX), beginAtZero: true },
      y: { ...cat, ticks: { ...cat.ticks, autoSkip: false } },
    };
  }
  const y = { ...valor, ticks: ticks(valor.ticks, formatoY), beginAtZero: minY === undefined };
  if (minY !== undefined) y.min = minY;
  if (maxY !== undefined) y.max = maxY;
  return { x: { ...cat, ticks: ticks(cat.ticks, formatoX) }, y };
}

/**
 * Cria (ou recria) um gráfico. `tabela` gera a versão em tabela, sempre disponível
 * para leitores de tela, impressão e quem prefere números a imagens.
 */
export function grafico(id, config, { descricao, tabela } = {}) {
  const canvas = document.getElementById(id);
  if (!canvas) return null;
  instancias.get(id)?.destroy();
  instancias.delete(id);

  canvas.setAttribute('role', 'img');
  if (descricao) canvas.setAttribute('aria-label', descricao);

  if (tabela) {
    const alvo = document.getElementById(`${id}-tabela`);
    if (alvo) alvo.innerHTML = String(tabelaHTML(tabela));
  }

  if (!configurarPadroes()) {
    canvas.replaceWith(Object.assign(document.createElement('p'), {
      className: 'chart-fallback',
      id,
      textContent: 'Não foi possível carregar a biblioteca de gráficos. Os dados estão na tabela abaixo.',
    }));
    return null;
  }
  const ch = new window.Chart(canvas, config);
  instancias.set(id, ch);
  return ch;
}

export function tabelaHTML({ legenda, colunas, linhas }) {
  return html`
    <table class="data-table compact">
      ${legenda ? html`<caption class="visually-hidden">${legenda}</caption>` : ''}
      <thead><tr>${colunas.map((c, i) => html`<th scope="col" class="${i ? 'num' : ''}">${c}</th>`)}</tr></thead>
      <tbody>${linhas.map((l) => html`<tr>${l.map((v, i) => (i ? html`<td class="num">${v}</td>` : html`<th scope="row">${v}</th>`))}</tr>`)}</tbody>
    </table>`;
}

/** Bloco padrão: canvas + "ver como tabela". */
export function blocoGrafico(id, altura = 300) {
  return html`
    <div class="chart-box" style="height:${altura}px"><canvas id="${id}"></canvas></div>
    <details class="table-toggle">
      <summary>Ver dados em tabela</summary>
      <div class="table-responsive" id="${id}-tabela"></div>
    </details>`;
}

export function destruirTodos() {
  for (const ch of instancias.values()) ch.destroy();
  instancias.clear();
}
