import { html, formatBRL, formatPct } from '../util.js';
import { calculadora } from '../model.js';
import { toast } from '../ui.js';

let valorAtual = 500;

/** Aceita "1.200,50", "1200.50", "R$ 350". */
export function lerValor(texto) {
  let s = String(texto).replace(/[^\d,.-]/g, '');
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  else if ((s.match(/\./g) || []).length > 1 || /\.\d{3}$/.test(s)) s = s.replace(/\./g, '');
  const v = Number.parseFloat(s);
  return Number.isFinite(v) && v > 0 ? Math.min(v, 1e9) : null;
}

export function render(el, { data, ano }) {
  const d = data.anos[ano];

  el.innerHTML = String(html`
    <div class="calculator-container">
      <div class="card calc-input-card">
        <span class="eyebrow">Simulador</span>
        <h3>Para onde foi o meu imposto?</h3>
        <p>Informe quanto você pagou à Prefeitura (IPTU, ISS, ITBI, taxas) e veja como esse valor se divide entre as áreas, na mesma proporção em que a Prefeitura comprometeu o orçamento de ${ano}.</p>
        <label class="field-label" for="calcValor">Valor pago em tributos municipais</label>
        <div class="input-money-group">
          <span class="prefix" aria-hidden="true">R$</span>
          <input type="text" inputmode="decimal" id="calcValor" autocomplete="off" value="${valorAtual.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}" aria-describedby="calcErro">
        </div>
        <p class="field-error" id="calcErro" role="alert"></p>
        <div class="quick-amounts" role="group" aria-label="Valores sugeridos">
          ${[150, 350, 800, 1500, 3000].map((v) => html`<button type="button" class="quick-btn" data-valor="${v}">${formatBRL(v, { centavos: false })}</button>`)}
        </div>
        <div class="note-box">
          <strong>Como funciona:</strong> o dinheiro dos impostos não é “carimbado”. Ele entra no mesmo cofre que os repasses da União e do Estado e é distribuído conforme o orçamento. A divisão usa a despesa empenhada por área em ${ano} (DCA, Anexo I-E). Só ${formatPct(d.receita.proprios_pct)} da receita da cidade vem de tributos próprios.
        </div>
      </div>

      <div class="citizen-receipt" aria-live="polite">
        <div class="receipt-header">
          <h4>Extrato do contribuinte</h4>
          <p>Prefeitura de Resplendor · Execução de ${ano}</p>
        </div>
        <div class="receipt-items" id="reciboItens"></div>
        <div class="receipt-total-bar"><span>Total</span><span class="tabular-nums" id="reciboTotal"></span></div>
        <div class="receipt-actions">
          <a class="btn-primary" id="btnCompartilhar" href="#" target="_blank" rel="noopener">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
            Compartilhar
          </a>
          <button type="button" class="btn-secondary" id="btnCopiar">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            Copiar
          </button>
        </div>
      </div>
    </div>`);

  const input = document.getElementById('calcValor');
  const erro = document.getElementById('calcErro');
  let texto = '';

  const atualizar = () => {
    const itens = calculadora(d, valorAtual);
    const max = Math.max(...itens.map((i) => i.pct));
    document.getElementById('reciboItens').innerHTML = String(html`${itens.map((i) => html`
      <div class="receipt-row">
        <div class="receipt-item-info">
          <span class="receipt-item-name">${i.nome}</span>
          <span class="receipt-bar" aria-hidden="true"><span style="width:${(i.pct / max) * 100}%"></span></span>
        </div>
        <div class="receipt-item-val"><strong class="tabular-nums">${formatBRL(i.valor)}</strong><small>${formatPct(i.pct)}</small></div>
      </div>`)}`);
    document.getElementById('reciboTotal').textContent = formatBRL(valorAtual);
    texto = [
      `Para onde foram os ${formatBRL(valorAtual)} que paguei à Prefeitura de Resplendor/MG (${ano}):`,
      '',
      ...itens.map((i) => `• ${i.nome.replace(/\s*\(.*\)$/, '')}: ${formatBRL(i.valor)} (${formatPct(i.pct)})`),
      '',
      `Fonte: Balanço Anual (DCA) enviado ao Tesouro Nacional.${location.protocol.startsWith('http') ? ` Veja mais: ${location.href.split('#')[0]}#aba=calculadora&ano=${ano}` : ''}`,
    ].join('\n');
    document.getElementById('btnCompartilhar').href = `https://wa.me/?text=${encodeURIComponent(texto)}`;
  };

  input.addEventListener('input', () => {
    const v = lerValor(input.value);
    erro.textContent = v ? '' : 'Digite um valor maior que zero, por exemplo 350 ou 1.200,50.';
    input.setAttribute('aria-invalid', v ? 'false' : 'true');
    if (v) { valorAtual = v; atualizar(); }
  });
  el.querySelectorAll('.quick-btn').forEach((b) => b.addEventListener('click', () => {
    valorAtual = Number(b.dataset.valor);
    input.value = valorAtual.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
    erro.textContent = '';
    atualizar();
  }));
  document.getElementById('btnCompartilhar').addEventListener('click', async (e) => {
    if (navigator.share) {
      e.preventDefault();
      try { await navigator.share({ title: 'Para onde foi o meu imposto', text: texto }); } catch { /* cancelado pelo usuário */ }
    }
  });
  document.getElementById('btnCopiar').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(texto);
      toast('Extrato copiado para a área de transferência.');
    } catch {
      toast('Não foi possível copiar automaticamente. Selecione o texto do extrato.');
    }
  });
  atualizar();
}
