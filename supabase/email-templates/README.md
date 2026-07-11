# Argus 인증 이메일 템플릿

Supabase가 보내는 **회원가입 확인 메일**을 브랜드 있게 바꾸는 템플릿입니다.
(기본 템플릿은 "Confirm your signup / Confirm your mail" 한 줄짜리라 성의 없고 사기 메일처럼
보입니다 — 이 파일이 그걸 대체합니다.)

## 적용 방법 (5분, 코드 배포 불필요)

이 메일은 **앱 코드가 아니라 Supabase 설정**에서 보내므로, 대시보드에서 한 번 붙여넣으면 됩니다.

1. **Supabase 대시보드** 접속 → 본인 프로젝트 선택.
2. 왼쪽 메뉴 **Authentication** → **Emails**(또는 **Email Templates**).
3. **Confirm signup** 탭 선택.
4. **Subject(제목)** 를 이렇게 바꾸기:
   ```
   이메일만 확인하면 출항 — Argus
   ```
5. **Message body** 를 **HTML** 모드로 두고, 기존 내용을 다 지운 뒤
   [`confirm-signup.html`](./confirm-signup.html) 파일 내용을 **통째로 복사해서 붙여넣기**.
6. **Save**. 끝. (새로 가입해보면 바뀐 메일이 옵니다.)

## 주의

- 템플릿 안의 `{{ .ConfirmationURL }}`(확인 링크)와 `{{ .SiteURL }}`(홈 주소)는 **Supabase가
  자동으로 채우는 변수**입니다. 그대로 두세요 — 지우면 링크가 깨집니다.
- `{{ .SiteURL }}`이 `argus.voyage`로 나오려면 **Authentication → URL Configuration → Site URL**
  이 운영 주소로 설정돼 있어야 합니다. (확인 링크가 `localhost`로 가면 여기가 잘못된 것.)
- 메일이 아예 안 오면 템플릿 문제가 아니라 **SMTP 설정**(Authentication → Emails → SMTP
  Settings, Resend 연결) 문제입니다. 도메인 `argus.voyage`는 이미 인증됨.

## 톤 / 디자인

로그북 정체성(양피지 `#ece5d8` · 잉크 `#2b2620` · 절제된 금색 `#96782e`)을 메일로 옮긴 것.
- `A` 금색 배지 + `Argus` serif 워드마크 (앱/랜딩과 동일).
- 단색 금색 버튼 (그라데이션 X — Outlook에서 깨지지 않게).
- table 기반 + 인라인 스타일 (Gmail/Outlook/애플 메일 호환).
- 푸터에 홈 링크(`argus.voyage`) + "가입 안 했으면 무시" 보안 안내(피싱 신뢰 신호).

## 비밀번호 재설정 메일도 같은 톤으로 (이미 만들어 둠)

[`reset-password.html`](./reset-password.html) — 같은 로그북 디자인의 **비밀번호 재설정** 메일.
적용법은 위와 동일하되 탭만 다릅니다:

1. **Authentication → Email Templates → "Reset password"** 탭 선택.
2. **Subject** 를 `비밀번호 재설정 — Argus` 로.
3. **Message body(HTML)** 에 `reset-password.html` 내용을 통째로 붙여넣기 → **Save**.

(변수는 `{{ .ConfirmationURL }}`(재설정 링크) + `{{ .SiteURL }}` 로 confirm 메일과 동일.)

## 그 밖의 인증 메일 (Magic Link 등)

같은 패턴으로 **Magic Link**, **Email change** 템플릿도 만들 수 있습니다. `confirm-signup.html`
을 복사해 제목/본문 문구만 바꾸면 됩니다(버튼 변수 동일). 요청하면 추가로 만들어 드립니다.
