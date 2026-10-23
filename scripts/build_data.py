"""Gera data/resplendor.json a partir das fontes oficiais.

Fontes:
  * SICONFI / Tesouro Nacional — DCA (Balanço Anual) Anexos I-AB, I-C, I-D, I-E;
    RREO Simplificado Anexo 14 (6º bimestre); RGF Simplificado Anexo 06 (2º semestre).
  * Banco Central — série SGS 433 (IPCA mensal) para correção monetária.

Uso:
    python scripts/build_data.py            # usa o cache local quando existir
    python scripts/build_data.py --refresh  # força novo download de tudo

Cada número publicado no app sai deste script. Se um total não fechar com o
demonstrativo oficial, o script falha em vez de publicar dado inconsistente.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import unicodedata
from datetime import datetime, timezone
from pathlib import Path

import siconfi

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "resplendor.json"

ENTE = {
    "nome": "Resplendor",
    "uf": "MG",
    "ibge": 3154309,
    "cnpj": "18.413.161/0001-72",
    "regiao": "Vale do Rio Doce",
    "endereco": "Praça Pedro Nolasco, 20 - Centro, Resplendor - MG",
}

# Municípios mineiros vizinhos ou de porte e economia semelhantes no Vale do Rio Doce.
VIZINHOS = {
    3101102: "Aimorés",
    3118403: "Conselheiro Pena",
    3134103: "Itueta",
    3159506: "Santa Rita do Itueto",
    3127305: "Galiléia",
    3169505: "Tumiritinga",
    3127370: "Goiabeira",
    3144003: "Mutum",
}

ANO_INICIAL = 2015
ANOS_VIZINHOS = 3  # últimos N exercícios comparados com os vizinhos

COL_BRUTA = "Receitas Brutas Realizadas"
COL_DED_FUNDEB = "Deduções - FUNDEB"
COL_EMP = "Despesas Empenhadas"
COL_LIQ = "Despesas Liquidadas"
COL_PAG = "Despesas Pagas"


# --------------------------------------------------------------------------
# Utilidades
# --------------------------------------------------------------------------

def norm(texto: str) -> str:
    """Minúsculas, sem acentos e sem o caractere de substituição '¿' do SICONFI."""
    t = unicodedata.normalize("NFKD", texto.replace("¿", "-"))
    return "".join(c for c in t if not unicodedata.combining(c)).lower()


def segmentos(cod_conta: str) -> tuple[str, ...]:
    """'RO1.7.1.1.51.0.0' -> ('1','7','1','1','51'); zeros finais removidos."""
    partes = re.sub(r"^[A-Z]+", "", cod_conta).split(".")
    while partes and set(partes[-1]) <= {"0"}:
        partes.pop()
    return tuple(partes)


def nome_conta(conta: str) -> str:
    """Remove o código numérico do início do nome da conta."""
    return re.sub(r"^[\d.]+\s*-?\s*", "", conta).strip().replace("¿", "–")


def r2(v: float | None) -> float | None:
    return None if v is None else round(v, 2)


def topo(linhas: list[dict]) -> list[dict]:
    """Mantém apenas as contas que não são descendentes de outra conta da lista."""
    segs = [segmentos(l["cod_conta"]) for l in linhas]
    out = []
    for i, s in enumerate(segs):
        if not s:
            continue
        ancestral = any(j != i and len(o) < len(s) and s[: len(o)] == o for j, o in enumerate(segs) if o)
        if not ancestral:
            out.append(linhas[i])
    # Remove duplicatas exatas de código (mesma conta repetida)
    vistos, unicos = set(), []
    for l in out:
        if l["cod_conta"] not in vistos:
            vistos.add(l["cod_conta"])
            unicos.append(l)
    return unicos


class Receitas:
    """Indexa o Anexo I-C de um exercício por coluna."""

    def __init__(self, linhas: list[dict]):
        self.bruta = [l for l in linhas if l["coluna"] == COL_BRUTA and l["cod_conta"].startswith("RO")]
        self.total_linhas = linhas
        self.deducoes: dict[str, float] = {}
        for l in linhas:
            if l["coluna"] != COL_BRUTA and l["cod_conta"].startswith("RO"):
                self.deducoes[l["cod_conta"]] = self.deducoes.get(l["cod_conta"], 0.0) + l["valor"]

    def total(self, coluna_prefixo: str) -> float:
        return sum(
            l["valor"] for l in self.total_linhas
            if l["cod_conta"] == "TotalReceitas" and l["coluna"].startswith(coluna_prefixo)
        )

    def por_nome(self, padrao: str, excluir: str | None = None) -> list[dict]:
        rx = re.compile(padrao)
        rx_ex = re.compile(excluir) if excluir else None
        achadas = [
            l for l in self.bruta
            if rx.search(norm(l["conta"])) and not (rx_ex and rx_ex.search(norm(l["conta"])))
        ]
        return topo(achadas)

    def por_codigo(self, *prefixos: tuple[str, ...]) -> list[dict]:
        return topo([l for l in self.bruta if segmentos(l["cod_conta"]) in prefixos])

    def soma(self, linhas: list[dict]) -> tuple[float, float]:
        bruto = sum(l["valor"] for l in linhas)
        ded = sum(self.deducoes.get(l["cod_conta"], 0.0) for l in linhas)
        return bruto, ded


# Padrões de nome (já normalizados: minúsculas, sem acento).
P_FPM = r"fundo de participacao d[oe]s? municipios"
P_ICMS = r"cota-parte do icms"
P_IPVA = r"cota-parte do ipva"
P_IPI = r"cota-parte do ipi"
P_FUNDEB = r"fundeb|fundo de manutencao e desenvolvimento da educacao basica|fundo de manutencao e desenvolviment"
P_ROYALTIES = r"compensac(ao|oes) financeira|recursos minerais|cfem|recursos hidricos|fundo especial do petroleo"
P_CFEM = r"recursos minerais|cfem"
P_SUS = r"sistema unico de saude|\bsus\b|programas de saude"
P_ISS = r"servicos de qualquer natureza|issqn|impostos sobre servicos"
P_IPTU = r"propriedade predial"
P_ITBI = r"inter vivos"
P_IRRF = r"imposto sobre a renda"


def analisar_receitas(rec: Receitas) -> dict:
    bruta = rec.total(COL_BRUTA)
    ded_fundeb = rec.total(COL_DED_FUNDEB)
    ded_outras = sum(
        l["valor"] for l in rec.total_linhas
        if l["cod_conta"] == "TotalReceitas" and l["coluna"] not in (COL_BRUTA, COL_DED_FUNDEB)
    )
    liquida = bruta - ded_fundeb - ded_outras

    # Grupos mutuamente exclusivos para o fluxo do dinheiro (valores líquidos).
    definicoes = [
        ("fpm", "FPM – Fundo de Participação dos Municípios", "Repasse constitucional da União (parte do IR e do IPI arrecadados no país).", rec.por_nome(P_FPM)),
        ("estado", "ICMS, IPVA e IPI (cota-parte do Estado)", "Parcela dos impostos estaduais que a Constituição destina ao município.", rec.por_nome(P_ICMS) + rec.por_nome(P_IPVA) + rec.por_nome(P_IPI)),
        ("fundeb", "FUNDEB", "Fundo da educação básica: volta ao município conforme o número de alunos matriculados.", rec.por_nome(P_FUNDEB, excluir=r"deduc")),
        ("sus", "SUS (União e Estado)", "Repasses fundo a fundo para atenção básica, vigilância e média complexidade.", rec.por_nome(P_SUS)),
        ("royalties", "Royalties (mineração, hidrelétricas, petróleo)", "Compensações financeiras pela exploração de recursos naturais (CFEM e outras).", rec.por_nome(P_ROYALTIES)),
        ("proprios", "Tributos próprios (ISS, IPTU, ITBI, taxas, COSIP)", "Impostos, taxas e contribuições cobrados diretamente pela prefeitura.", rec.por_codigo(("1", "1"), ("1", "2"))),
    ]
    grupos, usados = [], set()
    for gid, nome, desc, linhas in definicoes:
        linhas = [l for l in linhas if l["cod_conta"] not in usados]
        usados.update(l["cod_conta"] for l in linhas)
        bruto, ded = rec.soma(linhas)
        grupos.append({"id": gid, "nome": nome, "desc": desc, "bruto": r2(bruto), "deducao_fundeb": r2(ded), "liquido": r2(bruto - ded)})
    resto = liquida - sum(g["liquido"] for g in grupos)
    grupos.append({
        "id": "outras", "nome": "Outras receitas e transferências",
        "desc": "FNDE (merenda, transporte escolar), assistência social, convênios, rendimentos de aplicações e demais receitas.",
        "bruto": None, "deducao_fundeb": None, "liquido": r2(resto),
    })

    def valor(padrao, excluir=None):
        b, d = rec.soma(rec.por_nome(padrao, excluir))
        return {"bruto": r2(b), "liquido": r2(b - d)}

    destaques = {
        "fpm": valor(P_FPM),
        "icms": valor(P_ICMS),
        "ipva": valor(P_IPVA),
        "fundeb": valor(P_FUNDEB, r"deduc"),
        "cfem": valor(P_CFEM),
        "iss": valor(P_ISS),
        "iptu": valor(P_IPTU),
        "itbi": valor(P_ITBI),
        "irrf": valor(P_IRRF),
    }

    # Árvore completa para a tabela detalhada.
    arvore = []
    for l in rec.bruta:
        s = segmentos(l["cod_conta"])
        if not s:
            continue
        arvore.append({
            "codigo": ".".join(s),
            "nivel": len(s),
            "nome": nome_conta(l["conta"]),
            "bruto": r2(l["valor"]),
            "deducao": r2(rec.deducoes.get(l["cod_conta"], 0.0)) or 0,
        })

    proprios = next(g for g in grupos if g["id"] == "proprios")["liquido"]
    return {
        "bruta": r2(bruta),
        "deducoes_fundeb": r2(ded_fundeb),
        "outras_deducoes": r2(ded_outras),
        "liquida": r2(liquida),
        "correntes": r2(sum(l["valor"] for l in rec.por_codigo(("1",)))),
        "capital": r2(sum(l["valor"] for l in rec.por_codigo(("2",)))),
        "proprios_pct": r2(proprios / liquida * 100) if liquida else None,
        "grupos": grupos,
        "destaques": destaques,
        "arvore": arvore,
    }


# --------------------------------------------------------------------------
# Despesas
# --------------------------------------------------------------------------

GRUPOS_NATUREZA = {
    ("3", "1"): "Pessoal e encargos sociais",
    ("3", "2"): "Juros e encargos da dívida",
    ("3", "3"): "Outras despesas correntes (custeio)",
    ("4", "4"): "Investimentos (obras e equipamentos)",
    ("4", "5"): "Inversões financeiras",
    ("4", "6"): "Amortização da dívida",
}


def _col(linhas, coluna):
    return [l for l in linhas if l["coluna"] == coluna]


def analisar_despesas(anexo_d: list[dict], anexo_e: list[dict]) -> dict:
    def total(coluna):
        return sum(l["valor"] for l in anexo_d if l["cod_conta"] == "TotalDespesas" and l["coluna"] == coluna)

    def total_rp(prefixo):
        return sum(l["valor"] for l in anexo_d if l["cod_conta"] == "TotalDespesas" and l["coluna"].startswith(prefixo))

    resumo = {
        "empenhada": r2(total(COL_EMP)),
        "liquidada": r2(total(COL_LIQ)),
        "paga": r2(total(COL_PAG)),
        "rp_processados_inscritos": r2(total_rp("Inscrição de Restos a Pagar Processados")),
        "rp_nao_processados_inscritos": r2(total_rp("Inscrição de Restos a Pagar Não Processados")),
    }

    # Natureza: grupos e elementos (somando modalidades de aplicação).
    naturezas, elementos = [], {}
    por_coluna = {c: _col(anexo_d, c) for c in (COL_EMP, COL_LIQ, COL_PAG)}
    for seg, nome in GRUPOS_NATUREZA.items():
        valores = {}
        for c, linhas in por_coluna.items():
            valores[c] = sum(l["valor"] for l in linhas if l["cod_conta"].startswith("DO") and segmentos(l["cod_conta"]) == seg)
        if any(valores.values()):
            naturezas.append({
                "codigo": ".".join(seg), "nome": nome,
                "empenhado": r2(valores[COL_EMP]), "liquidado": r2(valores[COL_LIQ]), "pago": r2(valores[COL_PAG]),
            })
    for c, linhas in por_coluna.items():
        for l in linhas:
            s = segmentos(l["cod_conta"]) if l["cod_conta"].startswith("DO") else ()
            if len(s) == 4 and (s[0], s[1]) in GRUPOS_NATUREZA:
                chave = f"{s[0]}.{s[1]}.{s[3]}"
                e = elementos.setdefault(chave, {
                    "codigo": chave, "grupo": f"{s[0]}.{s[1]}", "nome": nome_conta(l["conta"]),
                    "empenhado": 0.0, "liquidado": 0.0, "pago": 0.0,
                })
                campo = {COL_EMP: "empenhado", COL_LIQ: "liquidado", COL_PAG: "pago"}[c]
                e[campo] += l["valor"]
    elementos_lista = sorted(
        ({**e, "empenhado": r2(e["empenhado"]), "liquidado": r2(e["liquidado"]), "pago": r2(e["pago"])} for e in elementos.values()),
        key=lambda e: -e["empenhado"],
    )

    # Funções e subfunções (Anexo I-E). Os nomes trazem o código: "10 - Saúde", "10.301 - Atenção Básica".
    funcoes: dict[str, dict] = {}
    rx_fun = re.compile(r"^(\d{2})\s*-\s*(.+)$")
    rx_sub = re.compile(r"^(\d{2})\.(\d{3})\s*-\s*(.+)$")
    rx_demais = re.compile(r"^FU(\d{2})\s*-\s*(.+)$")
    campos = {COL_EMP: "empenhado", COL_LIQ: "liquidado", COL_PAG: "pago"}
    intra = 0.0
    for l in anexo_e:
        campo = campos.get(l["coluna"])
        if not campo:
            continue
        conta = l["conta"].strip()
        if campo == "empenhado" and norm(conta).startswith("despesas intra"):
            intra += l["valor"]
        m = rx_fun.match(conta)
        if m:
            f = funcoes.setdefault(m.group(1), {"codigo": m.group(1), "nome": m.group(2).strip(), "empenhado": 0.0, "liquidado": 0.0, "pago": 0.0, "subfuncoes": {}})
            f[campo] += l["valor"]
            continue
        m = rx_sub.match(conta) or rx_demais.match(conta)
        if m:
            fcod = m.group(1)
            if len(m.groups()) == 3:
                scod, snome = m.group(2), m.group(3).strip()
            else:
                scod, snome = "demais", "Demais subfunções"
            f = funcoes.setdefault(fcod, {"codigo": fcod, "nome": "", "empenhado": 0.0, "liquidado": 0.0, "pago": 0.0, "subfuncoes": {}})
            sf = f["subfuncoes"].setdefault(scod, {"codigo": scod, "nome": snome, "empenhado": 0.0, "liquidado": 0.0, "pago": 0.0})
            sf[campo] += l["valor"]

    funcoes_lista = []
    for f in funcoes.values():
        subs = sorted(
            ({**s, "empenhado": r2(s["empenhado"]), "liquidado": r2(s["liquidado"]), "pago": r2(s["pago"])} for s in f["subfuncoes"].values()),
            key=lambda s: -s["empenhado"],
        )
        funcoes_lista.append({**f, "empenhado": r2(f["empenhado"]), "liquidado": r2(f["liquidado"]), "pago": r2(f["pago"]), "subfuncoes": subs})
    funcoes_lista.sort(key=lambda f: -f["empenhado"])

    return {**resumo, "naturezas": naturezas, "elementos": elementos_lista, "funcoes": funcoes_lista, "intra_empenhada": r2(intra)}


# --------------------------------------------------------------------------
# Indicadores oficiais (RREO e RGF simplificados) e balanço
# --------------------------------------------------------------------------

def _busca(linhas, conta_rx, coluna_rx=None):
    rc = re.compile(conta_rx)
    rcol = re.compile(coluna_rx) if coluna_rx else None
    for l in linhas:
        if rc.search(norm(l["conta"])) and (rcol is None or rcol.search(norm(l["coluna"]))):
            return l["valor"]
    return None


def analisar_indicadores(rreo: list[dict], rgf: list[dict]) -> dict:
    deficit = _busca(rreo, r"^deficit orcamentario")
    superavit = _busca(rreo, r"^superavit orcamentario")
    resultado = None
    if superavit is not None:
        resultado = superavit
    elif deficit is not None:
        resultado = -deficit

    def pct(conta_rx):
        return _busca(rreo, conta_rx, r"% aplicado")

    def minimo(conta_rx):
        return _busca(rreo, conta_rx, r"% minimo")

    rx_mde, rx_fundeb, rx_asps = r"receitas de impostos na manutencao", r"fundeb na remuneracao", r"servicos (publicos|oublicos) de saude"
    mde, mde_min = pct(rx_mde), minimo(rx_mde)
    fundeb, fundeb_min = pct(rx_fundeb), minimo(rx_fundeb)
    asps, asps_min = pct(rx_asps), minimo(rx_asps)
    inconsistencias = []

    # O próprio município às vezes preenche linhas trocadas no RREO. O "% mínimo"
    # legal de cada linha (25% MDE, 60/70% FUNDEB, 15% saúde) denuncia a troca.
    if mde_min in (60, 70) and fundeb_min == 25:
        mde, fundeb = fundeb, mde
        mde_min, fundeb_min = fundeb_min, mde_min
        inconsistencias.append(
            "No RREO enviado, as linhas de Educação (MDE, mínimo de 25%) e FUNDEB (mínimo de 60/70%) "
            "estão trocadas. Os valores foram exibidos nas linhas corretas."
        )
    if asps_min is not None and asps_min != 15:
        inconsistencias.append(
            f"No RREO enviado, a linha de Saúde (mínimo legal de 15%) repete os valores de outra linha "
            f"(mínimo declarado de {asps_min:g}% e aplicado de {asps:g}%). O índice de saúde deste ano não é confiável."
        )
        asps, asps_min = None, 15
    if asps is None and not any("Saúde" in i for i in inconsistencias):
        inconsistencias.append("O RREO deste ano não traz o percentual aplicado em Saúde (ASPS).")

    return {
        "receitas_realizadas": r2(_busca(rreo, r"^receitas realizadas")),
        "despesas_empenhadas": r2(_busca(rreo, r"^despesas empenhadas")),
        "previsao_atualizada": r2(_busca(rreo, r"^previsao atualizada")),
        "dotacao_atualizada": r2(_busca(rreo, r"^dotacao atualizada")),
        "resultado_orcamentario": r2(resultado),
        "resultado_primario": r2(_busca(rreo, r"^resultado primario", r"apurad")),
        "rcl": r2(_busca(rgf, r"^receita corrente liquida$") or _busca(rreo, r"^receita corrente liquida$")),
        "mde_pct": mde,
        "mde_min": mde_min,
        "fundeb_profissionais_pct": fundeb,
        "fundeb_profissionais_min": fundeb_min,
        "asps_pct": asps,
        "asps_min": asps_min,
        "inconsistencias": inconsistencias,
        "pessoal_valor": r2(_busca(rgf, r"^despesa total com pessoal", r"^valor$")),
        "pessoal_pct": _busca(rgf, r"^despesa total com pessoal", r"% sobre"),
        "pessoal_limite": _busca(rgf, r"^limite maximo", r"% sobre"),
        "pessoal_prudencial": _busca(rgf, r"^limite prudencial", r"% sobre"),
        "pessoal_alerta": _busca(rgf, r"^limite de alerta", r"% sobre"),
        "divida_consolidada_liquida": r2(_busca(rgf, r"^divida consolidada liquida")),
        "divida_limite": r2(_busca(rgf, r"^limite definido por resolucao")),
        "rp_nao_processados_inscritos": r2(_busca(rreo, r"^restos a pagar nao processados$", r"^inscricao")),
        "rp_nao_processados_cancelados": r2(_busca(rreo, r"^restos a pagar nao processados$", r"^cancelamento")),
        "rp_nao_liquidados": r2(_busca(rgf, r"^valor total", r"nao liquidad")),
        "caixa_liquida_apos_rp": r2(_busca(rgf, r"^valor total", r"disponibilidade de caixa")),
    }


def analisar_balanco(anexo_ab: list[dict]) -> dict:
    def conta(rx):
        for l in anexo_ab:
            if re.search(rx, norm(l["conta"])):
                return r2(l["valor"])
        return None

    return {
        "caixa": conta(r"^1\.1\.1\.0\.0\.00\.00 - caixa e equivalentes"),
        "ativo": conta(r"^1\.0\.0\.0\.0\.00\.00 - ativo$"),
        "passivo_circulante": conta(r"^2\.1\.0\.0\.0\.00\.00 - passivo circulante"),
        "divida_ativa_tributaria": conta(r"^1\.1\.2\.5\.0\.00\.00 - divida ativa tributaria"),
    }


# --------------------------------------------------------------------------
# IPCA
# --------------------------------------------------------------------------

def deflatores(anos: list[int]) -> dict:
    """Fatores para levar valores nominais de cada ano a preços médios do último ano."""
    serie = siconfi.bcb_serie(433)
    indice, acumulado = {}, 1.0
    por_ano: dict[int, list[float]] = {}
    for p in serie:
        d, m, a = p["data"].split("/")
        acumulado *= 1 + float(p["valor"]) / 100
        indice[(int(a), int(m))] = acumulado
        por_ano.setdefault(int(a), []).append(acumulado)
    medias = {a: sum(v) / len(v) for a, v in por_ano.items() if len(v) == 12}
    base = max(a for a in anos if a in medias)
    return {"ano_base": base, "fatores": {str(a): round(medias[base] / medias[a], 6) for a in anos if a in medias}}


# --------------------------------------------------------------------------
# Montagem
# --------------------------------------------------------------------------

def coletar_ano(ano: int, ibge: int, refresh: bool, completo: bool = True,
                populacao: dict[int, tuple[int, str]] | None = None) -> dict | None:
    anexo_c = siconfi.dca(ano, "DCA-Anexo I-C", ibge, refresh)
    if not anexo_c:
        return None
    anexo_d = siconfi.dca(ano, "DCA-Anexo I-D", ibge, refresh)
    anexo_e = siconfi.dca(ano, "DCA-Anexo I-E", ibge, refresh)
    rreo = siconfi.rreo_simplificado(ano, ibge, refresh)
    rgf = siconfi.rgf_simplificado(ano, ibge, refresh) or siconfi.rgf_completo_pessoal(ano, ibge, refresh)
    if populacao and ano in populacao:
        pop, fonte_pop = populacao[ano]
    else:
        pop = next((l.get("populacao") for l in anexo_c if l.get("populacao")), None)
        fonte_pop = "SICONFI (população declarada)"

    receitas = analisar_receitas(Receitas(anexo_c))
    despesas = analisar_despesas(anexo_d, anexo_e)
    indicadores = analisar_indicadores(rreo, rgf)
    resultado_calc = receitas["liquida"] - despesas["empenhada"]

    dado = {
        "ano": ano,
        "populacao": pop,
        "populacao_fonte": fonte_pop,
        "receita": receitas,
        "despesa": despesas,
        "indicadores": indicadores,
        "resultado_orcamentario": r2(resultado_calc),
    }
    if completo:
        dado["balanco"] = analisar_balanco(siconfi.dca(ano, "DCA-Anexo I-AB", ibge, refresh))
    else:
        dado["receita"].pop("arvore")
        dado["despesa"].pop("elementos")
        for f in dado["despesa"]["funcoes"]:
            f.pop("subfuncoes")
    return dado


def validar(d: dict, rotulo: str) -> list[str]:
    """Confere os totais derivados contra os totais oficiais. Retorna avisos."""
    avisos = []
    rec, desp, ind = d["receita"], d["despesa"], d["indicadores"]

    def perto(a, b, tol=1.0):
        return a is not None and b is not None and abs(a - b) <= tol

    soma_grupos = sum(g["liquido"] for g in rec["grupos"])
    if not perto(soma_grupos, rec["liquida"]):
        raise ValueError(f"{rotulo}: grupos de receita ({soma_grupos}) ≠ receita líquida ({rec['liquida']})")
    if min(g["liquido"] for g in rec["grupos"]) < -1:
        raise ValueError(f"{rotulo}: grupo de receita negativo — classificação sobreposta")
    soma_nat = sum(n["empenhado"] for n in desp["naturezas"])
    if not perto(soma_nat, desp["empenhada"]):
        raise ValueError(f"{rotulo}: naturezas ({soma_nat}) ≠ despesa empenhada ({desp['empenhada']})")
    soma_fun = sum(f["empenhado"] for f in desp["funcoes"])
    alvo = desp["empenhada"] - (desp.get("intra_empenhada") or 0)
    if not (perto(soma_fun, desp["empenhada"]) or perto(soma_fun, alvo)):
        avisos.append(f"{rotulo}: funções ({soma_fun:,.2f}) ≠ despesa empenhada ({desp['empenhada']:,.2f})")
    if ind["receitas_realizadas"] is not None and not perto(ind["receitas_realizadas"], rec["liquida"], 5):
        avisos.append(f"{rotulo}: receita líquida DCA ({rec['liquida']:,.2f}) ≠ RREO ({ind['receitas_realizadas']:,.2f})")
    if ind["resultado_orcamentario"] is not None and not perto(ind["resultado_orcamentario"], d["resultado_orcamentario"], 5):
        avisos.append(f"{rotulo}: resultado DCA ({d['resultado_orcamentario']:,.2f}) ≠ RREO ({ind['resultado_orcamentario']:,.2f})")
    return avisos


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--refresh", action="store_true", help="ignora o cache e baixa tudo de novo")
    ap.add_argument("--sem-vizinhos", action="store_true", help="não baixa a comparação regional")
    args = ap.parse_args()

    ano_atual = datetime.now().year
    todos_anos = list(range(ANO_INICIAL, ano_atual + 1))
    anos, avisos = {}, []
    pop = siconfi.ibge_populacao(ENTE["ibge"], todos_anos, args.refresh)
    for ano in todos_anos:
        print(f"• Resplendor {ano}…", flush=True)
        d = coletar_ano(ano, ENTE["ibge"], args.refresh, populacao=pop)
        if d is None:
            print("  sem DCA publicada — ignorado")
            continue
        avisos += validar(d, f"Resplendor {ano}")
        anos[str(ano)] = d

    lista_anos = sorted(int(a) for a in anos)
    ipca = deflatores(lista_anos)

    vizinhos = {}
    if not args.sem_vizinhos:
        for ano in lista_anos[-ANOS_VIZINHOS:]:
            linha = {}
            for ibge, nome in VIZINHOS.items():
                print(f"• {nome} {ano}…", flush=True)
                try:
                    pop_viz = siconfi.ibge_populacao(ibge, lista_anos[-ANOS_VIZINHOS:], args.refresh)
                    d = coletar_ano(ano, ibge, args.refresh, completo=False, populacao=pop_viz)
                except Exception as exc:  # noqa: BLE001
                    avisos.append(f"{nome} {ano}: falha no download ({exc})")
                    continue
                if d is None:
                    continue
                # Divergências DCA × RREO dos vizinhos não são exibidas como aviso do app;
                # a validação estrutural (que levanta exceção) continua valendo.
                validar(d, f"{nome} {ano}")
                linha[str(ibge)] = {"nome": nome, **d}
            vizinhos[str(ano)] = linha

    saida = {
        "meta": {
            "versao": 2,
            "gerado_em": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "ente": ENTE,
            "fontes": [
                {"nome": "SICONFI – Declaração de Contas Anuais (DCA)", "url": "https://siconfi.tesouro.gov.br/siconfi/pages/public/consulta_finbra/finbra_list.jsf"},
                {"nome": "SICONFI – RREO e RGF Simplificados", "url": "https://siconfi.tesouro.gov.br/siconfi/pages/public/declaracao/declaracao_list.jsf"},
                {"nome": "API de Dados Abertos do SICONFI", "url": "https://apidatalake.tesouro.gov.br/docs/siconfi/"},
                {"nome": "Banco Central – IPCA (série SGS 433)", "url": "https://dadosabertos.bcb.gov.br/dataset/433-indice-nacional-de-precos-ao-consumidor-amplo-ipca"},
            ],
            "ipca": ipca,
            "vizinhos": {str(k): v for k, v in VIZINHOS.items()},
            "avisos": avisos,
        },
        "anos": anos,
        "vizinhos": vizinhos,
    }
    OUT.write_text(json.dumps(saida, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"\n✔ {OUT.relative_to(ROOT)} gerado ({OUT.stat().st_size / 1024:.0f} KB), anos {lista_anos[0]}–{lista_anos[-1]}")
    for a in avisos:
        print("  ⚠", a)
    return 0


if __name__ == "__main__":
    sys.exit(main())
