const { test, expect, devices } = require('@playwright/test');

const BASE = process.env.QA_BASE_URL || 'http://127.0.0.1:4173';

function watchErrors(page) {
  const errors = [];
  page.on('pageerror', err => errors.push(`pageerror: ${err.message}`));
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(`console: ${msg.text()}`);
  });
  return errors;
}

async function openHome(page) {
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#tutorialModeCard');
}

async function openSolo(page, type = 'sprint') {
  await openHome(page);
  await page.locator('.mode-card[data-mode="solo"]').click();
  await expect(page.locator('#modeSetupScreen')).toBeVisible();
  await page.locator(`.solo-choice[data-solo="${type}"]`).click();
  await expect(page.locator(`.solo-choice[data-solo="${type}"]`)).toHaveClass(/active/);
  await page.locator('#startSoloBtn').click();
  await expect(page.locator('#game')).toBeVisible({ timeout: 3000 });
}

test.describe('desktop workflows', () => {
  test('landing, branding, chooser and back navigation', async ({ page }) => {
    const errors = watchErrors(page);
    await openHome(page);
    await expect(page).toHaveTitle('KO Blocks');
    await expect(page.locator('.brand h1')).toHaveText('KO Blocks');
    await expect(page.locator('.mode-card[data-mode="duel"] strong')).toHaveText('1v1 Battle');
    await expect(page.locator('.mode-card[data-mode="party"] strong')).toHaveText('Battle Arena');
    await expect(page.locator('.mode-card[data-mode="solo"] strong')).toHaveText('Solo Challenge');
    await expect(page.locator('#tutorialModeCard strong')).toHaveText('Tutorial');

    await page.locator('.mode-card[data-mode="duel"]').click();
    await expect(page.locator('#modeSetupScreen')).toBeVisible();
    await page.locator('#backToModesBtn').click();
    await expect(page.locator('#modeSetupScreen')).toBeHidden();
    expect(errors, errors.join('\n')).toEqual([]);
  });

  test('multiplayer name guard blocks blank 1v1 and arena entry', async ({ page }) => {
    const errors = watchErrors(page);
    await openHome(page);
    await page.locator('.mode-card[data-mode="duel"]').click();
    await page.locator('#playerName').fill('');
    await page.locator('#find2PBtn').click();
    await expect(page.locator('#playerNameError')).toBeVisible();
    await expect(page.locator('#game')).toBeHidden();

    await page.locator('#backToModesBtn').click();
    await page.locator('.mode-card[data-mode="party"]').click();
    await page.locator('#playerName').fill('');
    await page.locator('#createRoomBtn').click();
    await expect(page.locator('#playerNameError')).toBeVisible();
    await expect(page.locator('#game')).toBeHidden();
    expect(errors, errors.join('\n')).toEqual([]);
  });

  test('Solo Sprint starts with countdown and no Ready button', async ({ page }) => {
    const errors = watchErrors(page);
    await openSolo(page, 'sprint');
    await expect(page.locator('#readyBtn')).toBeHidden();
    await expect(page.locator('#readyPanel')).toBeHidden();
    await expect(page.locator('#overlayTitle')).toHaveText('READY?');
    await expect(page.locator('#overlayTitle')).toHaveText('3', { timeout: 1800 });
    await expect(page.locator('#overlayTitle')).toHaveText('2', { timeout: 1500 });
    await expect(page.locator('#overlayTitle')).toHaveText('1', { timeout: 1500 });
    await expect(page.locator('#overlayTitle')).toHaveText('GO!', { timeout: 1500 });
    await expect(page.locator('#overlay')).toBeHidden({ timeout: 1500 });
    await expect(page.locator('#playerState')).toHaveText('Playing');
    expect(errors, errors.join('\n')).toEqual([]);
  });

  test('Solo Marathon opens and starts', async ({ page }) => {
    const errors = watchErrors(page);
    await openSolo(page, 'marathon');
    await expect(page.locator('#modePill')).toContainText('MARATHON');
    await expect(page.locator('#readyBtn')).toBeHidden();
    await expect(page.locator('#overlay')).toBeHidden({ timeout: 6500 });
    await expect(page.locator('#playerState')).toHaveText('Playing');
    expect(errors, errors.join('\n')).toEqual([]);
  });

  test('tutorial opens and desktop actions advance lessons', async ({ page }) => {
    const errors = watchErrors(page);
    await openHome(page);
    await page.locator('#tutorialModeCard').click();
    await expect(page.locator('#tutorialIntro')).toBeVisible();
    await expect(page.locator('#tutorialIntroTitle')).toHaveText('Learn KO Blocks');
    await page.locator('#startTutorialBtn').click();
    await expect(page.locator('#tutorialCoach')).toBeVisible();
    await expect(page.locator('#tutorialCoachTitle')).toHaveText('Move your piece');
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('#tutorialCoachTitle')).toHaveText('Rotate');
    await page.keyboard.press('ArrowUp');
    await expect(page.locator('#tutorialCoachTitle')).toHaveText('Soft Drop');
    await page.keyboard.press('ArrowDown');
    await expect(page.locator('#tutorialCoachTitle')).toHaveText('Hard Drop');
    await page.keyboard.press('Space');
    await expect(page.locator('#tutorialCoachTitle')).toHaveText('Use HOLD');
    await page.keyboard.press('KeyC');
    await expect(page.locator('#tutorialCoachTitle')).toHaveText('Pause safely');
    expect(errors, errors.join('\n')).toEqual([]);
  });
});

