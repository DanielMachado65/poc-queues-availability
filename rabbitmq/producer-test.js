import amqp from 'amqplib';
import dotenv from 'dotenv';
import { percentile } from '../util.js';
dotenv.config();

const url        = process.env.RABBITMQ_URL   ?? 'amqp://localhost';
const queue      = process.env.RABBITMQ_QUEUE ?? 'test';
const RATE       = Number(process.env.MESSAGE_RATE || 100);   // msg/s
const DURATION   = Number(process.env.TEST_DURATION_SEC || 60 * 10); // 10 min
const TOTAL      = Number(process.env.MESSAGE_COUNT || RATE * DURATION);
const FAIL_AFTER = Number(process.env.FAIL_AFTER_SEC || 0);   // s

(async () => {
  // 1. Conexão / canal
  const conn = await amqp.connect(url);
  const ch   = await conn.createChannel();
  await ch.assertQueue(queue, { durable: true });
  ch.prefetch(100);            // permite processamento em paralelo

  // 2. Métricas
  let sent = 0, received = 0, duplicates = 0;
  const seen = new Set();
  const latencies = [];
  const startHR = process.hrtime.bigint();   // nanosegundos
  const startMs = Number(startHR / 1_000_000n);

  // 3. Consumidor (loop-back)
  ch.consume(queue, (msg) => {
    if (!msg) return;
    const { id, ts } = JSON.parse(msg.content.toString());
    const now = Date.now();
    latencies.push(now - ts);
    if (seen.has(id)) duplicates++;
    seen.add(id);
    received++;
    ch.ack(msg);

    if (received === TOTAL) finish(now);
  }, { noAck: false });

  // 4. Falha simulada (opcional)
  if (FAIL_AFTER > 0) {
    setTimeout(() => {
      console.log('⛔  Simulando falha: fechando conexão RabbitMQ');
      conn.close().catch(() => {});
    }, FAIL_AFTER * 1000);
  }

  // 5. Produtor – envia RATE msg/s com timer de alta precisão
  const interval = 1000 / RATE;
  let nextSend = Date.now();
  function schedule() {
    const now = Date.now();
    if (sent < TOTAL) {
      if (now >= nextSend) {
        const payload = { id: sent, ts: now };
        ch.sendToQueue(queue, Buffer.from(JSON.stringify(payload)), { persistent: true });
        sent++;
        nextSend += interval;
      }
      setImmediate(schedule);       // evita drift de setInterval
    } else {
      console.log(`✅  Enviadas ${sent} mensagens – aguardando confirmações…`);
    }
  }
  schedule();

  // 6. Finalização e impressão de métricas
  function finish(endMs) {
    const durationSec = (endMs - startMs) / 1000;
    console.log('───────── RESULTADOS ─────────');
    console.log('Total mensagens:', TOTAL);
    console.log('Duração teste s:', durationSec.toFixed(2));
    console.log('Throughput msg/s:', (received / durationSec).toFixed(2));
    console.log('Latência p50 ms :', percentile(latencies, 50).toFixed(2));
    console.log('Latência p95 ms :', percentile(latencies, 95).toFixed(2));
    console.log('Latência p99 ms :', percentile(latencies, 99).toFixed(2));
    console.log('Duplicatas      :', duplicates);
    conn.close();
    process.exit(0);
  }
})();
