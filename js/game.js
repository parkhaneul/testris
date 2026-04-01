import { BOARD_SIZE, GAME_DURATION } from './config.js';
import { Board } from './board.js';
import { getRandomPiece, resetBag } from './pieces.js';
import { rotateCW, cloneShape, escapeHtml } from './utils.js';
import { fetchSessionToken, submitScore, fetchRanking } from './ranking.js';

// ═══════════════════════════════════════════════════════════════
//  레이아웃
// ═══════════════════════════════════════════════════════════════

function initLayout() {
  const SLOT_W  = 90;
  const GAP     = 8;
  const PADDING = 16;
  const availW  = Math.min(window.innerWidth, 500) - PADDING;
  const boardPx = availW - SLOT_W - GAP;
  const cell    = Math.floor(boardPx / BOARD_SIZE);

  document.documentElement.style.setProperty('--cell-size', cell + 'px');
  document.documentElement.style.setProperty('--slot-w', SLOT_W + 'px');
  document.documentElement.style.setProperty('--mini-cell', Math.floor(SLOT_W / 5.5) + 'px');
}

// ═══════════════════════════════════════════════════════════════
//  DOM
// ═══════════════════════════════════════════════════════════════

const boardEl        = document.getElementById('board');
const slotPieceEls   = [document.getElementById('piece-0'), document.getElementById('piece-1')];
const floatingEl     = document.getElementById('floating-piece');
const rotateFab      = document.getElementById('rotate-fab');
const confirmBtn     = document.getElementById('confirm-btn');
const timerEl        = document.getElementById('timer-value');
const scoreEl        = document.getElementById('score-value');
const gameoverEl     = document.getElementById('gameover-overlay');
const rankingOverlay = document.getElementById('ranking-overlay');
const finalScoreText = document.getElementById('final-score-text');
const rankForm       = document.getElementById('rank-form');
const submitResult   = document.getElementById('submit-result');
const nameInput      = document.getElementById('name-input');
const submitBtn      = document.getElementById('submit-btn');
const rankingList    = document.getElementById('ranking-list');

// ═══════════════════════════════════════════════════════════════
//  게임 상태
// ═══════════════════════════════════════════════════════════════

let board;
let slots;
let score;
let timeLeft;
let timerHandle;
let active;
let sessionToken;

/** 드래그 중인 상태 */
let drag = null;
// { slotIdx, piece: {shape, color}, startX, startY, startTime }

/** 보드에 올려놨지만 미확정 상태 */
let pending = null;
// { slotIdx, piece: {shape, color}, row, col }

/** pending 피스 위에서 탭/드래그 감지용 */
let pendingPtr = null;
// { startX, startY, startTime }

/** pointermove 최신 좌표 (rotation 시 재사용) */
let lastPtr = { x: 0, y: 0 };

// ═══════════════════════════════════════════════════════════════
//  초기화
// ═══════════════════════════════════════════════════════════════

async function init() {
  initLayout();
  buildBoardDOM();

  board        = new Board();
  slots        = [getRandomPiece(), getRandomPiece()];
  score        = 0;
  timeLeft     = GAME_DURATION;
  active       = true;
  drag         = null;
  pending      = null;
  pendingPtr   = null;
  sessionToken = null;
  resetBag();

  updateScoreDOM();
  updateTimerDOM();
  renderBoard();
  renderSlots();
  startTimer();

  fetchSessionToken().then(tok => { sessionToken = tok; });
}

// ═══════════════════════════════════════════════════════════════
//  보드 DOM 빌드
// ═══════════════════════════════════════════════════════════════

function buildBoardDOM() {
  boardEl.innerHTML = '';
  boardEl.style.gridTemplateColumns = `repeat(${BOARD_SIZE}, var(--cell-size))`;
  boardEl.style.gridTemplateRows    = `repeat(${BOARD_SIZE}, var(--cell-size))`;
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const div = document.createElement('div');
      div.className = 'cell';
      div.dataset.r = r;
      div.dataset.c = c;
      boardEl.appendChild(div);
    }
  }
}

// ═══════════════════════════════════════════════════════════════
//  보드 렌더링
// ═══════════════════════════════════════════════════════════════

