export function isUsageExhausted(error) {
  const code = error?.codexErrorInfo ?? error?.data?.codexErrorInfo ?? error?.code;
  return ['usageLimitExceeded', 'usage_limit_exceeded', 'insufficient_quota'].includes(code);
}

export async function runWithFallback({mode, codex, copilot, onSwitch = () => {}}) {
  if (mode === 'copilot-test') return copilot();
  try {
    return await codex();
  } catch (error) {
    if (!isUsageExhausted(error)) throw error;
    onSwitch();
    return copilot();
  }
}

export function providerLabel(mode) {
  if(mode==='chatgpt-plan')return 'GPT-6-Luna · ChatGPT';
  return mode === 'copilot-test' ? 'Copilot Auto（動作確認中）' : 'Luna medium · Copilot予備';
}
