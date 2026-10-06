// v43: touch devices can play in portrait or landscape. No forced orientation gate.
(() => {
  const touchCapable = (navigator.maxTouchPoints || 0) > 0 || 'ontouchstart' in window || !!window.matchMedia?.('(pointer: coarse)').matches;
  const $ = id => document.getElementById(id);

  // Legacy gameplay buttons stay in the DOM for compatibility, but are never shown.
  const baseStyle = document.createElement('style');
  baseStyle.textContent = `
    .touch-controls{display:none!important}
    .hold-touch-btn{display:none!important}
    #multiplayerScreenGate{display:none!important}
  `;
  document.head.appendChild(baseStyle);

  // Remove any gate created by an older cached build.
  const staleGate = $('multiplayerScreenGate');
  if (staleGate) {
    staleGate.classList.add('hidden');
    staleGate.style.setProperty('display','none','important');
  }

  if (!touchCapable) return;
  document.body.classList.add('tb-touch-device');

  function rewriteTutorialCopy(){
    const quick = $('tutorialQuickControls');
    if (quick) {
      const spans = quick.querySelectorAll('span');
      if (spans[1]) spans[1].textContent = 'Right-side controls: ◀ and ▶ move · ⟳ in the up-arrow position rotates · ▼ soft drops. Use the long HARD DROP bar to drop instantly. Tap the HOLD box itself to hold/swap. Pause is at the top.';
    }
    const title = $('tutorialCoachTitle')?.textContent || '';
    const text = $('tutorialCoachText');
    if (!text) return;
    if (title === 'Move your piece') text.textContent = 'Use ◀ and ▶ on the right side to move the falling piece.';
    else if (title === 'Rotate') text.textContent = 'Tap ⟳ in the top position of the arrow cluster to rotate.';
    else if (title === 'Soft Drop') text.textContent = 'Press or hold ▼ on the right-side arrow cluster to move down faster.';
    else if (title === 'Hard Drop') text.textContent = 'Tap the long HARD DROP bar near the bottom-left to instantly lock the piece.';
    else if (title === 'Use HOLD') text.textContent = 'Tap the HOLD preview box itself to save the current piece or swap it back.';
    else if (title === 'Pause safely') text.textContent = 'Tap Pause at the top. Resume continues from the same board state.';
  }

  rewriteTutorialCopy();
  const coach = $('tutorialCoach');
  if (coach) new MutationObserver(rewriteTutorialCopy).observe(coach,{subtree:true,childList:true,characterData:true});
  const intro = $('tutorialIntro');
  if (intro) new MutationObserver(rewriteTutorialCopy).observe(intro,{subtree:true,childList:true,characterData:true});
})();
