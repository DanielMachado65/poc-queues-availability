const { BigQuery } = require('@google-cloud/bigquery');
const { percentile } = require('./util');

async function main() {
  const datasetId = process.env.BIGQUERY_DATASET || 'test';
  const tableId = process.env.BIGQUERY_TABLE || 'messages';
  const projectId = process.env.BQ_PROJECT_ID;

  const bigquery = new BigQuery(projectId ? { projectId } : {});
  const table = bigquery.dataset(datasetId).table(tableId);

  const rate = parseInt(process.env.MESSAGE_RATE || '100', 10);
  const durationSec = parseInt(process.env.TEST_DURATION_SEC || '600', 10);
  const count = parseInt(
    process.env.MESSAGE_COUNT || (rate * durationSec).toString(),
    10
  );

  let sent = 0;
  const latencies = [];
  const start = Date.now();

  const sendInterval = setInterval(async () => {
    const inserts = [];
    for (let i = 0; i < rate && sent < count; i++) {
      const payload = { id: sent, ts: Date.now() };
      const startTs = Date.now();
      inserts.push(
        table.insert([payload])
          .then(() => {
            latencies.push(Date.now() - startTs);
          })
          .catch((err) => {
            console.error('Insert error:', err.errors || err);
          })
      );
      sent++;
    }
    await Promise.all(inserts);
    if (sent >= count) {
      clearInterval(sendInterval);
      const duration = (Date.now() - start) / 1000;
      console.log('p95 latency ms:', percentile(latencies, 95));
      console.log('throughput msg/s:', (sent / duration).toFixed(2));
    }
  }, 1000);
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
