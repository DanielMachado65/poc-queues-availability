const amqp = require('amqplib');
const { percentile } = require('./util');

async function main() {
  const url = process.env.RABBITMQ_URL || 'amqp://localhost';
  const queue = process.env.RABBITMQ_QUEUE || 'test';

  const rate = parseInt(process.env.MESSAGE_RATE || '100', 10);
  const durationSec = parseInt(process.env.TEST_DURATION_SEC || '600', 10);
  const count = parseInt(
    process.env.MESSAGE_COUNT || (rate * durationSec).toString(),
    10
  );
  const failAfter = parseInt(process.env.FAIL_AFTER_SEC || '0', 10);

  let connection;
  try {
    connection = await amqp.connect(url);
    console.log('RabbitMQ available');
  } catch (err) {
    console.error('RabbitMQ unavailable', err);
    return;
  }

  const channel = await connection.createChannel();
  await channel.assertQueue(queue, { durable: true });

  let sent = 0;
  let received = 0;
  const latencies = [];
  const seen = new Set();
  let duplicates = 0;

  const start = Date.now();

  if (failAfter > 0) {
    setTimeout(() => {
      console.log('Simulating RabbitMQ failure: closing connection');
      connection.close().catch(() => {});
    }, failAfter * 1000);
  }

  await channel.consume(
    queue,
    (msg) => {
      if (msg !== null) {
        try {
          const messageContent = msg.content.toString();
          console.log('Received message content:', messageContent); // Debug log
          const { id, ts } = JSON.parse(messageContent);
          const now = Date.now();
          latencies.push(now - ts);
          if (seen.has(id)) duplicates++;
          seen.add(id);
          received++;
          channel.ack(msg);
          if (received === count) {
            const duration = (now - start) / 1000;
            console.log('p95 latency ms:', percentile(latencies, 95));
            console.log('duplicates:', duplicates);
            console.log('throughput msg/s:', (received / duration).toFixed(2));
            connection.close();
          }
        } catch (error) {
          console.error('Error parsing message:', error.message);
          console.error('Message content:', msg.content.toString());
          channel.ack(msg); // Acknowledge the message to prevent reprocessing
        }
      }
    },
    { noAck: false }
  );

  const sendInterval = setInterval(() => {
    for (let i = 0; i < rate && sent < count; i++) {
      const payload = { id: sent, ts: Date.now() };
      channel.sendToQueue(queue, Buffer.from(JSON.stringify(payload)), {
        persistent: true,
      });
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
