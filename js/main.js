// Ponto de entrada: carrega os dados, mantém o estado na URL e desenha a aba ativa.

import { html, formatBRL, formatCompacto, formatPct, formatVariacao, gerarCSV } from './util.js';
import { anos, kpis } from './model.js';
import { botaoAjuda, selo, configurarModal, abrirAjuda, baixar, toast } from './ui.js';
import { destruirTodos } from './charts.js';
import * as visao from './views/visao.js';
import * as fluxo from './views/fluxo.js';
import * as receitas from './views/receitas.js';
import * as despesas from './views/despesas.js';
import * as gastos from './views/gastos.js';
import * as calculadora from './views/calculadora.js';
import * as lrf from './views/lrf.js';
import * as historico from './views/historico.js';
import * as vizinhos from './views/vizinhos.js';
import * as metodologia from './views/metodologia.js';

const VIEWS = { visao, fluxo, receitas, despesas, gastos, calculadora, lrf, historico, vizinhos, metodologia };
const ABAS = Object.keys(VIEWS);

let data = null;
const estado = { aba: 'visao', ano: null, valores: 'nominal' };
let renderizado = '';

// ---------------------------------------------------------------------------
// Estado ⇄ URL (#aba=receitas&ano=2024&valores=real)
// ---------------------------------------------------------------------------

function lerHash() {
  const p = new URLSearchParams(location.hash.slice(1));
  const lista = anos(data);
  const aba = p.get('aba');
  const ano = p.get('ano');
  return {
    aba: ABAS.includes(aba) ? aba : 'visao',
    ano: lista.includes(ano) ? ano : lista.at(-1),
    valores: p.get('valores') === 'real' ? 'real' : 'nominal',
  };
}

function escreverHash() {
  const p = new URLSearchParams({ aba: estado.aba, ano: estado.ano });
  if (estado.valores === 'real') p.set('valores', 'real');
  const novo = `#${p}`;
  if (location.hash !== novo) history.replaceState(null, '', novo);
}

function setEstado(patch, { foco = false } = {}) {
  Object.assign(estado, patch);
  escreverHash();
  aplicar({ foco });
}

// ---------------------------------------------------------------------------
// Tema
// ---------------------------------------------------------------------------

const ICONE_SOL = '<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>';
const ICONE_LUA = '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>';

function temaAtual() {
  const salvo = (() => { try { return localStorage.getItem('tema'); } catch { return null; } })();
  if (salvo === 'light' || salvo === 'dark') return salvo;
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function aplicarTema(t) {
  document.documentElement.dataset.theme = t;
  const icone = document.getElementById('temaIcone');
  icone.innerHTML = t === 'dark' ? ICONE_SOL : ICONE_LUA;
  document.getElementById('temaBtn').setAttribute('aria-label', t === 'dark' ? 'Mudar para tema claro' : 'Mudar para tema escuro');
}

function configurarTema() {
  aplicarTema(temaAtual());
  document.getElementById('temaBtn').addEventListener('click', () => {
    const novo = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem('tema', novo); } catch { /* armazenamento indisponível */ }
    aplicarTema(novo);
    renderizado = '';
    aplicar();
  });
}

// ---------------------------------------------------------------------------
// Abas (padrão WAI-ARIA: setas, Home e End)
// ---------------------------------------------------------------------------

function configurarAbas() {
  const tabs = [...document.querySelectorAll('[role="tab"]')];
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => setEstado({ aba: t.dataset.aba }));
    t.addEventListener('keydown', (e) => {
      const alvo = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 }[e.key];
      if (alvo === undefined) return;
      e.preventDefault();
      const prox = tabs[(alvo + tabs.length) % tabs.length];
      prox.focus();
      setEstado({ aba: prox.dataset.aba });
    });
  });
}

