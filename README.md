# Refit 앱

React Native, TypeScript, Expo Router 기반 모바일 앱입니다.

```sh
npm install
npx expo start
npx eslint src
npx tsc --noEmit
npm test
```

## 서버 연결

개발 환경 기본 주소는 iOS 시뮬레이터 `http://localhost:8080`, Android 에뮬레이터 `http://10.0.2.2:8080`입니다. 실기기에서는 서버 PC와 같은 네트워크에서 `EXPO_PUBLIC_API_URL=http://서버-PC-IP:8080`을 지정합니다. 배포 빌드에는 `EXPO_PUBLIC_API_URL`에 HTTPS 주소를 지정해야 합니다.

로컬 HTTP를 사용하는 **개발 빌드**는 네이티브 설정을 생성할 때만 `REFIT_ALLOW_HTTP=1`을 명시합니다. 이 설정은 iOS의 ATS와 Android의 평문 통신 제한을 개발 빌드 전체에 완화하므로 배포 빌드에서 사용하지 않습니다. 값이 바뀌면 네이티브 빌드를 다시 만들어야 하며, Expo Go 자체의 네트워크 정책은 이 설정으로 바뀌지 않습니다.

```sh
REFIT_ALLOW_HTTP=1 npx expo run:ios
REFIT_ALLOW_HTTP=1 npx expo run:android
```

로그인·회원가입·토큰 갱신 API가 아직 없어 인증이 필요한 기능은 실제 토큰 발급 후에 검증할 수 있습니다. 수업·결석·보강·출석·알림 기능은 서버가 제공되지 않아 화면과 연결 지점만 준비되어 있습니다.
