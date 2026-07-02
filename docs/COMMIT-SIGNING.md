# 커밋 서명(Verified 도장) 설정 가이드

오픈소스로 배포할 때, 당신이 만드는 커밋에 GitHub **초록색 "Verified" 도장**이
붙게 하는 방법입니다. 비개발자도 위에서 아래로 그대로 따라 하면 됩니다.

---

## 이게 뭐고, 왜 하나

- 커밋(작업 저장 기록)의 **작성자 이름은 누구나 흉내낼 수 있습니다.**
- "서명"은 **아무나 위조 못 하는 전자 인감**이라, 이게 붙으면 "진짜 이 사람이
  올린 게 맞다"고 GitHub가 초록색 **Verified**로 표시해 줍니다.
- 오픈소스에서 유지보수자(=당신)의 커밋이 위조가 아님을 보여주는 신뢰 표시입니다.

> **중요:** "Verified"는 **당신 컴퓨터 + 당신 GitHub 계정**에서만 만들 수 있습니다.
> 자동화 봇이 대신 만든 과거 커밋들이 도장 없이(Unverified) 남아 있는 것은
> 오픈소스에서 지극히 정상이며, 코드 동작에 아무 영향이 없습니다. 그대로 두세요.
> **여기부터는 앞으로 당신이 직접 만들 커밋에 도장이 붙게 하는 설정입니다.**

---

## 준비물

- 당신의 **컴퓨터**(맥/윈도우/리눅스)에 설치된 Git과 터미널
  - 맥: "터미널" 앱 / 윈도우: "Git Bash" 또는 PowerShell
- 당신의 **GitHub 계정** 로그인

---

## 1단계 — 서명용 열쇠 만들기 (컴퓨터에서, 1회)

터미널에 아래 한 줄을 붙여넣고 실행하세요. 따옴표 안은 **당신 GitHub 이메일**로 바꿉니다.

```bash
ssh-keygen -t ed25519 -C "당신이메일@example.com"
```

- "Enter file in which to save the key" → 그냥 **엔터** (기본 위치 사용)
- "Enter passphrase" → 그냥 **엔터** 두 번 (암호 없이. 원하면 넣어도 됨)

이러면 두 개의 파일이 생깁니다:
- `~/.ssh/id_ed25519` → **개인키. 절대 아무에게도 공유 금지.**
- `~/.ssh/id_ed25519.pub` → **공개키. GitHub에 등록할 것.**

> 이미 `id_ed25519.pub`가 있다면 새로 만들 필요 없이 그걸 그대로 써도 됩니다.

---

## 2단계 — 공개키를 GitHub에 "서명 키"로 등록 (⚠️ 이 단계만 당신 로그인 필요)

먼저 공개키 내용을 화면에 띄워 복사합니다.

```bash
cat ~/.ssh/id_ed25519.pub
```

출력된 `ssh-ed25519 AAAA... 당신이메일` **한 줄 전체를 복사**한 뒤:

1. GitHub 로그인 → 오른쪽 위 프로필 → **Settings**
2. 왼쪽 메뉴 → **SSH and GPG keys**
3. **New SSH key** 버튼
4. **Key type**를 반드시 **`Signing Key`** 로 선택 (기본값 Authentication 아님!)
5. **Key** 칸에 복사한 한 줄 붙여넣기 → **Add SSH key**

---

## 3단계 — Git에게 이 열쇠로 서명하라고 알려주기 (컴퓨터에서, 1회)

터미널에 아래 세 줄을 그대로 실행하세요.

```bash
git config --global gpg.format ssh
git config --global user.signingkey ~/.ssh/id_ed25519.pub
git config --global commit.gpgsign true
```

작성자 이름/이메일도 GitHub 계정과 맞춰 둡니다 (아직 안 했다면):

```bash
git config --global user.name "당신 이름"
git config --global user.email "당신이메일@example.com"
```

> **주의:** 여기 이메일은 **2단계에서 GitHub에 등록된 이메일**과 같아야 도장이
> 붙습니다. (GitHub Settings → Emails 에서 확인)

---

## 4단계 — 잘 되는지 확인

아무 변경이나 하나 커밋해서 GitHub에 올린 뒤, 그 커밋 옆에 **초록색 `Verified`**
배지가 보이면 성공입니다.

내 컴퓨터에서 바로 확인하려면:

```bash
git log -1 --show-signature
```

`Good "git" signature ...` 같은 문구가 보이면 서명이 정상적으로 들어간 것입니다.

---

## 자주 묻는 것

- **과거 커밋도 전부 Verified로 바꿔야 하나요?** 아니요. 안 바꿔도 됩니다.
  이미 여러 곳에 공유된 기록을 소급해서 다시 쓰는 건 위험하고, 오픈소스에서
  과거 커밋이 Unverified인 것은 흔하고 정상입니다.
- **암호(passphrase)를 넣었더니 커밋마다 물어봐요.** 정상입니다. 매번 묻기 싫으면
  키를 암호 없이 다시 만들거나, OS의 키체인/ssh-agent에 등록해 두면 됩니다.
- **여전히 Unverified로 떠요.** 대개 (a) GitHub에 등록할 때 Key type을
  `Signing Key`가 아니라 `Authentication`으로 골랐거나, (b) 커밋 이메일과
  GitHub 등록 이메일이 다른 경우입니다. 이 두 가지를 먼저 확인하세요.

---

*이 문서는 배포 준비용 안내입니다. 실제 서명은 당신의 컴퓨터와 GitHub 계정에서
이루어지며, 위 절차는 최초 1회만 설정하면 이후 모든 커밋에 자동 적용됩니다.*
