import MarkdownIt from 'markdown-it';
const markdown=new MarkdownIt({html:false,linkify:true,breaks:true}).disable('image');
const original=markdown.renderer.rules.link_open||((tokens,index,options,env,renderer)=>renderer.renderToken(tokens,index,options));
markdown.renderer.rules.link_open=(tokens,index,options,env,renderer)=>{tokens[index].attrSet('target','_blank');tokens[index].attrSet('rel','noopener noreferrer');return original(tokens,index,options,env,renderer);};
export function renderMarkdown(text){return markdown.render(String(text));}
