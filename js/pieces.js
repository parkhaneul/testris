import { cloneShape } from './utils.js';

/**
 * 표준 테트리스 7종 피스 (Tetris Guideline 색상)
 * shape: 스폰 기본 방향
 * color: 공식 테트리스 색상
 */
const PIECE_DEFS = [
  { shape: [[1,1,1,1]],        color: '#00f0f0' }, // I — 시안
  { shape: [[1,1],[1,1]],      color: '#f0f000' }, // O — 노랑
  { shape: [[0,1,0],[1,1,1]],  color: '#a000f0' }, // T — 보라
  { shape: [[0,1,1],[1,1,0]],  color: '#00f000' }, // S — 초록
  { shape: [[1,1,0],[0,1,1]],  color: '#f00000' }, // Z — 빨강
  { shape: [[1,0,0],[1,1,1]],  color: '#0000f0' }, // J — 파랑
  { shape: [[0,0,1],[1,1,1]],  color: '#f0a000' }, // L — 주황
];

/**
 * 랜덤 피스 하나를 복사해서 반환
 * @returns {{ shape: number[][], color: string }}
 */
export function getRandomPiece() {
  const def = PIECE_DEFS[Math.floor(Math.random() * PIECE_DEFS.length)];
  return { shape: cloneShape(def.shape), color: def.color };
}