function atualizarAbas() {
  for (const t of document.querySelectorAll('[role="tab"]')) {
    const ativa = t.dataset.aba === estado.aba;
    t.setAttribute('aria-selected', String(ativa));
    t.tabIndex = ativa ? 0 : -1;
    t.classList.toggle('active', ativa);
    if (ativa) t.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
  for (const p of document.querySelectorAll('[role="tabpanel"]')) p.hidden = p.id !== `painel-${estado.aba}`;
}

// ---------------------------------------------------------------------------
// Ano
// ---------------------------------------------------------------------------

function configurarAno() {
  const sel = document.getElementById('anoSelect');
  const lista = anos(data);
  sel.innerHTML = String(html`${[...lista].reverse().map((a) => html`<option value="${a}">${a}</option>`)}`);
  sel.addEventListener('change', () => setEstado({ ano: sel.value }));
  const passo = (n) => {
    const i = lista.indexOf(estado.ano) + n;
    if (i >= 0 && i < lista.length) setEstado({ ano: lista[i] });
  };
  document.getElementById('anoAnterior').addEventListener('click', () => passo(-1));
  document.getElementById('anoProximo').addEventListener('click', () => passo(1));
}

function atualizarAno() {
  const lista = anos(data);
  document.getElementById('anoSelect').value = estado.ano;
  document.getElementById('anoAnterior').disabled = estado.ano === lista[0];
  document.getElementById('anoProximo').disabled = estado.ano === lista.at(-1);
}

// ---------------------------------------------------------------------------
// KPIs e cabeçalho
// ---------------------------------------------------------------------------

function variacaoHTML(nominal, real, anoRef) {
  if (nominal == null) return html`<span class="muted">Primeiro ano da série</span>`;
  const cls = real >= 0.05 ? 'up' : real <= -0.05 ? 'down' : '';
  return html`<span>${formatVariacao(nominal)} vs ${anoRef}</span><span class="trend ${cls}" title="Variação descontada a inflação (IPCA)">real ${formatVariacao(real)}</span>`;
}

function desenharKPIs() {
  const k = kpis(data, estado.ano);
  const d = data.anos[estado.ano];
  const deficit = k.resultado < 0;
  const el = document.getElementById('kpis');
  el.innerHTML = String(html`
    <article class="kpi-card">
      <div class="kpi-header"><h2 class="kpi-title">Receita arrecadada</h2>${botaoAjuda('receita_liquida')}</div>
      <p class="kpi-value tabular-nums">${formatBRL(k.receita, { centavos: false })}</p>
      <div class="kpi-footer">${variacaoHTML(k.varReceita, k.varReceitaReal, k.anoAnterior)}</div>
    </article>
    <article class="kpi-card">
      <div class="kpi-header"><h2 class="kpi-title">Despesa empenhada</h2>${botaoAjuda('despesa_empenhada')}</div>
      <p class="kpi-value tabular-nums">${formatBRL(k.despesaEmpenhada, { centavos: false })}</p>
      <div class="kpi-footer">${variacaoHTML(k.varDespesa, k.varDespesaReal, k.anoAnterior)}</div>
      <p class="kpi-sub">Pago: ${formatCompacto(k.despesaPaga)} (${formatPct(k.pagoSobreEmpenhado, 0)})</p>
    </article>
    <article class="kpi-card ${deficit ? 'negative' : 'positive'}">
      <div class="kpi-header"><h2 class="kpi-title">Resultado do ano</h2>${botaoAjuda('resultado_orcamentario')}</div>
      <p class="kpi-value tabular-nums">${deficit ? '−' : '+'}${formatBRL(Math.abs(k.resultado), { centavos: false })}</p>
      <div class="kpi-footer">${selo(deficit ? 'alto' : 'ok', deficit ? 'Déficit orçamentário' : 'Superávit orçamentário')}<span>${formatPct(Math.abs(k.resultadoPct))} da receita</span></div>
    </article>
    <article class="kpi-card">
      <div class="kpi-header"><h2 class="kpi-title">Despesa por habitante</h2>${botaoAjuda('per_capita')}</div>
      <p class="kpi-value tabular-nums">${formatBRL(k.despesaPorHabitante, { centavos: false })}</p>
      <div class="kpi-footer"><span>${formatBRL(k.despesaPorHabitante / 12, { centavos: false })} por mês</span><span>${d.populacao.toLocaleString('pt-BR')} moradores</span></div>
    </article>`);
  el.hidden = false;

  const inc = d.indicadores.inconsistencias?.length;
  document.getElementById('entityTags').innerHTML = String(html`
    <span class="tag verified"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>SICONFI / Tesouro Nacional</span>
    <span class="tag">Exercício ${estado.ano}</span>
    ${inc ? html`<a class="tag warning" href="#aba=metodologia&ano=${estado.ano}">${inc} inconsistência${inc > 1 ? 's' : ''} na declaração</a>` : ''}`);
}

// ---------------------------------------------------------------------------
// Exportação
// ---------------------------------------------------------------------------

function exportar(tipo) {
  const ano = estado.ano;
  const d = data.anos[ano];
  const nome = (s) => `resplendor_${s}`;
  if (tipo === 'json') {
    baixar(nome('dados_completos.json'), JSON.stringify(data, null, 2), 'application/json');
  } else if (tipo === 'receitas') {
    baixar(nome(`receitas_${ano}.csv`), gerarCSV([
      { chave: 'codigo', titulo: 'Código' }, { chave: 'nivel', titulo: 'Nível' }, { chave: 'nome', titulo: 'Conta' },
      { chave: 'bruto', titulo: 'Receita bruta (R$)' }, { chave: 'deducao', titulo: 'Dedução FUNDEB (R$)' },
      { chave: (l) => l.bruto - l.deducao, titulo: 'Receita líquida (R$)' },
    ], d.receita.arvore));
  } else if (tipo === 'despesas') {
    const linhas = d.despesa.funcoes.flatMap((f) => [
      { tipo: 'Função', codigo: f.codigo, nome: f.nome, empenhado: f.empenhado, liquidado: f.liquidado, pago: f.pago },
      ...(f.subfuncoes ?? []).map((s) => ({ tipo: 'Subfunção', codigo: s.codigo === 'demais' ? `${f.codigo}.demais` : `${f.codigo}.${s.codigo}`, nome: s.nome, empenhado: s.empenhado, liquidado: s.liquidado, pago: s.pago })),
    ]);
    baixar(nome(`despesas_funcao_${ano}.csv`), gerarCSV([
      { chave: 'tipo', titulo: 'Tipo' }, { chave: 'codigo', titulo: 'Código' }, { chave: 'nome', titulo: 'Nome' },
      { chave: 'empenhado', titulo: 'Empenhado (R$)' }, { chave: 'liquidado', titulo: 'Liquidado (R$)' }, { chave: 'pago', titulo: 'Pago (R$)' },
    ], linhas));
  } else if (tipo === 'elementos') {
    baixar(nome(`despesas_elemento_${ano}.csv`), gerarCSV([
      { chave: 'codigo', titulo: 'Código' }, { chave: 'nome', titulo: 'Elemento' },
      { chave: 'empenhado', titulo: 'Empenhado (R$)' }, { chave: 'liquidado', titulo: 'Liquidado (R$)' }, { chave: 'pago', titulo: 'Pago (R$)' },
    ], d.despesa.elementos));
  } else if (tipo === 'serie') {
    const linhas = anos(data).map((a) => {
      const x = data.anos[a];
      const i = x.indicadores;
      return {
        ano: a, pop: x.populacao, bruta: x.receita.bruta, liquida: x.receita.liquida, emp: x.despesa.empenhada, liq: x.despesa.liquidada, pago: x.despesa.paga,
        res: x.resultado_orcamentario, pes: i.pessoal_pct, mde: i.mde_pct, asps: i.asps_pct, rcl: i.rcl, caixa: x.balanco?.caixa, ipca: data.meta.ipca.fatores[a],
      };
    });
    baixar(nome('serie_historica.csv'), gerarCSV([
      { chave: 'ano', titulo: 'Ano' }, { chave: 'pop', titulo: 'População' }, { chave: 'bruta', titulo: 'Receita bruta' }, { chave: 'liquida', titulo: 'Receita líquida' },
      { chave: 'emp', titulo: 'Despesa empenhada' }, { chave: 'liq', titulo: 'Despesa liquidada' }, { chave: 'pago', titulo: 'Despesa paga' },
      { chave: 'res', titulo: 'Resultado orçamentário' }, { chave: 'rcl', titulo: 'RCL' }, { chave: 'pes', titulo: 'Pessoal % RCL' },
      { chave: 'mde', titulo: 'Educação MDE %' }, { chave: 'asps', titulo: 'Saúde ASPS %' }, { chave: 'caixa', titulo: 'Caixa em 31/12' },
      { chave: 'ipca', titulo: `Fator IPCA para R$ de ${data.meta.ipca.ano_base}` },
    ], linhas));
  }
  document.getElementById('menuExportar').open = false;
  toast('Download iniciado.');
}

// ---------------------------------------------------------------------------

function aplicar({ foco = false } = {}) {
  atualizarAbas();
  atualizarAno();
  desenharKPIs();
  const chave = `${estado.aba}|${estado.ano}|${estado.valores}|${document.documentElement.dataset.theme}`;
  if (chave !== renderizado) {
    destruirTodos();
    const painel = document.getElementById(`painel-${estado.aba}`);
    for (const p of document.querySelectorAll('[role="tabpanel"]')) if (p !== painel) p.replaceChildren();
    VIEWS[estado.aba].render(painel, { data, ano: estado.ano, estado, setEstado });
    renderizado = chave;
  }
  if (foco) document.getElementById(`painel-${estado.aba}`).focus();
  document.title = `${document.querySelector(`[data-aba="${estado.aba}"]`).textContent} · ${estado.ano} — Transparência Resplendor`;
}

function erroCarregamento(e) {
  const local = location.protocol === 'file:';
  document.getElementById('estadoCarregamento').innerHTML = String(html`
    <div class="banner error">
      <strong>Não foi possível carregar os dados.</strong>
      ${local
        ? html`<p>O navegador bloqueia a leitura de arquivos quando a página é aberta direto do disco. Rode <code>python -m http.server 8080</code> na pasta do projeto e acesse <code>http://localhost:8080</code>.</p>`
        : html`<p>Verifique sua conexão e recarregue a página. (${String(e.message ?? e)})</p>`}
    </div>`);
}

async function iniciar() {
  configurarTema();
  configurarModal();
  try {
    const resp = await fetch('data/resplendor.json', { cache: 'no-cache' });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    data = await resp.json();
  } catch (e) {
    erroCarregamento(e);
    return;
  }
  // Os gráficos medem os rótulos ao desenhar; com a fonte web ainda carregando, cortariam o texto.
  await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 2500))]);
  document.getElementById('estadoCarregamento').remove();
  Object.assign(estado, lerHash());
  escreverHash();

  configurarAbas();
  configurarAno();
  document.addEventListener('click', (e) => {
    const ajuda = e.target.closest('[data-ajuda]');
    if (ajuda) abrirAjuda(ajuda.dataset.ajuda);
    const exp = e.target.closest('[data-export]');
    if (exp) exportar(exp.dataset.export);
  });
  document.addEventListener('detalhar-funcao', (e) => despesas.detalharFuncao({ data, ano: estado.ano }, e.detail));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') document.getElementById('menuExportar').open = false; });
  window.addEventListener('hashchange', () => { Object.assign(estado, lerHash()); escreverHash(); aplicar(); });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    aplicarTema(temaAtual());
    renderizado = '';
    aplicar();
  });

  const gerado = new Date(data.meta.gerado_em);
  document.getElementById('rodapeAtualizado').textContent = `Dados atualizados em ${gerado.toLocaleDateString('pt-BR')} · exercícios ${anos(data)[0]}–${anos(data).at(-1)}`;

  aplicar();

  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('sw.js').catch(() => { /* o painel funciona sem modo offline */ });
  }
}

iniciar();
