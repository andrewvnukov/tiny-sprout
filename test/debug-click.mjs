import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 420, height: 800 } });
page.on('console', m => console.log('[console]', m.type(), m.text()));
page.on('pageerror', e => console.log('[pageerror]', e.message));
await page.goto('http://localhost:8347/');
await page.waitForFunction(() => { try { return !!JSON.parse(window.render_game_to_text()).plots; } catch(e) { return false; } }, null, { timeout: 15000 });
await page.waitForTimeout(500);

const info = await page.evaluate(() => {
    const p = worldToScreen(plotPos(0));
    const c = mainCanvas;
    const r = c.getBoundingClientRect();
    return { plotScreen: { x: p.x, y: p.y }, canvasAttr: { w: c.width, h: c.height },
             canvasCss: { w: r.width, h: r.height, left: r.left, top: r.top },
             camScale: cameraScale, camPos: { x: cameraPos.x, y: cameraPos.y },
             mainCanvasSize: { x: mainCanvasSize.x, y: mainCanvasSize.y },
             dpr: devicePixelRatio };
});
console.log(JSON.stringify(info, null, 1));

// проверяем, что видит движок при клике
await page.evaluate(() => { window.__dbg = []; const of = fieldInput; });
await page.mouse.click(info.plotScreen.x * info.canvasCss.w / info.canvasAttr.w, info.plotScreen.y * info.canvasCss.h / info.canvasAttr.h);
await page.waitForTimeout(300);
const after = await page.evaluate(() => ({
    mouse: { x: +mousePos.x.toFixed(2), y: +mousePos.y.toFixed(2) },
    mouseScreen: { x: mousePosScreen.x, y: mousePosScreen.y },
    plot0: JSON.parse(window.render_game_to_text()).plots[0],
    blocked: uiBlocked(), uiTouch,
}));
console.log(JSON.stringify(after, null, 1));
await browser.close();
