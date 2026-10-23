"""Testes do pipeline de dados (sem rede). Rode com: python -m unittest discover tests"""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))

import build_data as b  # noqa: E402


def linha(cod, conta, valor, coluna=b.COL_BRUTA):
    return {"cod_conta": cod, "conta": conta, "valor": valor, "coluna": coluna}


class Utilitarios(unittest.TestCase):
    def test_segmentos_remove_zeros_finais(self):
        self.assertEqual(b.segmentos("RO1.7.1.1.51.0.0"), ("1", "7", "1", "1", "51"))
        self.assertEqual(b.segmentos("RO1.3.1.0.01.0.0"), ("1", "3", "1", "0", "01"))
        self.assertEqual(b.segmentos("DO3.1.90.11.00.00"), ("3", "1", "90", "11"))

    def test_norm(self):
        self.assertEqual(b.norm("Saúde ¿ SUS"), "saude - sus")

    def test_topo_descarta_descendentes(self):
        linhas = [
            linha("RO1.7.1.1.51.0.0", "FPM", 100),
            linha("RO1.7.1.1.51.1.0", "FPM cota mensal", 90),
            linha("RO1.7.1.8.01.3.0", "FPM 1% julho", 5),
        ]
        self.assertEqual([l["cod_conta"] for l in b.topo(linhas)], ["RO1.7.1.1.51.0.0", "RO1.7.1.8.01.3.0"])


class Receitas(unittest.TestCase):
    def setUp(self):
        self.linhas = [
            linha("TotalReceitas", "Total", 1000),
            linha("TotalReceitas", "Total", 100, b.COL_DED_FUNDEB),
            linha("RO1.0.0.0.00.0.0", "1.0 - Receitas Correntes", 1000),
            linha("RO1.1.0.0.00.0.0", "1.1 - Impostos", 80),
            linha("RO1.7.1.1.51.0.0", "1.7.1.1.51.0.0 - Cota-Parte do Fundo de Participação dos Municípios - FPM", 500),
            linha("RO1.7.1.1.51.0.0", "FPM", 100, b.COL_DED_FUNDEB),
            linha("RO1.7.1.1.51.1.0", "1.7.1.1.51.1.0 - Cota-Parte do Fundo de Participação dos Municípios - Cota Mensal", 480),
            linha("RO1.7.5.1.00.0.0", "1.7.5.1 - Transferências de Recursos do Fundo de Manutenção e Desenvolvimento da Educação Básica - FUNDEB", 300),
            linha("RO1.9.0.0.00.0.0", "1.9 - Outras Receitas Correntes", 120),
        ]

    def test_grupos_fecham_com_receita_liquida_sem_dupla_contagem(self):
        r = b.analisar_receitas(b.Receitas(self.linhas))
        self.assertEqual(r["liquida"], 900)
        g = {x["id"]: x["liquido"] for x in r["grupos"]}
        self.assertEqual(g["fpm"], 400)  # bruto 500 − dedução 100; a subconta não soma de novo
        self.assertEqual(g["fundeb"], 300)
        self.assertEqual(g["proprios"], 80)
        self.assertAlmostEqual(sum(g.values()), 900)


class Indicadores(unittest.TestCase):
    def rreo(self, mde_min, mde, fundeb_min, fundeb, asps_min=15, asps=20):
        def l(conta, coluna, valor):
            return {"conta": conta, "coluna": coluna, "valor": valor}
        return [
            l("Mínimo Anual de <18% / 25%> das Receitas de Impostos na Manutenção e Desenvolvimento do Ensino", "% Mínimo a Aplicar no Exercício", mde_min),
            l("Mínimo Anual de <18% / 25%> das Receitas de Impostos na Manutenção e Desenvolvimento do Ensino", "% Aplicado Até o Bimestre", mde),
            l("Mínimo Anual de 70% do FUNDEB na Remuneração dos Profissionais da Educação Básica", "% Mínimo a Aplicar no Exercício", fundeb_min),
            l("Mínimo Anual de 70% do FUNDEB na Remuneração dos Profissionais da Educação Básica", "% Aplicado Até o Bimestre", fundeb),
            l("Despesas com Ações e Serviços Públicos de Saúde Executadas com Recursos de Impostos", "% Mínimo a Aplicar no Exercício", asps_min),
            l("Despesas com Ações e Serviços Públicos de Saúde Executadas com Recursos de Impostos", "% Aplicado Até o Bimestre", asps),
            l("Déficit Orçamentário", "Até o Bimestre", 10),
        ]

    def test_declaracao_correta(self):
        i = b.analisar_indicadores(self.rreo(25, 26.0, 70, 80.0), [])
        self.assertEqual((i["mde_pct"], i["fundeb_profissionais_pct"], i["asps_pct"]), (26.0, 80.0, 20))
        self.assertEqual(i["resultado_orcamentario"], -10)
        self.assertEqual(i["inconsistencias"], [])

    def test_linhas_trocadas_sao_corrigidas_e_sinalizadas(self):
        i = b.analisar_indicadores(self.rreo(70, 90.9, 25, 26.6), [])
        self.assertEqual((i["mde_pct"], i["mde_min"]), (26.6, 25))
        self.assertEqual((i["fundeb_profissionais_pct"], i["fundeb_profissionais_min"]), (90.9, 70))
        self.assertEqual(len(i["inconsistencias"]), 1)

    def test_saude_duplicada_vira_nao_confiavel(self):
        i = b.analisar_indicadores(self.rreo(25, 26.9, 70, 76.5, asps_min=70, asps=76.5), [])
        self.assertIsNone(i["asps_pct"])
        self.assertTrue(any("Saúde" in t for t in i["inconsistencias"]))


if __name__ == "__main__":
    unittest.main()
