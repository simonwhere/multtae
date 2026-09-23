#!/usr/bin/env bash
# 스토어 스크린샷 한 장 찍기 (SPEC.md 17.1).
#
#   store/shot.sh 1-today
#
# 켜져 있는 시뮬레이터 화면을 찍어 store/screenshots/ 에 둔다. 원본과 함께
# 앱스토어 6.9인치(1320×2868) 크기로 맞춘 파일도 만든다. 비율이 거의 같아
# 늘어나 보이지 않지만, 제출용은 6.9인치 기기(예: iPhone 17 Pro Max)에서
# 찍는 것이 가장 깨끗하다.
#
# 찍기 전에:
#   1. 개발 빌드로 켠다. Expo Go 는 오른쪽 아래에 개발용 버튼이 찍힌다
#   2. xcrun simctl status_bar booted override --time "9:41" --batteryState charged \
#        --batteryLevel 100 --cellularBars 4 --wifiBars 3
#   3. 다 찍고 나면 xcrun simctl status_bar booted clear
set -euo pipefail

name="${1:-}"
if [ -z "$name" ]; then
  echo "쓰는 법: store/shot.sh <이름>   예: store/shot.sh 1-today"
  exit 1
fi

dir="$(cd "$(dirname "$0")" && pwd)/screenshots"
mkdir -p "$dir"

raw="$dir/$name.png"
xcrun simctl io booted screenshot --type=png "$raw"

python3 - "$raw" "$dir/$name@6.9.png" <<'PY'
import sys
from PIL import Image

source, target = sys.argv[1], sys.argv[2]
image = Image.open(source)
# 앱스토어 6.9인치 세로
image.resize((1320, 2868), Image.LANCZOS).save(target)
print(f"{source} {image.size} → {target} (1320, 2868)")
PY
