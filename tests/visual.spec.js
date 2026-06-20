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

      await expect(page.locator("#tempValue")).not.toHaveText("--", { timeout: 30000 });

      await page.getByRole("button", { name: "Taj Mahal" }).click();
      await expect(page.locator("#placeName")).toContainText("Agra", { timeout: 30000 });
      await expect(page.locator("#photoCredit")).toContainText("Photo:", { timeout: 45000 });

      await page.waitForFunction(() => {
        const layer = document.querySelector("#photoLayer");
        return layer.dataset.photoState === "loaded" && getComputedStyle(layer).backgroundImage.includes("url(");
      }, null, { timeout: 45000 });

      await page.waitForTimeout(700);

      const photoBackground = await page.locator("#photoLayerNext").evaluate((element) =>
        getComputedStyle(element).backgroundImage
      );
      expect(photoBackground).toContain("wikimedia.org");

      const weatherCanvasPainted = await page.evaluate(() => {
        const canvas = document.querySelector("#weatherCanvas");
        return Boolean(canvas) && canvas.width > 0 && canvas.height > 0;
      });
      expect(weatherCanvasPainted).toBeTruthy();

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

      if (config.name === "mobile") {
        const hud = await page.locator(".hud").boundingBox();
        expect(hud.height).toBeLessThan(290);
        expect(hud.y + hud.height).toBeLessThan(config.viewport.height * 0.46);
      }

      await page.screenshot({
        path: `test-results/${config.name}-landmark-weather.png`,
        fullPage: true
      });
    });
  });
}
