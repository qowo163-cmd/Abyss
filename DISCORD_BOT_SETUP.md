# Abyss Discord 거래소 봇

## 1. DB
Railway MySQL에서 `drizzle/discord.sql`을 1회 실행합니다.

## 2. Abyss 서버 환경변수
`DISCORD_INTERNAL_SECRET`에 긴 랜덤 문자열을 추가합니다. 봇과 Abyss 서버에 **같은 값**을 넣어야 합니다.

## 3. 봇 설치
`discord-bot` 폴더에서 `pnpm install` 후 `.env`를 만들고 `pnpm start`를 실행합니다.

## 4. Discord 연동
Abyss에 로그인한 뒤 `/discord` 페이지에서 연동 코드를 생성합니다. Discord에서 `/link code:XXXXXXX`를 입력합니다.

## 5. 명령어
- `/market search` 판매 거래 조회
- `/market create` 판매 등록
- `/market mine` 내 판매글
- `/market cancel` 판매 취소
- `/exchange search` 교환글 조회
- `/exchange create` 교환 등록
- `/exchange mine` 내 교환글/제안
- `/exchange cancel` 교환 취소

사이트에서 판매/교환 요청이 발생하면 연결된 Discord 계정으로 DM 알림을 보냅니다.
