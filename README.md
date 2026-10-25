# Stock Chart Lab

React Native / Expo 기반 주식 분석 앱 MVP입니다.

## 실행

이 프로젝트는 iPhone의 Expo Go 호환성을 위해 Expo SDK 54 기준으로 맞춰져 있습니다.

시스템 Node.js를 별도로 설치하지 않은 현재 환경에서는 프로젝트에 포함된 휴대용 Node.js를 사용합니다.

```powershell
.\.tools\node\npm.cmd install
.\.tools\node\npm.cmd run start
```

## 현재 기능

- 실제 Yahoo 시세 API, 30초 자동 갱신 (지연 가능, 실시간 체결 보장 아님)
- 1D 분봉 및 1M/3M/6M 일봉, 출처/기준 시각/갱신 오류 표시
- 종목명/티커 검색
- 캔들 차트와 거래량 표시
- 차트 확대/축소, 과거/최신 구간 이동, 캔들 OHLCV 선택 조회
- 관심종목 추가/해제 및 로컬 저장
- SMA, EMA, Bollinger Band, Volume 토글
- 실제 OHLCV 기반 RSI, MACD, 방향성 표시
- 차트 분석 요약
- 참고 매수 구간, 손절 기준, 분할매수/분할매도 시나리오
- 관련 뉴스와 재무 분석은 샘플 표시 (AI 판단 근거에서는 제외)
- Gemini/GPT/Claude 개인 API 연결, 로컬 ChatGPT 구독 연결 경로

## 개인 AI API 연결

시세 API 설명과 제한은 [docs/market-data.md](docs/market-data.md)를 참고합니다.
PC 테스트 시 웹 서버와 함께 `npm run ai-server`로 API 서버(8787)를 실행해야 합니다.

PC 테스트: http://localhost:8081

Gemini, GPT, Claude 중 제공자를 선택하고 모델 ID와 본인 API 키를 입력합니다.
연결 테스트 성공 후 "선택한 AI로 분석"을 누르면 해당 계정의 API를 사용합니다.
API 사용량은 각 제공자 정책에 따라 과금됩니다.
채팅 구독 계정 탭에서는 PC 로컬용 ChatGPT 로그인과 구독 분석을 선택할 수 있습니다.
계정의 사용 권한과 모델을 확인한 뒤 활성화되며, 실제 로그인 검증은 사용자 동의가 필요합니다.

```powershell
.\.tools\node\npm.cmd run web
.\.tools\node\npm.cmd run ai-server
```

키는 현재 앱 세션 메모리에만 유지하며 새로고침 또는 연결 해제 시 삭제됩니다.
운영자의 서버 Gemini 키는 개인 분석에 사용하지 않습니다.
자세한 구조는 `docs/personal-ai-connections.md`를 참고하세요.
ChatGPT 구독 연결 구조는 `docs/chat-subscription.md`를 참고하세요.

## 검증

```powershell
.\.tools\node\npm.cmd run typecheck
.\.tools\node\npm.cmd test
```

현재 데이터는 `src/data/mockMarket.ts`의 샘플 데이터입니다. 실제 시세, 뉴스, 재무제표 API는 다음 단계에서 서버에 연결하는 구조로 확장합니다.
점검 결과와 남은 작업은 `docs/qa-2026-10-26.md`에 기록했습니다.
