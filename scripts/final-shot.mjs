import { chromium } from 'playwright';
import path from 'node:path'; import fs from 'node:fs'; import { pathToFileURL } from 'node:url';
const OUT=path.resolve('.shots/final'); fs.mkdirSync(OUT,{recursive:true});
const U=pathToFileURL(path.resolve('.shots/final-test.html')).href;
const b=await chromium.launch();
const p=await b.newPage({viewport:{width:1900,height:680}});
for(const s of ['bind','listen','land']){
  await p.goto(`${U}?s=${s}`,{waitUntil:'load'}); await p.evaluate(()=>document.fonts.ready); await p.waitForTimeout(500);
  await p.locator('figure').screenshot({path:`${OUT}/${s}.png`}); console.log('ok',s);
}
await b.close();
