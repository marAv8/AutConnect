import { mkdir, writeFile, rename, unlink } from 'node:fs/promises';
import { tmpdir, networkInterfaces } from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { getSession } from '@/lib/session';
import { db } from '@/lib/db';
import { validLocalTrace } from '@/diagnostics/validateLocalTrace';

export const runtime = 'nodejs';
const MAX_BYTES = 2_000_000;
export async function POST(request: Request) {
  // Never collect diagnostics on Vercel or in a production build.
  if (process.env.NODE_ENV !== 'development' || process.env.VERCEL) return new Response(null, { status: 404 });
  const origin = request.headers.get('origin');
  const host = request.headers.get('host');
  let parsed: URL;
  try { parsed = new URL(origin || ''); } catch { return new Response(null, { status: 403 }); }
  const addresses = new Set(['localhost', '127.0.0.1', '[::1]', ...Object.values(networkInterfaces()).flatMap(items => (items || []).map(item => item.address))]);
  if (parsed.host !== host || !addresses.has(parsed.hostname)) return new Response(null, { status: 403 });
  const session = await getSession();
  if (!session) return new Response(null, { status: 401 });
  const actor = await db.provider.findUnique({ where: { id: session.providerId }, select: { status: true } });
  if (actor?.status !== 'ACTIVE') return new Response(null, { status: 403 });
  if (!request.headers.get('content-type')?.startsWith('application/json')) return new Response(null, { status: 415 });
  const reader = request.body?.getReader();
  if (!reader) return new Response(null, { status: 400 });
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > MAX_BYTES) { await reader.cancel(); return new Response(null, { status: 413 }); }
    chunks.push(value);
  }
  let trace: unknown;
  try { trace = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { return new Response(null, { status: 400 }); }
  const directory = path.join(tmpdir(), 'autconnect-local-diagnostic');
  if (!validLocalTrace(trace)) {
    // Record rejection categories, never rejected values or arbitrary keys.
    let category = 'structure';
    let index = -1;
    if (Array.isArray(trace)) {
      index = trace.findIndex(item => !validLocalTrace([item]));
      const item = trace[index];
      if (item && typeof item === 'object') {
        for (const key of ['type', 'phase', 'target', 'expectedControls', 'surfaces', 'hit', 'ancestors', 'label']) {
          if (key in item && !validLocalTrace([{ sequence: 1, kind: 'input', [key]: item[key] }])) { category = key; break; }
        }
      }
    }
    await mkdir(directory, { recursive: true, mode: 0o700 });
    await writeFile(path.join(directory, 'last-rejection.json'), JSON.stringify({ receivedAt: new Date().toISOString(), count: Array.isArray(trace) ? trace.length : 0, index, category }), { mode: 0o600 });
    return new Response(null, { status: 422 });
  }
  const temporary = path.join(directory, `${randomUUID()}.tmp`);
  try {
    await mkdir(directory, { recursive: true, mode: 0o700 });
    await writeFile(temporary, JSON.stringify(trace), { mode: 0o600, flag: 'wx' });
    await rename(temporary, path.join(directory, 'latest.json'));
    if (trace.some(item => item.kind === 'input')) {
      await writeFile(path.join(directory, 'latest-with-input.json'), JSON.stringify(trace), { mode: 0o600 });
    }
  } catch {
    await unlink(temporary).catch(() => {});
    return new Response(null, { status: 500 });
  }
  return Response.json({ received: trace.length }, { headers: { 'Cache-Control': 'no-store' } });
}
