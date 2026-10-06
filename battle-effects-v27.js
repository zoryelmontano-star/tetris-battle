// v27: louder battle SFX than music, heavy drops, attack cues, KO cues, defeat boo, and confetti.
(() => {
  function fx(freq,dur=.10,type='triangle',vol=.08,delay=0){
    if(!sfxOn || typeof tone!=='function') return;
    tone(freq,dur,type,vol,delay,'sfx');
  }

  function heavyDrop(){
    // Two low impacts: BOOG ... BOOG.
    fx(72,.13,'sine',.14,0); fx(48,.16,'triangle',.12,.018);
    fx(64,.10,'square',.07,.055); fx(43,.15,'sine',.12,.075);
  }

  function attackChime(lines=1){
    // Bright two-part "teneneng teneneng" cue, louder as more lines are sent.
    const boost=Math.min(.045,Math.max(0,Number(lines)-1)*.009);
    [784,1047,988,1319].forEach((f,i)=>fx(f,.10,i%2?'sine':'triangle',.085+boost,i*.045));
    [880,1175,1109,1480].forEach((f,i)=>fx(f,.085,'square',.045+boost*.5,.19+i*.04));
  }

  function enemyKO(){
    // Metallic boxing-bell style hit for knocking out the opponent.
    [1180,1575,2130].forEach((f,i)=>fx(f,.34,i===1?'sine':'triangle',i===0?.12:.075,i*.012));
    [1120,1500,2050].forEach((f,i)=>fx(f,.28,'triangle',i===0?.08:.05,.24+i*.01));
  }

  function selfKO(){
    // Descending "kukuuu" cue when YOU are knocked out.
    fx(660,.20,'sine',.11,0); fx(523,.24,'sine',.105,.11); fx(392,.30,'triangle',.105,.22); fx(294,.38,'sine',.09,.34);
  }

  function boo(){
    // Low synthetic crowd-like defeat swell.
    [190,174,160,145].forEach((f,i)=>fx(f,.42,'sawtooth',.045,i*.06));
    [130,118].forEach((f,i)=>fx(f,.48,'triangle',.055,.18+i*.08));
  }

  function winFanfare(){
    [523,659,784,1047,1319].forEach((f,i)=>fx(f,.20,i%2?'sine':'triangle',.095,i*.055));
    fx(262,.42,'sawtooth',.05,0); fx(1568,.32,'sine',.08,.30);
  }

  // Override the normal drop and clear cues with stronger battle-first SFX.
  sfxDrop=heavyDrop;
  const previousClearSfx=clearSfx;
  clearSfx=function(lines,comboCount,perfect){
    // A short line-clear sparkle first, then the attack cue.
    const n=Math.max(1,Number(lines)||1);
    fx(420+n*80,.07,'square',.07,0);
    fx(610+n*95,.09,'triangle',.075,.035);
    attackChime(n);
    if(perfect){ [1047,1319,1568].forEach((f,i)=>fx(f,.22,'sine',.09,.38+i*.055)); }
    else if(comboCount>=3) fx(1500+Math.min(8,comboCount)*55,.16,'sine',.075,.34);
  };

  // Keep end-result SFX above the background track too.
  sfxWin=winFanfare;
  sfxLose=function(){ selfKO(); setTimeout(boo,260); };

  function confetti(){
    const layer=document.createElement('div'); layer.className='confetti-layer';
    const palette=['#55e7ff','#ff63b6','#ffe568','#58e79a','#9c65ff','#ff784e','#ffffff'];
    for(let i=0;i<76;i++){
      const bit=document.createElement('i');
      bit.style.setProperty('--x',`${Math.random()*100}vw`);
      bit.style.setProperty('--dx',`${(Math.random()-.5)*38}vw`);
      bit.style.setProperty('--delay',`${Math.random()*.35}s`);
      bit.style.setProperty('--dur',`${1.45+Math.random()*1.25}s`);
      bit.style.setProperty('--rot',`${Math.floor(Math.random()*900+180)}deg`);
      bit.style.background=palette[Math.floor(Math.random()*palette.length)];
      bit.style.width=`${6+Math.random()*7}px`; bit.style.height=`${8+Math.random()*10}px`;
      layer.appendChild(bit);
    }
    document.body.appendChild(layer); setTimeout(()=>layer.remove(),3100);
  }

  const style=document.createElement('style');
  style.textContent=`
    .confetti-layer{position:fixed;inset:0;z-index:15000;overflow:hidden;pointer-events:none}.confetti-layer i{position:absolute;left:var(--x);top:-24px;border-radius:2px;box-shadow:0 1px 2px rgba(0,0,0,.2);animation:confettiFall var(--dur) cubic-bezier(.2,.7,.35,1) var(--delay) forwards}@keyframes confettiFall{0%{transform:translate3d(0,-30px,0) rotate(0);opacity:1}100%{transform:translate3d(var(--dx),110vh,0) rotate(var(--rot));opacity:.88}}
  `;
  document.head.appendChild(style);

  window.TBSfx={heavyDrop,garbageSend:attackChime,enemyKO,selfKO,partyWin:winFanfare,partyLose:boo};
  window.TBEffects={confetti};
})();
