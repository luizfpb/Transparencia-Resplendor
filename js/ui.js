// Componentes de interface compartilhados pelas abas.

import { html, raw } from './util.js';
import { GLOSSARIO } from './glossario.js';

export function botaoAjuda(chave, rotulo) {
  const g = GLOSSARIO[chave];
  if (!g) return '';
  return html`<button type="button" class="help-btn" data-ajuda="${chave}" aria-label="Como ler: ${rotulo ?? g.titulo}" title="Como ler este número">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
  </button>`;
}

export function card({ titulo, subtitulo, ajuda, corpo, classe = '', extra = '', nivelTitulo = 3 }) {
  const h = raw(`h${nivelTitulo}`);
  return html`
    <article class="card ${classe}">
      <header class="card-header">
        <div class="card-title-group">
          <${h}>${titulo} ${ajuda ? botaoAjuda(ajuda) : ''}</${h}>
          ${subtitulo ? html`<p>${subtitulo}</p>` : ''}
        </div>
        ${extra}
      </header>
      ${corpo}
    </article>`;
}

const ICONES_STATUS = {
  ok: '<polyline points="20 6 9 17 4 12"/>',
  medio: '<path d="M12 9v4"/><path d="M12 17h.01"/><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>',
  alto: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>',
  critico: '<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>',
  info: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>',
  nd: '<circle cx="12" cy="12" r="10"/><line x1="8" y1="12" x2="16" y2="12"/>',
};

/** Selo de status: ícone + texto, nunca só cor. */
export function selo(nivel, rotulo) {
  return html`<span class="status-pill ${nivel}"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">${raw(ICONES_STATUS[nivel] ?? ICONES_STATUS.info)}</svg>${rotulo}</span>`;
}

export function iconeStatus(nivel) {
  return raw(`<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true">${ICONES_STATUS[nivel] ?? ICONES_STATUS.info}</svg>`);
}

// ---------------------------------------------------------------------------
// Modal (usa <dialog>, que já prende o foco e fecha com Esc)
// ---------------------------------------------------------------------------

let origemFoco = null;

export function abrirModal(titulo, corpo) {
  const dlg = document.getElementById('modal');
  document.getElementById('modalTitulo').textContent = titulo;
  document.getElementById('modalCorpo').innerHTML = String(corpo);
  origemFoco = document.activeElement;
  if (!dlg.open) dlg.showModal();
  return document.getElementById('modalCorpo');
}

export function configurarModal() {
  const dlg = document.getElementById('modal');
  document.getElementById('modalFechar').addEventListener('click', () => dlg.close());
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
  dlg.addEventListener('close', () => origemFoco?.focus?.());
}

export function abrirAjuda(chave) {
  const g = GLOSSARIO[chave];
  if (!g) return;
  abrirModal(g.titulo, html`<p class="help-text">${g.texto}</p><p class="help-source"><strong>Onde conferir:</strong> ${g.fonte}</p>`);
}

// ---------------------------------------------------------------------------

let timerToast;
export function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('visible');
  clearTimeout(timerToast);
  timerToast = setTimeout(() => t.classList.remove('visible'), 3200);
}

export function baixar(nome, conteudo, tipo = 'text/csv;charset=utf-8') {
  // BOM para o Excel reconhecer UTF-8 e exibir acentos corretamente.
  const blob = new Blob([tipo.startsWith('text/csv') ? '﻿' : '', conteudo], { type: tipo });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: nome });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Tabela ordenável: clique (ou Enter) no cabeçalho alterna a ordem. */
export function tornarOrdenavel(tabela, aoOrdenar) {
  tabela.querySelectorAll('th[data-ordem]').forEach((th) => {
    th.tabIndex = 0;
    th.setAttribute('role', 'columnheader');
    const ativar = () => {
      const atual = th.getAttribute('aria-sort');
      const nova = atual === 'descending' ? 'ascending' : 'descending';
      tabela.querySelectorAll('th[aria-sort]').forEach((o) => o.removeAttribute('aria-sort'));
      th.setAttribute('aria-sort', nova);
      aoOrdenar(th.dataset.ordem, nova === 'ascending' ? 1 : -1);
    };
    th.addEventListener('click', ativar);
    th.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ativar(); } });
  });
}
