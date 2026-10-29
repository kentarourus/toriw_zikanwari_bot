import {setTimeout as sleep} from 'node:timers/promises';

export async function fetchStats(url,token,{request=fetch,wait=sleep}={}){
  const attempts=4;
  for(let attempt=0;attempt<attempts;attempt++){
    let response;
    try{
      response=await request(url,{headers:{Authorization:`Bearer ${token}`,Accept:'application/json'},signal:AbortSignal.timeout(30000)});
    }catch{
      if(attempt===attempts-1)throw new Error('GoatCounter could not be reached after four attempts. Existing counts were preserved.');
    }
    if(response?.ok)return response.json();
    if(response){
      const retryable=[404,408,429,500,502,503,504].includes(response.status);
      // Do not echo the server body or credentials into public Actions logs.
      if(!retryable||attempt===attempts-1)throw new Error(`GoatCounter returned ${response.status}. Existing counts were preserved.`);
      await response.body?.cancel();
    }
    console.log(`GoatCounter temporarily unavailable; retry ${attempt+1}/${attempts-1}.`);
    await wait(10000*2**attempt);
  }
}
