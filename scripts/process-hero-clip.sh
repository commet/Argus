#!/usr/bin/env bash
# ============================================================================
# process-hero-clip.sh — Argus 히어로 영상 원본 → 클린 처리 파이프라인
# ----------------------------------------------------------------------------
# 무엇을 하나: Veo/생성 원본 클립의 반짝이(sparkle) 워터마크를 "박스-only"
#              방식으로 지운다. 박스 밖은 원본과 100% 동일 → 좌측 바/더블링
#              같은 전역 아티팩트가 원리적으로 생길 수 없다.
#
# 왜 이렇게 하나 (실패에서 배운 것, 자세한 배경은 internal design notes):
#   - delogo    → 선화(line-art) 위에서 뭉갬(smudge). 금지.
#   - 밝기캡    → 반짝이의 어두운 외곽 링이 마름모로 잔존. 금지.
#   - 전체프레임 shift + pad + maskedmerge → pad의 검정이 마스크 floor(=16,
#                 limited range)를 타고 6% 새어나와 "좌측 회색 바 + 배경
#                 더블링"을 만든다. 이게 그 악명 높은 바의 정체였다. 금지.
#   - 정답     → 워터마크 박스 주변 patch만 crop → 페더 알파 → overlay back.
#                전역 레이어가 없으니 바/더블링이 생길 수 없다.
#
# 사용법:
#   scripts/process-hero-clip.sh INPUT OUTPUT [WM_X WM_Y]
#   예) scripts/process-hero-clip.sh assets/hero-originals/01.mp4 out.mp4
#       scripts/process-hero-clip.sh in.mp4 out.mp4 1158 597
#
# 기본 워터마크 위치는 (1158,597) — 지금까지 받은 Veo 원본은 전부 여기 고정.
# 새 원본이 다른 위치면 아래 "위치 자동탐지" 블록이 알려준다.
# ============================================================================
set -euo pipefail

IN="${1:?INPUT 파일 경로가 필요합니다}"
OUT="${2:?OUTPUT 파일 경로가 필요합니다}"
WMX="${3:-1158}"   # 반짝이 중심 x
WMY="${4:-597}"    # 반짝이 중심 y

command -v ffmpeg >/dev/null || { echo "ffmpeg가 필요합니다"; exit 1; }

# --- 원본 정보 ---
read -r W H DUR < <(ffprobe -v error -select_streams v:0 \
  -show_entries stream=width,height:format=duration \
  -of default=noprint_wrappers=1:nokey=1 "$IN" | paste -sd' ' -)
echo "원본: ${W}x${H}, ${DUR}s  →  $OUT"

# --- 위치 자동탐지 (참고용): 하단-우측에서 블러 후 가장 밝은 blob 위치 ---
echo "[자동탐지] 반짝이 추정 위치 (여러 시점의 밝은 blob 중앙값 근처여야 함):"
for t in 2 5 8; do
  ffmpeg -ss "$t" -i "$IN" -vframes 1 \
    -vf "format=gray,gblur=sigma=6,crop=600:400:600:250" -f rawvideo - 2>/dev/null \
  | python3 -c "
import sys;d=sys.stdin.buffer.read();w,h=600,400;mx=mi=0
for i in range(w*h):
    if d[i]>mx:mx=d[i];mi=i
print(f'  t=$t  blob@({mi%w+600},{mi//w+250})  (설정값=($WMX,$WMY))')" 2>/dev/null || true
done

# --- 처리 파라미터 ---
BOX=130                      # patch 한 변
SHIFT=80                     # 왼쪽 이웃에서 몇 px 당겨와 채울지 (반짝이 폭 > 60 이므로 80 안전)
SIG=38                       # 페더(가우시안) 시그마
DX=$(( WMX - BOX/2 ))        # dest 좌상단 x
DY=$(( WMY - BOX/2 ))        # dest 좌상단 y
SX=$(( DX - SHIFT ))         # source 좌상단 x (왼쪽 이웃 = 같은 행 → 파도선 이어짐)
SY=$DY

# --- 핵심 필터: 박스-only overlay-patch (전역 레이어 없음) ---
FC="[0:v]split[base][src];\
[src]crop=${BOX}:${BOX}:${SX}:${SY},format=yuva420p,\
geq=lum='lum(X,Y)':cb='cb(X,Y)':cr='cr(X,Y)':\
a='255*exp(-(pow(X-$((BOX/2))\,2)+pow(Y-$((BOX/2))\,2))/(2*pow(${SIG}\,2)))'[patch];\
[base][patch]overlay=${DX}:${DY}:format=yuv420"

echo "[인코딩] libx264 crf19 preset medium ..."
ffmpeg -y -i "$IN" -filter_complex "$FC" \
  -c:v libx264 -crf 19 -preset medium -pix_fmt yuv420p -movflags +faststart -an \
  "$OUT" 2>/dev/null

# --- 검증: 박스 밖은 원본과 동일해야 한다 (좌측 바/전역 오염 = 처리가 뭔가 바꿈) ---
# 주의: "Left vs Mid" 비교는 틀린 검증이다. 단일 장면은 구도상 왼쪽이 원래 어두울 수
#       있고(판화 테두리/여백=콘텐츠), 그건 원본에도 있다. 올바른 불변식은
#       "출력의 좌측 = 입력의 좌측"(처리가 박스 밖을 안 건드렸는가) 이다.
echo "[검증] 박스 밖 무변화 — 출력 좌측/모서리 밝기가 원본과 같아야 함:"
probe() { ffmpeg -ss 2 -i "$1" -vframes 1 -vf "crop=$2,signalstats,metadata=print:key=lavfi.signalstats.YAVG" -f null - 2>&1|grep -o 'YAVG=[0-9.]*'|head -1|cut -d= -f2; }
ok=1
for region in "8:680:2:20|좌측" "8:680:1270:20|우측" "1240:8:20:2|상단" "1240:8:20:710|하단"; do
  crop="${region%|*}"; name="${region#*|}"
  a=$(probe "$IN" "$crop"); b=$(probe "$OUT" "$crop")
  d=$(awk -v a="$a" -v b="$b" 'BEGIN{d=a-b; if(d<0)d=-d; printf "%.1f", d}')
  flag=$(awk -v d="$d" 'BEGIN{print (d<=2.5)?"✅":"⚠️"}')
  [ "$flag" = "⚠️" ] && ok=0
  echo "  $name: 원본=$a 출력=$b (차 $d) $flag"
done
[ "$ok" = 1 ] && echo "  ✅ 박스 밖 원본과 동일 — 좌측 바/더블링 없음" \
             || echo "  ⚠️  박스 밖이 바뀜 — 전역 레이어가 새고 있음(박스-only인지 확인)"

echo "완료: $OUT"
