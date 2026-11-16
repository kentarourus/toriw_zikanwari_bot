export function webModeFor(messages){
 const latest=messages.filter(m=>m.role==='user').at(-1)?.content||'';
 if(/(?:Web検索|検索)(?:は|を)?(?:いりません|不要|しないで|しなくていい)/i.test(latest))return 'disabled';
 const external=/検索|調べ|公式|最新|営業時間|料金|運賃|行き方|アクセス|周辺|近く|おすすめ|観光|レストラン|食べ|グルメ|台風|警報|天気|気温|予報|雨|weather/i;
 if(external.test(latest))return 'live';
 if(/^(こんにちは|こんばんは|おはよう|ありがとう|どうも|やあ|はい|わかった|おやすみ)[!！。\s]*$/.test(latest))return 'disabled';
 if(/泊まるホテル|宿泊先|ホテル名|日程|旅程|集合|何時|出発|帰着|帰国|定時|現況|班別|しおり|入国カード|持ち物|パスポート|準備|携行品|スマホ|制服|服装|バッテリー|規則|禁止|学校|研修旅行|修学旅行|翻訳|英語で|中国語で|言い換え|計算/.test(latest))return 'disabled';
 return 'live';
}
export function selectGuideTopics(messages){
 const users=messages.filter(m=>m.role==='user');let text=users.at(-1)?.content||'';
 if(/^(それ|その|では|じゃあ|準備は|時間は)/.test(text)&&text.length<65)text+=' '+(users.at(-2)?.content||'');
 const topics=new Set();
 if(/しおり.*(全部|全体)|全日程/.test(text))return ['all'];
 for(const [pattern,topic] of [
  [/ホテル|宿泊|泊まる|宿舎の名前/,'hotel'],
  [/12月1日|12\/1|初日|1日目|学校.*出発|往路/,'day1'],
  [/12月2日|12\/2|2日目/,'day2'],
  [/12月3日|12\/3|3日目|班別|定時|現況|帰着/,'day3'],
  [/12月4日|12\/4|4日目|最終日|帰国|復路/,'day4'],
  [/持ち物|携行品|準備|パスポート|出発前/,'packing'],
  [/手荷物|大荷物|荷物.*(重|サイズ)|液体|バッテリー|ヘアアイロン|\bkg\b|\bWh\b/,'baggage'],
  [/服装|制服|パジャマ|館内着|寝間着/,'clothing'],
  [/スマホ|スマートフォン|SNS|撮影|通信|カメラ|機内モード/,'devices'],
  [/ホテル.*(ルール|規則|備付|設備)|宿舎|エレベーター|金庫|セキュリティ|タオル|階段|外出|スリッパ|モーニングコール/,'hotel_rules'],
  [/健康|持病|服薬|常備薬|体調|酔い/,'health'],
  [/迷子|はぐれ|緊急|事故/,'emergency'],
  [/免税|買い物|買物|現地学生.*(費用|料金)/,'shopping'],
  [/国際電話|連絡先|電話.*かけ/,'contacts'],
  [/中国語|言語|発音|トイレ.*どこ/,'language'],
  [/バス.*(号車|割当)|乗車.*割当/,'buses'],
  [/班別.*計画|計画書/,'planning'],
  [/MRT|路線図/,'transport'],
  [/見取り図|平面図/,'maps'],
  [/規則|注意|禁止|単独|時差|交通ルール/,'rules'],
  [/何泊|何日間|旅行.*いつ|日程|旅程|しおり|研修旅行|修学旅行/,'overview']
 ])if(pattern.test(text))topics.add(topic);
 if(![...topics].some(t=>/^day[1-4]$/.test(t))&&/朝食|点呼|就寝|起床|消灯/.test(text))topics.add('daily_routine');
 if(/食事|昼食|夕食|レストラン/.test(text))topics.add('meals');
 if(topics.size>1)topics.delete('overview');
 return [...topics];
}