function renderBoard() {
  const cells = boardEl.children;
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const el        = cells[r * BOARD_SIZE + c];
      const committed = board.grid[r][c];
      const pendingColor = getPendingColor(r, c);

      el.classList.remove('highlight', 'invalid');

      if (pendingColor) {
        el.style.backgroundColor = pendingColor;
        el.classList.add('filled', 'pending');
      } else if (committed) {
        el.style.backgroundColor = committed;
        el.classList.add('filled');
        el.classList.remove('pending');
      } else {
        el.style.backgroundColor = '';
        el.classList.remove('filled', 'pending');
      }
    }
  }
}

/** pending 피스가 (r, c)를 덮고 있으면 해당 색상 반환 */
function getPendingColor(r, c) {
  if (!pending) return null;
  const pr = r - pending.row;
  const pc = c - pending.col;
  if (pr < 0 || pr >= pending.piece.shape.length) return null;
  const row = pending.piece.shape[pr];
  if (!row || pc < 0 || pc >= row.length || !row[pc]) return null;
  return pending.piece.color;
}

function showHighlight(shape, boardRow, boardCol) {
  clearHighlight();
  const valid = board.canPlace(shape, boardRow, boardCol);
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const br = boardRow + r;
      const bc = boardCol + c;
      if (br < 0 || br >= BOARD_SIZE || bc < 0 || bc >= BOARD_SIZE) continue;
      const el = boardEl.children[br * BOARD_SIZE + bc];
      if (el) el.classList.add(valid ? 'highlight' : 'invalid');
    }
  }
}

function clearHighlight() {
  boardEl.querySelectorAll('.highlight,.invalid').forEach(el => {
    el.classList.remove('highlight', 'invalid');
  });
}

function animateClear(rows, cols, cb) {
  const cellEls = boardEl.children;
  rows.forEach(r => {
    for (let c = 0; c < BOARD_SIZE; c++) cellEls[r * BOARD_SIZE + c].classList.add('clearing');
  });
  cols.forEach(c => {
    for (let r = 0; r < BOARD_SIZE; r++) cellEls[r * BOARD_SIZE + c].classList.add('clearing');
  });
  setTimeout(() => {
    boardEl.querySelectorAll('.clearing').forEach(el => el.classList.remove('clearing'));
    cb();
  }, 350);
}

// ═══════════════════════════════════════════════════════════════
//  슬롯 렌더링
// ═══════════════════════════════════════════════════════════════

function renderSlots() {
  slots.forEach((piece, i) => renderSlotPiece(i, piece));
}

function renderSlotPiece(idx, piece) {
  const el = slotPieceEls[idx];
  el.innerHTML = '';
  if (!piece) return;

  const { shape, color } = piece;
  const rows     = shape.length;
  const cols     = Math.max(...shape.map(r => r.length));
  const miniCell = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--mini-cell'));

  el.style.gridTemplateColumns = `repeat(${cols}, ${miniCell}px)`;
  el.style.gridTemplateRows    = `repeat(${rows}, ${miniCell}px)`;
  el.style.gap                 = '1px';

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = document.createElement('div');
      cell.className = 'piece-cell';
      cell.style.width           = miniCell + 'px';
      cell.style.height          = miniCell + 'px';
      cell.style.backgroundColor = (shape[r] && shape[r][c]) ? color : 'transparent';
      el.appendChild(cell);
    }
  }
}

// ═══════════════════════════════════════════════════════════════
//  플로팅 피스
// ═══════════════════════════════════════════════════════════════

function getCellSize() {
  return parseInt(getComputedStyle(document.documentElement).getPropertyValue('--cell-size'));
}

function showFloating(piece, cx, cy) {
  const { shape, color } = piece;
  const cs   = getCellSize();
  const rows = shape.length;
  const cols = Math.max(...shape.map(r => r.length));

  floatingEl.innerHTML = '';
  floatingEl.style.display             = 'grid';
  floatingEl.style.gridTemplateColumns = `repeat(${cols}, ${cs}px)`;
  floatingEl.style.gridTemplateRows    = `repeat(${rows}, ${cs}px)`;
  floatingEl.style.gap                 = '1px';

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = document.createElement('div');
      cell.className = 'piece-cell';
      cell.style.width           = cs + 'px';
      cell.style.height          = cs + 'px';
      cell.style.borderRadius    = '3px';
      cell.style.backgroundColor = (shape[r] && shape[r][c]) ? color : 'transparent';
      floatingEl.appendChild(cell);
    }
  }

  moveFloating(piece, cx, cy);
}

function moveFloating(piece, cx, cy) {
  const cs   = getCellSize();
  const cols = Math.max(...piece.shape.map(r => r.length));
  const rows = piece.shape.length;
  floatingEl.style.left = (cx - cols * cs / 2) + 'px';
  floatingEl.style.top  = (cy - rows * cs / 2) + 'px';
}

