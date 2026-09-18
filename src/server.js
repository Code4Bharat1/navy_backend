const app = require('./app');
const connectDB = require('./config/db');
const env = require('./config/env');
const startSettlementCron = require('./jobs/settlementCron');

async function start() {
  await connectDB();
  app.listen(env.port, () => {
    console.log(`[server] Navy Cashless API listening on port ${env.port} (${env.nodeEnv})`);
  });
  startSettlementCron();
}

start().catch((err) => {
  console.error('[server] failed to start:', err);
  process.exit(1);
});
