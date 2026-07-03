import { chromium } from 'playwright';
import path from 'node:path'; import fs from 'node:fs'; import { pathToFileURL } from 'node:url';
const OUT=path.resolve('.shots/crop'); fs.mkdirSync(OUT,{recursive:true});
const U=pathToFileURL(path.resolve('.shots/crop-test.html')).href;
const b=await chromium.launch();
const p=await b.newPage({viewport:{width:1900,height:760}});
const cases=[
  ['cover','center 25%','680','C-cover25-h680'],
  ['cover','center top','680','D-covertop-h680'],
  ['contain','center','600','E-contain-h600'],
];
for(const [f,pos,h,tag] of cases){
  await p.goto(`${U}?fit=${f}&pos=${encodeURIComponent(pos)}&h=${h}`,{waitUntil:'load'});
  await p.waitForTimeout(300);
  await p.locator('#band').screenshot({path:`${OUT}/${tag}.png`});
  console.log('ok',tag);
}
await b.close();
