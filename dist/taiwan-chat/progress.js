export const labels={queued:'接続中…',preparing:'確認中…',reading:'しおりを確認中…',searching:'検索中…',answering:'回答中…',delivering:'表示中…'};
export function stageFor(result){return Object.hasOwn(labels,result.stage)?result.stage:result.status==='in_progress'?'preparing':'queued';}
