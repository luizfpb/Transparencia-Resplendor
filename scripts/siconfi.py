"""Cliente mínimo da API de dados abertos do SICONFI (Tesouro Nacional) e do BCB.

Documentação: https://apidatalake.tesouro.gov.br/docs/siconfi/
Todas as respostas são guardadas em .cache/ para que a reconstrução seja
reprodutível e não sobrecarregue a API.
"""

from __future__ import annotations

import gzip
import hashlib
import json
import time
import urllib.parse
import urllib.request
from pathlib import Path

BASE = "https://apidatalake.tesouro.gov.br/ords/siconfi/tt"
BCB_SGS = "https://api.bcb.gov.br/dados/serie/bcdata.sgs.{serie}/dados?formato=json"
CACHE_DIR = Path(__file__).resolve().parent.parent / ".cache"
USER_AGENT = "TransparenciaResplendor/2.0 (+controle social; dados abertos)"

_last_request = 0.0


def _get_json(url: str, retries: int = 4) -> dict | list:
    global _last_request
    for attempt in range(retries):
        # A API do Tesouro limita a taxa de requisições; 1 req/s é seguro.
        wait = 1.0 - (time.time() - _last_request)
        if wait > 0:
            time.sleep(wait)
        _last_request = time.time()
        try:
            req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
            with urllib.request.urlopen(req, timeout=90) as resp:
                corpo = resp.read()
                # O IBGE responde em gzip mesmo sem Accept-Encoding.
                if corpo[:2] == b"\x1f\x8b":
                    corpo = gzip.decompress(corpo)
                return json.loads(corpo.decode("utf-8"))
        except Exception as exc:  # noqa: BLE001 - rede instável, tenta de novo
            if attempt == retries - 1:
                raise RuntimeError(f"Falha ao buscar {url}: {exc}") from exc
            time.sleep(2 ** attempt * 2)
    raise AssertionError("inalcançável")


def _cached(key: str, fetch, refresh: bool = False):
    CACHE_DIR.mkdir(exist_ok=True)
    path = CACHE_DIR / (hashlib.sha1(key.encode()).hexdigest()[:16] + ".json")
    if path.exists() and not refresh:
        return json.loads(path.read_text(encoding="utf-8"))["data"]
    data = fetch()
    path.write_text(json.dumps({"key": key, "data": data}, ensure_ascii=False), encoding="utf-8")
    return data


def siconfi(endpoint: str, refresh: bool = False, **params) -> list[dict]:
    """Busca todas as páginas de um endpoint do SICONFI."""
    query = urllib.parse.urlencode(params)
    key = f"{endpoint}?{query}"

    def fetch():
        items, offset = [], 0
        while True:
            url = f"{BASE}/{endpoint}?{query}&offset={offset}&limit=5000"
            page = _get_json(url)
            items.extend(page.get("items", []))
            if not page.get("hasMore"):
                return items
            offset += len(page.get("items", []))

    return _cached(key, fetch, refresh)


def dca(ano: int, anexo: str, ibge: int, refresh: bool = False) -> list[dict]:
    return siconfi("dca", refresh, an_exercicio=ano, no_anexo=anexo, id_ente=ibge)


def rreo_simplificado(ano: int, ibge: int, refresh: bool = False) -> list[dict]:
    return siconfi(
        "rreo", refresh, an_exercicio=ano, nr_periodo=6,
        co_tipo_demonstrativo="RREO Simplificado", no_anexo="RREO-Anexo 14", id_ente=ibge,
    )


def rgf_simplificado(ano: int, ibge: int, refresh: bool = False) -> list[dict]:
    return siconfi(
        "rgf", refresh, an_exercicio=ano, in_periodicidade="S", nr_periodo=2,
        co_tipo_demonstrativo="RGF Simplificado", no_anexo="RGF-Anexo 06",
        co_poder="E", id_ente=ibge,
    )


def rgf_completo_pessoal(ano: int, ibge: int, refresh: bool = False) -> list[dict]:
    """RGF completo (3º quadrimestre), Anexo 01 — para municípios que não usam o simplificado."""
    return siconfi(
        "rgf", refresh, an_exercicio=ano, in_periodicidade="Q", nr_periodo=3,
        co_tipo_demonstrativo="RGF", no_anexo="RGF-Anexo 01", co_poder="E", id_ente=ibge,
    )


def extrato_entregas(ano: int, ibge: int, refresh: bool = False) -> list[dict]:
    return siconfi("extrato_entregas", refresh, id_ente=ibge, an_referencia=ano)


def bcb_serie(serie: int, refresh: bool = False) -> list[dict]:
    url = BCB_SGS.format(serie=serie)
    return _cached(url, lambda: _get_json(url), refresh)


IBGE_AGREGADOS = "https://servicodados.ibge.gov.br/api/v3/agregados"


def ibge_populacao(ibge: int, anos: list[int], refresh: bool = False) -> dict[int, tuple[int, str]]:
    """População por ano: estimativa anual do IBGE (tabela 6579) ou Censo 2022 (tabela 9514).

    Para anos sem estimativa publicada (2022 e 2023), usa o Censo 2022.
    """
    periodos = "%7C".join(str(a) for a in anos)
    url_est = f"{IBGE_AGREGADOS}/6579/periodos/{periodos}/variaveis/9324?localidades=N6%5B{ibge}%5D"
    url_censo = (
        f"{IBGE_AGREGADOS}/9514/periodos/2022/variaveis/93?localidades=N6%5B{ibge}%5D"
        "&classificacao=2%5B6794%5D%7C287%5B100362%5D%7C286%5B113635%5D"
    )
    est = _cached(url_est, lambda: _get_json(url_est), refresh)
    censo = _cached(url_censo, lambda: _get_json(url_censo), refresh)
    serie_est = est[0]["resultados"][0]["series"][0]["serie"] if est else {}
    censo_2022 = int(censo[0]["resultados"][0]["series"][0]["serie"]["2022"])
    out = {}
    for a in anos:
        v = serie_est.get(str(a))
        if v and v not in ("-", "..."):
            out[a] = (int(v), "IBGE – Estimativa da população")
        elif a >= 2022:
            out[a] = (censo_2022, "IBGE – Censo Demográfico 2022")
    return out
