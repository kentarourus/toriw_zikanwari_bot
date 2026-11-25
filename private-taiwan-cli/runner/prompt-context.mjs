export function formatChatPrompt({guide, messages, now, weather}) {
  const parts = [];
  // Keep public material before request-specific context so matching prefixes can be reused.
  if (guide) parts.push('しおり（関連ページ）:\n' + JSON.stringify(guide));

  const history = messages.slice(0, -1);
  const format = ({role, content}) => JSON.stringify([role, content]);
  if (history.length) parts.push('過去の会話（古い順）:\n' + history.map(format).join('\n'));
  parts.push('台湾時間: ' + now);
  if (weather) parts.push('天気資料:\n' + weather);
  parts.push('最後のメッセージに回答:\n' + format(messages.at(-1)));
  return parts.join('\n');
}
