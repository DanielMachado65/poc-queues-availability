# poc-queues-availability

This repository contains simple scripts to test different messaging technologies (RabbitMQ, AWS SQS and NATS). Each script sends and receives a single message demonstrating basic connectivity.

## Requirements

- Node.js 20+
- Optional: Pulumi CLI if you want to deploy infrastructure using the files in the `infrastructure/` directory.

Install dependencies once:

```bash
npm install
```

## RabbitMQ Test

Set `RABBITMQ_URL` to your RabbitMQ server (for example from AmazonMQ) and optionally `RABBITMQ_QUEUE`.

Run:

```bash
node rabbitmq_test.js
```

## SQS Test

Configure AWS credentials and set `AWS_REGION` and optionally `SQS_QUEUE`.

Run:

```bash
node sqs_test.js
```

## NATS Test

Set `NATS_URL` to your NATS server and optionally `NATS_SUBJECT`.

Run:

```bash
node nats_test.js
```

## Pulumi

The `infrastructure/` folder contains a small Pulumi program that provisions an SQS queue and a RabbitMQ broker using AmazonMQ. Initialize a Pulumi stack and run `pulumi up` to deploy (AWS credentials required).
