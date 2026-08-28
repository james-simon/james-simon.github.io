import { chromium } from 'playwright';
const S='/private/tmp/claude-501/-Users-jamie-Projects-james-simon-github-io/3079dcb4-0320-423f-86e6-424370b253e4/scratchpad/';
const errors=[];
const browser=await chromium.launch();
const ctx=await browser.newContext({viewport:{width:1300,height:1000}});
const page=await ctx.newPage();
page.on('pageerror',e=>errors.push('PAGEERROR: '+e.message));
page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
await page.goto('http://localhost:4111/fringe-map/',{waitUntil:'networkidle'});
await page.evaluate(()=>localStorage.clear());
await page.reload({waitUntil:'networkidle'}); await page.waitForTimeout(2200);
await page.click('#btnAll'); await page.waitForTimeout(300);

// add two picks
for (const i of [0,1]) {
  await page.locator('.fm-pin-wrap.is-active, .fm-pin-wrap.is-picked').nth(i).click({force:true});
  await page.waitForTimeout(300);
  const b=page.locator('.fm-add-btn:not(.added)').first();
  if (await b.count()) { await b.click(); await page.waitForTimeout(300); }
}
// close the panel so we can prove the block click re-opens it
await page.locator('#detClose').click(); await page.waitForTimeout(300);
const closed = await page.evaluate(()=>({hidden:document.getElementById('details').hidden, blocks:document.querySelectorAll('.fm-itin-block').length}));
console.log('panel closed:', JSON.stringify(closed));

// click an itinerary block
await page.locator('.fm-itin-block').first().click(); await page.waitForTimeout(600);
const after = await page.evaluate(()=>({
  hidden: document.getElementById('details').hidden,
  blocksStillThere: document.querySelectorAll('.fm-itin-block').length,
  greenPins: document.querySelectorAll('.fm-pin-wrap.is-picked').length,
  focused: document.querySelector('.fm-detail-show.focus')?.querySelector('h3')?.textContent?.trim().slice(0,40),
  venueHeader: document.getElementById('details').textContent.trim().slice(0,45),
}));
console.log('after block click:', JSON.stringify(after,null,1));
await page.screenshot({path:S+'shot-blockclick.png'});
console.log('errors:', errors.length?errors:'none');
await browser.close();
