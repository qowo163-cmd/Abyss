# Railway 배포 성공 후 업데이트 내역 자동 등록

이 프로젝트는 Railway의 **프로젝트 Webhook**을 받아, GitHub에서 가져온 배포가 `SUCCESS`가 된 경우에만 사이트 업데이트 내역을 자동으로 등록합니다.

## 동작 순서

`GitHub Desktop Push` → `Railway 배포` → `SUCCESS` → `/api/webhooks/railway/deploy` → `site_updates` 저장 → 기존 SSE(`/api/updates/events`)로 모든 접속자에게 즉시 반영

실패한 빌드/배포는 업데이트 내역에 등록하지 않습니다.

## Railway 환경변수

Railway 서비스의 Variables에 다음을 추가합니다.

```text
RAILWAY_UPDATE_WEBHOOK_SECRET=아무도_모르는_긴_랜덤문자열
GITHUB_REPOSITORY=qowo163-cmd/Abyss
```

선택 사항:

```text
AUTO_SITE_UPDATE_ENVIRONMENT=production
AUTO_SITE_UPDATE_SERVICE=서비스이름
```

`AUTO_SITE_UPDATE_ENVIRONMENT` 또는 `AUTO_SITE_UPDATE_SERVICE`를 비워두면 해당 필터는 적용하지 않습니다. `isEphemeral=true` 환경의 배포는 자동 기록에서 제외합니다.

## Railway Webhook 설정

Railway 프로젝트 → **Settings → Webhooks → Add Webhook**에서 다음 주소를 입력합니다.

```text
https://사이트도메인/api/webhooks/railway/deploy?secret=위에서_설정한_RAILWAY_UPDATE_WEBHOOK_SECRET
```

이 프로젝트에서는 Railway의 배포 상태 변경 Webhook을 사용하므로 **배포 상태 이벤트**만 선택해도 됩니다. 테스트 Webhook은 인증된 실제 배포 성공을 대신하지 않으므로, 설정 후 실제 GitHub Push → Railway 성공 배포로 확인하는 것이 안전합니다.

## 업데이트 제목/내용 생성 규칙

- 제목: GitHub 커밋 메시지의 첫 줄
- 상세 변경사항: 커밋 메시지 본문의 bullet 문장이 있으면 그 내용을 우선 사용
- 본문이 없으면 GitHub Commit API의 변경 파일을 화면/컴포넌트/서버/데이터/DB 등으로 묶어 자동 요약
- 버전: 기존 `vX.Y.Z` 형식 중 가장 높은 버전의 patch를 1 올림
- 중복 Webhook: Railway deployment ID를 고유 ID로 사용하여 같은 배포가 여러 번 도착해도 중복 항목이 생기지 않음

## 과거 이력

현재 저장소의 `client/src/data/updates.json`에 기록된 기존 이력은 2026-08-26에서 끝납니다. 2026-08-27 이후의 실제 커밋별 변경 내용을 현재 작업 환경에서 신뢰성 있게 재구성할 수 있는 자료가 부족하므로 임의의 이력을 만들어 넣지 않습니다. 자동 등록 기능은 **이 변경 이후 성공하는 배포부터** 정확히 기록합니다.
