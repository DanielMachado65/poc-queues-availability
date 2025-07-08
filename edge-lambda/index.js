import amqp from 'amqplib';

let connection;
let channel;

const QUEUE = process.env.RABBITMQ_QUEUE || 'tracking_events';
const URL = process.env.RABBITMQ_URL || 'amqp://localhost';

async function init() {
  if (!connection) {
    connection = await amqp.connect(URL);
    channel = await connection.createChannel();
    await channel.assertQueue(QUEUE, { durable: true });
  }
}

export const handler = async (event) => {
  try {
    await init();
  } catch (err) {
    console.error('RabbitMQ connection error', err);
    return { statusCode: 500, body: 'RabbitMQ connection error' };
  }

  let messages;
  try {
    const body = event.body || '{}';
    const parsed = JSON.parse(body);
    messages = Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return { statusCode: 400, body: 'Invalid JSON' };
  }

  for (const msg of messages) {
    const payload = Buffer.from(JSON.stringify(msg));
    channel.sendToQueue(QUEUE, payload, { persistent: true });
  }

  return { statusCode: 200, body: JSON.stringify({ sent: messages.length }) };
};
