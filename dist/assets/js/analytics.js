if(location.hostname==='kentarourus.github.io'&&/^\/toriw_zikanwari_bot\/classes\/(1-5|2-1|2-3|2-5)\/?$/.test(location.pathname)){
  try{
    const response=await fetch('../../stats/config.json',{cache:'no-store'});
    if(response.ok){
      const {site}=await response.json();
      if(typeof site==='string'&&/^[a-z0-9-]+$/.test(site)){
        const script=document.createElement('script');
        script.src='https://gc.zgo.at/count.js';
        script.async=true;
        script.dataset.goatcounter=`https://${site}.goatcounter.com/count`;
        script.dataset.goatcounterSettings=JSON.stringify({no_session:true});
        document.head.append(script);
      }
    }
  }catch{}
}
