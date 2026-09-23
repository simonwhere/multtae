# -*- coding: utf-8 -*-
"""
앱 아이콘과 스플래시 그림을 만든다 (SPEC.md 14.4 일러스트, 16장 7-4).

마크는 앱 안에서 쓰는 잔가지(src/ui/sprig.tsx)와 같은 선이다. 색은 토큰만 쓴다
(src/ui/tokens.ts). 손으로 고치지 말고 이 파일을 고친 뒤 다시 돌린다:

    python3 scripts/icons.py
"""
from pathlib import Path

from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parent.parent / "assets" / "images"

# src/ui/tokens.ts 의 값
PAPER = (244, 246, 242)
HIGHLIGHT = (228, 237, 211)
ACCENT = (47, 95, 73)
ACCENT_DARK = (143, 199, 165)  # 다크 모드의 주색

# src/ui/sprig.tsx 의 경로 (viewBox 96×96). M 은 시작점, C 는 세제곱 베지에, Z 는 닫기
SPRIG = [
    ([(48, 92), (46, 68), (50, 42), (61, 14)], False),
    ([(47, 72), (34, 70), (26, 60), (24, 48), (38, 50), (46, 60), (47, 72)], True),
    ([(49, 60), (62, 58), (72, 48), (74, 36), (60, 38), (51, 48), (49, 60)], True),
    ([(50, 46), (38, 42), (32, 32), (32, 22), (44, 26), (50, 35), (50, 46)], True),
    ([(54, 32), (64, 30), (72, 22), (74, 12), (63, 14), (56, 22), (54, 32)], True),
]
VIEW_BOX = 96
STROKE = 1.6  # viewBox 기준. 그릴 때 함께 커진다


def curve(points, steps=48):
    """세제곱 베지에를 이어 붙인 선. points 는 [시작, 제어1, 제어2, 끝, 제어1, ...]"""
    out = []
    for i in range(0, len(points) - 1, 3):
        p0, p1, p2, p3 = points[i : i + 4]
        for step in range(steps + 1):
            t = step / steps
            u = 1 - t
            out.append(
                (
                    u**3 * p0[0] + 3 * u**2 * t * p1[0] + 3 * u * t**2 * p2[0] + t**3 * p3[0],
                    u**3 * p0[1] + 3 * u**2 * t * p1[1] + 3 * u * t**2 * p2[1] + t**3 * p3[1],
                )
            )
    return out


# 선을 매끄럽게: 네 배로 그린 뒤 줄인다
SUPERSAMPLE = 4


def sprig(size, color, stroke_scale=1.0):
    """잔가지만 그린 투명 그림. 선을 따라 둥근 붓을 찍어 이음매가 없다"""
    big = size * SUPERSAMPLE
    image = Image.new("RGBA", (big, big), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    scale = big / VIEW_BOX
    radius = max(1.0, STROKE * scale * stroke_scale / 2)

    for points, closed in SPRIG:
        line = curve(points, steps=600)
        if closed:
            line.append(line[0])
        for x, y in line:
            cx, cy = x * scale, y * scale
            draw.ellipse([cx - radius, cy - radius, cx + radius, cy + radius], fill=color)

    box = image.getbbox()
    cropped = image.crop(box)
    return cropped.resize(
        (max(1, cropped.width // SUPERSAMPLE), max(1, cropped.height // SUPERSAMPLE)),
        Image.LANCZOS,
    )


def centered(size, background, mark_color, mark_ratio=0.62, stroke_scale=1.0):
    """바탕 위에 잔가지를 가운데 놓는다. 그림의 실제 크기로 맞춘다"""
    image = Image.new("RGBA", (size, size), background)
    mark = sprig(round(size * mark_ratio), mark_color, stroke_scale)
    image.alpha_composite(mark, ((size - mark.width) // 2, (size - mark.height) // 2))
    return image


def main():
    # iOS 앱 아이콘: 새순 연두 바탕에 깊은 잎 초록 잔가지
    centered(1024, HIGHLIGHT + (255,), ACCENT, 0.66, stroke_scale=1.7).save(OUT / "icon.png")

    # 안드로이드 적응형 아이콘: 앞면은 투명 바탕에 마크만, 바깥 3분의 1은 잘릴 수 있다
    centered(432, (0, 0, 0, 0), ACCENT, 0.44, stroke_scale=1.7).save(
        OUT / "android-icon-foreground.png"
    )
    Image.new("RGBA", (432, 432), HIGHLIGHT + (255,)).save(OUT / "android-icon-background.png")
    centered(432, (0, 0, 0, 0), (0, 0, 0), 0.44, stroke_scale=1.7).save(
        OUT / "android-icon-monochrome.png"
    )

    # 스플래시: 바탕은 app.json 이 칠한다. 마크만 투명 바탕에
    for name, color in (("splash-icon.png", ACCENT), ("splash-icon-dark.png", ACCENT_DARK)):
        centered(512, (0, 0, 0, 0), color, 0.96, stroke_scale=1.5).save(OUT / name)

    print("만든 파일:", ", ".join(sorted(p.name for p in OUT.glob("*.png"))))


if __name__ == "__main__":
    main()