function hideFloating() {
  floatingEl.style.display = 'none';
  floatingEl.innerHTML     = '';
}

// ═══════════════════════════════════════════════════════════════
//  좌표 계산
// ═══════════════════════════════════════════════════════════════

function getCellSize_() { return getCellSize(); }

function getBoardCoord(cx, cy, shape) {
  const rect = boardEl.getBoundingClientRect();
  const cs   = getCellSize();
  const cols = Math.max(...shape.map(r => r.length));
  const rows = shape.length;

  const col = Math.round((cx - (cols * cs / 2) - rect.left) / cs);
  const row = Math.round((cy - (rows * cs / 2) - rect.top)  / cs);
  return { row, col };
}

function isOverBoard(cx, cy) {
  const r = boardEl.getBoundingClientRect();
  return cx >= r.left && cx <= r.right && cy >= r.top && cy <= r.bottom;
}

/** 포인터가 pending 피스의 바운딩박스(패딩 포함) 안에 있는지 확인 */
function isOnPendingPiece(cx, cy) {
  if (!pending) return false;
  const cs   = getCellSize();
  const rect = boardEl.getBoundingClientRect();
  const pad  = cs * 0.5; // 터치 인식 여유 영역

  const cols  = Math.max(...pending.piece.shape.map(r => r.length));
  const rows  = pending.piece.shape.length;
  const left  = rect.left + pending.col * cs - pad;
  const top   = rect.top  + pending.row * cs - pad;
  const right = rect.left + (pending.col + cols) * cs + pad;
  const bot   = rect.top  + (pending.row + rows) * cs + pad;

  return cx >= left && cx <= right && cy >= top && cy <= bot;
}

// ═══════════════════════════════════════════════════════════════
//  Confirm 버튼 위치
// ═══════════════════════════════════════════════════════════════

function showConfirmBtn() {
  if (!pending) return;
  const cs   = getCellSize();
  const rect = boardEl.getBoundingClientRect();
  const cols = Math.max(...pending.piece.shape.map(r => r.length));

  // 피스 오른쪽 위 모서리
  const x = rect.left + (pending.col + cols) * cs;
  const y = rect.top  + pending.row * cs;

  confirmBtn.style.left = (x - 14) + 'px'; // 버튼 중심이 모서리에 오도록
  confirmBtn.style.top  = (y - 14) + 'px';
  confirmBtn.classList.remove('hidden');
}

function hideConfirmBtn() {
  confirmBtn.classList.add('hidden');
}

// ═══════════════════════════════════════════════════════════════
//  Pending 상태 관리
// ═══════════════════════════════════════════════════════════════

/** drag → pending 전환 */
function enterPending(row, col) {
  pending = {
    slotIdx: drag.slotIdx,
    piece:   drag.piece,
    row,
    col,
  };
  drag = null;

  hideFloating();
  clearHighlight();
  rotateFab.classList.add('hidden');

  renderBoard();
  showConfirmBtn();
}

/** pending 상태 해제 */
function clearPending() {
  if (!pending) return;
  const idx = pending.slotIdx;
  pending    = null;
  pendingPtr = null;
  hideConfirmBtn();
  renderBoard();
  // 슬롯 불투명도 복원 (피스가 손에 없으므로)
  slotPieceEls[idx].style.opacity = '1';
}

/** pending 피스를 다시 손에 집어들기 (drag 전환) */
function pickUpFromPending(cx, cy) {
  const p = { ...pending };
  pending    = null;
  pendingPtr = null;
  hideConfirmBtn();
  renderBoard();

  drag = {
    slotIdx:   p.slotIdx,
    piece:     p.piece,
    startX:    cx,
    startY:    cy,
    startTime: Date.now(),
  };

  slotPieceEls[p.slotIdx].style.opacity = '0.25';
  showFloating(drag.piece, cx, cy);
  rotateFab.classList.remove('hidden');
}

/** pending 피스 탭 회전 (현재 위치에 맞을 때만) */
function rotatePending() {
  if (!pending) return;
  const rotated = rotateCW(pending.piece.shape);
  if (board.canPlace(rotated, pending.row, pending.col)) {
    pending.piece.shape = rotated;
    renderBoard();
    showConfirmBtn();
  }
  // 안 맞으면 무반응 (기존 방향 유지)
}

