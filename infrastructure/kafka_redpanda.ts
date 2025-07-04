import * as docker from '@pulumi/docker';

// Kafka container using bitnami Kafka image
const kafkaImage = new docker.RemoteImage('kafkaImage', {
    name: 'bitnami/kafka:3.7',
});

export const kafkaContainer = new docker.Container('kafka', {
    image: kafkaImage.repoDigest,
    ports: [
        { internal: 9092, external: 9092 },
        { internal: 9093, external: 9093 },
    ],
    envs: [
        'KAFKA_ENABLE_KRAFT=true',
        'KAFKA_CFG_NODE_ID=1',
        'KAFKA_CFG_PROCESS_ROLES=controller,broker',
        'KAFKA_CFG_CONTROLLER_LISTENER_NAMES=CONTROLLER',
        'KAFKA_CFG_CONTROLLER_QUORUM_VOTERS=1@kafka:9093',
        'KAFKA_CFG_LISTENERS=PLAINTEXT://0.0.0.0:9092,CONTROLLER://0.0.0.0:9093',
        'KAFKA_CFG_ADVERTISED_LISTENERS=PLAINTEXT://localhost:9092',
        'KAFKA_CFG_LISTENER_SECURITY_PROTOCOL_MAP=PLAINTEXT:PLAINTEXT,CONTROLLER:PLAINTEXT',
        'ALLOW_PLAINTEXT_LISTENER=yes',
    ],
});

// Redpanda container
const redpandaImage = new docker.RemoteImage('redpandaImage', {
    name: 'redpandadata/redpanda:latest',
});

export const redpandaContainer = new docker.Container('redpanda', {
    image: redpandaImage.repoDigest,
    ports: [
        { internal: 9092, external: 9094 },
        { internal: 9644, external: 9644 },
    ],
    command: ['redpanda', 'start', '--smp', '1', '--memory', '512M', '--overprovisioned', '--node-id', '0', '--check=false', '--kafka-addr', 'PLAINTEXT://0.0.0.0:9092', '--advertise-kafka-addr', 'PLAINTEXT://redpanda:9092'],
    volumes: [
        {
            containerPath: '/var/lib/redpanda/data',
            hostPath: 'redpanda_data',
        },
    ],
});

// Redpanda Console container
const consoleImage = new docker.RemoteImage('consoleImage', {
    name: 'redpandadata/console:latest',
});

export const consoleContainer = new docker.Container('redpanda-console', {
    image: consoleImage.repoDigest,
    ports: [ { internal: 8080, external: 8080 } ],
    envs: [ 'KAFKA_BROKERS=redpanda:9092' ],
});

// Kafka Connect container for Redpanda
const connectImage = new docker.RemoteImage('connectImage', {
    name: 'redpandadata/connectors:latest',
});

export const connectContainer = new docker.Container('kafka-connect', {
    image: connectImage.repoDigest,
    ports: [ { internal: 8083, external: 8083 } ],
    envs: [
        'CONNECT_CONFIGURATION=bootstrap.servers=redpanda:9092\ngroup.id=connect-cluster\nkey.converter=org.apache.kafka.connect.json.JsonConverter\nkey.converter.schemas.enable=false\nvalue.converter=org.apache.kafka.connect.json.JsonConverter\nvalue.converter.schemas.enable=false\nconfig.storage.topic=_connect_configs\noffset.storage.topic=_connect_offsets\nstatus.storage.topic=_connect_status\nplugin.path=/opt/kafka/redpanda-plugins\nrest.port=8083\noffset.storage.replication.factor=1\nconfig.storage.replication.factor=1\nstatus.storage.replication.factor=1',
    ],
});
