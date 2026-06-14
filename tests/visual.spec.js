import { expect, test } from "@playwright/test";

const appUrl = "http://127.0.0.1:5173";
const batonRouge = { latitude: 30.4515, longitude: -91.1871 };

const viewports = [
  { name: "desktop", viewport: { width: 1440, height: 900 } },
  { name: "mobile", viewport: { width: 390, height: 844 } }
];

for (const config of viewports) {
  test.describe(config.name, () => {
    test.use({
      viewport: config.viewport,
      geolocation: batonRouge,
      permissions: ["geolocation"]
    });

    test("renders weather scene, photo background, and stable controls", async ({ page }) => {
      await page.goto(appUrl, { waitUntil: "domcontentloaded" });

      await expect(page.locator("#weatherCanvas")).toBeVisible();
      await expect(page.locator("#tempValue")).not.toHaveText("--", { timeout: 30000 });

      await page.getByRole("button", { name: "Taj Mahal" }).click();
      await expect(page.locator("#placeName")).toContainText("Agra", { timeout: 30000 });
      await expect(page.locator("#photoCredit")).toContainText("Photo:", { timeout: 45000 });

      await page.waitForFunction(() => {
        const layer = document.querySelector("#photoLayer");
        return layer.dataset.photoState === "loaded" && getComputedStyle(layer).backgroundImage.includes("url(");
      }, null, { timeout: 45000 });

      await page.waitForTimeout(700);

      const canvas = await page.evaluate(() => {
        const element = document.querySelector("#weatherCanvas");
        const gl = element.getContext("webgl2") || element.getContext("webgl");
        const pixel = new Uint8Array(4);
        let nonBlank = 0;

        for (let row = 1; row < 9; row += 1) {
          for (let col = 1; col < 9; col += 1) {
            const x = Math.floor(element.width * (col / 10));
            const y = Math.floor(element.height * (row / 10));
            gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
            if (pixel[3] > 0 && pixel[0] + pixel[1] + pixel[2] > 12) {
              nonBlank += 1;
            }
          }
        }

        return { width: element.width, height: element.height, nonBlank };
      });

      expect(canvas.width).toBeGreaterThan(200);
      expect(canvas.height).toBeGreaterThan(200);
      const condition = await page.locator("#conditionBadge").innerText();
      if (!/clear/i.test(condition)) {
        expect(canvas.nonBlank).toBeGreaterThan(0);
      }

      const layout = await page.evaluate(() => {
        const hud = document.querySelector(".hud").getBoundingClientRect();
        const bar = document.querySelector(".landmark-bar").getBoundingClientRect();
        const source = document.querySelector(".source-strip").getBoundingClientRect();
        const overlap = (a, b) => !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom);
        return {
          hudBar: overlap(hud, bar),
          hudSource: overlap(hud, source),
          barSource: overlap(bar, source)
        };
      });

      expect(layout.hudBar).toBeFalsy();
      expect(layout.hudSource).toBeFalsy();
      expect(layout.barSource).toBeFalsy();

      await page.screenshot({
        path: `test-results/${config.name}-landmark-weather.png`,
        fullPage: true
      });
    });
  });
}
