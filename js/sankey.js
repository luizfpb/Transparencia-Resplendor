// Desenho SVG do fluxo do dinheiro. O cálculo das posições está em model.js (testado).

import { modeloFluxo, layoutFluxo, caminhoFita } from './model.js';
import { formatBRL, formatCompacto, formatPct } from './util.js';

const NS = 'http://www.w3.org/2000/svg';

// A cor acompanha a fonte (não a posição), para o FPM ter sempre a mesma cor em todos os anos.
const SLOT_FONTE = { fpm: 1, estado: 2, fundeb: 3, sus: 4, royalties: 5, proprios: 6, outras: 7 };

function el(tag, attrs = {}, texto) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (texto !== undefined) e.textContent = texto;
  return e;
}

function corNo(no) {
  if (no.tipo === 'fonte') return `var(--s${SLOT_FONTE[no.id] ?? 7})`;
  if (no.tipo === 'deficit') return 'var(--status-serious)';
  if (no.tipo === 'saldo') return 'var(--status-good)';
  if (no.tipo === 'centro') return 'var(--text-secondary)';
  return 'var(--chart-neutral-strong)';
}

function truncar(s, n) {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

/** Afasta rótulos que ficariam sobrepostos, preservando a ordem vertical. */
function espalhar(ys, minimo, topo, base) {
  const out = [...ys];
  for (let i = 1; i < out.length; i++) if (out[i] - out[i - 1] < minimo) out[i] = out[i - 1] + minimo;
  const excesso = out.at(-1) - base;
  if (excesso > 0) for (let i = out.length - 1; i >= 0; i--) {
    out[i] -= excesso;
    if (i > 0 && out[i] - out[i - 1] >= minimo) break;
  }
  return out.map((y) => Math.max(topo, y));
}

export function desenharFluxo(svg, d, { aoSelecionarDestino, tooltip } = {}) {
  const modelo = modeloFluxo(d);
  const W = 1000, H = 560, margem = 220;
  const lay = layoutFluxo(modelo, { largura: W, altura: H, margemX: margem, nodeW: 14, gap: 12, margemY: 50 });
  svg.replaceChildren();
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);

  const gFitas = el('g', { class: 'sankey-links' });
  const gNos = el('g', { class: 'sankey-nodes' });
  svg.append(gFitas, gNos);

  const fitasPorNo = new Map();
  const total = modelo.total;
  const pct = (v) => formatPct((v / total) * 100);

  for (const l of lay.links) {
    const externo = l.de.id === 'tesouro' ? l.para : l.de;
    const p = el('path', { d: caminhoFita(l), class: 'sankey-link', fill: corNo(externo) });
    p.dataset.no = externo.id;
    gFitas.append(p);
    if (!fitasPorNo.has(externo.id)) fitasPorNo.set(externo.id, []);
    fitasPorNo.get(externo.id).push(p);
  }

  function destacar(id) {
    svg.classList.toggle('has-focus', Boolean(id));
    for (const p of gFitas.children) p.classList.toggle('active', id === 'tesouro' || p.dataset.no === id);
  }

  function rotular(nos, lado) {
    const centros = nos.map((n) => n.y + n.h / 2);
    const ys = espalhar(centros, 30, 14, H - 14);
    nos.forEach((n, i) => {
      const g = el('g', { class: 'sankey-node', tabindex: '0', role: 'button' });
      const descricao = `${n.nomeCompleto ?? n.nome}: ${formatBRL(n.valor)}, ${pct(n.valor)} do total`;
      g.setAttribute('aria-label', descricao + (lado === 'dir' && n.codigo ? '. Pressione Enter para ver o detalhamento.' : ''));
      g.append(el('rect', { x: n.x, y: n.y, width: lay.nodeW, height: Math.max(2, n.h), rx: 3, fill: corNo(n) }));

      const xTexto = lado === 'esq' ? n.x - 10 : n.x + lay.nodeW + 10;
      const anchor = lado === 'esq' ? 'end' : 'start';
      g.append(el('text', { x: xTexto, y: ys[i] - 2, 'text-anchor': anchor, class: 'nome' }, truncar(n.nome, 34)));
      g.append(el('text', { x: xTexto, y: ys[i] + 13, 'text-anchor': anchor, class: 'val' }, `${formatCompacto(n.valor)} · ${pct(n.valor)}`));
      if (Math.abs(ys[i] - centros[i]) > 6) {
        const x0 = lado === 'esq' ? n.x - 2 : n.x + lay.nodeW + 2;
        const x1 = lado === 'esq' ? n.x - 8 : n.x + lay.nodeW + 8;
        g.append(el('path', { d: `M${x0},${centros[i]} L${x1},${ys[i] + 4}`, class: 'leader' }));
      }

      const mostrar = (ev) => {
        destacar(n.id);
        tooltip?.mostrar(descricao, ev);
      };
      g.addEventListener('mouseenter', mostrar);
      g.addEventListener('mousemove', (ev) => tooltip?.mover(ev));
      g.addEventListener('mouseleave', () => { destacar(null); tooltip?.esconder(); });
      g.addEventListener('focus', () => { destacar(n.id); tooltip?.mostrar(descricao, null, g); });
      g.addEventListener('blur', () => { destacar(null); tooltip?.esconder(); });
      if (lado === 'dir' && n.codigo && aoSelecionarDestino) {
        g.classList.add('clickable');
        g.addEventListener('click', () => aoSelecionarDestino(n.codigo));
        g.addEventListener('keydown', (ev) => {
          if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); aoSelecionarDestino(n.codigo); }
        });
      }
      gNos.append(g);
      // Área de clique transparente cobrindo barra e rótulo (o texto não recebe eventos).
      const bb = g.getBBox();
      g.prepend(el('rect', { x: bb.x - 4, y: bb.y - 4, width: bb.width + 8, height: bb.height + 8, fill: 'transparent', class: 'hit' }));
    });
  }

  for (const p of gFitas.children) {
    const id = p.dataset.no;
    const no = lay.nos.find((n) => n.id === id);
    p.addEventListener('mouseenter', (ev) => { destacar(id); tooltip?.mostrar(`${no.nomeCompleto ?? no.nome}: ${formatBRL(no.valor)} (${pct(no.valor)})`, ev); });
    p.addEventListener('mousemove', (ev) => tooltip?.mover(ev));
    p.addEventListener('mouseleave', () => { destacar(null); tooltip?.esconder(); });
  }

  rotular(lay.fontes, 'esq');
  rotular(lay.destinos, 'dir');

  const c = lay.centro;
  const gc = el('g', { class: 'sankey-node center', tabindex: '0', role: 'img', 'aria-label': `Cofre da Prefeitura: ${formatBRL(modelo.receita)} arrecadados, ${formatBRL(modelo.despesa)} empenhados` });
  gc.append(el('rect', { x: c.x, y: c.y, width: lay.nodeW, height: c.h, rx: 3, fill: corNo(c) }));
  gc.append(el('text', { x: c.x + lay.nodeW / 2, y: c.y - 28, 'text-anchor': 'middle', class: 'nome' }, 'Cofre da Prefeitura'));
  gc.append(el('text', { x: c.x + lay.nodeW / 2, y: c.y - 12, 'text-anchor': 'middle', class: 'val' }, `entrou ${formatCompacto(modelo.receita)} · comprometeu ${formatCompacto(modelo.despesa)}`));
  gc.addEventListener('mouseenter', () => destacar('tesouro'));
  gc.addEventListener('mouseleave', () => destacar(null));
  gc.addEventListener('focus', () => destacar('tesouro'));
  gc.addEventListener('blur', () => destacar(null));
  gNos.append(gc);

  return modelo;
}

/** Tooltip HTML posicionado dentro do contêiner do gráfico. */
export function criarTooltip(container) {
  const tip = document.createElement('div');
  tip.className = 'chart-tooltip';
  tip.setAttribute('aria-hidden', 'true');
  container.append(tip);
  const mover = (ev) => {
    const r = container.getBoundingClientRect();
    const x = Math.min(ev.clientX - r.left + 14, r.width - tip.offsetWidth - 8);
    tip.style.left = `${Math.max(8, x)}px`;
    tip.style.top = `${ev.clientY - r.top + 14}px`;
  };
  return {
    mostrar(texto, ev, alvo) {
      tip.textContent = texto;
      tip.classList.add('visible');
      if (ev) mover(ev);
      else if (alvo) {
        const r = container.getBoundingClientRect();
        const a = alvo.getBoundingClientRect();
        tip.style.left = `${Math.min(a.left - r.left, r.width - tip.offsetWidth - 8)}px`;
        tip.style.top = `${a.bottom - r.top + 6}px`;
      }
    },
    mover,
    esconder() { tip.classList.remove('visible'); },
  };
}
