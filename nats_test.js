const { connect, StringCodec } = require('nats');
const { percentile } = require('./util');

async function main() {
  const url = process.env.NATS_URL || 'nats://localhost:4222';
  const subject = process.env.NATS_SUBJECT || 'test';

  const rate = parseInt(process.env.MESSAGE_RATE || '100', 10);
  const durationSec = parseInt(process.env.TEST_DURATION_SEC || '600', 10);
  const count = parseInt(
    process.env.MESSAGE_COUNT || (rate * durationSec).toString(),
    10
  );

  let nc;
  try {
    nc = await connect({ servers: url });
    console.log('NATS available');
  } catch (err) {
    console.error('NATS unavailable', err);
    return;
  }
  const sc = StringCodec();

  let received = 0;
  const latencies = [];
  const seen = new Set();
  let duplicates = 0;

  const start = Date.now();
  const sub = nc.subscribe(subject);
  (async () => {
    for await (const m of sub) {
      const { id, ts } = JSON.parse(sc.decode(m.data));
      const now = Date.now();
      latencies.push(now - ts);
      if (seen.has(id)) duplicates++; else seen.add(id);
      received++;
      if (received === count) {
        const duration = (now - start) / 1000;
        console.log('p95 latency ms:', percentile(latencies, 95));
        console.log('duplicates:', duplicates);
        console.log('throughput msg/s:', (received / duration).toFixed(2));
        sub.unsubscribe();
        await nc.drain();
      }
    }
  })();

  let sent = 0;
  const sendInterval = setInterval(() => {
    for (let i = 0; i < rate && sent < count; i++) {
      const payload = { id: sent, ts: Date.now() };
      nc.publish(subject, sc.encode(JSON.stringify(payload)));
      sent++;
    }
    if (sent >= count) {
      clearInterval(sendInterval);
      console.log(`Sent ${sent} messages, waiting for receipts...`);
    }
  }, 1000);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
