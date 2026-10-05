// Prevent a garbage-overflow KO from being counted again by the immediately following spawn collision.
(() => {
  let lastRivalKO = Number(document.getElementById('rivalKO')?.textContent || 0);
  const priorEndGame = endGame;
  endGame = function(reason) {
    if (gameMode === 'duel' && reason === 'lose') {
      const shown = Number(document.getElementById('rivalKO')?.textContent || 0);
      if (shown > lastRivalKO) {
        lastRivalKO = shown;
        return;
      }
    }
    const result = priorEndGame(reason);
    lastRivalKO = Number(document.getElementById('rivalKO')?.textContent || lastRivalKO);
    return result;
  };
})();
