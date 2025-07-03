const {
  SQSClient,
  CreateQueueCommand,
  SendMessageCommand,
  ReceiveMessageCommand,
  DeleteMessageCommand,
} = require("@aws-sdk/client-sqs");

async function main() {
  const queueName = process.env.SQS_QUEUE || "test-queue";
  const region = process.env.AWS_REGION || "us-east-1";
  const endpoint = process.env.SQS_ENDPOINT || "http://localhost:4566";
  const useDummyCreds =
    endpoint &&
    !process.env.AWS_ACCESS_KEY_ID &&
    !process.env.AWS_SECRET_ACCESS_KEY;

  const client = new SQSClient({
    region,
    ...(endpoint ? { endpoint } : {}),
    ...(useDummyCreds
      ? { credentials: { accessKeyId: "test", secretAccessKey: "test" } }
      : {}),
  });

  console.log(
    "Using SQS client with region:",
    region,
    "and endpoint:",
    endpoint || "default"
  );

  const { QueueUrl } = await client.send(
    new CreateQueueCommand({ QueueName: queueName })
  );
  const message = "Hello SQS";
  await client.send(new SendMessageCommand({ QueueUrl, MessageBody: message }));
  console.log("Sent:", message);

  const { Messages } = await client.send(
    new ReceiveMessageCommand({ QueueUrl, WaitTimeSeconds: 5 })
  );
  if (Messages && Messages.length > 0) {
    const m = Messages[0];
    console.log("Received:", m.Body);
    await client.send(
      new DeleteMessageCommand({ QueueUrl, ReceiptHandle: m.ReceiptHandle })
    );
  }
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
