import { test,expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
test('email sign-in, reload restoration and sign-out through the real backend',async({page,request},testInfo)=>{
 await page.goto('/');
 await expect(page.getByRole('heading',{name:'Welcome to your day'})).toBeVisible();
 await page.screenshot({path:`docs/evidence/auth-${testInfo.project.name}.png`,fullPage:true});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 const email=`browser-proof-${randomUUID()}@example.test`;
 await page.getByLabel('Email address').fill(email);
 await page.getByRole('button',{name:'Send me a code'}).click();
 await expect(page.getByLabel('Six-digit code')).toBeVisible();
 const messages=await (await request.get('http://127.0.0.1:8025/api/v1/messages')).json();
 const message=messages.messages.find((m:{To:Array<{Address:string}>})=>m.To.some(r=>r.Address===email));
 expect(message).toBeTruthy();
 const content=await (await request.get(`http://127.0.0.1:8025/api/v1/message/${message.ID}`)).json();
 const otp=content.Text.match(/code is (\d{6})/)?.[1];
 if(!otp) throw new Error('Mail capture did not contain a code');
 // No trace, video or screenshots after entering authentication material.
 await page.getByLabel('Six-digit code').fill(otp);
 await page.getByRole('button',{name:'Sign in',exact:true}).click();
 await expect(page.getByRole('heading',{name:"You're signed in."})).toBeVisible();
 await page.reload();
 await expect(page.getByRole('heading',{name:"You're signed in."})).toBeVisible();
 await page.getByRole('button',{name:'Sign out',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Welcome to your day'})).toBeVisible();
});
