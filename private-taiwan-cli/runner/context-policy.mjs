export function webModeFor(messages){
 const latest=messages.filter(m=>m.role==='user').at(-1)?.content||'';
 if(/(?:Web検索|検索)(?:は|を)?(?:いりません|不要|しないで|しなくていい)/i.test(latest))return 'disabled';
 const external=/検索|調べ|公式|最新|営業時間|料金|運賃|行き方|アクセス|周辺|近く|おすすめ|観光|レストラン|食べ|グルメ|台風|警報|天気|気温|予報|雨|weather/i;
 if(external.test(latest))return 'live';
 if(/^(こんにちは|こんばんは|おはよう|ありがとう|どうも|やあ|はい|わかった|おやすみ)[!！。\s]*$/.test(latest))return 'disabled';
 if(/泊まるホテル|宿泊先|ホテル名|日程|旅程|集合|何時|出発|帰着|帰国|定時|現況|班別|しおり|入国カード|持ち物|パスポート|準備|学校|研修旅行|修学旅行|翻訳|英語で|中国語で|言い換え|計算/.test(latest))return 'disabled';
 return 'live';
}
export function selectGuideTopics(messages){
 const users=messages.filter(m=>m.role==='user');let text=users.at(-1)?.content||'';
 if(/^(それ|その|では|じゃあ|準備は|時間は)/.test(text)&&text.length<65)text+=' '+(users.at(-2)?.content||'');
 const topics=new Set();
 if(/しおり.*(全部|全体)|全日程/.test(text))return ['all'];
 for(const [pattern,topic] of [[/ホテル|宿泊|泊まる|宿舎の名前/,'hotel'],[/12月1日|12\/1|初日|1日目|学校.*出発|往路/,'day1'],[/12月2日|12\/2|2日目/,'day2'],[/12月3日|12\/3|3日目|班別|定時|現況|帰着/,'day3'],[/12月4日|12\/4|4日目|最終日|帰国|復路/,'day4'],[/準備|持ち物|手荷物|パスポート|入国|保険|液体|バッテリー|出発前/,'preparation'],[/規則|注意|禁止|単独|時差|交通ルール/,'rules'],[/何泊|何日間|旅行.*いつ|日程|旅程|しおり|研修旅行|修学旅行/,'overview']])if(pattern.test(text))topics.add(topic);
 return [...topics];
}
