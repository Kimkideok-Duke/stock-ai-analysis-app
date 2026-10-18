# Gemini AI 분석 구조

작성일: 2026-07-14

## 목적

차트 지표, 뉴스, 재무제표 데이터를 코드로 먼저 계산한 뒤, Gemini가 이를 종합 해석하도록 구성한다.

## 구조

```text
Expo 앱
  -> /api/ai-analysis
Node AI 서버
  -> Gemini API
  -> JSON 분석 결과 반환
```

## 원칙

- Gemini API 키는 앱에 넣지 않는다.
- 키는 서버의 `.env`에만 저장한다.
- 앱은 서버 API만 호출한다.
- 숫자 계산은 앱 또는 서버의 deterministic 로직으로 처리한다.
- AI는 계산값을 바탕으로 해석, 리스크 설명, 시나리오 문구를 작성한다.
- 문구는 매수/매도 권유가 아니라 투자 참고용 시나리오로 제한한다.

## 현재 구현

- 서버 파일: `server/aiAnalysisServer.js`
- 앱 클라이언트: `src/lib/aiAnalysisClient.ts`
- 앱 패널: `src/components/AiAnalysisPanel.tsx`
- 앱 연결: `App.tsx`

## 서버 실행

```powershell
.\.tools\node\npm.cmd run ai-server
```

기본 포트:

```text
http://localhost:8787
```

상태 확인:

```text
http://localhost:8787/health
```

## Gemini API 키 설정

`.env.example`을 참고해 `.env`를 만든다.

```env
GEMINI_API_KEY=your-gemini-api-key-here
GEMINI_MODEL=gemini-flash-latest
AI_SERVER_PORT=8787
```

키가 없으면 서버는 fallback 분석을 반환한다.

## iPhone 테스트 주의사항

iPhone이 LTE이거나 PC와 같은 네트워크가 아니면 앱에서 `localhost:8787`에 접근할 수 없다.

실제 iPhone에서 Gemini 서버 분석을 보려면 다음 중 하나가 필요하다.

- AI 서버를 배포한다.
- API 서버용 별도 공개 터널 URL을 만든다.
- 같은 Wi-Fi에서 PC의 LAN IP를 `EXPO_PUBLIC_AI_API_URL`로 넣고 Expo를 재시작한다.

앱은 서버 접근 실패 시 로컬 fallback 분석을 표시한다.

## 응답 스키마

```json
{
  "mode": "gemini",
  "model": "gemini-flash-latest",
  "analysis": {
    "headline": "...",
    "summary": "...",
    "direction": "...",
    "riskLevel": "...",
    "buyScenario": "...",
    "sellScenario": "...",
    "keyReasons": ["..."],
    "riskWarnings": ["..."],
    "disclaimer": "..."
  }
}
```
