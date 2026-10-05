// Tetris Battle v7: persistent Stars + Rank progression inspired by classic Tetris Battle.
(() => {
  const $r = id => document.getElementById(id);

  const TITLE_RANGES = [
    [1, 'Newbie'], [2, 'Novice'], [3, 'Rookie'], [4, 'Trainee'], [5, 'Hobbyist'],
    [6, 'Practitioner'], [7, 'Contender'], [8, 'Achiever'], [9, 'Apprentice'], [10, 'Journeyman'],
    [11, 'Intermediate'], [12, 'Hotshot'], [13, 'Captain'], [14, 'Leader'], [15, 'Pioneer'],
    [16, 'Whiz'], [17, 'Professional'], [18, 'Expert'], [19, 'Veteran'], [20, 'Elite'],
    [21, 'Artist'], [22, 'Star'], [23, 'Superstar'], [24, 'Maven'], [25, 'Virtuoso'],
    [30, 'Genius'], [35, 'Untouchable'], [40, 'Prodigy'], [45, 'Ace'], [50, 'Hero'],
    [55, 'King'], [60, 'Beast'], [65, 'Champion'], [70, 'Guru'], [75, 'Sage'],
    [80, 'Master'], [85, 'Grand Master'], [90, 'Legendary Grand Master'], [95, 'Phenomenon'],
    [100, 'Superhuman'], [105, 'Immortal'], [110, 'Demi-God']
  ];

  let rank = Math.max(1, Math.min(110, Number(localStorage.getItem('tb_rank') || 1)));
  let stars = Math.max(0, Number(localStorage.getItem('tb_rank_stars') || 0));
  let lifetimeWins = Math.max(0, Number(localStorage.getItem('tb_lifetime_wins') || 0));
  let lifetimeLosses = Math.max(0, Number(localStorage.getItem('tb_lifetime_losses') || 0));

  function starGoal(r = rank) { return r >= 101 ? 50 : 5; }

  function rankTitle(r = rank, s = stars) {
    if (r === 110 && s >= 50) return 'God of Tetris';
    for (const [maxRank, title] of TITLE_RANGES) if (r <= maxRank) return title;
    return 'Demi-God';
  }

  function persist() {
    localStorage.setItem('tb_rank', String(rank));
    localStorage.setItem('tb_rank_stars', String(stars));
    localStorage.setItem('tb_lifetime_wins', String(lifetimeWins));
    localStorage.setItem('tb_lifetime_losses', String(lifetimeLosses));
  }

  const sideCard = document.querySelector('.side-card');
  if (sideCard && !$r('rankCard')) {
    const rankCard = document.createElement('div');
    rankCard.id = 'rankCard';
    rankCard.className = 'rank-card';
    rankCard.innerHTML = `
      <div class="rank-topline"><span>RANKED 1v1</span><b id="rankNumber">RANK 1</b></div>
      <div class="rank-title" id="rankTitle">Newbie</div>
      <div class="rank-stars-row"><span class="rank-star">★</span><strong id="rankStars">0 / 5</strong></div>
      <div class="rank-progress"><i id="rankProgress"></i></div>
      <div class="rank-record"><span><b id="lifetimeWins">0</b> wins</span><span><b id="lifetimeLosses">0</b> losses</span></div>
    `;
    sideCard.insertBefore(rankCard, sideCard.firstChild);
  }

  const style = document.createElement('style');
  style.textContent = `
    .rank-card{margin-bottom:16px;padding:15px;border-radius:17px;background:linear-gradient(145deg,rgba(217,168,90,.13),rgba(185,107,134,.09) 58%,rgba(26,21,26,.95));border:1px solid rgba(217,168,90,.24);box-shadow:inset 0 1px rgba(255,255,255,.06)}
    .rank-topline{display:flex;justify-content:space-between;gap:8px;align-items:center;color:#94858e;font-size:9px;font-weight:900;letter-spacing:.1em}.rank-topline b{color:#e4bd77;font-size:11px}.rank-title{font-size:20px;font-weight:1000;margin:7px 0 8px;color:#f5e4c1}.rank-stars-row{display:flex;align-items:center;gap:7px}.rank-star{font-size:20px;color:#e2b955;text-shadow:0 0 12px rgba(226,185,85,.28)}.rank-stars-row strong{font-size:13px}.rank-progress{height:7px;border-radius:999px;background:#171317;border:1px solid #392f36;overflow:hidden;margin:7px 0 10px}.rank-progress i{display:block;height:100%;width:0;background:linear-gradient(90deg,#b96b86,#d9a85a);transition:width .35s ease}.rank-record{display:flex;justify-content:space-between;gap:8px;color:#887b84;font-size:10px}.rank-record b{color:#cdbfc7}.rank-card.rank-up{animation:rankBurst .8s ease}@keyframes rankBurst{0%{transform:scale(.98);box-shadow:0 0 0 rgba(217,168,90,0)}35%{transform:scale(1.03);box-shadow:0 0 28px rgba(217,168,90,.28)}100%{transform:scale(1)}}
  `;
  document.head.appendChild(style);

  function renderRank(rankUp = false) {
    const goal = starGoal();
    const cappedStars = rank === 110 ? Math.min(stars, 50) : Math.min(stars, goal);
    if ($r('rankNumber')) $r('rankNumber').textContent = `RANK ${rank}`;
    if ($r('rankTitle')) $r('rankTitle').textContent = rankTitle();
    if ($r('rankStars')) $r('rankStars').textContent = `${cappedStars} / ${goal}`;
    if ($r('rankProgress')) $r('rankProgress').style.width = `${Math.min(100, (cappedStars / goal) * 100)}%`;
    if ($r('lifetimeWins')) $r('lifetimeWins').textContent = lifetimeWins;
    if ($r('lifetimeLosses')) $r('lifetimeLosses').textContent = lifetimeLosses;
    const card = $r('rankCard');
    if (card && rankUp) {
      card.classList.remove('rank-up'); void card.offsetWidth; card.classList.add('rank-up');
    }
  }

  function awardWin() {
    lifetimeWins++;
    let rankedUp = false;
    if (rank === 110 && stars >= 50) {
      stars = 50;
    } else {
      stars += 1;
      const goal = starGoal();
      if (stars >= goal) {
        if (rank < 110) {
          rank++;
          stars = 2;
          rankedUp = true;
        } else {
          stars = 50;
          rankedUp = true;
        }
      }
    }
    persist();
    renderRank(rankedUp);
    if (typeof toast === 'function') {
      if (rank === 110 && stars >= 50) toast('GOD OF TETRIS', 'Maximum rank achieved');
      else if (rankedUp) toast(`RANK UP! ${rank}`, rankTitle());
      else toast('+1 STAR', `${stars} / ${starGoal()} toward Rank ${rank + (rank < 110 ? 1 : 0)}`);
    }
  }

  function awardLoss() {
    lifetimeLosses++;
    if (!(rank === 1 && stars === 0)) {
      stars -= 1;
      if (stars < 0) {
        if (rank > 1) {
          rank--;
          stars = 2;
        } else stars = 0;
      }
    }
    persist();
    renderRank(false);
  }

  // Rank changes only on a resolved ranked 1v1 result. Party-session results don't alter 1v1 rank.
  const originalEndGame = endGame;
  endGame = function(reason) {
    const rankedResult = gameMode === 'duel' && (reason === 'win' || reason === 'lose');
    const result = originalEndGame(reason);
    if (rankedResult) {
      if (reason === 'win') awardWin();
      else awardLoss();
    }
    return result;
  };

  window.getTetrisRank = () => ({ rank, stars, goal: starGoal(), title: rankTitle(), lifetimeWins, lifetimeLosses });
  renderRank();
})();
