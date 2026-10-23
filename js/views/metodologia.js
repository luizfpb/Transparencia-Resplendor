import { html } from '../util.js';
import { GLOSSARIO } from '../glossario.js';
import { anos } from '../model.js';
import { card } from '../ui.js';

export function render(el, { data }) {
  const meta = data.meta;
  const gerado = new Date(meta.gerado_em).toLocaleString('pt-BR', { dateStyle: 'long', timeStyle: 'short' });
  const inconsist = anos(data).flatMap((a) => (data.anos[a].indicadores.inconsistencias ?? []).map((t) => ({ ano: a, texto: t })));
  const pops = anos(data).map((a) => ({ ano: a, pop: data.anos[a].populacao, fonte: data.anos[a].populacao_fonte }));

  el.innerHTML = String(html`
    <div class="section-head">
      <h2>Como ler este painel</h2>
      <p>Todo número exibido aqui pode ser conferido nos relatórios oficiais. Esta página explica de onde cada um vem e como foi calculado.</p>
    </div>

    <div class="section-grid">
      ${card({
        titulo: 'Princípios',
        classe: 'span-6',
        corpo: html`<ul class="bullets">
          <li><strong>Só dados oficiais.</strong> Nada é digitado à mão: um script baixa os demonstrativos do Tesouro Nacional, do IBGE e do Banco Central e gera o arquivo que o painel lê.</li>
          <li><strong>Sem dupla contagem.</strong> As receitas são líquidas da dedução do FUNDEB; o dinheiro que vai para o fundo e volta é contado uma única vez.</li>
          <li><strong>Despesa empenhada como base.</strong> É o critério da Lei 4.320/1964 para apurar o resultado do ano e o mesmo que o RREO usa.</li>
          <li><strong>Totais conferidos.</strong> O script interrompe a publicação se a soma das partes não bater com o total oficial.</li>
          <li><strong>Problemas à mostra.</strong> Divergências e erros de preenchimento nos relatórios da própria Prefeitura são exibidos, não escondidos.</li>
        </ul>`,
      })}

      ${card({
        titulo: 'Fontes',
        classe: 'span-6',
        corpo: html`<ul class="link-list">
          ${meta.fontes.map((f) => html`<li><a href="${f.url}" target="_blank" rel="noopener">${f.nome}</a></li>`)}
          <li><a href="https://servicodados.ibge.gov.br/api/docs/agregados" target="_blank" rel="noopener">IBGE: estimativas da população e Censo 2022</a></li>
        </ul>
        <p class="note">Dados gerados em <strong>${gerado}</strong>. Exercícios ${anos(data)[0]} a ${anos(data).at(-1)}. Valores corrigidos usam o IPCA médio, a preços de ${meta.ipca.ano_base}.</p>`,
      })}

      ${card({
        titulo: 'Divergências entre relatórios oficiais',
        subtitulo: 'O mesmo número declarado de forma diferente no Balanço Anual (DCA) e no RREO',
        classe: 'span-6',
        corpo: meta.avisos.length
          ? html`<ul class="bullets small">${meta.avisos.map((a) => html`<li>${a}</li>`)}</ul>
            <p class="note">O painel usa a DCA (balanço anual, entregue depois) para receitas e despesas, e o RREO/RGF para os índices legais. Diferenças pequenas costumam vir de ajustes de encerramento; diferenças grandes merecem pedido de esclarecimento à Prefeitura.</p>`
          : html`<p>Nenhuma divergência encontrada.</p>`,
      })}

      ${card({
        titulo: 'Erros de preenchimento detectados',
        classe: 'span-6',
        corpo: inconsist.length
          ? html`<ul class="bullets small">${inconsist.map((i) => html`<li><strong>${i.ano}:</strong> ${i.texto}</li>`)}</ul>`
          : html`<p>Nenhuma inconsistência detectada.</p>`,
      })}

      ${card({
        titulo: 'Glossário',
        classe: 'span-12',
        corpo: html`<dl class="glossary">${Object.values(GLOSSARIO).map((g) => html`<div><dt>${g.titulo}</dt><dd>${g.texto}<small>${g.fonte}</small></dd></div>`)}</dl>`,
      })}

      ${card({
        titulo: 'População usada nos cálculos por habitante',
        classe: 'span-6',
        corpo: html`<div class="table-responsive"><table class="data-table compact"><thead><tr><th scope="col">Ano</th><th scope="col" class="num">População</th><th scope="col">Fonte</th></tr></thead>
          <tbody>${pops.map((p) => html`<tr><th scope="row">${p.ano}</th><td class="num">${p.pop.toLocaleString('pt-BR')}</td><td>${p.fonte}</td></tr>`)}</tbody></table></div>
          <p class="note">O SICONFI registra para alguns anos uma população diferente da oficial do IBGE. Aqui vale sempre o IBGE.</p>`,
      })}

      ${card({
        titulo: 'Limitações conhecidas',
        classe: 'span-6',
        corpo: html`<ul class="bullets small">
          <li>Notas de empenho individuais (fornecedor, CNPJ, contrato) não estão incluídas: o sistema do TCE-MG exige acesso manual. Veja a aba “Em que se gasta”.</li>
          <li>Os índices de educação e saúde são os declarados pela Prefeitura; o Tribunal de Contas pode recalculá-los ao julgar as contas.</li>
          <li>A despesa empenhada inclui empenhos que podem ser cancelados no ano seguinte (restos a pagar não processados).</li>
          <li>Na comparação com vizinhos, educação e saúde ficam de fora por falta de preenchimento na fonte.</li>
          <li>O exercício corrente só aparece depois que a Prefeitura envia o Balanço Anual (até 30 de abril do ano seguinte).</li>
        </ul>`,
      })}

      ${card({
        titulo: 'Atualizar e reproduzir',
        classe: 'span-12',
        corpo: html`<p>O código e os dados são abertos. Para reconstruir a base a partir das fontes oficiais:</p>
          <pre class="code"><code>python scripts/build_data.py --refresh</code></pre>
          <p class="note">Em produção, uma tarefa automática roda toda semana, publica os dados novos e registra a mudança no histórico do repositório, de modo que qualquer alteração em número já publicado fica rastreável.</p>`,
      })}
    </div>`);
}
