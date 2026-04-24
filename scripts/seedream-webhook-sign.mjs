#!/usr/bin/env node
/*
 * Seedream webhook HMAC 서명 + curl / fetch helper.
 *
 * Server B 에 배포 + Seedream Ops 가 실제 이벤트를 쏘기 전에 수동 smoke test
 * 를 하기 위한 도구. 통합 가이드 §8.3.1 / go-server/internal/infra/seedream/webhook_verify.go
 * 와 동일한 서명 알고리즘:
 *
 *   signed_payload = `${timestamp}.${rawBody}`
 *   signature      = hex(HMAC-SHA256(secret, signed_payload))
 *   header         = `sha256=${signature}`
 *
 * Headers 생성 결과:
 *   X-Seedream-Event        : <--event 값>
 *   X-Seedream-Timestamp    : <현재 Unix epoch seconds>
 *   X-Seedream-Signature    : `sha256=<hex>`
 *   X-Seedream-Delivery-Id  : <random bigint, --delivery-id 로 override 가능>
 *
 * 실행:
 *   SEEDREAM_WEBHOOK_SECRET=5e03... node scripts/seedream-webhook-sign.mjs \
 *     --event vaccount.issued \
 *     --payload scripts/fixtures/vaccount-issued.json
 *
 * --send URL 로 바로 POST:
 *   node scripts/seedream-webhook-sign.mjs \
 *     --event vaccount.issued --payload - --send https://seedreamgift.com/webhook/seedream
 *
 * 의존성 없음 — Node built-in 만 사용.
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import { request as httpsRequest } from 'node:https';
import { request as httpRequest } from 'node:http';

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--secret') out.secret = argv[++i];
    else if (a === '--event') out.event = argv[++i];
    else if (a === '--payload') out.payload = argv[++i];
    else if (a === '--delivery-id') out.deliveryId = argv[++i];
    else if (a === '--send') out.send = argv[++i];
    else if (a === '--help' || a === '-h') out.help = true;
  }
  return out;
}

function usageAndExit() {
  process.stdout.write(
    [
      'Usage: node seedream-webhook-sign.mjs [options]',
      '',
      'Options:',
      '  --secret SECRET        Webhook HMAC secret (or env SEEDREAM_WEBHOOK_SECRET)',
      '  --event EVENT          X-Seedream-Event value (e.g. vaccount.issued)',
      '  --payload PATH         Payload JSON file path, or - to read stdin',
      '  --delivery-id ID       X-Seedream-Delivery-Id (defaults random bigint)',
      '  --send URL             If set, POST to URL and print response body',
      '  --help                 Show this message',
      '',
      'Without --send, prints ready-to-run curl command.',
      '',
    ].join('\n'),
  );
  process.exit(0);
}

async function readStdin() {
  return new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => { data += chunk; });
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', reject);
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) usageAndExit();

  const secret = args.secret || process.env.SEEDREAM_WEBHOOK_SECRET;
  if (!secret) {
    process.stderr.write('ERROR: --secret 또는 SEEDREAM_WEBHOOK_SECRET env 필수\n');
    process.exit(2);
  }
  if (!args.event) {
    process.stderr.write('ERROR: --event 필수 (예: vaccount.issued)\n');
    process.exit(2);
  }
  if (!args.payload) {
    process.stderr.write('ERROR: --payload 필수 (파일 경로 또는 -)\n');
    process.exit(2);
  }

  const body = args.payload === '-'
    ? (await readStdin()).trim()
    : fs.readFileSync(args.payload, 'utf8').trim();

  // JSON 파싱 확인 — 깨진 payload 는 서버 측에서 바로 거부되므로 여기서 사전 검증.
  try { JSON.parse(body); } catch {
    process.stderr.write('ERROR: payload 가 유효한 JSON 이 아닙니다\n');
    process.exit(2);
  }

  const timestamp = String(Math.floor(Date.now() / 1000));
  const signedPayload = `${timestamp}.${body}`;
  const signature = crypto.createHmac('sha256', secret).update(signedPayload).digest('hex');
  const sigHeader = `sha256=${signature}`;
  // 9자리 랜덤 bigint (실제 Seedream 은 더 큰 값을 쓰지만 테스트용)
  const deliveryId = args.deliveryId || String(crypto.randomInt(10_000_000, 999_999_999));

  const headers = {
    'Content-Type': 'application/json',
    'X-Seedream-Event': args.event,
    'X-Seedream-Timestamp': timestamp,
    'X-Seedream-Signature': sigHeader,
    'X-Seedream-Delivery-Id': deliveryId,
  };

  if (args.send) {
    await postTo(args.send, headers, body);
    return;
  }

  // curl template 출력
  const headerFlags = Object.entries(headers)
    .map(([k, v]) => `  -H '${k}: ${v}' \\`)
    .join('\n');
  process.stdout.write(
    [
      '# Computed signature (copy to terminal):',
      '',
      `curl -X POST '<webhook-url>' \\`,
      headerFlags,
      `  --data '${body.replace(/'/g, `'\\''`)}'`,
      '',
      '# Headers (if you prefer Postman / Insomnia):',
      ...Object.entries(headers).map(([k, v]) => `# ${k}: ${v}`),
      '',
    ].join('\n'),
  );
}

function postTo(urlStr, headers, body) {
  return new Promise((resolve, reject) => {
    let url;
    try { url = new URL(urlStr); } catch (e) { reject(e); return; }
    const doReq = url.protocol === 'https:' ? httpsRequest : httpRequest;
    const req = doReq(
      {
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname + url.search,
        method: 'POST',
        headers: { ...headers, 'Content-Length': Buffer.byteLength(body) },
      },
      (res) => {
        let chunks = '';
        res.setEncoding('utf8');
        res.on('data', (c) => { chunks += c; });
        res.on('end', () => {
          process.stdout.write(`HTTP ${res.statusCode}\n`);
          for (const [k, v] of Object.entries(res.headers)) {
            process.stdout.write(`${k}: ${v}\n`);
          }
          process.stdout.write(`\n${chunks}\n`);
          resolve();
        });
      },
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

main().catch((err) => {
  process.stderr.write(`${err?.stack || err}\n`);
  process.exit(1);
});
