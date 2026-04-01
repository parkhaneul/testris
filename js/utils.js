/**
 * 2D 배열(shape)을 시계 방향으로 90도 회전
 * @param {number[][]} shape
 * @returns {number[][]}
 */
export function rotateCW(shape) {
  const rows = shape.length;
  const cols = shape[0].length;
  const result = Array.from({ length: cols }, () => Array(rows).fill(0));
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      result[c][rows - 1 - r] = shape[r][c];
    }
  }
  return result;
}

/**
 * shape의 열 수 최대값 반환
 * @param {number[][]} shape
 */
export function shapeWidth(shape) {
  return Math.max(...shape.map(r => r.length));
}

/**
 * shape 깊은 복사
 * @param {number[][]} shape
 */
export function cloneShape(shape) {
  return shape.map(r => [...r]);
}

/**
 * HTML 이스케이프 (XSS 방지)
 * @param {string} str
 */
export function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
