import {chromium,devices} from '@playwright/test';
const url='https://agendamentocar.netlify.app';
const browser=await chromium.launch({channel:'chrome'});
try{
  for(const [device,options] of [['desktop',{viewport:{width:1440,height:950}}],['mobile',{...devices['iPhone 13']}]]){
    const page=await browser.newPage(options);const runtimeErrors=[];
    page.on('pageerror',error=>runtimeErrors.push(error.message));
    try{
      const response=await page.goto(url,{waitUntil:'domcontentloaded',timeout:25000});
      if(response.status()!==200)throw new Error('HTTP '+response.status());
      await page.getByRole('heading',{name:'Vamos ao próximo destino?'}).waitFor({timeout:20000});
      await page.screenshot({path:`test-results/production-${device}.png`,fullPage:true,scale:'css',animations:'disabled'});
      const demoOff=(await page.getByRole('button',{name:'Explorar demonstração'}).count())===0;
      await page.getByRole('button',{name:'Cadastre-se',exact:true}).click();
      await page.getByRole('heading',{name:'Crie sua conta'}).waitFor();
      console.log(JSON.stringify({device,status:response.status(),loginLoaded:true,signupFormLoaded:true,demoOff,runtimeErrors:runtimeErrors.length,horizontalOverflow:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)}));
      if(runtimeErrors.length)throw new Error('Erro de execução na página.');
    }finally{await page.close()}
  }
}finally{await browser.close()}
