import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
const OUT=path.resolve('.shots/trail-center'); fs.mkdirSync(OUT,{recursive:true});
const URL=pathToFileURL(path.resolve('.shots/trail-center.html')).href;
const b=await chromium.launch();
for(const w of [1440,1100,900]){
  const p=await b.newPage({viewport:{width:w,height:520}});
  await p.goto(URL,{waitUntil:'load'}); await p.waitForTimeout(250);
  const m=await p.evaluate(()=>{const c=document.getElementById('chart').getBoundingClientRect();
    return {left:Math.round(c.left),right:Math.round(c.right),vw:window.innerWidth,
      leftGap:Math.round(c.left),rightGap:Math.round(window.innerWidth-c.right)};});
  console.log(`w=${w}`, JSON.stringify(m), '=> centered?', Math.abs(m.leftGap-m.rightGap)<=2);
  await p.screenshot({path:`${OUT}/w${w}.png`}); await p.close();
}
await b.close();
