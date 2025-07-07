import amqp from 'amqplib';
import { v4 as uuid } from 'uuid';
import dotenv from 'dotenv'; dotenv.config();

(async () => {
  const conn = await amqp.connect(process.env.AMQP_URL);
  const ch = await conn.createChannel();
  const q = 'tracking_events';
  await ch.assertQueue(q, { durable: true });

  // dispara 10 eventos fictícios
  for (let i = 0; i < 10; i++) {
    const evt = {
      eventId: uuid(),
      userId: Math.floor(Math.random() * 1000),
      eventName: 'button_click',
      ts: new Date().toISOString(),
      attrs: { page: '/home', button: 'signup' },
    };
    ch.sendToQueue(q, Buffer.from(JSON.stringify(evt)), { persistent: true });
    console.log('sent', evt.eventId);
  }
  setTimeout(() => { conn.close(); }, 500);
})();
