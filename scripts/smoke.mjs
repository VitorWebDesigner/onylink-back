/**
 * Smoke-test do backend OnyLink — exercita o funil real respeitando o
 * envelope payload-in-JWT (§5.1) e o Bearer de identidade (§5.2).
 *
 * Uso: node scripts/smoke.mjs   (com o backend rodando em :4444)
 * Requer: Postgres + Redis no ar (docker compose up -d) e migrations aplicadas.
 */
import 'dotenv/config';
import jwt from 'jsonwebtoken';
import axios from 'axios';

const BASE = `http://localhost:${process.env.PORT ?? 4444}`;
const T = process.env.TRANSPORT_SECRET;
if (!T) { console.error('TRANSPORT_SECRET ausente no .env'); process.exit(1); }

const http = axios.create({ baseURL: BASE, validateStatus: () => true, timeout: 15000 });
const enc = (d) => ({ payload: jwt.sign({ d }, T, { expiresIn: '10m' }) });
const dec = (raw) => {
  const p = raw?.payload;
  if (!p) throw new Error('resposta sem payload: ' + JSON.stringify(raw));
  return jwt.verify(p, T).d;
};

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✓ ${name}${extra ? ' — ' + extra : ''}`); }
  else { fail++; console.log(`  ✗ ${name}${extra ? ' — ' + extra : ''}`); }
};

async function main() {
  console.log(`\n▶ Smoke-test em ${BASE}\n`);

  // 1) Health
  {
    const r = await http.get('/health');
    ok('GET /health', r.status === 200 && r.data?.ok === true, `status ${r.status}`);
  }

  // 2) Register (sem rate-limit; cria usuário + tokens)
  const email = `smoke_${Date.now()}@onylink.test`;
  let access = null;
  {
    const r = await http.post('/web/auth/register', enc({ name: 'Smoke Tester', email, password: 'senha12345' }));
    const body = dec(r.data);
    ok('POST /web/auth/register', body.boleano === true, body.mensagem);
    ok('  → accessToken presente', !!body.obj?.accessToken);
    ok('  → user.email confere', body.obj?.user?.email === email);
    access = body.obj?.accessToken;
  }
  if (!access) { console.log('\nSem accessToken — abortando.'); summary(); return; }
  const auth = { headers: { Authorization: `Bearer ${access}` } };

  // 3) /me (valida o Bearer)
  {
    const r = await http.get('/web/auth/me', auth);
    const body = dec(r.data);
    ok('GET /web/auth/me', body.boleano === true && body.obj?.email === email);
  }

  // 4) Diagnóstico (porta de aquisição)
  {
    const answers = {
      financeiro: [4, 3, 5], comercial: [2, 2, 3],
      marketing: [1, 2, 1], gestao: [3, 4, 3],
    };
    const r = await http.post('/web/diagnostics', enc({ answers }), auth);
    const body = dec(r.data);
    ok('POST /web/diagnostics', body.boleano === true, body.mensagem);
    ok('  → total 0..100', typeof body.obj?.total === 'number' && body.obj.total >= 0 && body.obj.total <= 100, `total=${body.obj?.total}`);
    ok('  → scores por área', !!body.obj?.scores?.financeiro !== undefined && body.obj?.scores?.marketing !== undefined);
    ok('  → recomenda marketing (score baixo)', Array.isArray(body.obj?.recommendations) && body.obj.recommendations.some((x) => x.area === 'marketing'));
  }

  // 5) Feed (vazio é ok — só valida shape)
  {
    const r = await http.get('/web/posts?cursor=0&limit=5', auth);
    const body = dec(r.data);
    ok('GET /web/posts (feed)', body.boleano === true && Array.isArray(body.obj?.items), `${body.obj?.items?.length ?? 0} itens`);
  }

  // 6) Criar post (rate-limit + fila de moderação — exige Redis)
  {
    const r = await http.post('/web/posts', enc({ category: 'Gestão', content: 'Post de smoke-test. Foco em gestão.' }), auth);
    const body = dec(r.data);
    ok('POST /web/posts', body.boleano === true, body.mensagem);
    ok('  → status PENDING (vai pra moderação IA)', body.obj?.status === 'PENDING', `status=${body.obj?.status}`);
  }

  summary();
}

function summary() {
  console.log(`\n──────── ${pass} passou · ${fail} falhou ────────\n`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => { console.error('\nERRO fatal no smoke:', e.message); process.exit(1); });
