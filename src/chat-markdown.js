import MarkdownIt from 'markdown-it';
import {katex} from '@mdit/plugin-katex';

const markdown=new MarkdownIt({html:false,linkify:true,breaks:true}).disable('image');
markdown.use(katex,{
  delimiters:'all',
  mathFence:true,
  output:'mathml',
  throwOnError:false,
  trust:false,
  maxExpand:200,
  maxSize:20,
  logger:()=> 'ignore'
});
const original=markdown.renderer.rules.link_open||((tokens,index,options,env,renderer)=>renderer.renderToken(tokens,index,options));
markdown.renderer.rules.link_open=(tokens,index,options,env,renderer)=>{tokens[index].attrSet('target','_blank');tokens[index].attrSet('rel','noopener noreferrer');return original(tokens,index,options,env,renderer);};
export function renderMarkdown(text){return markdown.render(String(text));}
