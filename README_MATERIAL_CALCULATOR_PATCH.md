# Abyss 재료 계산기 업데이트 안내

이 ZIP은 기존 Abyss GitHub 저장소의 프로젝트 전체 소스에 재료 계산기 수정 사항을 반영한 업데이트본입니다. 새 호스팅 이전용 패키지가 아니라, 평소 사용하던 GitHub 소스 업데이트 흐름에 사용할 파일입니다.

## 반영된 변경

- 득코 가능한(`acquired: "0"`) 헨치는 레벨과 관계없이 가장 상위 확보 재료로 표시하고, 그 하위 믹스는 더 펼치지 않습니다.
- 득코 불가능(`acquired: "x"`)한 헨치에 하위 믹스가 있으면 하위 경로를 따라가 다음으로 득코 가능한 헨치를 찾습니다.
- 하위 믹스가 여러 개인 경우 기존 조합 선택 기능으로 해당 하위 경로를 선택할 수 있습니다.
- 네펠레맨처럼 하위 조합법이 없는 헨치는 직접 재료로 표시하고, 득코 불가능하며 하위 조합도 없는 항목은 체크박스를 비활성화합니다.
- 조합 데이터가 가리키는 이름이 현재 몬스터 목록에 없더라도 계산 결과에서 누락하지 않고 직접 재료로 표시합니다.
- 화면의 제목과 안내 문구를 변경한 동작에 맞게 조정했습니다.
- 해당 동작을 확인하는 테스트를 보강했습니다.

## 수정된 소스 파일

- `client/src/lib/materialCalculator.ts`
- `client/src/pages/MaterialCalculator.tsx`
- `client/src/lib/materialCalculator.test.ts`
- `client/src/lib/materialCalculator.actualData.test.ts`
- `client/src/pages/MaterialCalculator.test.tsx`
- `MATERIAL_CALCULATOR.md`
- `client/src/data/updates.json` (사이트 업데이트 탭 표시용 기록)

## 적용 시 주의

이 파일은 기존 GitHub 저장소에 반영할 프로젝트 전체 소스 업데이트본입니다. ZIP 자체만 저장소에 새 파일로 올리는 것이 아니라, 압축을 푼 프로젝트 파일을 기존 저장소에 반영한 뒤 평소처럼 배포하세요. 데이터베이스나 환경변수는 수정 대상이 아니므로 기존 값을 그대로 유지하세요. 운영 빌드와 UI 테스트는 배포 전에 확인하세요.


## 검증 상태

계산 로직을 TypeScript 단독 컴파일로 확인하고, 실제 몬스터 데이터와 시나리오를 대상으로 최고 단계 득코 가능 재료에서 멈추는지 검사했습니다. 전체 의존성 설치와 production build/UI 테스트는 실행하지 않았으므로, 기존 GitHub 저장소에 반영한 뒤 자동 배포/미리보기에서 재료계산기 화면을 확인하세요.
