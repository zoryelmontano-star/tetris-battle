// v21: keep the Solo landing card clean. Sprint/Marathon choices belong on the Solo setup screen only.
(() => {
  const card = document.querySelector('.mode-card[data-mode="solo"]');
  if (!card) return;

  card.innerHTML = `
    <span class="mode-icon">◆</span>
    <span class="solo-card-title"><strong>Solo Session</strong></span>
  `;

  const style = document.createElement('style');
  style.textContent = `
    #lobby .mode-card[data-mode="solo"] .solo-card-title{display:flex;align-items:center;min-width:0}
    #lobby .mode-card[data-mode="solo"] .solo-card-title strong{margin:0}
  `;
  document.head.appendChild(style);
})();
