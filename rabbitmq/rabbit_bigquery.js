const amqp = require('amqplib');
const { Kafka } = require('kafkajs');
const { BigQuery } = require('@google-cloud/bigquery');
const { percentile } = require('../util');

async function main() {
  const rabbitUrl = process.env.RABBITMQ_URL || 'amqp://localhost';
  const rabbitQueue = process.env.RABBITMQ_QUEUE || 'test';
  const kafkaTopic = process.env.KAFKA_TOPIC || 'test';
  const brokers = (process.env.KAFKA_BROKERS || '127.0.0.1:9092')
    .split(',')
    .map((b) => b.trim());
  const datasetId = process.env.BIGQUERY_DATASET || 'test';
  const tableId = process.env.BIGQUERY_TABLE || 'messages';
  const projectId = process.env.BQ_PROJECT_ID;

  const rate = parseInt(process.env.MESSAGE_RATE || '100', 10);
  const durationSec = parseInt(process.env.TEST_DURATION_SEC || '600', 10);
  const count = parseInt(
    process.env.MESSAGE_COUNT || (rate * durationSec).toString(),
    10
  );

  const bigquery = new BigQuery(projectId ? { projectId } : {});
  const table = bigquery.dataset(datasetId).table(tableId);

  const rabbitConn = await amqp.connect(rabbitUrl);
  const rabbitChannel = await rabbitConn.createChannel();
  await rabbitChannel.assertQueue(rabbitQueue, { durable: true });

  const kafka = new Kafka({ clientId: 'poc-client', brokers });
  const producer = kafka.producer();
  const consumer = kafka.consumer({ groupId: 'poc-group' });

  await producer.connect();
  await consumer.connect();
  await consumer.subscribe({ topic: kafkaTopic, fromBeginning: true });

  console.log('RabbitMQ and Redpanda available, starting test');

  let sent = 0;
  let inserted = 0;
  const latencies = [];
  const start = Date.now();

  // Consume from Kafka and insert into BigQuery
  consumer.run({
    eachMessage: async ({ message }) => {
      if (!message.value) return;
      const payload = JSON.parse(message.value.toString());
      try {
        // Simulate BigQuery insert
        // await table.insert([payload]);
        setTimeout(() => {}, 0);
        latencies.push(Date.now() - payload.ts);
      } catch (err) {
        console.error('BigQuery insert error:', err.errors || err);
      }
      inserted++;
      if (inserted === count) {
        const duration = (Date.now() - start) / 1000;
        console.log('p95 latency ms:', percentile(latencies, 95));
        console.log('throughput msg/s:', (inserted / duration).toFixed(2));
        await producer.disconnect();
        await consumer.disconnect();
        await rabbitConn.close();
      }
    },
  });

  // Consume from RabbitMQ and forward to Kafka
  await rabbitChannel.consume(
    rabbitQueue,
    async (msg) => {
      if (msg) {
        await producer.send({
          topic: kafkaTopic,
          messages: [{ value: msg.content.toString() }],
        });
        rabbitChannel.ack(msg);
      }
    },
    { noAck: false }
  );

  // Publish messages to RabbitMQ
  const sendInterval = setInterval(() => {
    for (let i = 0; i < rate && sent < count; i++) {
      const payload = { id: sent, ts: Date.now() };
      rabbitChannel.sendToQueue(rabbitQueue, Buffer.from(JSON.stringify(payload)), {
        persistent: true,
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
  console.error('Error:', err);
  process.exit(1);
});