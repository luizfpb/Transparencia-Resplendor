import { html } from '../util.js';
import { formatBRL, formatCompacto, formatPct, formatVariacao } from '../util.js';
import { alertas, anoAnterior, variacaoReal, NOMES_CIDADAOS, NOMES_CURTOS_FONTE } from '../model.js';
import { card, botaoAjuda, iconeStatus } from '../ui.js';
import { grafico, blocoGrafico, eixos, cores } from '../charts.js';

const SLOT_FONTE = { fpm: 1, estado: 2, fundeb: 3, sus: 4, royalties: 5, proprios: 6, outras: 7 };

function destaques(data, ano) {
  const d = data.anos[ano];
  const p = anoAnterior(data, ano);
  const out = [];
  const funcoes = d.despesa.funcoes;
  const saude = funcoes.find((f) => f.codigo === '10')?.empenhado ?? 0;
  const educ = funcoes.find((f) => f.codigo === '12')?.empenhado ?? 0;
  out.push({
    titulo: 'Saúde e educação',
    texto: html`Juntas, receberam <strong>${formatCompacto(saude + educ)}</strong>, ou <strong>${formatPct(((saude + educ) / d.despesa.empenhada) * 100)}</strong> de toda a despesa empenhada. Isso dá ${formatBRL((saude + educ) / d.populacao, { centavos: false })} por morador.`,
  });

  const cfem = d.receita.destaques.cfem.liquido;
  if (cfem > 0) {
    const vr = p ? variacaoReal(data, cfem, ano, p.receita.destaques.cfem.liquido, p.ano) : null;
    out.push({
      titulo: 'Royalties da mineração (CFEM)',
      texto: html`Resplendor recebeu <strong>${formatCompacto(cfem)}</strong> de compensação pela exploração mineral${vr != null ? html`, ${vr >= 0 ? 'alta' : 'queda'} real de <strong>${formatVariacao(vr)}</strong> sobre ${p.ano}` : ''}. É ${formatPct((cfem / d.receita.liquida) * 100)} da receita.`,
    });
  }

  const proprios = d.receita.grupos.find((g) => g.id === 'proprios')?.liquido ?? 0;
  const fpm = d.receita.grupos.find((g) => g.id === 'fpm')?.liquido ?? 0;
  out.push({
    titulo: 'Dependência de repasses',
    texto: html`Os tributos cobrados pela própria Prefeitura (ISS, IPTU, ITBI, taxas) somaram <strong>${formatPct((proprios / d.receita.liquida) * 100)}</strong> da receita. Só o FPM, repasse da União, trouxe <strong>${formatPct((fpm / d.receita.liquida) * 100)}</strong>.`,
  });

  if (d.balanco?.caixa != null) {
    out.push({
      titulo: 'Dinheiro em caixa em 31/12',
      texto: html`<strong>${formatCompacto(d.balanco.caixa)}</strong> em contas e aplicações${p?.balanco?.caixa != null ? html` (${formatCompacto(p.balanco.caixa)} no fim de ${p.ano})` : ''}. Parte desse valor é vinculada a fins específicos, como FUNDEB, SUS e convênios.`,
      ajuda: 'caixa',
    });
  }
  return out;
}

export function render(el, { data, ano }) {
  const d = data.anos[ano];
  const lista = alertas(data, ano);
  const top = d.despesa.funcoes.slice(0, 6);

  el.innerHTML = String(html`
    <div class="section-grid">
      ${card({
        titulo: `Pontos de atenção em ${ano}`,
        subtitulo: 'Gerados automaticamente a partir dos demonstrativos oficiais',
        classe: 'span-12',
        corpo: html`<ul class="alert-list">${lista.map((a) => html`
          <li class="alert-item ${a.nivel}">
            <span class="alert-icon">${iconeStatus(a.nivel)}</span>
            <div><strong>${a.titulo}</strong> ${botaoAjuda(a.ajuda)}<p>${a.texto}</p></div>
          </li>`)}</ul>`,
      })}

      ${card({
        titulo: 'Para onde foi o dinheiro',
        subtitulo: 'As 6 áreas com maior despesa empenhada. Clique numa barra para ver o detalhamento.',
        ajuda: 'funcao',
        classe: 'span-7',
        corpo: blocoGrafico('gVisaoFuncoes', 300),
      })}

      ${card({
        titulo: 'De onde veio',
        subtitulo: 'Receita líquida por origem',
        ajuda: 'receita_liquida',
        classe: 'span-5',
        corpo: blocoGrafico('gVisaoFontes', 300),
      })}

      ${card({
        titulo: 'Destaques do exercício',
        classe: 'span-12',
        corpo: html`<div class="facts-grid">${destaques(data, ano).map((f) => html`
          <div class="fact"><h4>${f.titulo} ${f.ajuda ? botaoAjuda(f.ajuda) : ''}</h4><p>${f.texto}</p></div>`)}</div>`,
      })}
    </div>`);

  const c = cores();
  grafico('gVisaoFuncoes', {
    type: 'bar',
    data: {
      labels: top.map((f) => f.nome),
      datasets: [{ label: 'Despesa empenhada', data: top.map((f) => f.empenhado), backgroundColor: c.serie[0], maxBarThickness: 26 }],
    },
    options: {
      indexAxis: 'y',
      scales: eixos({ horizontal: true, formatoX: (v) => formatCompacto(v) }),
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (ctx) => ` ${formatBRL(ctx.raw)} (${formatPct((ctx.raw / d.despesa.empenhada) * 100)})` } },
      },
      onClick: (_e, els) => { if (els.length) el.dispatchEvent(new CustomEvent('detalhar-funcao', { bubbles: true, detail: top[els[0].index].codigo })); },
      onHover: (e, els) => { e.native.target.style.cursor = els.length ? 'pointer' : 'default'; },
    },
  }, {
    descricao: `Gráfico de barras: ${top.map((f) => `${f.nome} ${formatCompacto(f.empenhado)}`).join('; ')}`,
    tabela: {
      colunas: ['Área', 'Empenhado', '% do total', 'Por habitante'],
      linhas: top.map((f) => [NOMES_CIDADAOS[f.codigo] ?? f.nome, formatBRL(f.empenhado), formatPct((f.empenhado / d.despesa.empenhada) * 100), formatBRL(f.empenhado / d.populacao)]),
    },
  });

  const grupos = [...d.receita.grupos].filter((g) => g.liquido > 0).sort((a, b) => b.liquido - a.liquido);
  grafico('gVisaoFontes', {
    type: 'bar',
    data: {
      labels: grupos.map((g) => NOMES_CURTOS_FONTE[g.id] ?? g.nome),
      datasets: [{ label: 'Receita líquida', data: grupos.map((g) => g.liquido), backgroundColor: grupos.map((g) => c.serie[SLOT_FONTE[g.id] - 1]), maxBarThickness: 26 }],
    },
    options: {
      indexAxis: 'y',
      scales: eixos({ horizontal: true, formatoX: (v) => formatCompacto(v) }),
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (ctx) => ` ${formatBRL(ctx.raw)} (${formatPct((ctx.raw / d.receita.liquida) * 100)})` } },
      },
    },
  }, {
    descricao: `Receita por origem: ${grupos.map((g) => `${g.nome} ${formatCompacto(g.liquido)}`).join('; ')}`,
    tabela: {
      colunas: ['Origem', 'Valor líquido', '% da receita'],
      linhas: grupos.map((g) => [g.nome, formatBRL(g.liquido), formatPct((g.liquido / d.receita.liquida) * 100)]),
    },
  });
}
