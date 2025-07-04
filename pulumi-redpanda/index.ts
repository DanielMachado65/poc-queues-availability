import * as pulumi from "@pulumi/pulumi";
import * as docker from "@pulumi/docker";

// Rede Docker local
const network = new docker.Network("redpanda-network", {
  name: "redpanda-net",
});

// Redpanda Broker
const redpanda = new docker.Container("redpanda", {
  image: "redpandadata/redpanda:latest",
  name: "redpanda",
  networksAdvanced: [{ name: network.name }],
  ports: [
    { internal: 9092, external: 9092 },
    { internal: 9644, external: 9644 },
  ],
  command: [
    "redpanda",
    "start",
    "--smp",
    "1",
    "--memory",
    "512M",
    "--overprovisioned",
    "--node-id",
    "0",
    "--check=false",
    "--kafka-addr",
    "PLAINTEXT://0.0.0.0:9092",
    "--advertise-kafka-addr",
    "PLAINTEXT://localhost:9092",
  ],
});

// Redpanda Console
const console = new docker.Container("redpanda-console", {
  image: "redpandadata/console:latest",
  name: "redpanda-console",
  networksAdvanced: [{ name: network.name }],
  ports: [{ internal: 8080, external: 8080 }],
  envs: ["KAFKA_BROKERS=redpanda:9092"],
});

// Kafka Connect
const connect = new docker.Container("redpanda-connect", {
  image: "redpandadata/connectors:latest",
  name: "kafka-connect",
  networksAdvanced: [{ name: network.name }],
  ports: [{ internal: 8083, external: 8083 }],
  envs: [
    `KAFKA_CONNECT_CONFIGURATION=${[
      "bootstrap.servers=redpanda:9092",
      "group.id=connect-cluster",
      "key.converter=org.apache.kafka.connect.json.JsonConverter",
      "value.converter=org.apache.kafka.connect.json.JsonConverter",
      "key.converter.schemas.enable=false",
      "value.converter.schemas.enable=false",
      "config.storage.topic=_connect_configs",
      "offset.storage.topic=_connect_offsets",
      "status.storage.topic=_connect_status",
      "plugin.path=/opt/kafka/redpanda-plugins",
      "rest.port=8083",
    ].join("\\n")}`,
  ],
});

export const redpandaUI = pulumi.output("http://localhost:8080");
export const kafkaConnectAPI = pulumi.output("http://localhost:8083");
