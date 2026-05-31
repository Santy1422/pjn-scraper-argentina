const cron = require("node-cron");
const { scrapeAll } = require("./scraper");
const { notifyAfterSync } = require("./notifier");

// 2 veces por dia: 8:00 y 18:00 (Lun-Vie, hora Argentina)
// Matutino: scrape + WhatsApp notification
cron.schedule(
  "0 8 * * 1-5",
  async () => {
    console.log(`[CRON] Scraping matutino - ${new Date().toISOString()}`);
    try {
      const result = await scrapeAll("CRON");
      await notifyAfterSync(result);
    } catch (err) {
      console.error("[CRON ERROR]", err);
    }
  },
  { timezone: "America/Argentina/Buenos_Aires" }
);

cron.schedule(
  "0 18 * * 1-5",
  () => {
    console.log(`[CRON] Scraping vespertino - ${new Date().toISOString()}`);
    scrapeAll("CRON").catch((err) => console.error("[CRON ERROR]", err));
  },
  { timezone: "America/Argentina/Buenos_Aires" }
);

console.log("[CRON] Programado: 8:00 (scrape + WhatsApp) y 18:00 (scrape) — Lun-Vie, hora Argentina");
