const { Kafka, Partitioners } = require("kafkajs");
const { BigQuery } = require("@google-cloud/bigquery");
const { percentile } = require("./util");

async function main() {
  const topic = process.env.KAFKA_TOPIC || "test";
  const datasetId = process.env.BIGQUERY_DATASET || "test";
  const tableId = process.env.BIGQUERY_TABLE || "messages";
  const projectId = process.env.BQ_PROJECT_ID;

  const rate = parseInt(process.env.MESSAGE_RATE || "100", 10);
  const durationSec = parseInt(process.env.TEST_DURATION_SEC || "600", 10);
  const count = parseInt(
    process.env.MESSAGE_COUNT || (rate * durationSec).toString(),
    10
  );

  const bigquery = new BigQuery(projectId ? { projectId } : {});
  const table = bigquery.dataset(datasetId).table(tableId);

  const brokers = (process.env.KAFKA_BROKERS || "127.0.0.1:9092")
    .split(",")
    .map((b) => b.trim());

  // create a new Kafka client
  const kafka = new Kafka({
    clientId: "poc-client",
    brokers,
    ssl: process.env.KAFKA_SSL === "true",
    sasl: process.env.KAFKA_SASL_USER && {
      mechanism: "plain",
      username: process.env.KAFKA_SASL_USER,
      password: process.env.KAFKA_SASL_PASS,
    },
    createPartitioner: Partitioners.LegacyPartitioner,
  });

  const producer = kafka.producer({
    createPartitioner: Partitioners.LegacyPartitioner,
  });
  const consumer = kafka.consumer({ groupId: "poc-group" });

  await producer.connect();
  await consumer.connect();
  await consumer.subscribe({ topic, fromBeginning: true });
  console.log("Kafka available, starting test");

  let sent = 0;
  let inserted = 0;
  const latencies = [];

  const start = Date.now();

  // for each message published in big query
  consumer.run({
    eachMessage: async ({ message }) => {
      if (!message.value) return;
      const payload = JSON.parse(message.value.toString());
      const insertStart = Date.now();
      console.log(
        "inserted",
        insertStart.toLocaleString(),
        "payload",
        payload.id
      );
      try {
        await table.insert([payload]);
        latencies.push(Date.now() - payload.ts);
      } catch (err) {
        console.error("BigQuery insert error:", err.errors || err);
      }
      inserted++;
      if (inserted === count) {
        const duration = (Date.now() - start) / 1000;
        console.log("p95 latency ms:", percentile(latencies, 95));
        console.log("throughput msg/s:", (inserted / duration).toFixed(2));
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
      console.log(`Sent ${sent} messages, waiting for processing...`);
    }
  }, 1000);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
