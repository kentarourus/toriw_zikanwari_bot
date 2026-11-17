import path from 'node:path';import {SiwcClient} from '../siwc/client.mjs';import {handle,readGuide,readDirections} from '../runner/guide-mcp.mjs';import {useGeneratedMapLinks} from '../runner/directions.mjs';
export class ChatgptPlanProvider{
 constructor({root}){this.client=new SiwcClient(path.join(root,'siwc'));}
 async start(){await this.client.credentials();}
 async stop(){}
 async run(job,prepared,{signal}={}){
  job.provider='chatgpt-plan';job.model='gpt-6-luna';job.stage='answering';const links=[];
  const specs=handle({id:1,method:'tools/list'}).result.tools.filter(t=>t.name==='read_trip_guide'||prepared.needDirections);
  const tools=[{type:'namespace',name:'trip',description:'しおりと経路リンクの固定ツール',tools:specs.map(t=>({type:'function',name:t.name,description:t.description,parameters:t.inputSchema,strict:false}))},...(prepared.webMode==='live'?[{type:'web_search'}]:[])];
  const result=await this.client.answer([{role:'user',content:prepared.prompt}],{instructions:prepared.instructions,signal,tools,handlers:{read_trip_guide:({topic})=>{job.guideReads++;return readGuide(topic);},get_map_directions:args=>{const result=readDirections(args);links.push(result);job.directions=(job.directions||0)+1;return result;}},onDelta:delta=>{job.partial+=delta;job.firstTokenAt||=Date.now();}});
  job.webSearches+=result.webSearches||0;result.answer=useGeneratedMapLinks(result.answer,links);return result;
 }
}
