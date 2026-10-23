import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as m from '../js/model.js';
import { html, raw, gerarCSV, formatCompacto, formatVariacao } from '../js/util.js';

const data = JSON.parse(readFileSync(new URL('../data/resplendor.json', import.meta.url), 'utf8'));
const ANOS = m.anos(data);
const perto = (a, b, tol = 0.01) => Math.abs(a - b) <= tol;

test('há série histórica contínua', () => {
  assert.ok(ANOS.length >= 5);
  for (let i = 1; i < ANOS.length; i++) assert.equal(Number(ANOS[i]) - Number(ANOS[i - 1]), 1);
});

test('resultado orçamentário = receita líquida − despesa empenhada', () => {
  for (const a of ANOS) {
    const d = data.anos[a];
    assert.ok(perto(d.resultado_orcamentario, d.receita.liquida - d.despesa.empenhada, 0.05), a);
  }
});

test('2024 teve déficit e bate com o RREO oficial', () => {
  const d = data.anos['2024'];
  assert.ok(d.resultado_orcamentario < 0);
  assert.ok(perto(d.resultado_orcamentario, d.indicadores.resultado_orcamentario, 5));
});

test('receita líquida desconta a dedução do FUNDEB (sem dupla contagem)', () => {
  for (const a of ANOS) {
    const r = data.anos[a].receita;
    assert.ok(perto(r.liquida, r.bruta - r.deducoes_fundeb - r.outras_deducoes, 0.05), a);
    const soma = r.grupos.reduce((s, g) => s + g.liquido, 0);
    assert.ok(perto(soma, r.liquida, 1), `grupos ${a}`);
  }
});

test('fluxo: os dois lados do cofre têm o mesmo total', () => {
  for (const a of ANOS) {
    const mod = m.modeloFluxo(data.anos[a]);
    const esq = mod.fontes.reduce((s, x) => s + x.valor, 0);
    const dir = mod.destinos.reduce((s, x) => s + x.valor, 0);
    assert.ok(perto(esq, dir, 2), `${a}: ${esq} vs ${dir}`);
    assert.ok(perto(esq, mod.total, 2));
  }
});

test('fluxo: fitas empilhadas preenchem exatamente o nó central, sem sobreposição', () => {
  for (const a of ANOS) {
    const lay = m.layoutFluxo(m.modeloFluxo(data.anos[a]));
    const entrada = lay.links.filter((l) => l.para.id === 'tesouro');
    const saida = lay.links.filter((l) => l.de.id === 'tesouro');
    for (const grupo of [entrada, saida]) {
      let y = lay.centro.y;
      for (const l of grupo) {
        const yc = l.para.id === 'tesouro' ? l.y1 : l.y0;
        assert.ok(perto(yc, y, 1e-6), `${a}: fita começa em ${yc}, esperado ${y}`);
        y += l.h;
      }
      assert.ok(perto(y, lay.centro.y + lay.centro.h, 1e-6));
    }
    for (const n of lay.nos) assert.ok(n.y >= 0 && n.y + n.h <= lay.altura + 1e-6, `${a}: nó ${n.id} fora da área`);
  }
});

test('déficit aparece como fonte "caixa de anos anteriores"; superávit como destino', () => {
  const def = m.modeloFluxo(data.anos['2024']);
  assert.ok(def.fontes.some((f) => f.id === 'caixa'));
  const sup = m.modeloFluxo(data.anos['2025']);
  assert.ok(sup.destinos.some((f) => f.id === 'saldo'));
});

test('calculadora: fatias somam exatamente o valor informado', () => {
  for (const a of ANOS) {
    for (const valor of [1, 150, 333.33, 2500, 98765.43]) {
      const itens = m.calculadora(data.anos[a], valor);
      const soma = Math.round(itens.reduce((s, i) => s + i.valor, 0) * 100) / 100;
      assert.equal(soma, valor, `${a} / ${valor}`);
      assert.ok(perto(itens.reduce((s, i) => s + i.pct, 0), 100, 1e-6));
    }
  }
  assert.deepEqual(m.calculadora(data.anos['2025'], 0), []);
});

test('IPCA: ano-base tem fator 1 e anos antigos têm fator maior', () => {
  const base = String(data.meta.ipca.ano_base);
  assert.equal(m.fatorIPCA(data, base), 1);
  assert.ok(m.fatorIPCA(data, ANOS[0]) > 1);
});

test('limites legais', () => {
  assert.equal(m.statusPessoal({ pessoal_pct: 45 }).nivel, 'ok');
  assert.equal(m.statusPessoal({ pessoal_pct: 49 }).nivel, 'medio');
  assert.equal(m.statusPessoal({ pessoal_pct: 52 }).nivel, 'alto');
  assert.equal(m.statusPessoal({ pessoal_pct: 55 }).nivel, 'critico');
  assert.equal(m.statusMinimo(25.95, 25).nivel, 'medio');
  assert.equal(m.statusMinimo(24, 25).nivel, 'critico');
  assert.equal(m.statusMinimo(null, 25).nivel, 'nd');
});

test('alertas de 2024 incluem déficit e educação no limite', () => {
  const al = m.alertas(data, '2024');
  assert.ok(al.some((a) => a.ajuda === 'resultado_orcamentario' && a.nivel === 'alto'));
  assert.ok(al.some((a) => a.ajuda === 'mde'));
});

test('comparação regional inclui Resplendor em destaque', () => {
  const t = m.tabelaVizinhos(data, ANOS.at(-1));
  assert.ok(t.linhas.length > 1);
  assert.equal(t.linhas.filter((l) => l.destaque).length, 1);
  const r = m.ranking(t.linhas, 'receitaPc');
  assert.ok(r.posicao >= 1 && r.posicao <= r.de);
});

test('html escapa interpolações', () => {
  const nome = '<img src=x onerror=alert(1)>';
  assert.equal(String(html`<b>${nome}</b>`), '<b>&lt;img src=x onerror=alert(1)&gt;</b>');
  assert.equal(String(html`<i>${raw('<u>ok</u>')}</i>`), '<i><u>ok</u></i>');
  assert.equal(String(html`<ul>${['a', '<b>'].map((x) => html`<li>${x}</li>`)}</ul>`), '<ul><li>a</li><li>&lt;b&gt;</li></ul>');
});

test('CSV no padrão brasileiro', () => {
  const csv = gerarCSV([{ chave: 'n', titulo: 'Nome' }, { chave: 'v', titulo: 'Valor' }], [{ n: 'A; "B"', v: 1234.5 }, { n: 'C', v: 7 }]);
  assert.equal(csv, 'Nome;Valor\r\n"A; ""B""";1234,50\r\nC;7');
});

test('formatação', () => {
  assert.equal(formatCompacto(91624135.79), 'R$ 91,6 mi');
  assert.equal(formatCompacto(-10532077), '−R$ 10,5 mi');
  assert.equal(formatVariacao(5.123), '+5,1%');
  assert.equal(formatVariacao(-3), '−3,0%');
});
