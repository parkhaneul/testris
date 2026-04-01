/**
 * Supabase Edge Function: /functions/v1/api
 *
 * 보안 레이어:
 * 1. 모든 DB 접근은 이 함수를 통해서만 가능 (Service Role Key는 환경변수에만 존재)
 * 2. 세션 토큰: 게임 시작 시 발급 → HMAC-SHA256 서명 → 제출 시 검증
 * 3. 1회용 토큰: 사용된 토큰은 DB에 기록되어 재사용 불가
 * 4. 점수 범위 검증: 이론적 최대값 초과 시 거부
 * 5. 게임 시간 검증: 토큰 발급 후 100초+여유 내에서만 제출 가능
 * 6. Rate limiting: IP 기준 최소 간격 제한
 * 7. 닉네임 sanitize
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ─── 환경변수 (Supabase Dashboard > Edge Functions > Secrets 에서 설정) ───
const SUPABASE_URL      = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const HMAC_SECRET       = Deno.env.get('HMAC_SECRET')!;       // 임의의 긴 문자열
const ALLOWED_ORIGIN    = Deno.env.get('ALLOWED_ORIGIN') ?? '*'; // 배포 도메인으로 제한 권장

// ─── 게임 상수 ───────────────────────────────────────────────────────────────
const GAME_DURATION_S = 100;
const TOKEN_TTL_S     = GAME_DURATION_S + 60;  // 토큰 유효시간 (여유 포함)
const MAX_SCORE       = 9 * 9 * 10 * 50;       // 이론적 최대 (매우 관대하게 설정)
const MAX_NAME_LEN    = 8;

// ─── Rate limit (단순 메모리, 단일 인스턴스 한정) ───────────────────────────
const ipLastSubmit = new Map<string, number>();

function checkRateLimit(ip: string): boolean {
  const now  = Date.now();
  const last = ipLastSubmit.get(ip) ?? 0;
  if (now - last < 8_000) return false; // 8초 쿨다운
  ipLastSubmit.set(ip, now);
  return true;
}

// ─── HMAC 유틸 ───────────────────────────────────────────────────────────────

async function hmacKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(HMAC_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

async function signToken(issuedAt: number): Promise<string> {
  const key = await hmacKey();
  const msg = new TextEncoder().encode(String(issuedAt));
  const sig = await crypto.subtle.sign('HMAC', key, msg);
  const hex = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
  return `${issuedAt}.${hex}`;
}

async function verifyToken(token: string): Promise<{ ok: boolean; issuedAt: number }> {
  const dot = token.indexOf('.');
  if (dot < 0) return { ok: false, issuedAt: 0 };

  const issuedAt = parseInt(token.slice(0, dot), 10);
  if (isNaN(issuedAt)) return { ok: false, issuedAt: 0 };

  const expected = await signToken(issuedAt);

  // 상수 시간 비교 (타이밍 공격 방지)
  if (token.length !== expected.length) return { ok: false, issuedAt: 0 };
  let eq = true;
  for (let i = 0; i < token.length; i++) {
    if (token.charCodeAt(i) !== expected.charCodeAt(i)) eq = false;
  }
  return { ok: eq, issuedAt };
}

// ─── Supabase 클라이언트 ─────────────────────────────────────────────────────

const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// ─── CORS 헤더 ───────────────────────────────────────────────────────────────

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin':  ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
  });
}

function err(msg: string, status: number) {
  return new Response(msg, { status, headers: corsHeaders() });
}

// ─── 핸들러 ──────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  // Preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders() });
  }
  if (req.method !== 'POST') return err('Method Not Allowed', 405);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return err('Bad Request', 400);
  }

  const action = body.action as string;
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';

  // ── action: start ─────────────────────────────────────────────────────────
  if (action === 'start') {
    const token = await signToken(Date.now());
    return json({ token });
  }

  // ── action: record ────────────────────────────────────────────────────────
  if (action === 'record') {
    const { token, name, score } = body as { token: string; name: string; score: unknown };

    // 필드 검증
    if (typeof token !== 'string' || typeof name !== 'string' || score === undefined) {
      return err('Missing fields', 400);
    }

    // Rate limit
    if (!checkRateLimit(ip)) return err('Too Many Requests', 429);

    // 토큰 서명 검증
    const { ok, issuedAt } = await verifyToken(token);
    if (!ok) return err('Invalid token', 403);

    // 토큰 만료 검증
    const elapsedS = (Date.now() - issuedAt) / 1000;
    if (elapsedS > TOKEN_TTL_S || elapsedS < 0) {
      return err('Token expired or invalid', 403);
    }

    // 1회용 토큰 검증 (재사용 방지)
    const { data: usedToken } = await db
      .from('used_tokens')
      .select('token')
      .eq('token', token)
      .maybeSingle();

    if (usedToken) return err('Token already used', 403);

    // 점수 검증 및 정규화
    const scoreNum = Math.max(0, Math.min(MAX_SCORE, Math.floor(Number(score))));
    if (isNaN(scoreNum)) return err('Invalid score', 400);

    // 닉네임 sanitize
    const safeName = String(name)
      .trim()
      .slice(0, MAX_NAME_LEN)
      .replace(/[<>&"'`]/g, '');
    if (!safeName) return err('Invalid name', 400);

    // 토큰 사용 기록 (삽입 실패 시 = 동시 중복 제출 시도 → 거부)
    const { error: tokenErr } = await db
      .from('used_tokens')
      .insert({ token, ip });

    if (tokenErr) return err('Duplicate submission', 409);

    // 점수 저장
    const { error: scoreErr } = await db
      .from('scores')
      .insert({ name: safeName, score: scoreNum });

    if (scoreErr) {
      console.error('Score insert error:', scoreErr);
      return err('DB Error', 500);
    }

    return json({ ok: true });
  }

  // ── action: rankings ──────────────────────────────────────────────────────
  if (action === 'rankings') {
    const { data, error } = await db
      .from('scores')
      .select('name, score')
      .order('score', { ascending: false })
      .limit(20);

    if (error) {
      console.error('Rankings fetch error:', error);
      return err('DB Error', 500);
    }

    return json(data);
  }

  return err('Not Found', 404);
});
