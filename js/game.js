import { BOARD_SIZE, GAME_DURATION } from './config.js';
import { Board } from './board.js';
import { getRandomPiece } from './pieces.js';
import { rotateCW, cloneShape, escapeHtml } from './utils.js';
import { fetchSessionToken, submitScore, fetchRanking } from './ranking.js';

// ═══════════════════════════════════════════════════════════════
//  레이아웃 초기화
// ═══════════════════════════════════════════════════════════════

function initLayout() {
  const SLOT_W  = 90;
  const GAP     = 8;
  const PADDING = 16; // 양쪽
  const availW  = Math.min(window.innerWidth, 500) - PADDING;
  const boardPx = availW - SLOT_W - GAP;
  const cell    = Math.floor(boardPx / BOARD_SIZE);

  document.documentElement.style.setProperty('--cell-size', cell + 'px');
  document.documentElement.style.setProperty('--slot-w', SLOT_W + 'px');
  document.documentElement.style.setProperty('--mini-cell', Math.floor(SLOT_W / 5.5) + 'px');
}

// ═══════════════════════════════════════════════════════════════
//  DOM 참조
// ═══════════════════════════════════════════════════════════════

const boardEl        = document.getElementById('board');
const slotPieceEls   = [document.getElementById('piece-0'), document.getElementById('piece-1')];
const floatingEl     = document.getElementById('floating-piece');
const rotateFab      = document.getElementById('rotate-fab');
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
let slots;       // [piece|null, piece|null]
let score;
let timeLeft;
let timerHandle;
let active;      // 게임 진행 여부
let sessionToken;

/** dragState: 드래그 진행 중 상태 */
let drag = null;
/*
  drag = {
    slotIdx: 0|1,
    piece: { shape, color },   // 현재 드래그 중인 피스 (회전 반영)
    startX, startY,            // 포인터 다운 위치
    startTime,
  }
*/

// ═══════════════════════════════════════════════════════════════
//  초기화
// ═══════════════════════════════════════════════════════════════

async function init() {
  initLayout();
  buildBoardDOM();

  board  = new Board();
  slots  = [getRandomPiece(), getRandomPiece()];
  score  = 0;
  timeLeft = GAME_DURATION;
  active = true;
  drag   = null;
  sessionToken = null;

  updateScoreDOM();
  updateTimerDOM();
  renderBoard();
  renderSlots();
  startTimer();

  // 백그라운드에서 세션 토큰 발급 (비동기, 게임에 영향 없음)
  fetchSessionToken().then(tok => { sessionToken = tok; });
}

// ═══════════════════════════════════════════════════════════════
//  보드 DOM 빌드
// ═══════════════════════════════════════════════════════════════

function buildBoardDOM() {
  boardEl.innerHTML = '';
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
      const el = cells[r * BOARD_SIZE + c];
      const color = board.grid[r][c];
      el.style.backgroundColor = color ?? '';
      el.classList.toggle('filled', color !== null);
    }
  }
}

/** 하이라이트/invalid 셀 표시 */
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

/** 클리어 애니메이션 */
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
  const rows = shape.length;
  const cols = Math.max(...shape.map(r => r.length));
  const miniCell = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--mini-cell'));

  el.style.gridTemplateColumns = `repeat(${cols}, ${miniCell}px)`;
  el.style.gridTemplateRows    = `repeat(${rows}, ${miniCell}px)`;
  el.style.gap                 = '1px';

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = document.createElement('div');
      cell.className = 'piece-cell';
      cell.style.width  = miniCell + 'px';
      cell.style.height = miniCell + 'px';
      cell.style.backgroundColor = (shape[r] && shape[r][c]) ? color : 'transparent';
      el.appendChild(cell);
    }
  }
}

// ═══════════════════════════════════════════════════════════════
//  플로팅 피스 렌더링
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
  floatingEl.innerHTML = '';
}

// ═══════════════════════════════════════════════════════════════
//  보드 좌표 계산
// ═══════════════════════════════════════════════════════════════

function getBoardCoord(cx, cy, shape) {
  const rect = boardEl.getBoundingClientRect();
  const cs   = getCellSize();
  const cols = Math.max(...shape.map(r => r.length));
  const rows = shape.length;

  const pieceLeft = cx - (cols * cs) / 2;
  const pieceTop  = cy - (rows * cs) / 2;

  const col = Math.round((pieceLeft - rect.left) / cs);
  const row = Math.round((pieceTop  - rect.top)  / cs);
  return { row, col };
}

function isOverBoard(cx, cy) {
  const r = boardEl.getBoundingClientRect();
  return cx >= r.left && cx <= r.right && cy >= r.top && cy <= r.bottom;
}

// ═══════════════════════════════════════════════════════════════
//  이벤트 설정
// ═══════════════════════════════════════════════════════════════

