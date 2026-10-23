// Utilitários puros: formatação, escape de HTML e geração de CSV.
// Não acessam o DOM, então podem ser testados no Node.

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const brl0 = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const num = new Intl.NumberFormat('pt-BR');

export function formatBRL(v, { centavos = true } = {}) {
  if (v === null || v === undefined || Number.isNaN(v)) return '—';
  return (centavos ? brl : brl0).format(v);
}

/** "R$ 91,6 mi", "R$ 850 mil" — para eixos, rótulos e textos curtos. */
export function formatCompacto(v) {
  if (v === null || v === undefined || Number.isNaN(v)) return '—';
  const abs = Math.abs(v);
  const sinal = v < 0 ? '−' : '';
  if (abs >= 1e9) return `${sinal}R$ ${(abs / 1e9).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} bi`;
  if (abs >= 1e6) return `${sinal}R$ ${(abs / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: abs >= 1e8 ? 0 : 1 })} mi`;
  if (abs >= 1e3) return `${sinal}R$ ${(abs / 1e3).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} mil`;
  return `${sinal}${brl.format(abs)}`;
}

export function formatPct(v, casas = 1) {
  if (v === null || v === undefined || Number.isNaN(v)) return '—';
  return `${v.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })}%`;
}

/** Variação com sinal explícito: "+5,1%", "−3,0%". */
export function formatVariacao(v, casas = 1) {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  // Arredonda antes de decidir o sinal, para não exibir "−0,0%".
  v = Math.round(v * 10 ** casas) / 10 ** casas;
  const s = Math.abs(v).toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });
  return `${v > 0 ? '+' : v < 0 ? '−' : ''}${s}%`;
}

export function formatNumero(v) {
  if (v === null || v === undefined || Number.isNaN(v)) return '—';
  return num.format(v);
}

// ---------------------------------------------------------------------------
// Template HTML com escape automático. Interpolações são escapadas, exceto
// quando vêm de outro `html` ou de `raw()`. Arrays são concatenados.
// ---------------------------------------------------------------------------

const SEGURO = Symbol('html-seguro');

function escapar(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function converter(v) {
  if (v === null || v === undefined || v === false) return '';
  if (Array.isArray(v)) return v.map(converter).join('');
  if (typeof v === 'object' && v[SEGURO]) return v.valor;
  return escapar(v);
}

export function html(partes, ...valores) {
  let out = partes[0];
  for (let i = 0; i < valores.length; i++) out += converter(valores[i]) + partes[i + 1];
  return { [SEGURO]: true, valor: out, toString() { return out; } };
}

export function raw(s) {
  return { [SEGURO]: true, valor: String(s), toString() { return String(s); } };
}

// ---------------------------------------------------------------------------
// CSV no padrão do Excel brasileiro: ponto e vírgula e vírgula decimal.
// ---------------------------------------------------------------------------

function celulaCSV(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : v.toFixed(2).replace('.', ',');
  const s = String(v);
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** colunas: [{ chave, titulo }]; linhas: objetos. */
export function gerarCSV(colunas, linhas) {
  const cab = colunas.map((c) => celulaCSV(c.titulo)).join(';');
  const corpo = linhas.map((l) => colunas.map((c) => celulaCSV(typeof c.chave === 'function' ? c.chave(l) : l[c.chave])).join(';'));
  return [cab, ...corpo].join('\r\n');
}

export function slug(s) {
  return String(s)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function normalizarBusca(s) {
  return String(s ?? '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase();
}
