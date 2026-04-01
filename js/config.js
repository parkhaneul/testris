// ─── 게임 설정 ──────────────────────────────────────────────────
export const BOARD_SIZE    = 8;
export const GAME_DURATION = 100; // 초

// ─── Supabase 설정 (배포 시 실제 값으로 교체) ──────────────────
// ※ 아래 값들은 Edge Function URL 하나만 노출됩니다.
//   실제 DB 자격증명(Service Role Key)은 Edge Function 환경변수에만 존재합니다.
export const API_BASE = 'https://fzcgdoyvglvqyqqyvefk.supabase.co/functions/v1/api';
