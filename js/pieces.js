import { cloneShape } from './utils.js';

/**
 * 모든 블럭 정의
 * shape: 1이 채워진 셀, 0이 빈 셀 (2D 배열)
 * color: 블럭 색상
 */
const PIECE_DEFS = [
  // ── I 피스 ──────────────────────────────
  { shape: [[1, 1, 1, 1]],             color: '#00d4ff' }, // I-4 가로
  { shape: [[1], [1], [1], [1]],       color: '#00d4ff' }, // I-4 세로
  { shape: [[1, 1, 1]],               color: '#ff6b35' }, // I-3
  { shape: [[1, 1]],                  color: '#ff69b4' }, // I-2
  { shape: [[1]],                     color: '#aaaaaa' }, // I-1

  // ── O 피스 ──────────────────────────────
  { shape: [[1, 1], [1, 1]],          color: '#ffd700' }, // 2×2

  // ── T 피스 ──────────────────────────────
  { shape: [[0,1,0],[1,1,1]],         color: '#a855f7' },
  { shape: [[1,1,1],[0,1,0]],         color: '#a855f7' },
  { shape: [[1,0],[1,1],[1,0]],       color: '#a855f7' },
  { shape: [[0,1],[1,1],[0,1]],       color: '#a855f7' },

  // ── S / Z 피스 ──────────────────────────
  { shape: [[0,1,1],[1,1,0]],         color: '#22c55e' },
  { shape: [[1,0],[1,1],[0,1]],       color: '#22c55e' },
  { shape: [[1,1,0],[0,1,1]],         color: '#ef4444' },
  { shape: [[0,1],[1,1],[1,0]],       color: '#ef4444' },

  // ── J 피스 ──────────────────────────────
  { shape: [[1,0,0],[1,1,1]],         color: '#3b82f6' },
  { shape: [[1,1],[1,0],[1,0]],       color: '#3b82f6' },
  { shape: [[1,1,1],[0,0,1]],         color: '#3b82f6' },
  { shape: [[0,1],[0,1],[1,1]],       color: '#3b82f6' },

  // ── L 피스 ──────────────────────────────
  { shape: [[0,0,1],[1,1,1]],         color: '#f97316' },
  { shape: [[1,0],[1,0],[1,1]],       color: '#f97316' },
  { shape: [[1,1,1],[1,0,0]],         color: '#f97316' },
  { shape: [[1,1],[0,1],[0,1]],       color: '#f97316' },

  // ── 소형 L (2×2 변형) ────────────────────
  { shape: [[1,0],[1,1]],             color: '#84cc16' },
  { shape: [[1,1],[1,0]],             color: '#06b6d4' },
  { shape: [[0,1],[1,1]],             color: '#84cc16' },
  { shape: [[1,1],[0,1]],             color: '#06b6d4' },

  // ── 3×3 코너 ────────────────────────────
  { shape: [[1,0,0],[1,0,0],[1,1,1]], color: '#ec4899' },
  { shape: [[1,1,1],[1,0,0],[1,0,0]], color: '#8b5cf6' },
  { shape: [[1,1,1],[0,0,1],[0,0,1]], color: '#ec4899' },
  { shape: [[0,0,1],[0,0,1],[1,1,1]], color: '#8b5cf6' },
];

/**
 * 랜덤 피스 하나를 복사해서 반환
 * @returns {{ shape: number[][], color: string }}
 */
export function getRandomPiece() {
  const def = PIECE_DEFS[Math.floor(Math.random() * PIECE_DEFS.length)];
  return { shape: cloneShape(def.shape), color: def.color };
}
