const app = require('./app');
const connectDB = require('./config/db');
const env = require('./config/env');

async function start() {
  await connectDB();
  app.listen(env.port, () => {
    console.log(`[server] Navy Cashless API listening on port ${env.port} (${env.nodeEnv})`);
  });
}

start().catch((err) => {
  console.error('[server] failed to start:', err);
  process.exit(1);
});
