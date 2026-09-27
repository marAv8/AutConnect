import { test, expect, type Page } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
async function measure(page:Page) {
  return page.evaluate(()=>{
    const date=document.querySelector<HTMLInputElement>('input[type="datetime-local"]')!;
    const field=date.parentElement!;
    const box=(n:Element)=>{const r=n.getBoundingClientRect(),c=getComputedStyle(n);return {left:r.left,right:r.right,width:r.width,clientWidth:n.clientWidth,scrollWidth:n.scrollWidth,widthCSS:c.width,minWidth:c.minWidth,maxWidth:c.maxWidth,inlineSize:c.inlineSize,minInlineSize:c.minInlineSize,maxInlineSize:c.maxInlineSize,padding:c.padding,border:c.borderWidth,boxSizing:c.boxSizing,grid:c.gridTemplateColumns,direction:c.direction,writingMode:c.writingMode,font:c.fontSize};};
    const siblings=[...document.querySelectorAll('input:not([type="hidden"]):not([type="datetime-local"]),select,textarea')].map(n=>({tag:n.tagName,...box(n)}));
    return {date:box(date),field:box(field),siblings,grid:box(field.parentElement!),root:box(document.documentElement),body:box(document.body),iosFeature:CSS.supports('-webkit-touch-callout','none'),visual:visualViewport?{width:visualViewport.width,scale:visualViewport.scale}:null};
  });
}
for (const width of [320,375,390,430,768,1280]) for (const workflow of ['supervisor','provider','request','field']) {
  test(`${workflow} native date alignment ${width}`, async ({page},info) => {
    await page.setViewportSize({width,height:1000});
    await page.goto('/dev/case-support-inputs?workflow='+workflow);
    const date=page.locator('input[type="datetime-local"]');
    const results=[];
    for (const theme of ['light','dark']) {
      await page.locator('html').evaluate((el,t)=>el.classList.toggle('dark',t==='dark'),theme);
      for (const value of ['', '2026-09-20T16:12']) {
        await date.fill(value);
        const before=await measure(page);
        // Actual old deployed Case Support declarations; remove the new rule
        // only in the test to compare every unaffected control's geometry.
        if(workflow!=='field') {
          const style=await page.addStyleTag({content:'.case-support-field input[type="datetime-local"] { inline-size:100%; min-inline-size:auto; max-inline-size:none; justify-self:normal; font-size:inherit; }'});
          const baseline=await measure(page);
          await style.evaluate(el=>el.parentNode?.removeChild(el));
          const after=await measure(page);
          expect(after.siblings).toEqual(baseline.siblings);
          expect({left:after.field.left,right:after.field.right,width:after.field.width}).toEqual({left:baseline.field.left,right:baseline.field.right,width:baseline.field.width});
          expect({...after.grid,scrollWidth:0}).toEqual({...baseline.grid,scrollWidth:0});
          results.push({theme,valueState:value?'filled':'empty',baseline,after});
        } else results.push({theme,valueState:value?'filled':'empty',after:before});
        expect(Math.abs(before.date.left-before.field.left)).toBeLessThanOrEqual(1);
        expect(Math.abs(before.date.right-before.field.right)).toBeLessThanOrEqual(1);
        expect(before.root.scrollWidth).toBe(before.root.clientWidth);
        expect(before.body.scrollWidth).toBe(before.body.clientWidth);
        expect(before.date.scrollWidth).toBeLessThanOrEqual(before.date.clientWidth+1);
        expect(before.field.scrollWidth).toBeLessThanOrEqual(before.field.clientWidth+1);
        if(width<=700) expect(parseFloat(before.date.font)).toBeGreaterThanOrEqual(16);
        await expect(date).toHaveValue(value);
        if(workflow!=="field") {
          const submitted=await date.evaluate((el:HTMLInputElement)=>new FormData(el.form!).get(el.name));
          expect(submitted).toBe(value);
        }
        await date.click(); // Native input remains enabled, focusable, and tappable.
        await expect(date).toBeFocused();
        await page.keyboard.press('Escape');
      }
    }
    await writeFile(info.outputPath('date-bounds.json'),JSON.stringify(results,null,2));
    await info.attach('date-bounds',{body:JSON.stringify(results,null,2),contentType:'application/json'});
  });
}
