// Split only explicit bullets/line breaks; never infer or rewrite deadlines.
export function noticeItems(text){
  return String(text).split(/\r?\n|(?:^|\s+)[・●]/u).map(s=>s.trim().replace(/^[・●]\s*/u,'')).filter(Boolean);
}
