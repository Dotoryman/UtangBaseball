const { createRequire } = require('node:module');
const { chromium } = createRequire(process.env.QA_RUNTIME + '/package.json')('playwright');
const assert = require('node:assert/strict');
(async () => {
 const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
 try {
  for (const width of [360,430]) {
   const page = await browser.newPage({ viewport:{width,height:844} });
   const errors=[]; page.on('pageerror',e=>errors.push(e.message));
   await page.route('**/*', r=> {const u=new URL(r.request().url()); if(u.hostname!=='localhost')return r.abort(); if(u.pathname==='/api/scores')return r.fulfill({contentType:'application/json',body:'{"records":[]}'});return r.continue();});
   await page.addInitScript(()=>{Math.random=()=>.5;});
   await page.goto('http://localhost:3000/?qa=v090'); await page.waitForLoadState('networkidle'); await page.waitForTimeout(1000);
   await page.getByRole('button',{name:'PLAY BALL!',exact:true}).click();
   await page.locator('.pitcher-throw').waitFor();
   assert.match(await page.locator('.pitcher-sprite').evaluate(n=>getComputedStyle(n).backgroundImage),/v090/);
   await page.screenshot({path:`artifacts/qa-v090/pitch-${width}.png`});
   await page.waitForFunction(()=>{const b=document.querySelector('.baseball')?.getBoundingClientRect(), t=document.querySelector('.contact-core')?.getBoundingClientRect();return b&&t&&Math.hypot(b.x+b.width/2-t.x-t.width/2,b.y+b.height/2-t.y-t.height/2)<9;},{},{polling:'raf'});
   await page.mouse.click(width/2,500);
   await page.locator('.pitcher-reaction').waitFor();
   await page.locator('.umpire-fair').waitFor();
   assert.equal(await page.locator('.baseball').count(),0);
   assert.equal(await page.locator('.pitcher-sprite').evaluate(n=>getComputedStyle(n).backgroundPosition),'50% 0px');
   await page.screenshot({path:`artifacts/qa-v090/hit-${width}.png`});
   const layout=await page.evaluate(()=>{const u=document.querySelector('.umpire').getBoundingClientRect(),c=document.querySelector('.catcher').getBoundingClientRect(),s=document.querySelector('.stadium').getBoundingClientRect();return {right:u.right<=s.right,bottom:u.bottom<=s.bottom,clear:u.left>=c.right-4};});
   assert(layout.right&&layout.bottom&&layout.clear,JSON.stringify(layout));
   await page.locator('.catcher-catch').waitFor({timeout:12000});
   await page.locator('.umpire-strike').waitFor();
   await page.screenshot({path:`artifacts/qa-v090/strike-${width}.png`});
   assert.equal(await page.locator('.pitcher-reaction').count(),0,'miss must not show surprised pitcher');
   assert.deepEqual(errors,[]); console.log('PASS',width,layout); await page.close();
  }
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
