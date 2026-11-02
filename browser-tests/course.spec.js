const {test,expect}=require("@playwright/test");
test("course gates progression and records local practice summary",async({page})=>{
 await page.goto("/");await expect(page.getByRole("heading",{name:"From Session to Release"})).toBeVisible();
 const nav=page.getByRole("navigation",{name:"Course modules"});
 await expect(nav.getByRole("button",{name:/2 Gain Staging/})).toBeDisabled();
 const answers=[2,-14,9,-14,20,3,95];
 for(let i=0;i<answers.length;i++){
  await page.getByLabel("Numeric answer").fill(String(answers[i]));
  await page.getByRole("button",{name:"Check practice answer"}).click();
  await expect(page.getByText("Correct. Practice checkpoint completed.")).toBeVisible();
  if(i<answers.length-1){await expect(nav.locator("button").nth(i+1)).toBeEnabled();await nav.locator("button").nth(i+1).click();}
 }
 await expect(page.getByRole("button",{name:"Print my practice summary"})).toBeVisible();
 await expect(page.locator("#practice-list li")).toHaveCount(7);
 await page.reload();await expect(nav.locator("button").nth(6)).toBeEnabled();await nav.locator("button").nth(6).click();
 await expect(page.getByRole("button",{name:"Print my practice summary"})).toBeVisible();
});
test("wrong and near-miss answers cannot unlock module",async({page})=>{
 await page.goto("/");
 for(const answer of ["999","2.01"]){
  await page.getByLabel("Numeric answer").fill(answer);
  await page.getByRole("button",{name:"Check practice answer"}).click();
  await expect(page.getByText(/Not correct yet/)).toBeVisible();
  await expect(page.getByRole("navigation").locator("button").nth(1)).toBeDisabled();
 }
});
test("keyboard Enter submits and module change focuses lesson heading",async({page})=>{
 await page.goto("/");await page.getByLabel("Numeric answer").fill("2");await page.getByLabel("Numeric answer").press("Enter");
 await expect(page.getByText("Correct. Practice checkpoint completed.")).toBeVisible();
 const next=page.getByRole("navigation").locator("button").nth(1);
 await next.focus();await next.press("Enter");
 await expect(page.locator("#title")).toHaveText("Gain Staging");
 expect(await page.evaluate(()=>document.activeElement.id)).toBe("title");
 await expect(next).toHaveAttribute("aria-current","step");
});
test("practice summary is explicitly not a certificate, even with local storage spoofed",async({page})=>{
 await page.goto("/");await page.evaluate(()=>localStorage.setItem("mercor-passed","[0,1,2,3,4,5,6]"));await page.reload();
 await expect(page.getByRole("button",{name:"Print my practice summary"})).toBeVisible();
 await expect(page.locator("#practice-summary")).toContainText("Unverified");
 const text=await page.locator("body").innerText();
 expect(text).not.toMatch(/completion record|Check competency|competency checkpoints/i);
});
test("mixing laboratory sliders recalculate and 0 dBFS headroom is explicit",async({page})=>{
 await page.goto("/lab.html");
 await expect(page.getByText("Pre-compressor peak:")).toBeVisible();
 await expect(page.locator("#post")).toHaveText("-17.00");
 await page.locator("#gain").fill("8");
 await expect(page.locator("#pre")).toHaveText("0.00");
 await expect(page.locator("#clip")).toContainText("at digital full scale");
 await expect(page.locator("#clip")).toContainText("no headroom");
 await page.locator("#gain").fill("12");
 await expect(page.locator("#clip")).toContainText("exceeds 0 dBFS");
 await page.getByLabel("Your answer").fill("-17");
 await page.getByRole("button",{name:"Check calculation"}).click();
 await expect(page.locator("#status")).toContainText("Correct");
});
// Pixel probe independent of graph code: frequency maps logarithmically to x;
// expected dB values are precomputed with SciPy, not read from the app summary.
async function expectCurvePixel(page,hz,expectedDb){
 const probe=await page.locator("#plot").evaluate((canvas,{hz,expectedDb})=>{
  const ctx=canvas.getContext("2d"),x=Math.round(Math.log(hz/20)/Math.log(1000)*(canvas.width-1));
  const y=Math.round(canvas.height/2-expectedDb*canvas.height/40);
  const data=ctx.getImageData(x-2,y-2,5,5).data;
  let found=false;for(let i=0;i<data.length;i+=4){if(data[i]>=110&&data[i]<=175&&data[i+1]>195&&data[i+2]>175&&data[i+3]>200)found=true}
  return {found,x,y};
 },{hz,expectedDb});
 expect(probe.found,"EQ curve missing near "+hz+" Hz / "+expectedDb+" dB at pixel "+probe.x+","+probe.y).toBe(true);
}
test("EQ graph pixels match independent boost and cut references, including high-frequency axis",async({page})=>{
 await page.goto("/eq.html");await expect(page.locator("canvas")).toBeVisible();
 await page.locator("#q").fill("0.5");
 await expect(page.locator("#summary")).toContainText("6.00 dB");
 await expectCurvePixel(page,2000,3.791219995926305);
 await expectCurvePixel(page,10000,0.18534303433831467);
 await page.locator("#gain").fill("-6");await expect(page.locator("#summary")).toContainText("-6.00 dB");
 await expectCurvePixel(page,2000,-3.791219995926305);
 await expectCurvePixel(page,10000,-0.18534303433831467);
 await page.getByLabel("Gain in dB").fill("6");
 await page.getByRole("button",{name:"Check answer"}).click();
 await expect(page.locator("#feedback")).toContainText("Correct");
});
test("EQ Q slider changes off-center curve as predicted",async({page})=>{
 await page.goto("/eq.html");
 await page.locator("#q").fill("4");
 await expect(page.locator("#qValue")).toHaveText("4.0");
 await expectCurvePixel(page,2000,0.17182904326470574);
});
test("mobile layout and keyboard access",async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto("/eq.html");
 await expect(page.getByRole("heading",{name:"EQ Mathematics Laboratory"})).toBeVisible();
 await page.locator("#gain").focus();await page.keyboard.press("ArrowRight");
 await expect(page.locator("#gainValue")).toHaveText("7");
 await expect(page.locator("#summary")).toContainText("7.00 dB");
 const dims=await page.locator("#plot").evaluate(el=>({width:el.getBoundingClientRect().width,height:el.getBoundingClientRect().height}));
 expect(dims.width/dims.height).toBeCloseTo(800/270,1);
 await expect(page.locator(".plot-scroll")).toHaveAttribute("tabindex","0");
});
