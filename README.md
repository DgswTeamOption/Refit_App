# Refit 앱

React Native, TypeScript, Expo Router 기반 모바일 앱입니다.

```sh
npm install
npx expo start
npx eslint src
npx tsc --noEmit
npm test
```
- 설치 후
```sh
npm run ios
```

## 서버 연결

개발 환경 기본 주소는 iOS 시뮬레이터 `http://localhost:8080`, Android 에뮬레이터 `http://10.0.2.2:8080`입니다. 실기기에서는 서버 PC와 같은 네트워크에서 `EXPO_PUBLIC_API_URL=http://서버-PC-IP:8080`을 지정합니다. 배포 빌드에는 `EXPO_PUBLIC_API_URL`에 HTTPS 주소를 지정해야 합니다.

로컬 HTTP를 사용하는 **개발 빌드**는 네이티브 설정을 생성할 때만 `REFIT_ALLOW_HTTP=1`을 명시합니다. 이 설정은 iOS의 ATS와 Android의 평문 통신 제한을 개발 빌드 전체에 완화하므로 배포 빌드에서 사용하지 않습니다. 값이 바뀌면 네이티브 빌드를 다시 만들어야 하며, Expo Go 자체의 네트워크 정책은 이 설정으로 바뀌지 않습니다.

```sh
REFIT_ALLOW_HTTP=1 npx expo run:ios
REFIT_ALLOW_HTTP=1 npx expo run:android
```

서버 인증, 수업, 공지, 일정, 출결, 보강, 알림 API를 사용합니다. 서버는 토큰 재발급을 지원하지 않으므로 accessToken 만료 시 다시 로그인해야 합니다.

NFC 출석은 `react-native-nfc-manager` 네이티브 모듈이 필요하므로 Expo Go가 아닌 iOS 또는 Android 개발 빌드를 사용해야 합니다. 선생님은 수업의 NFC 관리에서 태그를 생성·연결하고 별도의 NFC 쓰기 도구로 토큰 또는 URL을 태그에 기록합니다. 실제 태그 형식과 서버 통신은 배포된 서버 및 NFC 지원 실기기에서 확인해야 합니다.
