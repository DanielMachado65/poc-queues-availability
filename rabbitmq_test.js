const amqp = require('amqplib');

async function main() {
  const url = process.env.RABBITMQ_URL || 'amqp://localhost';
  const queue = process.env.RABBITMQ_QUEUE || 'test';

  const connection = await amqp.connect(url);
  const channel = await connection.createChannel();
  await channel.assertQueue(queue, { durable: true });

  const message = 'Hello RabbitMQ';
  await channel.sendToQueue(queue, Buffer.from(message), { persistent: true });
  console.log('Sent:', message);

  await channel.consume(queue, msg => {
    if (msg !== null) {
      console.log('Received:', msg.content.toString());
      channel.ack(msg);
      connection.close();
    }
  }, { noAck: false });

  console.log('Waiting for message...');
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