test.describe('mobile touch workflows', () => {
  test.use({ ...devices['iPhone 13'], hasTouch: true });

  test('portrait is allowed and PC-style touch controls appear in Solo', async ({ page }) => {
    const errors = watchErrors(page);
    await openSolo(page, 'sprint');
    await expect(page.locator('#multiplayerScreenGate')).toBeHidden();
    await expect(page.locator('#overlay')).toBeHidden({ timeout: 6500 });
    await expect(page.locator('#pcStyleTouchControls')).toBeVisible();
    await expect(page.locator('.pc-touch-arrows .rotate')).toBeVisible();
    await expect(page.locator('.pc-touch-arrows .left')).toBeVisible();
    await expect(page.locator('.pc-touch-arrows .down')).toBeVisible();
    await expect(page.locator('.pc-touch-arrows .right')).toBeVisible();
    await expect(page.locator('.pc-touch-space')).toBeVisible();
    await expect(page.locator('.hold-panel')).toBeVisible();
    expect(errors, errors.join('\n')).toEqual([]);
  });

  test('touch controls, HOLD box, Pause/Resume and Quit are wired', async ({ page }) => {
    const errors = watchErrors(page);
    await openSolo(page, 'sprint');
    await expect(page.locator('#overlay')).toBeHidden({ timeout: 6500 });

    await page.locator('.pc-touch-arrows .rotate').dispatchEvent('pointerdown', { pointerType:'touch', pointerId:1, isPrimary:true });
    await page.locator('.pc-touch-arrows .left').dispatchEvent('pointerdown', { pointerType:'touch', pointerId:2, isPrimary:true });
    await page.locator('.pc-touch-arrows .left').dispatchEvent('pointerup', { pointerType:'touch', pointerId:2, isPrimary:true });
    await page.locator('.pc-touch-space').dispatchEvent('pointerdown', { pointerType:'touch', pointerId:3, isPrimary:true });
    await page.locator('.hold-panel').dispatchEvent('pointerdown', { pointerType:'touch', pointerId:4, isPrimary:true });

    await page.locator('[data-touch-action="pause"]').dispatchEvent('pointerdown', { pointerType:'touch', pointerId:5, isPrimary:true });
    await expect(page.locator('#overlayTitle')).toHaveText('PAUSED');
    await page.locator('[data-touch-action="pause"]').dispatchEvent('pointerdown', { pointerType:'touch', pointerId:6, isPrimary:true });
    await expect(page.locator('#overlay')).toBeHidden();

    page.once('dialog', dialog => dialog.accept());
    await page.locator('[data-touch-action="quit"]').dispatchEvent('pointerdown', { pointerType:'touch', pointerId:7, isPrimary:true });
    await expect(page.locator('#lobby')).toBeVisible();
    await expect(page.locator('#game')).toBeHidden();
    expect(errors, errors.join('\n')).toEqual([]);
  });

  test('mobile tutorial advances with the new touch controls', async ({ page }) => {
    const errors = watchErrors(page);
    await openHome(page);
    await page.locator('#tutorialModeCard').click();
    await page.locator('#startTutorialBtn').click();
    await expect(page.locator('#tutorialCoachTitle')).toHaveText('Move your piece');

    await page.locator('.pc-touch-arrows .right').dispatchEvent('pointerdown', { pointerType:'touch', pointerId:11, isPrimary:true });
    await page.locator('.pc-touch-arrows .right').dispatchEvent('pointerup', { pointerType:'touch', pointerId:11, isPrimary:true });
    await expect(page.locator('#tutorialCoachTitle')).toHaveText('Rotate');
    await page.locator('.pc-touch-arrows .rotate').dispatchEvent('pointerdown', { pointerType:'touch', pointerId:12, isPrimary:true });
    await expect(page.locator('#tutorialCoachTitle')).toHaveText('Soft Drop');
    await page.locator('.pc-touch-arrows .down').dispatchEvent('pointerdown', { pointerType:'touch', pointerId:13, isPrimary:true });
    await page.locator('.pc-touch-arrows .down').dispatchEvent('pointerup', { pointerType:'touch', pointerId:13, isPrimary:true });
    await expect(page.locator('#tutorialCoachTitle')).toHaveText('Hard Drop');
    await page.locator('.pc-touch-space').dispatchEvent('pointerdown', { pointerType:'touch', pointerId:14, isPrimary:true });
    await expect(page.locator('#tutorialCoachTitle')).toHaveText('Use HOLD');
    await page.locator('.hold-panel').dispatchEvent('pointerdown', { pointerType:'touch', pointerId:15, isPrimary:true });
    await expect(page.locator('#tutorialCoachTitle')).toHaveText('Pause safely');
    expect(errors, errors.join('\n')).toEqual([]);
  });
});
