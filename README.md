# poc-queues-availability

This repository contains simple scripts to test different messaging technologies (RabbitMQ, AWS SQS, NATS and Kafka). Each script sends and receives a single message demonstrating basic connectivity.

## Requirements

- Node.js 20+
- Optional: Pulumi CLI if you want to deploy infrastructure using the files in the `infrastructure/` directory.

Install dependencies once:

```bash
npm install
```

You can run the example scripts via npm:

```bash
npm run rabbitmq   # test RabbitMQ
npm run sqs        # test SQS
npm run nats       # test NATS
npm run kafka      # test Kafka
```

## Running Messaging Services Locally

Start RabbitMQ, NATS, Kafka and a local SQS implementation using Docker Compose:

```bash
docker-compose up -d
```

This will expose the following ports:

- RabbitMQ: `5672` (AMQP) and `15672` (management UI)
- NATS: `4222`
- LocalStack (SQS): `4566`
- Kafka: `9092`

Set the following environment variables when running the scripts to connect to
these local services:

- `RABBITMQ_URL=amqp://localhost`
- `NATS_URL=nats://localhost:4222`
- `KAFKA_BROKERS=localhost:9092`
- `AWS_REGION=us-east-1`
- `SQS_ENDPOINT=http://localhost:4566`
- optionally `AWS_ACCESS_KEY_ID=test` and `AWS_SECRET_ACCESS_KEY=test`
- `MESSAGE_RATE=100` number of messages per second (default)
- `TEST_DURATION_SEC=600` duration in seconds (default 10 minutes)
- `FAIL_AFTER_SEC` seconds after start to simulate a connection failure (optional)

## RabbitMQ Test

Set `RABBITMQ_URL` to your RabbitMQ server (for example from AmazonMQ) and optionally `RABBITMQ_QUEUE`.

Run (you can override `MESSAGE_RATE`, `TEST_DURATION_SEC` and `FAIL_AFTER_SEC`):

```bash
node rabbitmq_test.js
```

## SQS Test

Configure AWS credentials and set `AWS_REGION` and optionally `SQS_QUEUE`.

Run (you can override `MESSAGE_RATE`, `TEST_DURATION_SEC` and `FAIL_AFTER_SEC`):

```bash
node sqs_test.js
```

## NATS Test

Set `NATS_URL` to your NATS server and optionally `NATS_SUBJECT`.

Run (you can override `MESSAGE_RATE`, `TEST_DURATION_SEC` and `FAIL_AFTER_SEC`):

```bash
node nats_test.js
```

## Kafka Test

Set `KAFKA_BROKERS` to your Kafka brokers (for example from Amazon MSK or Confluent Cloud) and optionally `KAFKA_TOPIC`.

Run (you can override `MESSAGE_RATE`, `TEST_DURATION_SEC` and `FAIL_AFTER_SEC`):

```bash
node kafka_test.js
```

## BigQuery Test

Use `npm run bigquery` to insert events directly into Google BigQuery. Set `BIGQUERY_DATASET` and `BIGQUERY_TABLE` along with your credentials. The script reports basic latency and throughput metrics.

## Kafka to BigQuery Flow

Run `npm run kafka-bigquery` to publish messages to Kafka and immediately insert
them into BigQuery. Configure the same environment variables as `kafka_test.js`
for Kafka connectivity plus `BIGQUERY_DATASET` and `BIGQUERY_TABLE` for the
destination table. The message rate and duration are controlled via
`MESSAGE_RATE`, `TEST_DURATION_SEC` and `MESSAGE_COUNT`.

## Redpanda & Redpanda Connect

Spin up the `redpanda` service from `docker-compose.yml` and run `kafka_test.js` with `KAFKA_BROKERS=localhost:9094`. Redpanda Connect can forward these events to sinks such as BigQuery.

## Node-RED

The compose file also provides a `nodered` service on port `1880`. Build flows that consume from your queues and send data to BigQuery using available nodes.

## Pulumi

The `infrastructure/` folder contains a small Pulumi program that provisions an SQS queue and a RabbitMQ broker using AmazonMQ. Initialize a Pulumi stack and run `pulumi up` to deploy (AWS credentials required).

A second program `kafka_redpanda.ts` creates Docker containers for Kafka and Redpanda using Pulumi. This allows you to spin up the local broker stack with `pulumi up` instead of using Docker Compose.
