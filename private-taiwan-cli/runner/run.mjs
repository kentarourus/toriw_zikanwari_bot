import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
const event=JSON.parse(await fs.readFile(process.env.GITHUB_EVENT_PATH,'utf8'));
const messages=JSON.parse(event.inputs.messages);
if(!Array.isArray(messages)||messages.length<1||messages.length>8||messages.some(m=>!['user','assistant'].includes(m.role)||typeof m.content!=='string'||m.content.length>1500))throw Error('Invalid messages');
if(!process.env.CODEX_AUTH_JSON)throw Error('TAIWAN_CODEX_AUTH_JSON secret is missing.');
const auth=JSON.parse(process.env.CODEX_AUTH_JSON);
if(auth.auth_mode!=='chatgpt'||!auth.tokens)throw Error('ChatGPT CLI sign-in is required.');
const root=await fs.mkdtemp(path.join(os.tmpdir(),'taiwan-cli-'));
const home=path.join(root,'auth'),work=path.join(root,'workspace'),answer=path.join(root,'answer.txt');
await fs.mkdir(home,{mode:0o700});await fs.mkdir(work);
await fs.writeFile(path.join(home,'auth.json'),JSON.stringify(auth),{mode:0o600});
const context=await fs.readFile('trip-context.txt','utf8');
const prompt=`あなたは利用者本人のための台湾研修旅行相談アシスタントです。日本語で簡潔に回答。道具・コマンド・ファイル操作は使わないでください。以下の資料は2026年11月13日暫定版の案内であり、変更は学校の指示を優先してください。確認できない集合時刻・規則や営業情報を創作しない。観光の一般情報は案内できるが、最新の営業時間・料金は公式確認を促す。氏名や個人の連絡先を求めない。\n資料:\n${context}\n会話データ(JSON):\n${JSON.stringify(messages)}`;
const env={...process.env,CODEX_HOME:home};delete env.CODEX_AUTH_JSON;delete env.GITHUB_TOKEN;delete env.ACTIONS_RUNTIME_TOKEN;delete env.ACTIONS_ID_TOKEN_REQUEST_TOKEN;
try{
 await new Promise((resolve,reject)=>{const child=spawn('codex',['exec','--ignore-user-config','--ephemeral','--skip-git-repo-check','--sandbox','read-only','--model','gpt-6-luna','-c','model_reasoning_effort="medium"','--disable','apps','--disable','plugins','--disable','shell_tool','--disable','unified_exec','--disable','multi_agent','--disable','multi_agent_v2','--cd',work,'-o',answer,'-'],{env,stdio:['pipe','ignore','ignore']});const timer=setTimeout(()=>{child.kill('SIGKILL');reject(Error('CLI timed out'));},180000);child.on('error',()=>{clearTimeout(timer);reject(Error('CLI did not start'));});child.on('close',code=>{clearTimeout(timer);code===0?resolve():reject(Error('CLI failed; check account sign-in and plan limits.'));});child.stdin.end(prompt);});
 const text=await fs.readFile(answer,'utf8');if(!text.trim()||text.length>40000)throw Error('Invalid answer');
 await fs.writeFile('result.json',JSON.stringify({answer:text}));console.log('Private answer prepared.');
}finally{await fs.rm(root,{recursive:true,force:true});}
