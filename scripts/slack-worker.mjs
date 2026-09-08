import {setTimeout as sleep} from 'node:timers/promises';
let running=true;
process.on('SIGTERM',()=>{running=false;});process.on('SIGINT',()=>{running=false;});
while(running){
 if(!process.env.SLACK_WORKER_SECRET){console.error('Slack worker: configure SLACK_WORKER_SECRET');await sleep(30000);continue;}
 try {
  const response=await fetch(`${process.env.SLACK_INTERNAL_URL||'http://app:3000'}/api/internal/slack-delivery`,{method:'POST',headers:{authorization:`Bearer ${process.env.SLACK_WORKER_SECRET}`},signal:AbortSignal.timeout(50000)});
  if(!response.ok)console.error(`Slack worker: HTTP ${response.status}`);
  else {const result=await response.json();if(result.status!=='idle'&&result.status!=='unconfigured')console.log(`Slack delivery: ${result.status}`);}
 }catch {console.error('Slack worker: serviço temporariamente indisponível');}
 if(running)await sleep(5000);
}
