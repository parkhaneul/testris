import { API_BASE } from './config.js';

/**
 * 게임 시작 시 서버에서 세션 토큰 발급
 * 토큰은 서버 비밀키로 서명된 타임스탬프이며, 점수 제출 시 검증에 사용됩니다.
 * 클라이언트에는 서명 비밀키가 노출되지 않습니다.
 */
export async function fetchSessionToken() {
  try {
    const res = await fetch(API_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'start' }),
    });
    if (!res.ok) throw new Error('Token fetch failed');
    const { token } = await res.json();
    return token;
  } catch {
    // 오프라인/서버 미연결 시 null 반환 (랭킹 등록만 불가)
    return null;
  }
}

/**
 * 점수 제출
 * @param {string} sessionToken - fetchSessionToken으로 받은 토큰
 * @param {string} name         - 플레이어 닉네임 (최대 8자)
 * @param {number} score        - 최종 점수
 */
export async function submitScore(sessionToken, name, score) {
  if (!sessionToken) throw new Error('세션 토큰 없음 (서버와 연결을 확인해주세요)');

  const res = await fetch(API_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'record', token: sessionToken, name, score }),
  });

  if (!res.ok) {
    const msg = await res.text().catch(() => '서버 오류');
    throw new Error(msg);
  }
  return res.json();
}

/**
 * 상위 20개 랭킹 조회
 * @returns {Promise<Array<{name:string, score:number}>>}
 */
export async function fetchRanking() {
  const res = await fetch(API_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'rankings' }),
  });
  if (!res.ok) throw new Error('랭킹 조회 실패');
  return res.json();
}
