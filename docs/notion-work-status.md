# 주식 차트분석 앱 작업현황

작성일: 2026-07-14

## 1. 프로젝트 방향

- 앱 유형: iPhone용 주식 차트분석 앱
- 개발 방식: React Native / Expo
- 현재 목표: 실제 API 연동 전, 차트분석 MVP 화면과 기본 분석 로직을 먼저 구성

## 2. 현재 구현된 앱 기능

- 관심종목 리스트
- 종목별 현재가, 등락률 표시
- 기간 선택: 1D, 1W, 1M, 3M
- 캔들차트 표시
- 거래량 차트 표시
- 이동평균선 MA5, MA20 표시
- RSI 14 계산
- MACD 계산
- 추세, 모멘텀, 거래량 상태 요약
- 가격 알림 설정 UI
- 투자 판단 참고용 고지 문구

## 3. 주요 파일 구조

- `App.tsx`: 메인 화면, 종목 선택, 기간 선택, 분석 요약 UI
- `src/components/CandlestickChart.tsx`: 캔들차트, 이동평균선, 거래량 렌더링
- `src/components/MetricCard.tsx`: RSI, MACD, MA, 거래량 지표 카드
- `src/data/mockMarket.ts`: 샘플 종목과 OHLCV 데이터 생성
- `src/lib/indicators.ts`: 이동평균, RSI, MACD, 분석 요약 계산
- `package.json`: Expo 실행 및 타입체크 스크립트
- `README.md`: 실행 방법 정리

## 4. 설치 및 개발환경

- 휴대용 Node.js 설치 완료
  - 위치: `.tools/node`
  - 버전: `v22.23.1`
- npm 설치 완료
  - 버전: `10.9.8`
- 프로젝트 의존성 설치 완료
  - Expo SDK 57
  - React 19.2.3
  - React Native 0.86.0
  - react-native-svg 15.15.4
  - TypeScript 6.0.3

## 5. 검증 현황

- TypeScript 타입체크 통과
  - 명령: `.\.tools\node\npm.cmd run typecheck`
- Expo Doctor 검사 통과
  - 결과: 20/20 checks passed
- npm audit 확인
  - high 이상 취약점 없음
  - moderate 취약점 10개 존재
  - 현재 Expo 의존성 체인에서 발생하며, `npm audit fix --force`는 Expo 버전을 크게 낮추는 breaking change를 유발하므로 적용하지 않음

## 6. 현재 실행 상태

- Expo Metro 서버 실행 중
- 주소: `http://localhost:8081`
- 현재 포트 상태: `[::1]:8081 LISTENING`
- 프로세스 ID: `2192`
- 중지 명령:

```powershell
Stop-Process -Id 2192
```

## 7. 실행 방법

시스템 Node.js를 별도로 설치하지 않은 현재 환경에서는 다음 명령을 사용합니다.

```powershell
.\.tools\node\npm.cmd run start
```

iPhone에서는 Expo Go 앱으로 QR 코드를 스캔해서 확인합니다.

## 8. 다음 작업 후보

- 실제 주식 시세 API 선택
  - 한국 주식: KIS Developers 또는 증권사 OpenAPI 검토
  - 미국 주식: Polygon, Finnhub, Twelve Data 등 검토
- 서버 구조 설계
  - 시세 API 호출
  - 지표 계산 캐싱
  - 사용자 관심종목 저장
  - 가격/지표 알림 조건 저장
- 앱 기능 확장
  - 종목 검색
  - 관심종목 추가/삭제
  - 목표가 알림 실제 푸시 연동
  - RSI/MACD 조건 알림
  - 차트 확대/스크롤/크로스헤어
- 배포 준비
  - 앱 아이콘과 스플래시 이미지
  - iOS bundle identifier 확정
  - App Store 금융/투자 고지 문구 정리

## 9. 결정이 필요한 사항

- 한국 주식만 지원할지, 미국 주식도 함께 지원할지
- 실시간 시세가 필요한지, 지연 시세로 시작할지
- 로그인 없이 로컬 관심종목으로 시작할지, 계정 기반 동기화를 넣을지
- 알림 기능을 MVP에 포함할지, 2차 단계로 미룰지
