import { chromium } from 'playwright';
import path from 'node:path'; import fs from 'node:fs'; import { pathToFileURL } from 'node:url';
const OUT=path.resolve('.shots/scrim'); fs.mkdirSync(OUT,{recursive:true});
const U=pathToFileURL(path.resolve('.shots/scrim-test.html')).href;
const b=await chromium.launch();
const p=await b.newPage({viewport:{width:1230,height:1950},deviceScaleFactor:1.5});
await p.goto(U,{waitUntil:'load'}); await p.evaluate(()=>document.fonts.ready); await p.waitForTimeout(700);
const figs=await p.locator('figure').all();
for(let i=0;i<figs.length;i++){await figs[i].screenshot({path:`${OUT}/V${i}.png`});console.log('ok V'+i);}
await b.close();
