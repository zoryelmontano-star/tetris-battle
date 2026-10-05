// Tetris Battle v16: enforce real one-second 3-2-1 countdown beats.
(() => {
  const nativeSetTimeout = window.setTimeout.bind(window);
  window.setTimeout = function(fn, delay, ...args) {
    const title = document.getElementById('overlayTitle')?.textContent?.trim().toUpperCase() || '';
    // Existing start countdown uses 480ms; shared resume uses 430ms.
    // Convert only those countdown waits while 3/2/1 is on screen.
    if ((delay === 480 || delay === 430) && ['3','2','1'].includes(title)) delay = 1000;
    // READY and GO stay shorter bookends; only the numeric countdown is exactly one second each.
    if (delay === 420 && title === 'READY') delay = 650;
    if ((delay === 380 || delay === 280) && title === 'GO!') delay = 450;
    return nativeSetTimeout(fn, delay, ...args);
  };
})();