import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  try {
    // Navigate to the app (Wait for it to be ready)
    // We'll retry a few times
    let connected = false;
    for (let i = 0; i < 20; i++) {
        try {
            await page.goto('http://localhost:3000', { timeout: 3000 });
            connected = true;
            break;
        } catch (e) {
            await new Promise(r => setTimeout(r, 2000));
        }
    }

    if (!connected) throw new Error("Could not connect to localhost:3000");

    // Wait for the Main Menu to appear
    await page.waitForSelector('text=3615 LA BAULE');

    // Take screenshot of Main Menu
    await page.screenshot({ path: 'verification/menu.png' });
    console.log("Menu screenshot taken");

    // Type a code
    await page.fill('input', 'TEST01');

    // Take screenshot of Input
    await page.screenshot({ path: 'verification/input.png' });
    console.log("Input screenshot taken");

    // Click Connect (We expect it to fail or stay on connecting because server might reject or stay in loop)
    // Note: The websocket server is running on port 3001 via "bun run dev" (concurrently).
    // So it should actually connect!
    await page.click('button[type="submit"]');

    // Wait for HUD or Game Canvas
    // We look for "SCORE:" in HUD
    try {
        await page.waitForSelector('text=SCORE:', { timeout: 5000 });
        await page.screenshot({ path: 'verification/game.png' });
        console.log("Game screenshot taken");
    } catch (e) {
        console.log("Could not enter game (Websocket might have failed or scene loading slow)");
        await page.screenshot({ path: 'verification/fail_game.png' });
    }

  } catch (error) {
    console.error(error);
  } finally {
    await browser.close();
  }
})();
