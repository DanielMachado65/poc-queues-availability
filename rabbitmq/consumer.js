import amqp from "amqplib";
import { Kafka } from "kafkajs";
// import { BigQuery } from "@google-cloud/bigquery"; // Commented out for POC
import dotenv from "dotenv";
dotenv.config();

async function startConsumer() {
  const kafka = new Kafka({
    clientId: "event-forwarder",
    brokers: process.env.KAFKA_BROKERS.split(","),
  });
  const producer = kafka.producer();
  await producer.connect();

  // BigQuery setup commented out for POC
  // const bq = new BigQuery({ projectId: process.env.BQ_PROJECT_ID });
  // const table = bq.dataset(process.env.BQ_DATASET).table(process.env.BQ_TABLE);

  const conn = await amqp.connect(process.env.AMQP_URL);
  const ch = await conn.createChannel();
  const q = "tracking_events";
  await ch.assertQueue(q, { durable: true });
  ch.prefetch(10);

  console.log("Waiting for messages…");
  ch.consume(q, async (msg) => {
    if (!msg) return;
    const payload = JSON.parse(msg.content.toString());

    // envia ao Redpanda
    await producer.send({
      topic: "events",
      messages: [
        { key: payload.userId.toString(), value: JSON.stringify(payload) },
      ],
    });

    // envia ao BigQuery (commented out for POC)
    // await table.insert([{ json: payload }]); // usa streaming insert
    console.log('Message processed and sent to Kafka:', payload);

    ch.ack(msg);
  });
}

startConsumer().catch(console.error);
