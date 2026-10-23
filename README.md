# Transparência Resplendor

Painel de controle social das contas da Prefeitura de Resplendor (MG): de onde vem e para onde vai o dinheiro, limites da Lei de Responsabilidade Fiscal, série histórica desde 2015 corrigida pela inflação e comparação com municípios vizinhos.

Todos os números vêm de fontes oficiais e são gerados por script. Nada é digitado à mão.

## Fontes

| Fonte | O que fornece |
|---|---|
| [SICONFI / Tesouro Nacional](https://apidatalake.tesouro.gov.br/docs/siconfi/): DCA, Anexos I-AB, I-C, I-D e I-E | Receitas, despesas por função, subfunção e elemento, caixa |
| SICONFI: RREO Simplificado (Anexo 14) e RGF Simplificado (Anexo 06) | Resultado orçamentário, mínimos de educação e saúde, pessoal/RCL, dívida |
| [IBGE](https://servicodados.ibge.gov.br/api/docs/agregados): tabelas 6579 e 9514 | População (estimativas anuais e Censo 2022) |
| [Banco Central](https://dadosabertos.bcb.gov.br/dataset/433-indice-nacional-de-precos-ao-consumidor-amplo-ipca): SGS 433 | IPCA para correção monetária |

## Rodar localmente

```bash
python -m http.server 8080      # e abra http://localhost:8080
```

Abrir o `index.html` direto do disco não funciona: o navegador bloqueia a leitura do JSON em `file://`.

## Atualizar os dados

```bash
python scripts/build_data.py --refresh   # baixa tudo de novo (sem --refresh, usa o cache em .cache/)
python scripts/gerar_imagens.py          # ícones e imagem de compartilhamento
```

O script **falha** se a soma das partes não fechar com o total oficial (grupos de receita × receita líquida; naturezas × despesa empenhada). Divergências entre DCA e RREO e erros de preenchimento detectados na declaração da Prefeitura não interrompem o processo: eles ficam registrados em `meta.avisos` e em `indicadores.inconsistencias` e aparecem no painel.

## Testes

```bash
npm test                              # cálculos do front-end (Node 20+)
python -m unittest discover tests     # pipeline de dados
```

## Publicação

`.github/workflows/publicar.yml` publica no GitHub Pages a cada push em `main` e, toda segunda-feira, rebaixa os dados oficiais, valida, registra a mudança em commit e republica. Para ativar, vá em *Settings → Pages → Source: GitHub Actions*.

## Estrutura

```
index.html, css/, js/          front-end estático (módulos ES, sem build)
  js/model.js                  cálculos puros (testados): fluxo, calculadora, alertas, comparação
  js/views/                    uma aba por arquivo
scripts/siconfi.py             cliente das APIs com cache
scripts/build_data.py          gera data/resplendor.json
tests/                         testes JS (node:test) e Python (unittest)
```

## Decisões metodológicas

- **Receita líquida**: a receita bruta menos a dedução do FUNDEB. Os 20% de FPM, ICMS e IPVA que vão para o fundo voltam como "receita do FUNDEB"; somar os dois contaria o mesmo dinheiro duas vezes.
- **Despesa empenhada** como base do resultado orçamentário (Lei 4.320/1964, critério do RREO).
- **Índices legais** (pessoal, MDE, ASPS): os valores declarados pela Prefeitura no RREO/RGF, não recalculados. Bases de cálculo diferentes (RCL, receita de impostos) tornariam qualquer recálculo próprio enganoso.
- **Notas de empenho individuais** não estão incluídas: o sistema do TCE-MG exige acesso manual (reCAPTCHA). O painel indica onde consultá-las.
