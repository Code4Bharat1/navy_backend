const cron = require('node-cron');
const env = require('../config/env');
const settlementService = require('../services/settlementService');

function startSettlementCron() {
  if (!env.settlement.enabled) {
    console.log('[settlement-cron] disabled via SETTLEMENT_CRON_ENABLED=false');
    return;
  }

  cron.schedule(env.settlement.cron, async () => {
    console.log('[settlement-cron] running scheduled settlement…');
    try {
      const results = await settlementService.runSettlementForAllShops({ actorId: null });
      const paid = results.filter((r) => r.status === 'paid').length;
      const failed = results.filter((r) => r.status === 'failed').length;
      const skipped = results.filter((r) => r.skipped).length;
      console.log(`[settlement-cron] done: ${paid} paid, ${failed} failed, ${skipped} skipped`);
    } catch (err) {
      console.error('[settlement-cron] run failed:', err);
    }
  });

  console.log(`[settlement-cron] scheduled with expression "${env.settlement.cron}"`);
}

module.exports = startSettlementCron;
