const amqp = require("amqplib");
const { Kafka } = require("kafkajs");
const { percentile } = require("../util");

(async () => {
  const rabbit = await amqp.connect("amqp://localhost");
  const ch = await rabbit.createChannel();
  await ch.assertQueue("test", { durable: true });

  const brokers = (process.env.KAFKA_BROKERS || "localhost:9092").split(",").map(b => b.trim());
  console.log("Environment KAFKA_BROKERS:", process.env.KAFKA_BROKERS);
  console.log("Using brokers:", brokers);
  const kafka = new Kafka({ clientId: "bench", brokers });
  const consumer = kafka.consumer({ groupId: "bench-g" });
  await consumer.connect();
  await consumer.subscribe({ topic: "test", fromBeginning: true });

  const rate = 100; // msgs/s
  const total = 10000; // msgs

  let sent = 0,
    ack = 0;
  const lat = [];
  const t0 = Date.now();

  consumer.run({
    eachMessage: async ({ message }) => {
      const { id, ts } = JSON.parse(message.value.toString());
      lat.push(Date.now() - ts);
      if (++ack === total) {
        console.log("p95 latency ms:", percentile(lat, 95));
        console.log(
          "throughput msg/s:",
          (ack / ((Date.now() - t0) / 1000)).toFixed(2)
        );
        process.exit(0);
      }
    },
  });

  const timer = setInterval(() => {
    for (let i = 0; i < rate && sent < total; ++i) {
      const payload = Buffer.from(JSON.stringify({ id: sent, ts: Date.now() }));
      ch.sendToQueue("test", payload, { persistent: true });
      ++sent;
    }
    if (sent === total) clearInterval(timer);
  }, 1000);
})();
