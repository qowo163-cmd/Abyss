# Android 푸시 알림 구현 메모

거래 요청 푸시는 Expo Push Service를 사용한다. Android 앱은 `getExpoPushTokenAsync({ projectId })`로 기기 토큰을 발급하고, 승인 회원 세션으로 사이트 서버에 등록한다. 서버는 거래 요청 수신자에게만 `https://exp.host/--/api/v2/push/send`으로 발송한다.

앱이 전면에 있을 때에는 사이트의 어두운 거래 요청 카드만 표시하고 Android의 흰 시스템 배너는 표시하지 않는다. 앱이 백그라운드이거나 종료된 경우에는 Android 시스템 푸시를 유지한다. Expo `setNotificationHandler`는 전면 배너·목록·소리를 제어할 수 있다.

Android 13 이상은 푸시 토큰 발급 전에 알림 채널을 만들고 사용자 알림 권한을 받아야 한다. Android 8 이상에서는 채널에 사운드를 설정해야 하며, 이 프로젝트는 기본 시스템 알림음과 높은 우선순위 채널을 사용한다. 푸시 API 티켓·수신 거부 토큰 오류를 확인해 무효 토큰은 비활성화한다.

2026-08-25 점검 결과 Expo 프로젝트 `saebuks-team/abyss-mixsite`의 `com.abyss.mixsite` Android 자격 증명에는 FCM V1 서비스 계정 키가 아직 없었다. Firebase 프로젝트 `abyss-f9f2a`에서 생성한 서비스 계정 비공개 키 JSON을 Expo의 **FCM V1 service account key**에만 업로드해야 하며, EAS Submit용 Google 서비스 계정 키 칸에는 사용하지 않는다.

Firebase Admin SDK 비공개 키는 원격 작업 공간의 Downloads 폴더에 생성되었다. 이 키는 Expo FCM V1 자격 증명 업로드에만 사용하고, 프로젝트 소스·저장소·배포 파일에는 포함하지 않는다.

## 공식 참고

- https://docs.expo.dev/versions/latest/sdk/notifications/
- https://docs.expo.dev/push-notifications/sending-notifications/
- https://docs.expo.dev/push-notifications/receiving-notifications/