/** pending 피스 확정 → 보드에 배치 */
function commitPending() {
  if (!pending) return;
  const { slotIdx, piece, row, col } = pending;

  board.place(piece.shape, row, col, piece.color);
  slots[slotIdx] = null;

  pending = null;
  hideConfirmBtn();
  renderSlotPiece(slotIdx, null);
  slotPieceEls[slotIdx].style.opacity = '1';

  const result = board.clearLines();
  if (result.total > 0) {
    animateClear(result.clearedRows, result.clearedCols, () => {
      renderBoard();
      addScore(result.score);
      refillAndCheck(slotIdx);
    });
  } else {
    renderBoard();
    refillAndCheck(slotIdx);
  }
}

function refillAndCheck(slotIdx) {
  slots[slotIdx] = getRandomPiece();
  renderSlotPiece(slotIdx, slots[slotIdx]);
  if (!board.canAnyFit(slots)) endGame();
}

// ═══════════════════════════════════════════════════════════════
//  이벤트 설정
// ═══════════════════════════════════════════════════════════════

function setupEvents() {
  // 슬롯 피스 드래그 시작
  slotPieceEls.forEach((el, idx) => {
    el.addEventListener('pointerdown', e => onSlotPointerDown(e, idx));
  });

  // 전역 이벤트 (drag용)
  document.addEventListener('pointermove',   onPointerMove,   { passive: false });
  document.addEventListener('pointerup',     onPointerUp);
  document.addEventListener('pointercancel', onDragCancel);

  // 보드 위 pending 피스 탭/드래그
  boardEl.addEventListener('pointerdown', e => {
    if (!active || !pending) return;
    if (!isOnPendingPiece(e.clientX, e.clientY)) return;
    e.preventDefault();
    e.stopPropagation();
    pendingPtr = { startX: e.clientX, startY: e.clientY, startTime: Date.now() };
  }, { passive: false });

  boardEl.addEventListener('pointermove', e => {
    if (!pendingPtr) return;
    const dx = e.clientX - pendingPtr.startX;
    const dy = e.clientY - pendingPtr.startY;
    if (Math.hypot(dx, dy) > 18) {
      // 드래그로 확정 → 집어올리기
      pendingPtr = null;
      pickUpFromPending(e.clientX, e.clientY);
    }
  });

  boardEl.addEventListener('pointerup', e => {
    if (!pendingPtr) return;
    const dx  = e.clientX - pendingPtr.startX;
    const dy  = e.clientY - pendingPtr.startY;
    const dt  = Date.now() - pendingPtr.startTime;
    pendingPtr = null;
    if (Math.hypot(dx, dy) < 18 && dt < 400) {
      rotatePending(); // 탭 → 회전
    }
  });

  // Rotate FAB (drag 중 회전)
  rotateFab.addEventListener('pointerdown', e => {
    e.stopPropagation();
    if (drag) rotateDragPiece();
  });

  // Confirm 버튼 (pending 확정)
  confirmBtn.addEventListener('pointerdown', e => {
    e.stopPropagation();
    commitPending();
  });

  // 게임오버 버튼들
  submitBtn.addEventListener('click', onSubmitScore);
  document.getElementById('ranking-btn').addEventListener('click', openRanking);
  document.getElementById('restart-btn').addEventListener('click', restart);
  document.getElementById('close-ranking-btn').addEventListener('click', () => {
    rankingOverlay.classList.add('hidden');
  });
}

// ── 슬롯 pointerdown ─────────────────────────────────────────────

function onSlotPointerDown(e, idx) {
  if (!active)      return;
  if (!slots[idx])  return;
  if (pending)      return; // pending 중엔 새 피스 드래그 불가

  e.preventDefault();
  e.stopPropagation();

  drag = {
    slotIdx:   idx,
    piece:     { shape: cloneShape(slots[idx].shape), color: slots[idx].color },
    startX:    e.clientX,
    startY:    e.clientY,
    startTime: Date.now(),
  };

  slotPieceEls[idx].style.opacity = '0.25';
  showFloating(drag.piece, e.clientX, e.clientY);
  rotateFab.classList.remove('hidden');
}

// ── 전역 pointermove ─────────────────────────────────────────────

function onPointerMove(e) {
  if (!drag) return;
  e.preventDefault();

  const { clientX: cx, clientY: cy } = e;
  lastPtr = { x: cx, y: cy };
  moveFloating(drag.piece, cx, cy);

  if (isOverBoard(cx, cy)) {
    const { row, col } = getBoardCoord(cx, cy, drag.piece.shape);
    showHighlight(drag.piece.shape, row, col);
  } else {
    clearHighlight();
  }
}

