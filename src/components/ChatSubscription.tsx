import React, { useEffect, useRef, useState } from 'react';
import { Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { subscriptionRequest, type AiConnection, type AiProvider } from '../lib/aiAnalysisClient';

type Props = { provider: AiProvider; onChange: (value: AiConnection | null) => void; onAnalyze: () => void; loading: boolean };
type Model = { id: string; name: string };

export function ChatSubscription({ provider, onChange, onAnalyze, loading }: Props) {
  const [available, setAvailable] = useState<boolean | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [models, setModels] = useState<Model[]>([]);
  const [model, setModel] = useState('');
  const [connected, setConnected] = useState(false);
  const credential = useRef<string | undefined>(undefined);
  const session = useRef<string | undefined>(undefined);
  const controller = useRef<AbortController | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const check = new AbortController();
    if (Platform.OS === 'web') subscriptionRequest('capabilities', undefined, {}, check.signal)
      .then(data => setAvailable(data.chatgpt === true)).catch(() => { if (!check.signal.aborted) setAvailable(false); });
    else setAvailable(false);
    return () => {
      check.abort(); controller.current?.abort();
      if (timer.current) clearTimeout(timer.current);
      if (session.current || credential.current) void subscriptionRequest('disconnect', session.current ?? credential.current).catch(() => {});
    };
  }, []);

  function useModel(value: string) {
    setModel(value);
    onChange({ provider: 'openai', model: value, apiKey: '', authMode: 'subscription', sessionToken: session.current });
  }

  async function start(newAccount: boolean) {
    controller.current?.abort(); const current = new AbortController(); controller.current = current;
    setPending(true); setError('');
    try {
      const data = await subscriptionRequest('start', undefined, { newAccount }, current.signal);
      if (current.signal.aborted) return;
      credential.current = data.attempt;
      await Linking.openURL(data.url);
      const poll = async () => {
        if (current.signal.aborted) return;
        try {
          const status = await subscriptionRequest('status', credential.current, {}, current.signal);
          if (current.signal.aborted) return;
          if (status.status === 'failed') throw new Error('로그인이 취소됐거나 구독 사용 권한을 확인하지 못했습니다.');
          if (status.status === 'connected') {
            session.current = status.session; credential.current = undefined;
            setModels(status.models); setConnected(true); setPending(false);
            const selected = status.models[0].id;
            setModel(selected); onChange({ provider: 'openai', model: selected, apiKey: '', authMode: 'subscription', sessionToken: status.session });
          } else timer.current = setTimeout(poll, 1500);
        } catch (err) {
          if (!current.signal.aborted) { setPending(false); setError(err instanceof Error ? err.message : '로그인에 실패했습니다.'); }
        }
      };
      void poll();
    } catch { if (!current.signal.aborted) { setPending(false); setError('로그인 창을 열지 못했습니다. 서버 연결을 확인해주세요.'); } }
  }

  async function disconnect() {
    controller.current?.abort(); if (timer.current) clearTimeout(timer.current);
    const token = session.current ?? credential.current;
    session.current = undefined; credential.current = undefined;
    setConnected(false); setPending(false); setModels([]); setError(''); onChange(null);
    if (token) try { await subscriptionRequest('disconnect', token); }
    catch { setError('로컬 연결을 해제했습니다. 서버 세션은 만료 시 삭제됩니다.'); }
  }

  if (provider !== 'openai') return <View style={styles.body}>
    <Text style={styles.note}>{provider === 'anthropic' ? 'Claude' : 'Gemini'} 구독 연결은 현재 지원하지 않습니다.</Text>
    <Text style={styles.note}>개인 API 연결을 사용할 수 있습니다.</Text>
  </View>;
  return <View style={styles.body}>
    <Text style={styles.note}>ChatGPT 구독 · PC 로컬 실행용 · 계정의 사용 가능 범위와 한도 적용</Text>
    {connected ? <>
      <Text style={styles.status}>ChatGPT 연결됨 · 세션 유지 중</Text>
      <Text style={styles.note}>모델</Text>
      <View style={styles.models}>{models.map(item => <Pressable key={item.id} accessibilityRole="radio"
        accessibilityState={{ checked: item.id === model }} onPress={() => useModel(item.id)}
        style={[styles.model, item.id === model && styles.selected]}><Text>{item.name}</Text></Pressable>)}</View>
      <Pressable accessibilityRole="button" onPress={disconnect}><Text style={styles.link}>연결 해제</Text></Pressable>
      <Pressable accessibilityRole="button" disabled={loading} onPress={onAnalyze} style={styles.button}>
        <Text style={styles.buttonText}>{loading ? '분석 중…' : 'ChatGPT 구독으로 분석'}</Text>
      </Pressable>
    </> : <>
      <Pressable accessibilityRole="button" disabled={!available || pending} onPress={() => start(false)}
        style={[styles.button, (!available || pending) && styles.disabled]}>
        <Text style={styles.buttonText}>{pending ? '브라우저 로그인 대기 중…' : 'Continue with ChatGPT'}</Text>
      </Pressable>
      {pending ? <Pressable accessibilityRole="button" onPress={disconnect}><Text style={styles.link}>로그인 취소</Text></Pressable>
        : <Pressable accessibilityRole="button" disabled={!available} onPress={() => start(true)}><Text style={styles.link}>다른 ChatGPT 계정 연결</Text></Pressable>}
      {available === null && <Text style={styles.note}>연결 가능 여부 확인 중</Text>}
      {available === false && <Text style={styles.note}>구독 연결은 PC 로컬 서버에서 사용할 수 있습니다. 서버 실행 상태를 확인해주세요.</Text>}
    </>}
    {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
  </View>;
}

const styles = StyleSheet.create({
  body: { gap: 12 }, note: { fontSize: 12, color: '#647078', lineHeight: 18 },
  button: { backgroundColor: '#151A1E', minHeight: 44, padding: 12, borderRadius: 6, alignItems: 'center' },
  buttonText: { color: '#FFFFFF', fontWeight: '700' }, disabled: { opacity: 0.45 },
  link: { color: '#1261A0', fontSize: 13, paddingVertical: 8 }, status: { color: '#14795B', fontWeight: '700' },
  models: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  model: { borderWidth: 1, borderColor: '#CBD2D5', borderRadius: 6, minHeight: 44, padding: 12 },
  selected: { borderColor: '#14795B', backgroundColor: '#E9F5EF' }, error: { color: '#B42318', fontSize: 13 },
});
