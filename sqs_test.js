const {
  SQSClient,
  CreateQueueCommand,
  SendMessageCommand,
  ReceiveMessageCommand,
  DeleteMessageCommand,
} = require('@aws-sdk/client-sqs');

async function main() {
  const queueName = process.env.SQS_QUEUE || 'test-queue';
  const region = process.env.AWS_REGION || 'us-east-1';
  const endpoint = process.env.SQS_ENDPOINT;

  const client = new SQSClient({
    region,
    ...(endpoint ? { endpoint } : {}),
  });

  const { QueueUrl } = await client.send(new CreateQueueCommand({ QueueName: queueName }));
  const message = 'Hello SQS';
  await client.send(new SendMessageCommand({ QueueUrl, MessageBody: message }));
  console.log('Sent:', message);

  const { Messages } = await client.send(new ReceiveMessageCommand({ QueueUrl, WaitTimeSeconds: 5 }));
  if (Messages && Messages.length > 0) {
    const m = Messages[0];
    console.log('Received:', m.Body);
    await client.send(new DeleteMessageCommand({ QueueUrl, ReceiptHandle: m.ReceiptHandle }));
  }
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
