"""Gera os ícones PNG do PWA e a imagem de compartilhamento (Open Graph).

A imagem de compartilhamento traz os números do exercício mais recente, então
deve ser regenerada sempre que data/resplendor.json mudar:

    python scripts/gerar_imagens.py
"""

from __future__ import annotations

import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "assets"
AZUL_ESCURO, AZUL = (30, 58, 138), (42, 120, 214)


def fonte(tamanho: int, negrito: bool = False) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    candidatas = (
        ["segoeuib.ttf", "DejaVuSans-Bold.ttf", "arialbd.ttf"] if negrito else ["segoeui.ttf", "DejaVuSans.ttf", "arial.ttf"]
    )
    for nome in candidatas:
        try:
            return ImageFont.truetype(nome, tamanho)
        except OSError:
            continue
    return ImageFont.load_default()


def gradiente(w: int, h: int) -> Image.Image:
    img = Image.new("RGB", (w, h))
    px = img.load()
    for y in range(h):
        for x in range(w):
            t = (x / w + y / h) / 2
            px[x, y] = tuple(int(a + (b - a) * t) for a, b in zip(AZUL_ESCURO, AZUL))
    return img


def logo(draw: ImageDraw.ImageDraw, x: float, y: float, s: float, largura: int) -> None:
    """Três camadas (o mesmo desenho do icon.svg), em escala s sobre uma caixa de 64."""
    p = lambda px, py: (x + px * s, y + py * s)  # noqa: E731
    draw.line([p(32, 12), p(12, 22), p(32, 32), p(52, 22), p(32, 12)], fill="white", width=largura, joint="curve")
    draw.line([p(12, 42), p(32, 52), p(52, 42)], fill="white", width=largura, joint="curve")
    draw.line([p(12, 32), p(32, 42), p(52, 32)], fill="white", width=largura, joint="curve")


def icone(tamanho: int) -> None:
    img = gradiente(tamanho, tamanho)
    mascara = Image.new("L", (tamanho, tamanho), 0)
    ImageDraw.Draw(mascara).rounded_rectangle([0, 0, tamanho, tamanho], radius=int(tamanho * 0.22), fill=255)
    fundo = Image.new("RGBA", (tamanho, tamanho), (0, 0, 0, 0))
    fundo.paste(img, (0, 0), mascara)
    logo(ImageDraw.Draw(fundo), 0, 0, tamanho / 64, max(2, int(tamanho * 0.07)))
    fundo.save(ASSETS / f"icon-{tamanho}.png")


def og_image() -> None:
    data = json.loads((ROOT / "data" / "resplendor.json").read_text(encoding="utf-8"))
    ano = max(data["anos"])
    d = data["anos"][ano]
    rec, desp, res = d["receita"]["liquida"], d["despesa"]["empenhada"], d["resultado_orcamentario"]

    def mi(v: float) -> str:
        return f"R$ {abs(v) / 1e6:,.1f} mi".replace(",", "X").replace(".", ",").replace("X", ".")

    W, H = 1200, 630
    img = gradiente(W, H)
    dr = ImageDraw.Draw(img)
    logo(dr, 70, 60, 1.6, 7)
    dr.text((190, 72), "Transparência Resplendor", font=fonte(52, True), fill="white")
    dr.text((192, 136), "Prefeitura de Resplendor / MG · dados oficiais do Tesouro Nacional", font=fonte(26), fill=(219, 234, 254))
    dr.text((70, 230), "Para onde vai o dinheiro público?", font=fonte(60, True), fill="white")

    caixas = [("Arrecadou", mi(rec)), ("Comprometeu", mi(desp)), ("Superávit" if res >= 0 else "Déficit", mi(res))]
    x = 70
    for rotulo, valor in caixas:
        dr.rounded_rectangle([x, 350, x + 340, 520], radius=22, fill=(255, 255, 255))
        dr.text((x + 28, 375), f"{rotulo} em {ano}", font=fonte(26), fill=(51, 65, 85))
        dr.text((x + 28, 424), valor, font=fonte(48, True), fill=(15, 23, 42))
        x += 370
    dr.text((70, 560), "Receitas · despesas · limites da LRF · comparação com vizinhos", font=fonte(26), fill=(219, 234, 254))
    img.save(ASSETS / "og-image.png", optimize=True)


if __name__ == "__main__":
    ASSETS.mkdir(exist_ok=True)
    for t in (192, 512):
        icone(t)
    og_image()
    print("✔ ícones e imagem de compartilhamento gerados em assets/")
