import { BOARD_SIZE } from './config.js';
import { rotateCW } from './utils.js';

export class Board {
  constructor() {
    // grid[row][col] = null(빈칸) | color string(채워진칸)
    this.grid = this._empty();
  }

  _empty() {
    return Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(null));
  }

  /**
   * shape를 (row, col) 위치에 놓을 수 있는지 검사
   */
  canPlace(shape, row, col) {
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        if (!shape[r][c]) continue;
        const br = row + r;
        const bc = col + c;
        if (br < 0 || br >= BOARD_SIZE) return false;
        if (bc < 0 || bc >= BOARD_SIZE) return false;
        if (this.grid[br][bc] !== null) return false;
      }
    }
    return true;
  }

  /**
   * shape를 (row, col)에 배치 (canPlace 확인 후 호출)
   */
  place(shape, row, col, color) {
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        if (shape[r][c]) {
          this.grid[row + r][col + c] = color;
        }
      }
    }
  }

  /**
   * 완성된 가로줄 / 세로줄을 찾아 제거하고 점수를 반환
   * 점수 공식: N줄 동시 = N² × 10
   * @returns {{ clearedRows: number[], clearedCols: number[], score: number, total: number }}
   */
  clearLines() {
    const clearedRows = [];
    const clearedCols = [];

    for (let r = 0; r < BOARD_SIZE; r++) {
      if (this.grid[r].every(cell => cell !== null)) clearedRows.push(r);
    }
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (this.grid.every(row => row[c] !== null)) clearedCols.push(c);
    }

    const total = clearedRows.length + clearedCols.length;
    const score = total > 0 ? total * total * 10 : 0;

    for (const r of clearedRows) this.grid[r].fill(null);
    for (const c of clearedCols) {
      for (let r = 0; r < BOARD_SIZE; r++) this.grid[r][c] = null;
    }

    return { clearedRows, clearedCols, score, total };
  }

  /**
   * slots 배열의 피스 중 하나라도 보드 어딘가에 놓을 수 있으면 true
   * 4방향 회전 모두 시도
   * @param {Array<{shape:number[][], color:string}|null>} pieces
   */
  canAnyFit(pieces) {
    for (const piece of pieces) {
      if (!piece) continue;
      let shape = piece.shape;
      for (let rot = 0; rot < 4; rot++) {
        for (let r = 0; r < BOARD_SIZE; r++) {
          for (let c = 0; c < BOARD_SIZE; c++) {
            if (this.canPlace(shape, r, c)) return true;
          }
        }
        shape = rotateCW(shape);
      }
    }
    return false;
  }
}
