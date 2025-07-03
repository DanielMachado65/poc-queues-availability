import * as aws from '@pulumi/aws';

// SQS Queue
export const queue = new aws.sqs.Queue('eventQueue');

// AmazonMQ RabbitMQ Broker
export const broker = new aws.mq.Broker('rabbitBroker', {
    brokerName: 'rabbit-broker',
    engineType: 'RabbitMQ',
    engineVersion: '3.10.20',
    hostInstanceType: 'mq.t3.micro',
    publiclyAccessible: true,
    users: [{ username: 'user', password: 'Password123!' }],
});

export const brokerEndpoint = broker.instances.apply(instances => instances[0].consoleUrl);
