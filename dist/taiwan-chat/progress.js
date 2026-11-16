export const stages=['queued','preparing','answering','delivering'];
export const labels={queued:'起動を待っています',preparing:'丹陽さんの準備をしています',answering:'回答を作成しています（必要に応じてWeb検索）',delivering:'回答を受け取っています'};
export function elapsed(start,now=Date.now()){const seconds=Math.max(0,Math.floor((now-start)/1000));return seconds<60?`${seconds}秒`:`${Math.floor(seconds/60)}分${seconds%60}秒`;}
export function stageFor(result){if(result.stage==='searching')return 'answering';return stages.includes(result.stage)?result.stage:result.status==='in_progress'?'preparing':'queued';}
