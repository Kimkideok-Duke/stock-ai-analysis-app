export async function requestJson(url: string, options: RequestInit = {}, signal?: AbortSignal, timeoutMs = 95000) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal?.aborted) controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  const timeout = setTimeout(abort, timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    let data;
    try { data = await response.json(); }
    catch { throw new Error('서버 응답을 읽지 못했습니다. 서버 주소와 실행 상태를 확인해주세요.'); }
    if (!response.ok) throw new Error(typeof data?.message === 'string' ? data.message : '서버 요청을 완료하지 못했습니다.');
    return data;
  } catch (error) {
    if (controller.signal.aborted && !signal?.aborted) throw new Error('요청 시간이 초과됐습니다. 다시 시도해주세요.');
    if (error instanceof TypeError) throw new Error('분석 서버에 연결할 수 없습니다. 서버 실행 상태를 확인해주세요.');
    throw error;
  } finally {
    clearTimeout(timeout); signal?.removeEventListener('abort', abort);
  }
}
