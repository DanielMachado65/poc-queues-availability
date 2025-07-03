const {
  SQSClient,
  CreateQueueCommand,
  SendMessageCommand,
  ReceiveMessageCommand,
  DeleteMessageCommand,
} = require("@aws-sdk/client-sqs");
const { percentile } = require('./util');

async function main() {
  const queueName = process.env.SQS_QUEUE || "test-queue";
  const region = process.env.AWS_REGION || "us-east-1";
  const endpoint = process.env.SQS_ENDPOINT || "http://localhost:4566";
  const useDummyCreds =
    endpoint &&
    !process.env.AWS_ACCESS_KEY_ID &&
    !process.env.AWS_SECRET_ACCESS_KEY;

  const client = new SQSClient({
    region,
    ...(endpoint ? { endpoint } : {}),
    ...(useDummyCreds
      ? { credentials: { accessKeyId: "test", secretAccessKey: "test" } }
      : {}),
  });

  console.log(
    "Using SQS client with region:",
    region,
    "and endpoint:",
    endpoint || "default"
  );

  const rate = parseInt(process.env.MESSAGE_RATE || '100', 10);
  const durationSec = parseInt(process.env.TEST_DURATION_SEC || '600', 10);
  const count = parseInt(
    process.env.MESSAGE_COUNT || (rate * durationSec).toString(),
    10
  );

  let QueueUrl;
  try {
    const result = await client.send(
      new CreateQueueCommand({ QueueName: queueName })
    );
    QueueUrl = result.QueueUrl;
    console.log('SQS available');
  } catch (err) {
    console.error('SQS unavailable', err);
    return;
  }

  let sent = 0;
  let received = 0;
  const latencies = [];
  const seen = new Set();
  let duplicates = 0;

  const start = Date.now();

  const sendInterval = setInterval(async () => {
    const promises = [];
    for (let i = 0; i < rate && sent < count; i++) {
      const payload = { id: sent, ts: Date.now() };
      promises.push(
        client.send(
          new SendMessageCommand({
            QueueUrl,
            MessageBody: JSON.stringify(payload),
          })
        )
      );
      sent++;
    }
    await Promise.all(promises);
    if (sent >= count) {
      clearInterval(sendInterval);
      console.log(`Sent ${sent} messages, waiting for receipts...`);
    }
  }, 1000);

  while (received < count) {
    const { Messages } = await client.send(
      new ReceiveMessageCommand({ QueueUrl, WaitTimeSeconds: 1, MaxNumberOfMessages: 10 })
    );
    if (Messages) {
      for (const m of Messages) {
        const { id, ts } = JSON.parse(m.Body);
        const now = Date.now();
        latencies.push(now - ts);
        if (seen.has(id)) duplicates++; else seen.add(id);
        received++;
        await client.send(
          new DeleteMessageCommand({ QueueUrl, ReceiptHandle: m.ReceiptHandle })
        );
      }
    }
  }

  const duration = (Date.now() - start) / 1000;
  console.log('p95 latency ms:', percentile(latencies, 95));
  console.log('duplicates:', duplicates);
  console.log('throughput msg/s:', (received / duration).toFixed(2));
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
