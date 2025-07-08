import * as aws from '@pulumi/aws';
import * as pulumi from '@pulumi/pulumi';

// RabbitMQ broker using AmazonMQ
export const broker = new aws.mq.Broker('edgeBroker', {
    brokerName: 'edge-broker',
    engineType: 'RabbitMQ',
    engineVersion: '3.10.20',
    hostInstanceType: 'mq.t3.micro',
    publiclyAccessible: true,
    users: [{ username: 'user', password: 'Password123!' }],
});

const role = new aws.iam.Role('edgeLambdaRole', {
    assumeRolePolicy: aws.iam.assumeRolePolicyForPrincipal({
        Service: 'lambda.amazonaws.com',
    }),
});

new aws.iam.RolePolicyAttachment('edgeLambdaBasic', {
    role: role.name,
    policyArn: aws.iam.ManagedPolicies.AWSLambdaBasicExecutionRole,
});

const lambda = new aws.lambda.Function('rabbitEdgeHandler', {
    runtime: aws.lambda.Runtime.NodeJS20dX, // Node 20
    role: role.arn,
    handler: 'index.handler',
    code: new pulumi.asset.AssetArchive({
        '.': new pulumi.asset.FileArchive('../edge-lambda'),
    }),
    environment: {
        variables: {
            RABBITMQ_URL: broker.amqpEndpoints.apply(e => e[0]),
            RABBITMQ_QUEUE: 'tracking_events',
        },
    },
});

export const lambdaArn = lambda.arn;
export const brokerEndpoint = broker.instances.apply(i => i[0].consoleUrl);