function setupEvents() {
  // 슬롯 피스 포인터다운
  slotPieceEls.forEach((el, idx) => {
    el.addEventListener('pointerdown', e => onSlotPointerDown(e, idx));
  });

  // 전역 포인터 이벤트
  document.addEventListener('pointermove',   onPointerMove, { passive: false });
  document.addEventListener('pointerup',     onPointerUp);
  document.addEventListener('pointercancel', onDragCancel);

  // 회전 FAB
  rotateFab.addEventListener('pointerdown', e => {
    e.stopPropagation();
    if (drag) rotateDragPiece();
  });

  // 게임오버 버튼
  submitBtn.addEventListener('click', onSubmitScore);
  document.getElementById('ranking-btn').addEventListener('click', openRanking);
  document.getElementById('restart-btn').addEventListener('click', restart);
  document.getElementById('close-ranking-btn').addEventListener('click', () => {
    rankingOverlay.classList.add('hidden');
  });
}

// ── 슬롯에서 포인터다운 ──────────────────────────────────────────

function onSlotPointerDown(e, idx) {
  if (!active) return;
  if (!slots[idx]) return;

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

// ── 포인터 이동 ──────────────────────────────────────────────────

function onPointerMove(e) {
  if (!drag) return;
  e.preventDefault();

  const { clientX: cx, clientY: cy } = e;
  moveFloating(drag.piece, cx, cy);

  if (isOverBoard(cx, cy)) {
    const { row, col } = getBoardCoord(cx, cy, drag.piece.shape);
    showHighlight(drag.piece.shape, row, col);
  } else {
    clearHighlight();
  }
}

// ── 포인터업 (배치 or 취소) ─────────────────────────────────────

function onPointerUp(e) {
  if (!drag) return;

  const { clientX: cx, clientY: cy } = e;
  const dx = cx - drag.startX;
  const dy = cy - drag.startY;
  const dt = Date.now() - drag.startTime;
  const isTap = Math.hypot(dx, dy) < 8 && dt < 280;

  // 탭 → 슬롯 안에서 회전 후 드래그 상태 유지
  if (isTap) {
    rotateDragPiece();
    // 슬롯 미리보기도 업데이트
    slotPieceEls[drag.slotIdx].style.opacity = '0.25';
    return;
  }

  // 보드 위에서 드롭
  if (isOverBoard(cx, cy)) {
    const { row, col } = getBoardCoord(cx, cy, drag.piece.shape);
    if (board.canPlace(drag.piece.shape, row, col)) {
      placePiece(row, col);
      return;
    }
  }

  // 보드 외부 or 배치 불가 → 슬롯 반환
  cancelDrag();
}

function onDragCancel() {
  cancelDrag();
}

// ── 드래그 취소 ──────────────────────────────────────────────────

function cancelDrag() {
  if (!drag) return;
  slotPieceEls[drag.slotIdx].style.opacity = '1';
  hideFloating();
  clearHighlight();
  rotateFab.classList.add('hidden');
  drag = null;
}

// ── 회전 ────────────────────────────────────────────────────────

function rotateDragPiece() {
  if (!drag) return;
  drag.piece.shape = rotateCW(drag.piece.shape);
  showFloating(drag.piece, drag.startX, drag.startY);
  // 현재 포인터 위치에 맞게 재배치 (마지막 알려진 위치)
}

// ═══════════════════════════════════════════════════════════════
//  배치 로직
// ═══════════════════════════════════════════════════════════════

function placePiece(row, col) {
  const { slotIdx, piece } = drag;

  // 보드에 피스 배치
  board.place(piece.shape, row, col, piece.color);
  slots[slotIdx] = null;

  // UI 정리
  hideFloating();
  clearHighlight();
  rotateFab.classList.add('hidden');
  renderSlotPiece(slotIdx, null);
  drag = null;

  // 라인 클리어 확인
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
  timerEl.className = '';
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

  finalScoreText.textContent = score.toLocaleString() + '점';
  rankForm.classList.remove('hidden');
  submitResult.classList.add('hidden');
  submitBtn.disabled = false;
  submitBtn.textContent = '랭킹 등록';
  nameInput.value = '';
  gameoverEl.classList.remove('hidden');
}

// ═══════════════════════════════════════════════════════════════
//  랭킹
// ═══════════════════════════════════════════════════════════════

async function onSubmitScore() {
  const name = nameInput.value.trim();
  if (!name) { nameInput.focus(); return; }

  submitBtn.disabled = true;
  submitBtn.textContent = '등록 중...';

  try {
    await submitScore(sessionToken, name, score);
    rankForm.classList.add('hidden');
    submitResult.classList.remove('hidden');
  } catch (err) {
    submitBtn.disabled = false;
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
