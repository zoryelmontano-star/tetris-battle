const { test, expect } = require('@playwright/test');

const BASE = process.env.QA_BASE_URL || 'http://127.0.0.1:4173';

async function open(page){
  await page.goto(BASE,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(() => !!window.KOVersusRules && !!window.KOVersusStats);
}

test.describe('versus rules',()=>{
  test('base attack table, combos, B2B and perfect clear match approved rules',async({page})=>{
    const pageErrors=[];page.on('pageerror',e=>pageErrors.push(e.message));
    await open(page);
    const result=await page.evaluate(()=>{
      const R=window.KOVersusRules.resolveClear;
      const once=(lines,opts={})=>R(lines,{...opts,state:{consecutive:0,b2b:false}});
      const comboState={consecutive:0,b2b:false};
      const combo=[];
      for(let i=0;i<11;i++)combo.push(R(1,{state:comboState}));
      const b2bState={consecutive:0,b2b:false};
      const b2b=[
        R(4,{state:b2bState}),
        R(0,{state:b2bState}),
        R(4,{state:b2bState}),
        R(2,{state:b2bState}),
        R(4,{state:b2bState})
      ];
      return {
        single:once(1).attack,
        double:once(2).attack,
        triple:once(3).attack,
        tetris:once(4).attack,
        tspin1:once(1,{tSpin:true}).attack,
        tspin2:once(2,{tSpin:true}).attack,
        tspin3:once(3,{tSpin:true}).attack,
        perfectTetris:once(4,{perfect:true}).attack,
        combo:combo.map(x=>({combo:x.combo,bonus:x.comboBonus,attack:x.attack})),
        b2b:b2b.map(x=>({attack:x.attack,b2b:x.b2bBonus}))
      };
    });
    expect(result.single).toBe(0);
    expect(result.double).toBe(1);
    expect(result.triple).toBe(2);
    expect(result.tetris).toBe(4);
    expect(result.tspin1).toBe(2);
    expect(result.tspin2).toBe(4);
    expect(result.tspin3).toBe(6);
    expect(result.perfectTetris).toBe(14);
    expect(result.combo[1]).toMatchObject({combo:1,bonus:0,attack:0});
    expect(result.combo[2]).toMatchObject({combo:2,bonus:1,attack:1});
    expect(result.combo[4]).toMatchObject({combo:4,bonus:2,attack:2});
    expect(result.combo[6]).toMatchObject({combo:6,bonus:3,attack:3});
    expect(result.combo[8]).toMatchObject({combo:8,bonus:4,attack:4});
    expect(result.combo[10]).toMatchObject({combo:10,bonus:5,attack:5});
    expect(result.b2b[0]).toMatchObject({attack:4,b2b:0});
    expect(result.b2b[2]).toMatchObject({attack:5,b2b:1});
    expect(result.b2b[3].attack).toBe(1);
    expect(result.b2b[4]).toMatchObject({attack:5,b2b:0});
    expect(pageErrors).toEqual([]);
  });

  test('AI has a real score and actual garbage-sent counter',async({page})=>{
    await open(page);
    const stats=await page.evaluate(()=>{
      window.dispatchEvent(new CustomEvent('tb-ai-lines',{detail:{cleared:2,total:2}}));
      window.TBBattle.aiAttack();
      return {score:window.TBAIStats?.score,linesSent:window.TBAIStats?.linesSent};
    });
    expect(stats.score).toBe(300);
    expect(stats.linesSent).toBe(1);
  });
});
