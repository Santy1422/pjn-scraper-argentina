const cron = require("node-cron");
const { scrapeAll } = require("./scraper");

// 2 veces por dia: 8:00 y 18:00 (Lun-Vie, hora Argentina)
cron.schedule(
  "0 8 * * 1-5",
  () => {
    console.log(`[CRON] Scraping matutino - ${new Date().toISOString()}`);
    scrapeAll("CRON").catch((err) => console.error("[CRON ERROR]", err));
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

console.log("[CRON] Programado: 8:00 y 18:00 (Lun-Vie, hora Argentina)");
