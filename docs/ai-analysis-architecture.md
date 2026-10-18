# 개인 AI 분석 구조

수정일: 2026-10-18

Expo 앱 → 로컬 AI 서버 → 선택한 제공자의 공식 API.

- Gemini: generateContent / x-goog-api-key
- GPT: OpenAI Responses / Bearer API key / store=false
- Claude: Anthropic Messages / x-api-key
- 제공자와 모델 ID, 개인 키는 요청 단위로 처리한다.
- /api/ai-connection/test: 소량 생성 요청으로 모델 접근 확인.
- /api/ai-analysis: 개인 키가 필요하며 운영자 .env 키로 대체하지 않는다.
- AI 분석은 명시적인 버튼 동작으로만 호출한다.
- 키는 앱 세션 메모리에 유지하고 서버에서 디스크에 저장하지 않는다.
- 원본 제공자 오류 메시지는 외부로 전달하지 않고 일반화한다.
- 출력 분석 스키마를 서버에서 검증한다. 실패하면 오류로 표시한다.
- 기본 지표 요약은 AI 미사용으로 구분한다.

채팅 구독 OAuth 로그인 및 지속적인 계정 저장은 구현하지 않았다.
실서비스 배포 시 HTTPS, 앱 인증, 요청 제한 및 허용 출처 구성이 필요하다.

세부 정책: docs/personal-ai-connections.md
