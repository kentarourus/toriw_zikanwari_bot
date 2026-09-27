import fs from 'node:fs';

const site=process.env.GOATCOUNTER_SITE||'';
if(site&&!/^[a-z0-9-]+$/.test(site))throw new Error('GOATCOUNTER_SITE must be a GoatCounter site code.');
fs.writeFileSync('dist/stats/config.json',JSON.stringify({site})+'\n');
