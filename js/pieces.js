import { cloneShape } from './utils.js';

/**
 * 표준 테트리스 7종 피스 (파스텔 색상)
 * 7-bag 시스템: 7개를 셔플한 뒤 순서대로 꺼내므로
 * 동일 피스가 연속으로 과도하게 나오지 않습니다.
 */
const PIECE_DEFS = [
  { shape: [[1,1,1,1]],        color: '#9dd8f5' }, // I — 하늘
  { shape: [[1,1],[1,1]],      color: '#fef08a' }, // O — 연노랑
  { shape: [[0,1,0],[1,1,1]],  color: '#d8b4fe' }, // T — 연보라
  { shape: [[0,1,1],[1,1,0]],  color: '#86efac' }, // S — 연초록
  { shape: [[1,1,0],[0,1,1]],  color: '#fca5a5' }, // Z — 연분홍
  { shape: [[1,0,0],[1,1,1]],  color: '#93c5fd' }, // J — 연파랑
  { shape: [[0,0,1],[1,1,1]],  color: '#fdba74' }, // L — 연주황
];

/** 7-bag 풀 */
let bag = [];

function refillBag() {
  bag = [...PIECE_DEFS];
  // Fisher-Yates 셔플
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }
}

/**
 * 다음 피스를 bag에서 꺼내 반환
 * bag이 비면 자동으로 새로 채움
 */
export function getRandomPiece() {
  if (bag.length === 0) refillBag();
  const def = bag.pop();
  return { shape: cloneShape(def.shape), color: def.color };
}

/** 게임 재시작 시 bag 초기화 */
export function resetBag() {
  bag = [];
}
