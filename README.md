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

## Gemini AI 분석 서버

Gemini API 키는 앱에 넣지 않고 Node 서버에서만 사용합니다.

```powershell
.\.tools\node\npm.cmd run ai-server
```

`.env`에 `GEMINI_API_KEY`가 있으면 실제 Gemini API를 호출하고, 없으면 fallback 분석을 반환합니다.

```env
GEMINI_API_KEY=your-gemini-api-key-here
GEMINI_MODEL=gemini-flash-latest
AI_SERVER_PORT=8787
```

자세한 구조는 `docs/ai-analysis-architecture.md`를 참고하세요.

## 검증

```powershell
.\.tools\node\npm.cmd run typecheck
```

현재 데이터는 `src/data/mockMarket.ts`의 샘플 데이터입니다. 실제 시세, 뉴스, 재무제표 API는 다음 단계에서 서버에 연결하는 구조로 확장합니다.
