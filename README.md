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

- 종목명/티커 검색
- 캔들 차트와 거래량 표시
- SMA, EMA, Bollinger Band, Volume 토글
- RSI, MACD, 방향성, 재무 점수 표시
- 차트 분석 요약
- 참고 매수 구간, 손절 기준, 분할매수/분할매도 시나리오
- 관련 뉴스와 뉴스 감성 요약
- 재무제표 기반 성장성, 수익성, 안정성, 밸류에이션 분석
- Gemini AI 종합 분석 서버 구조

## 개인 AI API 연결

PC 테스트: http://localhost:8081

Gemini, GPT, Claude 중 제공자를 선택하고 모델 ID와 본인 API 키를 입력합니다.
연결 테스트 성공 후 "선택한 AI로 분석"을 누르면 해당 계정의 API를 사용합니다.
채팅 구독 로그인은 구현하지 않았으며 API 사용량은 각 제공자 정책에 따라 과금됩니다.

```powershell
.\\.tools\\node\\npm.cmd run web
.\\.tools\\node\\npm.cmd run ai-server
```

키는 현재 앱 세션 메모리에만 유지하며 새로고침 또는 연결 해제 시 삭제됩니다.
운영자의 서버 Gemini 키는 개인 분석에 사용하지 않습니다.
자세한 구조는 `docs/personal-ai-connections.md`를 참고하세요.

## 검증

```powershell
.\.tools\node\npm.cmd run typecheck
```

현재 데이터는 `src/data/mockMarket.ts`의 샘플 데이터입니다. 실제 시세, 뉴스, 재무제표 API는 다음 단계에서 서버에 연결하는 구조로 확장합니다.
