const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const ts = require('typescript');
const React = require('react');
const { create, act } = require('react-test-renderer');
global.IS_REACT_ACT_ENVIRONMENT = true;

for (const extension of ['.ts', '.tsx']) require.extensions[extension] = (module, filename) => {
  module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React, esModuleInterop: true },
  }).outputText, filename);
};
const { mockStocks } = require('../src/data/mockMarket.ts');
const originalLoad = Module._load;
const missing = new Set();
const calls = [];
let disconnects = 0;
const native = Object.fromEntries(['SafeAreaView', 'ScrollView', 'StatusBar', 'Text', 'TextInput', 'Pressable', 'TouchableOpacity', 'View'].map(key => [key, key]));
native.StyleSheet = { create: value => value };
native.Platform = { OS: 'web' };
native.Linking = { openURL: async () => {} };
Module._load = function (id, parent, isMain) {
  if (id === 'react-native') return native;
  if (id === '@expo/vector-icons/Ionicons') return () => null;
  if (/CandlestickChart|AiAnalysisPanel|MetricCard/.test(id)) return { CandlestickChart: () => null, AiAnalysisPanel: () => null, MetricCard: () => null };
  if (id.endsWith('/useWatchlist')) return { useWatchlist: () => ({ ready: true, favorites: [], toggle() {} }) };
  if (id.endsWith('/useCompanyData')) return { useCompanyData: () => ({ data: null, error: '', loading: false, refresh() {} }) };
  if (id.endsWith('/useMarketData')) return { useMarketData: (symbol, range) => ({
    data: missing.has(symbol) ? null : { symbol, range, candles: mockStocks[symbol].candles, source: 'Test', interval: '1d', delay: 'possible', asOf: '2026-10-23T20:00:00Z', fetchedAt: '2026-10-23T20:00:00Z' },
    error: '', loading: missing.has(symbol), refresh() {},
  }) };
  if (id.endsWith('/aiAnalysisClient')) return {
    aiProviders: [{ id: 'openai', label: 'GPT', model: 'test-model' }, { id: 'gemini', label: 'Gemini', model: 'test-model' }],
    testAiConnection: async () => ({}),
    requestAiAnalysis: async (input, connection) => { calls.push({ input, connection }); return { mode: 'openai', analysis: {} }; },
    subscriptionRequest: async path => {
      if (path === 'capabilities') return { chatgpt: true };
      if (path === 'start') return { attempt: 'test-attempt', url: 'https://example.invalid/login' };
      if (path === 'status') return { status: 'connected', session: 'test-session', models: [{ id: 'test-model', name: 'Test model' }] };
      if (path === 'disconnect') disconnects++;
      return {};
    },
  };
  return originalLoad.call(this, id, parent, isMain);
};
const App = require('../App.tsx').default;
const { AiConnections } = require('../src/components/AiConnections.tsx');
Module._load = originalLoad;

function button(root, text) {
  return root.findAllByType('Pressable').find(node => node.findAllByType('Text').some(child => child.children.join('') === text));
}

test('subscription and personal API connections survive symbol loading and recover without reconnecting', async () => {
  let renderer;
  await act(async () => { renderer = create(React.createElement(App)); });
  try {
    await act(async () => { await button(renderer.root, 'Continue with ChatGPT').props.onPress(); });
    const originalPanel = renderer.root.findByType(AiConnections);
    assert.ok(button(renderer.root, 'ChatGPT 구독으로 분석'));
    missing.add('TSLA');
    await act(async () => { renderer.root.findByProps({ accessibilityLabel: 'Tesla Inc. 선택' }).props.onPress(); });
    assert.equal(renderer.root.findByType(AiConnections), originalPanel);
    assert.equal(disconnects, 0);
    assert.equal(button(renderer.root, 'ChatGPT 구독으로 분석').props.disabled, true);
    missing.delete('TSLA');
    await act(async () => { renderer.update(React.createElement(App)); });
    await act(async () => { await button(renderer.root, 'ChatGPT 구독으로 분석').props.onPress(); });
    assert.equal(calls.at(-1).input.stock.symbol, 'TSLA');
    assert.equal(calls.at(-1).connection.sessionToken, 'test-session');
    assert.equal(disconnects, 0);

    await act(async () => { button(renderer.root, '개인 API 키').props.onPress(); });
    await act(async () => { renderer.root.findByProps({ accessibilityLabel: 'API 키' }).props.onChangeText('synthetic-test-key'); });
    await act(async () => { await button(renderer.root, '연결 테스트').props.onPress(); });
    const before = disconnects;
    missing.add('AAPL');
    await act(async () => { renderer.root.findByProps({ accessibilityLabel: 'Apple Inc. 선택' }).props.onPress(); });
    assert.equal(button(renderer.root, '선택한 AI로 분석').props.disabled, true);
    missing.delete('AAPL');
    await act(async () => { renderer.update(React.createElement(App)); });
    assert.equal(button(renderer.root, '선택한 AI로 분석').props.disabled, false);
    await act(async () => { await button(renderer.root, '선택한 AI로 분석').props.onPress(); });
    assert.equal(calls.at(-1).input.stock.symbol, 'AAPL');
    assert.equal(calls.at(-1).connection.apiKey, 'synthetic-test-key');
    assert.equal(disconnects, before);
  } finally { await act(async () => { renderer.unmount(); }); }
});