// ── 전역 pointerup ───────────────────────────────────────────────

function onPointerUp(e) {
  if (!drag) return;

  const { clientX: cx, clientY: cy } = e;
  const dx  = cx - drag.startX;
  const dy  = cy - drag.startY;
  const dt  = Date.now() - drag.startTime;
  const isTap = Math.hypot(dx, dy) < 18 && dt < 400;

  if (isTap) {
    // 탭 → 슬롯 피스 회전 후 drag 상태 유지
    rotateDragPiece();
    return;
  }

  if (isOverBoard(cx, cy)) {
    const { row, col } = getBoardCoord(cx, cy, drag.piece.shape);
    if (board.canPlace(drag.piece.shape, row, col)) {
      enterPending(row, col); // 즉시 확정 아님 → pending
      return;
    }
  }

  cancelDrag();
}

function onDragCancel() { cancelDrag(); }

function cancelDrag() {
  if (!drag) return;
  slotPieceEls[drag.slotIdx].style.opacity = '1';
  hideFloating();
  clearHighlight();
  rotateFab.classList.add('hidden');
  drag = null;
}

// ── drag 중 회전 ─────────────────────────────────────────────────

function rotateDragPiece() {
  if (!drag) return;
  drag.piece.shape = rotateCW(drag.piece.shape);
  showFloating(drag.piece, lastPtr.x, lastPtr.y);
}

// ═══════════════════════════════════════════════════════════════
//  점수 / 타이머
// ═══════════════════════════════════════════════════════════════

function addScore(pts) {
  score += pts;
  updateScoreDOM();
}

function updateScoreDOM() {
  scoreEl.textContent = score.toLocaleString();
}

function startTimer() {
  timerHandle = setInterval(() => {
    timeLeft = Math.max(0, timeLeft - 1);
    updateTimerDOM();
    if (timeLeft <= 0) endGame();
  }, 1000);
}

function updateTimerDOM() {
  timerEl.textContent = timeLeft;
  timerEl.className   = '';
  if (timeLeft <= 10)      timerEl.classList.add('timer-danger');
  else if (timeLeft <= 30) timerEl.classList.add('timer-warning');
}

// ═══════════════════════════════════════════════════════════════
//  게임오버
// ═══════════════════════════════════════════════════════════════

function endGame() {
  if (!active) return;
  active = false;
  clearInterval(timerHandle);
  cancelDrag();
  clearPending();

  finalScoreText.textContent = score.toLocaleString() + '점';
  rankForm.classList.remove('hidden');
  submitResult.classList.add('hidden');
  submitBtn.disabled    = false;
  submitBtn.textContent = '랭킹 등록';
  nameInput.value       = '';
  gameoverEl.classList.remove('hidden');
}

// ═══════════════════════════════════════════════════════════════
//  랭킹
// ═══════════════════════════════════════════════════════════════

async function onSubmitScore() {
  const name = nameInput.value.trim();
  if (!name) { nameInput.focus(); return; }

  submitBtn.disabled    = true;
  submitBtn.textContent = '등록 중...';

  try {
    await submitScore(sessionToken, name, score);
    rankForm.classList.add('hidden');
    submitResult.classList.remove('hidden');
  } catch (err) {
    submitBtn.disabled    = false;
    submitBtn.textContent = '랭킹 등록';
    alert('등록 실패: ' + err.message);
  }
}

async function openRanking() {
  rankingOverlay.classList.remove('hidden');
  rankingList.innerHTML = '<div class="loading">불러오는 중...</div>';
  try {
    const data = await fetchRanking();
    if (!data.length) {
      rankingList.innerHTML = '<div class="loading">아직 기록이 없습니다.</div>';
      return;
    }
    rankingList.innerHTML = data.map((item, i) => `
      <div class="rank-item">
        <span class="rank-num">${i + 1}</span>
        <span class="rank-name">${escapeHtml(item.name)}</span>
        <span class="rank-score">${Number(item.score).toLocaleString()}</span>
      </div>
    `).join('');
  } catch {
    rankingList.innerHTML = '<div class="loading">랭킹을 불러올 수 없습니다.</div>';
  }
}

function restart() {
  gameoverEl.classList.add('hidden');
  clearInterval(timerHandle);
  init();
}

// ═══════════════════════════════════════════════════════════════
//  시작
// ═══════════════════════════════════════════════════════════════

setupEvents();
init();
