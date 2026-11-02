const {test,expect}=require("@playwright/test");
test("course gates progression and records completion",async({page})=>{
 await page.goto("/");await expect(page.getByRole("heading",{name:"From Session to Release"})).toBeVisible();
 const nav=page.getByRole("navigation",{name:"Course modules"});
 await expect(nav.getByRole("button",{name:/2 Gain Staging/})).toBeDisabled();
 const answers=[2,-14,9,-14,20,3,95];
 for(let i=0;i<answers.length;i++){
  await page.getByLabel("Numeric answer").fill(String(answers[i]));
  await page.getByRole("button",{name:"Check competency"}).click();
  await expect(page.getByText("Correct. Checkpoint passed.")).toBeVisible();
  if(i<answers.length-1){await expect(nav.locator("button").nth(i+1)).toBeEnabled();await nav.locator("button").nth(i+1).click();}
 }
 await expect(page.getByRole("button",{name:/Print completion record/})).toBeVisible();
 await page.reload();await expect(nav.locator("button").nth(6)).toBeEnabled();await nav.locator("button").nth(6).click();await expect(page.getByRole("button",{name:/Print completion record/})).toBeVisible();
});
test("invalid answer cannot unlock module",async({page})=>{
 await page.goto("/");await page.getByLabel("Numeric answer").fill("999");await page.getByRole("button",{name:"Check competency"}).click();
 await expect(page.getByText(/Not correct yet/)).toBeVisible();
 await expect(page.getByRole("navigation").locator("button").nth(1)).toBeDisabled();
});
test("mixing laboratory sliders recalculate and warning appears",async({page})=>{
 await page.goto("/lab.html");
 await expect(page.getByText("Pre-compressor peak:")).toBeVisible();
 await expect(page.locator("#post")).toHaveText("-17.00");
 await page.locator("#gain").fill("12");
 await expect(page.locator("#clip")).toContainText("exceeds 0 dBFS");
 await page.getByLabel("Your answer").fill("-17");
 await page.getByRole("button",{name:"Check calculation"}).click();
 await expect(page.locator("#status")).toContainText("Correct");
});
test("EQ graph and sliders calculate response",async({page})=>{
 await page.goto("/eq.html");await expect(page.locator("canvas")).toBeVisible();
 await expect(page.locator("#summary")).toContainText("6.00 dB");
 await page.locator("#gain").fill("-6");await expect(page.locator("#summary")).toContainText("-6.00 dB");
 await page.getByLabel("Gain in dB").fill("6");
 await page.getByRole("button",{name:"Check answer"}).click();
 await expect(page.locator("#feedback")).toContainText("Correct");
});
test("mobile layout and keyboard access",async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto("/eq.html");
 await expect(page.getByRole("heading",{name:"EQ Mathematics Laboratory"})).toBeVisible();
 await page.locator("#gain").focus();await page.keyboard.press("ArrowRight");
 await expect(page.locator("#gainValue")).toHaveText("7");
 await expect(page.locator("#summary")).toContainText("7.00 dB");
});
