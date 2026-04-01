-- ═══════════════════════════════════════════════════════════════
--  블럭 퍼즐 - Supabase 스키마
--  Supabase Dashboard > SQL Editor에서 실행하세요.
-- ═══════════════════════════════════════════════════════════════

-- ── 점수 테이블 ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS scores (
  id         BIGSERIAL PRIMARY KEY,
  name       TEXT    NOT NULL,
  score      INTEGER NOT NULL CHECK (score >= 0),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS scores_score_idx ON scores (score DESC);

-- ── 사용된 토큰 테이블 (1회용 토큰 재사용 방지) ──────────────────
CREATE TABLE IF NOT EXISTS used_tokens (
  token      TEXT PRIMARY KEY,
  ip         TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 오래된 토큰 자동 삭제를 위한 인덱스 (선택)
CREATE INDEX IF NOT EXISTS used_tokens_created_idx ON used_tokens (created_at);

-- ── Row Level Security: 모든 직접 접근 차단 ──────────────────────
-- Edge Function만 Service Role Key로 접근 가능
ALTER TABLE scores      ENABLE ROW LEVEL SECURITY;
ALTER TABLE used_tokens ENABLE ROW LEVEL SECURITY;

-- anon / authenticated 역할에 대한 정책 없음 = 전부 거부
-- (Service Role Key는 RLS를 우회하므로 Edge Function은 정상 동작)

-- ── 오래된 토큰 정리 (선택: pg_cron 또는 주기적 실행) ────────────
-- DELETE FROM used_tokens WHERE created_at < NOW() - INTERVAL '3 hours';
