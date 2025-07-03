const { connect, StringCodec } = require('nats');

async function main() {
  const url = process.env.NATS_URL || 'nats://localhost:4222';
  const subject = process.env.NATS_SUBJECT || 'test';

  const nc = await connect({ servers: url });
  const sc = StringCodec();

  const sub = nc.subscribe(subject);
  (async () => {
    for await (const m of sub) {
      console.log('Received:', sc.decode(m.data));
      sub.unsubscribe();
      await nc.drain();
    }
  })();

  const message = 'Hello NATS';
  nc.publish(subject, sc.encode(message));
  console.log('Sent:', message);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
