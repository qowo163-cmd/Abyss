# Abyss 재료 계산기 업데이트 안내

이 ZIP은 제공받은 `Abyss-main(1).zip` 전체 프로젝트를 기준으로 재료 계산기 수정 사항을 반영한 전체 소스 업데이트본입니다. 코드 일부만 담은 패치 파일이 아닙니다.

## 반영된 변경

- 득코 불가능(`acquired: "x"`)한 140~169레벨 헨치는 최종 재료로 멈추지 않고 하위 믹스 재료를 계산합니다.
- 하위 믹스가 여러 개인 경우 기존 조합 선택 기능을 사용해 재료 수량을 다시 계산합니다.
- 네펠레맨처럼 하위 조합법이 없는 헨치는 직접 체크할 재료로 표시합니다.
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

## 적용 시 주의

이 파일은 프로젝트 전체 소스의 업데이트본이므로 기존과 같은 소스 배포 절차를 사용할 수 있습니다. 다만 운영 환경의 비밀 환경변수, DB 데이터/볼륨, 서버에 별도로 마운트된 저장소와 Nginx 설정은 소스 ZIP만으로 관리되는 항목이 아닙니다. 배포 작업에서는 해당 운영 설정과 영구 저장 데이터가 삭제되거나 초기화되지 않도록 보존하세요.

정적 이미지도 프로젝트 소스의 `client/public/manus-storage/` 아래에 포함되어 있습니다. 이전 호스팅에서 해당 URL이 404를 반환했다면, 새 배포 후에도 웹 서버의 document root/빌드 출력 경로가 이 폴더를 실제로 서비스하는지 확인해야 합니다.

## 검증 상태

계산 함수는 TypeScript 단독 컴파일과 수동 시나리오 검증 대상입니다. 이 패키지를 만든 환경에서는 전체 프로젝트 의존성을 다시 설치할 수 없어 전체 UI 테스트 및 production build를 완료했다고 주장하지 않습니다. 호스팅 반영 후 실제 UI에서 재료계산기와 이미지 경로를 확인하세요.
