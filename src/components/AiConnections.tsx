import React, { useEffect, useRef, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { aiProviders, testAiConnection, type AiConnection, type AiProvider } from '../lib/aiAnalysisClient';
import { ChatSubscription } from './ChatSubscription';

type Props = { onChange: (connection: AiConnection | null) => void; onAnalyze: () => void; loading: boolean };

export function AiConnections({ onChange, onAnalyze, loading }: Props) {
  const [provider, setProvider] = useState<AiProvider>('openai');
  const [mode, setMode] = useState<'api' | 'subscription'>('subscription');
  const [connections, setConnections] = useState<Partial<Record<AiProvider, AiConnection>>>({});
  const [model, setModel] = useState('gpt-4.1-mini');
  const [key, setKey] = useState('');
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState('');
  const request = useRef<AbortController | null>(null);
  const active = connections[provider];
  useEffect(() => () => request.current?.abort(), []);

  function select(next: AiProvider) {
    if (next === provider) return;
    request.current?.abort(); setTesting(false); setError(''); setKey('');
    setProvider(next); setModel(connections[next]?.model ?? aiProviders.find(p => p.id === next)!.model);
    onChange(mode === 'api' ? connections[next] ?? null : null);
  }

  async function connect() {
    const connection = { provider, model: model.trim(), apiKey: key.trim() };
    const controller = new AbortController(); request.current?.abort(); request.current = controller;
    setTesting(true); setError('');
    try {
      await testAiConnection(connection, controller.signal);
      if (controller.signal.aborted) return;
      setConnections(previous => ({ ...previous, [provider]: connection }));
      setKey(''); onChange(connection);
    } catch (err) {
      if (!controller.signal.aborted) setError(err instanceof Error && err.message !== 'Failed to fetch'
        ? err.message : '분석 서버에 연결할 수 없습니다.');
    } finally { if (!controller.signal.aborted) setTesting(false); }
  }

  function disconnect() {
    request.current?.abort();
    setConnections(previous => { const next = { ...previous }; delete next[provider]; return next; });
    setKey(''); setError(''); setTesting(false); onChange(null);
  }

  return <View style={styles.section}>
    <Text style={styles.title}>내 AI 연결</Text>
    <View style={styles.tabs} accessibilityRole="tablist">
      {(['subscription', 'api'] as const).map(value => <Pressable key={value} accessibilityRole="tab"
        accessibilityState={{ selected: mode === value }} style={[styles.tab, mode === value && styles.selected]}
        onPress={() => { if (value === mode) return; request.current?.abort(); setTesting(false); setKey(''); setError(''); setMode(value); onChange(value === 'api' ? active ?? null : null); }}>
        <Text style={styles.label}>{value === 'subscription' ? '채팅 구독 계정' : '개인 API 키'}</Text>
      </Pressable>)}
    </View>
    <View style={styles.tabs} accessibilityRole="tablist">
      {aiProviders.map(item => <Pressable key={item.id} accessibilityRole="tab"
        accessibilityState={{ selected: provider === item.id }} onPress={() => select(item.id)}
        style={[styles.tab, provider === item.id && styles.selected]}>
        <Text style={styles.label}>{item.label}{mode === 'api' && connections[item.id] ? ' · 연결됨' : ''}</Text>
      </Pressable>)}
    </View>
    {mode === 'subscription' ? <ChatSubscription key={provider} provider={provider} onChange={onChange} onAnalyze={onAnalyze} loading={loading} /> : <>
    <Text style={styles.note}>개인 API 연결 · 채팅 구독과 별도 과금 · 키는 현재 세션에만 유지</Text>
    {active ? <View style={styles.row}>
      <Text style={styles.status}>연결됨 · {active.model}</Text>
      <Pressable accessibilityRole="button" onPress={disconnect} style={styles.secondary}>
        <Text style={styles.label}>연결 해제</Text>
      </Pressable>
    </View> : <>
      <Text style={styles.fieldLabel}>모델 ID</Text>
      <TextInput accessibilityLabel="모델 ID" value={model} onChangeText={setModel} style={styles.input}
        autoCapitalize="none" autoCorrect={false} editable={!testing} />
      <Text style={styles.fieldLabel}>API 키</Text>
      <TextInput accessibilityLabel="API 키" value={key} onChangeText={setKey} style={styles.input}
        secureTextEntry autoCapitalize="none" autoCorrect={false} editable={!testing} placeholder="API 키" />
      <View style={styles.row}>
        <Pressable accessibilityRole="link" onPress={() => { void Linking.openURL(aiProviders.find(p => p.id === provider)!.url); }}>
          <Text style={styles.link}>API 키 관리</Text>
        </Pressable>
        <Pressable accessibilityRole="button" disabled={testing || !key.trim() || !model.trim()}
          onPress={connect} style={[styles.button, (testing || !key.trim() || !model.trim()) && styles.disabled]}>
          <Text style={styles.buttonText}>{testing ? '연결 확인 중…' : '연결 테스트'}</Text>
        </Pressable>
      </View>
      <Text style={styles.note}>연결 테스트 시 소량의 API 사용량이 발생합니다.</Text>
    </>}
    {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
    <Pressable accessibilityRole="button" disabled={!active || loading} onPress={onAnalyze}
      style={[styles.button, (!active || loading) && styles.disabled]}>
      <Text style={styles.buttonText}>{loading ? '분석 중…' : '선택한 AI로 분석'}</Text>
    </Pressable>
    </>}
  </View>;
}

const styles = StyleSheet.create({
  section: { marginTop: 12, padding: 16, backgroundColor: '#FFFFFF', borderRadius: 8, gap: 12 },
  title: { fontSize: 17, fontWeight: '800', color: '#172026' },
  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tab: { padding: 10, borderBottomWidth: 2, borderColor: '#E5E7EB', minHeight: 44 },
  selected: { borderColor: '#13795B', backgroundColor: '#E9F5EF' },
  label: { color: '#25323B', fontSize: 13, fontWeight: '700' },
  note: { color: '#647078', fontSize: 12, lineHeight: 18 },
  fieldLabel: { color: '#25323B', fontSize: 12, fontWeight: '700' },
  input: { borderWidth: 1, borderColor: '#CAD2D5', borderRadius: 6, padding: 12, color: '#172026', minHeight: 44 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 },
  button: { backgroundColor: '#14795B', borderRadius: 6, padding: 12, minHeight: 44, alignItems: 'center' },
  buttonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
  secondary: { padding: 10, minHeight: 44 },
  disabled: { opacity: 0.45 },
  status: { color: '#14795B', fontSize: 13, flexShrink: 1 },
  link: { color: '#1261A0', fontSize: 13 },
  error: { color: '#B42318', fontSize: 13, lineHeight: 18 },
});
