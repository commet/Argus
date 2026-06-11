# argus-watch 훅 (opt-in)

> 세션 시작 = due 인사("그래서, 어떻게 됐어요?"), 세션 끝 = 수확 넛지.
> **둘 다 침묵이 기본이다** — 말할 게 있을 때만 한 줄. 자동 설치하지 않는다;
> 원하면 아래를 `~/.claude/settings.json`의 `hooks`에 직접 붙여 넣는다.

```jsonc
{
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            // 확인일 된 결정이 있을 때만 출력 (--quiet: 없으면 완전 침묵)
            "command": "node <repo>/tools/argus-watch/cli.mjs due --quiet"
          }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            // due 있으면 그것만, 없고 새 대화가 쌓였으면 수확 제안 한 줄, 아니면 침묵.
            // LLM 호출 없음 — 파일 상태 비교만 (수 ms).
            "command": "node <repo>/tools/argus-watch/cli.mjs nudge"
          }
        ]
      }
    ]
  }
}
```

`<repo>`는 이 저장소의 절대 경로로 치환.

## 규율

- 같은 정보를 두 번 말하지 않는다: nudge는 due가 있으면 due 안내만 하고 수확
  제안은 생략한다.
- scan(LLM 호출)을 훅에서 자동 실행하지 않는다 — 제안만 한다. 수확은 항상
  사용자의 손으로 (`argus-watch scan`).
- 거슬리면 settings에서 두 줄 지우면 끝 — 다른 흔적 없음.
