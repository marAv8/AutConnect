import { test, expect, type Page } from "@playwright/test";
import { writeFile } from "node:fs/promises";

const roles = ["OccupationalTherapist", "Educator", "SpeechPathologist", "BehaviorTherapist"];
const defaults = ["Assistance Level", "Participation", "Cueing Level", "Prompt Level"];
const isTargetWrite = (body: string) => /name="(?:_?[0-9]+_)?measurementProfile"/.test(body);
const field = (body: string, name: string) => body.match(new RegExp('name="(?:_?[0-9]+_)?' + name + '"\r?\n\r?\n([^\r\n]*)'))?.[1];
async function intercept(page: Page, response?: (body: string) => Promise<{ok: boolean; reason?: string}>) {
  const writes: string[] = [];
  await page.route("**/*", async route => {
    const request = route.request();
    if (request.method() !== "POST") return route.continue();
    const body = request.postData() ?? "";
    writes.push(body);
    const result = response && isTargetWrite(body) ? await response(body) : { ok: true, goalId: "00000000-0000-4000-8000-000000000004" };
    return route.fulfill({ contentType: "text/x-component", body: '0:{"a":"$@1","f":[],"b":""}\n1:' + JSON.stringify({goalId: "00000000-0000-4000-8000-000000000004", ...result}) + '\n' });
  });
  return writes;
}
async function measure(page: Page) {
  return page.evaluate(() => {
    const root = document.documentElement;
    const box = (node: Element) => { const r = node.getBoundingClientRect(), c = getComputedStyle(node); return {
      tag: node.tagName, cls: typeof node.className === "string" ? node.className : "", width: r.width, left: r.left, right: r.right,
      minWidth: c.minWidth, maxWidth: c.maxWidth, padding: c.padding, boxSizing: c.boxSizing, display: c.display,
      gridTemplateColumns: c.gridTemplateColumns, flexWrap: c.flexWrap, transform: c.transform, fontSize: c.fontSize
    }; };
    return { viewport: root.clientWidth, innerWidth, rootScroll: root.scrollWidth, bodyWidth: document.body.clientWidth, bodyScroll: document.body.scrollWidth,
      visual: visualViewport ? { width: visualViewport.width, scale: visualViewport.scale } : null,
      chain: [...document.querySelectorAll("main,form,.add-note-form .paper-surface,.add-note-form input,.add-note-form textarea,.add-note-form select")].map(box),
      overflow: [...document.querySelectorAll(".add-note-form *")].filter(n => {const r=n.getBoundingClientRect();return r.width>0 && (r.right>root.clientWidth+1||r.left<0);}).slice(0,15).map(box) };
  });
}
for (const role of roles) {
  test(`${role}: Continue must expose measurement without creating`, async ({ page }, info) => {
    const writes = await intercept(page);
    await page.goto(`/dev/target-workflow?role=${role}`);
    const selectedTarget = await page.getByRole("combobox").inputValue();
    await page.getByRole("button", { name: "Continue", exact: true }).tap();
    await page.locator("textarea").fill("Synthetic regression goal");
    await page.evaluate(() => {
      const events: unknown[] = [];
      Object.assign(window, { targetEvents: events });
      for (const type of ["click","submit"]) for (const capture of [true,false]) document.addEventListener(type, e => {
        const button = e.target instanceof HTMLButtonElement ? e.target : null;
        events.push({ type, capture, buttonType: button?.type, label: button?.textContent, card: document.querySelector(".add-target-navigation")?.textContent });
      }, capture);
    });
    await page.getByRole("button", { name: "Continue", exact: true }).tap();
    await expect(page.getByText("How will this be measured?", { exact: true })).toBeVisible();
    const evidence = { events: await page.evaluate(() => (window as typeof window & {targetEvents: unknown[]}).targetEvents), creates: writes.filter(isTargetWrite).length, viewport: await measure(page) };
    await writeFile(info.outputPath("target-evidence.json"), JSON.stringify(evidence,null,2));
    await expect(page.getByText("How will this be measured?", { exact: true })).toBeVisible();
    expect(evidence.creates).toBe(0);
    const options = page.locator(".add-target-measurement-options > button");
    await expect(options).toHaveCount(5);
    await expect(options.filter({ hasText: defaults[roles.indexOf(role)] })).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", {name: "Previous target", exact: true}).click();
    await expect(page.locator("textarea")).toHaveValue("Synthetic regression goal");
    await page.getByRole("button", {name: "Previous target", exact: true}).click();
    await expect(page.getByRole("combobox")).toHaveValue(selectedTarget);
    await page.getByRole("button", {name: "Next target", exact: true}).click();
    await page.getByRole("button", {name: "Next target", exact: true}).click();
    await options.filter({hasText: "Frequency"}).click();
    const beforeSave = await measure(page);
    expect(beforeSave.rootScroll).toBe(beforeSave.viewport);
    expect(beforeSave.overflow).toEqual([]);
    await page.getByRole("button", {name: "Save Target", exact: true}).tap();
    await expect(page.locator(".target-list-control")).toHaveCount(1);
    const creates = writes.filter(isTargetWrite);
    expect(creates).toHaveLength(1);
    expect(field(creates[0], "measurementProfile")).toBe("Frequency");
    expect(field(creates[0], "goal")).toBe("Synthetic regression goal");
  });
}
for (const width of [320,375,390,430,768,1280]) for (const theme of ["light", "dark"]) {
  test(`edit viewport ${width} ${theme}`, async ({ page }, info) => {
    const writes = await intercept(page);
    await page.addInitScript(theme => localStorage.setItem("autconnect-theme", theme), theme);
    await page.setViewportSize({width,height:900});
    await page.goto("/dev/target-workflow?edit=1");
    await page.locator(".target-list-control").click();
    await page.getByRole("button",{name:"Edit target details"}).click();
    const evidence=await measure(page);
    await writeFile(info.outputPath("viewport-evidence.json"), JSON.stringify(evidence,null,2));
    expect(evidence.rootScroll).toBeLessThanOrEqual(evidence.viewport);
    expect(evidence.bodyScroll).toBeLessThanOrEqual(evidence.bodyWidth);
    expect(evidence.overflow).toEqual([]);
    const controls = page.locator('.add-note-form input, .add-note-form textarea, .add-note-form select, .add-note-form button, .add-note-form [role="button"]');
    const dimensions = await controls.evaluateAll(nodes => nodes.map(n => {const r=n.getBoundingClientRect();return {left:r.left,right:r.right,height:r.height,tag:n.tagName,font:parseFloat(getComputedStyle(n).fontSize)};}));
    for (const d of dimensions) {
      expect(d.left).toBeGreaterThanOrEqual(0); expect(d.right).toBeLessThanOrEqual(width);
      if (width <= 700) expect(d.height).toBeGreaterThanOrEqual(44);
      if (width <= 700 && ["INPUT", "TEXTAREA", "SELECT"].includes(d.tag)) expect(d.font).toBeGreaterThanOrEqual(16);
    }
    for (const label of ["Cancel", "Save Details", "Remove Target"]) {
      const action = page.getByRole("button", {name:label,exact:true});
      if (width <= 700) expect((await action.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }
    await page.locator("textarea").fill("Updated synthetic goal");
    await page.getByRole("button",{name:"Save Details",exact:true}).click();
    await expect(page.getByText("Updated synthetic goal",{exact:true})).toBeVisible();
    const edits=writes.filter(isTargetWrite);
    expect(edits).toHaveLength(1);
    expect(field(edits[0],"goalId")).toBe("00000000-0000-4000-8000-000000000003");
    expect(field(edits[0],"measurementProfile")).toBe("Frequency");
  });
}

test("save is single-flight and a rejected create stays on measurement for correction", async ({page}) => {
  let release!: (result: {ok:boolean;reason?:string}) => void;
  const writes = await intercept(page, () => new Promise(resolve => {release=resolve;}));
  await page.goto('/dev/target-workflow');
  await page.getByRole('button',{name:'Continue',exact:true}).tap();
  // Even an implicit/programmatic submit on card two must not create anything.
  await page.locator('.add-target-form').evaluate(form => (form as HTMLFormElement).requestSubmit());
  await expect(page.getByText('2 of 3',{exact:true})).toBeVisible();
  expect(writes.filter(isTargetWrite)).toHaveLength(0);
  await page.locator('textarea').fill('Synthetic single-flight goal');
  await page.getByRole('button',{name:'Continue',exact:true}).tap();
  await page.getByRole('button',{name:'Save Target',exact:true}).tap();
  await expect.poll(()=>writes.filter(isTargetWrite).length).toBe(1);
  await page.locator('.add-target-form').evaluate(form => { for(let i=0;i<5;i++) (form as HTMLFormElement).requestSubmit(); });
  expect(writes.filter(isTargetWrite)).toHaveLength(1);
  release({ok:false,reason:'duplicate_target'});
  await expect(page.getByText('This target already exists.',{exact:true})).toBeVisible();
  await expect(page.getByText('3 of 3',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Save Target',exact:true}).tap();
  await expect.poll(()=>writes.filter(isTargetWrite).length).toBe(2);
  release({ok:true});
  await expect(page.locator('.add-target-form')).toHaveCount(0);
});

test('guarded card swipes preserve the goal and do not submit', async ({page}) => {
  const writes=await intercept(page);
  await page.setViewportSize({width:390,height:1000});
  await page.goto('/dev/target-workflow');
  const card=page.locator('.add-target-card');
  const swipe=async (forward:boolean) => {
    const box=(await card.boundingBox())!;
    const y=box.y+8;
    const start=box.x+box.width*(forward?0.75:0.25), end=box.x+box.width*(forward?0.25:0.75);
    await page.mouse.move(start,y); await page.mouse.down(); await page.mouse.move(end,y,{steps:8}); await page.mouse.up();
  };
  await swipe(true);
  await expect(page.getByText('2 of 3',{exact:true})).toBeVisible();
  await page.locator('textarea').fill('Synthetic retained goal');
  await swipe(true);
  await expect(page.getByText('3 of 3',{exact:true})).toBeVisible();
  await swipe(false);
  await expect(page.locator('textarea')).toHaveValue('Synthetic retained goal');
  expect(writes.filter(isTargetWrite)).toHaveLength(0);
});

for (const width of [320,375,390,430]) test(`real dashboard Target overlay at ${width}px`, async ({page}, info) => {
  const writes=await intercept(page);
  await page.setViewportSize({width,height:900});
  await page.route('**/api/**', route => route.fulfill({json:{ok:true}}));
  await page.route('**/api/notes/form-data?**', route => route.fulfill({json:{
    clientId:'00000000-0000-4000-8000-000000000001', providerId:'00000000-0000-4000-8000-000000000002',
    role:'OccupationalTherapist',providerRole:'OccupationalTherapist',clientName:'Synthetic Client',providerName:'Synthetic Provider',
    mode:'create',noteKind:'SessionNote',targetOptions:[],draft:null,draftWorkflowKey:'SessionNote:addTarget',initialValues:{note:'',items:[]}
  }}));
  await page.goto('/dev/provider-first-activation?role=occupational&orbit=1');
  await page.locator('[data-dashboard-trace-control="provider-action"]').tap();
  await page.getByRole('button',{name:'Add Target',exact:true}).tap();
  await page.getByRole('button',{name:'Continue',exact:true}).tap();
  await page.locator('textarea').fill('Synthetic dashboard target goal');
  await page.getByRole('button',{name:'Continue',exact:true}).tap();
  await expect(page.getByText('How will this be measured?',{exact:true})).toBeVisible();
  expect(writes.filter(isTargetWrite)).toHaveLength(0);
  await page.getByRole('button',{name:'Save Target',exact:true}).tap();
  await page.locator('.target-list-control').tap();
  await page.getByRole('button',{name:'Edit target details',exact:true}).tap();
  const evidence=await measure(page);
  await writeFile(info.outputPath('dashboard-viewport-evidence.json'),JSON.stringify(evidence,null,2));
  expect(evidence.rootScroll).toBe(evidence.viewport); expect(evidence.bodyScroll).toBe(evidence.bodyWidth);
  expect(evidence.overflow).toEqual([]);
  for(const name of ['Cancel','Save Details','Remove Target']) await expect(page.getByRole('button',{name,exact:true})).toBeVisible();
});
