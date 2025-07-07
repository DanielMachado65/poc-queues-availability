const { Kafka, Partitioners } = require("kafkajs");
const { percentile } = require("../util");

async function main() {
  const topic = process.env.KAFKA_TOPIC || "test";

  const rate = parseInt(process.env.MESSAGE_RATE || "100", 10);
  const durationSec = parseInt(process.env.TEST_DURATION_SEC || "600", 10);
  const count = parseInt(
    process.env.MESSAGE_COUNT || (rate * durationSec).toString(),
    10
  );
  const failAfter = parseInt(process.env.FAIL_AFTER_SEC || "0", 10);

  const brokers = (process.env.KAFKA_BROKERS || "127.0.0.1:9092")
    .split(",")
    .map((b) => b.trim());

  const kafka = new Kafka({
    clientId: "poc-client",
    brokers,
    ssl: process.env.KAFKA_SSL === "true", // para MSK/Confluent Cloud
    sasl: process.env.KAFKA_SASL_USER && {
      // idem, se precisar auth
      mechanism: "plain",
      username: process.env.KAFKA_SASL_USER,
      password: process.env.KAFKA_SASL_PASS,
    },
    // Mantém particionamento antigo, mas pode remover se não precisar
    createPartitioner: Partitioners.LegacyPartitioner,
  });
  const producer = kafka.producer({
    createPartitioner: Partitioners.LegacyPartitioner,
  });
  const consumer = kafka.consumer({ groupId: "poc-group" });

  try {
    await producer.connect();
    await consumer.connect();
    console.log("Kafka available");
  } catch (err) {
    console.error("Kafka unavailable", err);
    return;
  }

  await consumer.subscribe({ topic, fromBeginning: true });

  let sent = 0;
  let received = 0;
  const latencies = [];
  const seen = new Set();
  let duplicates = 0;

  const start = Date.now();

  if (failAfter > 0) {
    setTimeout(() => {
      console.log("Simulating Kafka failure: disconnecting producer");
      producer.disconnect().catch(() => {});
    }, failAfter * 1000);
  }

  await consumer.run({
    eachMessage: async ({ message }) => {
      if (!message.value) return;
      const { id, ts } = JSON.parse(message.value.toString());
      const now = Date.now();
      latencies.push(now - ts);
      if (seen.has(id)) duplicates++;
      else seen.add(id);
      received++;
      if (received === count) {
        const duration = (now - start) / 1000;
        console.log("p95 latency ms:", percentile(latencies, 95));
        console.log("duplicates:", duplicates);
        console.log("throughput msg/s:", (received / duration).toFixed(2));
        await producer.disconnect();
        await consumer.disconnect();
      }
    },
  });

  const sendInterval = setInterval(async () => {
    for (let i = 0; i < rate && sent < count; i++) {
      const payload = { id: sent, ts: Date.now() };
      await producer.send({
        topic,
        messages: [{ value: JSON.stringify(payload) }],
      });
      sent++;
    }
    if (sent >= count) {
      clearInterval(sendInterval);
      console.log(`Sent ${sent} messages, waiting for receipts...`);
    }
  }, 1000);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
