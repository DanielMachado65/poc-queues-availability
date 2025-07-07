import { Kafka } from 'kafkajs';
import dotenv from 'dotenv';
dotenv.config();

const kafka = new Kafka({ clientId: 'latency-probe', brokers: ['localhost:19092'] });
const consumer = kafka.consumer({ groupId: 'probe' });

await consumer.connect();
await consumer.subscribe({ topic: 'events', fromBeginning: false });

consumer.run({
  eachMessage: async ({ message }) => {
    const { id, ts } = JSON.parse(message.value.toString());
    const e2e = Date.now() - ts;
    console.log(`id ${id}  e2e ${e2e} ms`);
    // … (colete estatísticas como no script anterior)
  },
});
