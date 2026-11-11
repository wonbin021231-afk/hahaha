/**
 * 2-PLAYER TETRIS BATTLE
 * Features:
 * - 1P: WASD + Left Shift (Hard Drop)
 * - 2P: Arrow Keys + Space (Hard Drop)
 * - Attack Mechanic: 2+ lines cleared sends garbage lines with the last-filled parts removed (holes)
 * - Game Over when blocks touch the top
 * - High quality Web Audio synthesizer
 * - Next piece preview, Score, Pause, Restart
 */

// ============================================================================
// CONSTANTS & TETROMINO DEFINITIONS
// ============================================================================

const COLS = 10;
const ROWS = 20;
const BLOCK_SIZE = 30; // 300px x 600px

// Standard 7 Tetromino shapes and their rotational matrices
const TETROMINOES = {
  I: {
    shape: [
      [0, 0, 0, 0],
      [1, 1, 1, 1],
      [0, 0, 0, 0],
      [0, 0, 0, 0]
    ],
    color: '#00f0ff',
    id: 1
  },
  J: {
    shape: [
      [1, 0, 0],
      [1, 1, 1],
      [0, 0, 0]
    ],
    color: '#2979ff',
    id: 2
  },
  L: {
    shape: [
      [0, 0, 1],
      [1, 1, 1],
      [0, 0, 0]
    ],
    color: '#ff9100',
    id: 3
  },
  O: {
    shape: [
      [1, 1],
      [1, 1]
    ],
    color: '#ffd600',
    id: 4
  },
  S: {
    shape: [
      [0, 1, 1],
      [1, 1, 0],
      [0, 0, 0]
    ],
    color: '#00e676',
    id: 5
  },
  T: {
    shape: [
      [0, 1, 0],
      [1, 1, 1],
      [0, 0, 0]
    ],
    color: '#d500f9',
    id: 6
  },
  Z: {
    shape: [
      [1, 1, 0],
      [0, 1, 1],
      [0, 0, 0]
    ],
    color: '#ff1744',
    id: 7
  }
};

const GARBAGE_ID = 8;
const GARBAGE_COLOR = '#64748b'; // Metallic steel grey

const COLOR_MAP = {
  1: TETROMINOES.I.color,
  2: TETROMINOES.J.color,
  3: TETROMINOES.L.color,
  4: TETROMINOES.O.color,
  5: TETROMINOES.S.color,
  6: TETROMINOES.T.color,
  7: TETROMINOES.Z.color,
  8: GARBAGE_COLOR
};

// ============================================================================
// AUDIO SYSTEM (WEB AUDIO API SYNTHESIZER)
// ============================================================================

class SoundManager {
  constructor() {
    this.ctx = null;
    this.muted = false;
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    return this.muted;
  }

  playMove() {
    if (this.muted || !this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(320, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(180, this.ctx.currentTime + 0.05);
    gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.05);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.05);
  }

  playRotate() {
    if (this.muted || !this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(400, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(650, this.ctx.currentTime + 0.08);
    gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.08);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.08);
  }

  playDrop() {
    if (this.muted || !this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(180, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(60, this.ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.1);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.1);
  }

  playClear(lines) {
    if (this.muted || !this.ctx) return;
    const now = this.ctx.currentTime;
    const freqs = lines >= 4 ? [440, 554, 659, 880] : [523, 659, 784];
    freqs.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.06);
      gain.gain.setValueAtTime(0.12, now + idx * 0.06);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.2);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now + idx * 0.06);
      osc.stop(now + idx * 0.06 + 0.2);
    });
  }

  playAttack() {
    if (this.muted || !this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, this.ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(800, this.ctx.currentTime + 0.15);
    osc.frequency.exponentialRampToValueAtTime(100, this.ctx.currentTime + 0.35);
    gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.35);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.35);
  }

  playGameOver() {
    if (this.muted || !this.ctx) return;
    const notes = [300, 260, 220, 180];
    const now = this.ctx.currentTime;
    notes.forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, now + i * 0.12);
      gain.gain.setValueAtTime(0.15, now + i * 0.12);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.12 + 0.2);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now + i * 0.12);
      osc.stop(now + i * 0.12 + 0.2);
    });
  }
}

const sounds = new SoundManager();

// ============================================================================
// 7-BAG RANDOMIZER
// ============================================================================

class PieceBag {
  constructor() {
    this.bag = [];
  }

  nextPiece() {
    if (this.bag.length === 0) {
      this.bag = Object.keys(TETROMINOES);
      // Fisher-Yates shuffle
      for (let i = this.bag.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [this.bag[i], this.bag[j]] = [this.bag[j], this.bag[i]];
      }
    }
    const type = this.bag.pop();
    const item = TETROMINOES[type];
    return {
      type: type,
      id: item.id,
      color: item.color,
      shape: item.shape.map(row => [...row])
    };
  }
}

// ============================================================================
// PLAYER CLASS
// ============================================================================

class TetrisPlayer {
  constructor(id, canvasId, nextCanvasId, scoreId, linesId, attacksId, containerId, opponentGetter) {
    this.id = id; // '1P' or '2P'
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    this.nextCanvas = document.getElementById(nextCanvasId);
    this.nextCtx = this.nextCanvas.getContext('2d');
    this.scoreEl = document.getElementById(scoreId);
    this.linesEl = document.getElementById(linesId);
    this.attacksEl = document.getElementById(attacksId);
    this.container = document.getElementById(containerId);
    this.getOpponent = opponentGetter;

    this.board = [];
    this.bag = new PieceBag();
    this.currentPiece = null;
    this.pieceX = 0;
    this.pieceY = 0;
    this.nextPiece = null;

    this.score = 0;
    this.lines = 0;
    this.attacksSent = 0;

    this.dropInterval = 800; // ms
    this.lastDropTime = 0;
    this.isDead = false;

    this.init();
  }

  init() {
    this.createBoard();
    this.score = 0;
    this.lines = 0;
    this.attacksSent = 0;
    this.isDead = false;
    this.lastDropTime = performance.now();

    this.bag = new PieceBag();
    this.nextPiece = this.bag.nextPiece();
    this.spawnPiece();

    this.updateStats();
    this.drawNext();
    this.draw();
  }

  createBoard() {
    this.board = [];
    for (let r = 0; r < ROWS; r++) {
      this.board.push(new Array(COLS).fill(0));
    }
  }

  spawnPiece() {
    this.currentPiece = this.nextPiece;
    this.nextPiece = this.bag.nextPiece();
    this.drawNext();

    // Spawn near the middle top
    this.pieceX = Math.floor((COLS - this.currentPiece.shape[0].length) / 2);
    this.pieceY = 0;

    // Check if spawn location immediately collides -> GAME OVER
    if (this.checkCollision(this.pieceX, this.pieceY, this.currentPiece.shape)) {
      this.isDead = true;
      triggerGameOver(this.id === '1P' ? '2P' : '1P', `${this.id} 블록이 상단에 도달했습니다!`);
    }
  }

  checkCollision(targetX, targetY, shape) {
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        if (shape[r][c] !== 0) {
          const newX = targetX + c;
          const newY = targetY + r;

          // Wall and bottom bounds
          if (newX < 0 || newX >= COLS || newY >= ROWS) {
            return true;
          }

          // Existing placed blocks (ignore if newY < 0 during rotation spawn)
          if (newY >= 0 && this.board[newY][newX] !== 0) {
            return true;
          }
        }
      }
    }
    return false;
  }

  // Rotate clockwise with basic wall-kick offsets
  rotate() {
    if (this.isDead || !this.currentPiece) return;
    const oldShape = this.currentPiece.shape;
    const size = oldShape.length;
    const newShape = [];

    for (let r = 0; r < size; r++) {
      newShape[r] = [];
      for (let c = 0; c < size; c++) {
        newShape[r][c] = oldShape[size - 1 - c][r];
      }
    }

    // Attempt rotation with wall kicks: [0, -1, 1, -2, 2]
    const kicks = [0, -1, 1, -2, 2];
    for (let kick of kicks) {
      if (!this.checkCollision(this.pieceX + kick, this.pieceY, newShape)) {
        this.pieceX += kick;
        this.currentPiece.shape = newShape;
        sounds.playRotate();
        this.draw();
        return;
      }
    }
  }

  moveLeft() {
    if (this.isDead || !this.currentPiece) return;
    if (!this.checkCollision(this.pieceX - 1, this.pieceY, this.currentPiece.shape)) {
      this.pieceX--;
      sounds.playMove();
      this.draw();
    }
  }

  moveRight() {
    if (this.isDead || !this.currentPiece) return;
    if (!this.checkCollision(this.pieceX + 1, this.pieceY, this.currentPiece.shape)) {
      this.pieceX++;
      sounds.playMove();
      this.draw();
    }
  }

  softDrop() {
    if (this.isDead || !this.currentPiece) return;
    if (!this.checkCollision(this.pieceX, this.pieceY + 1, this.currentPiece.shape)) {
      this.pieceY++;
      this.score += 1;
      this.updateStats();
      this.lastDropTime = performance.now();
      this.draw();
    } else {
      this.lockPiece();
    }
  }

  hardDrop() {
    if (this.isDead || !this.currentPiece) return;
    let dropDistance = 0;
    while (!this.checkCollision(this.pieceX, this.pieceY + 1, this.currentPiece.shape)) {
      this.pieceY++;
      dropDistance++;
    }
    this.score += dropDistance * 2;
    this.updateStats();
    sounds.playDrop();
    this.lockPiece();
  }

  // Calculate Ghost piece position (where the piece will land)
  getGhostY() {
    if (!this.currentPiece) return 0;
    let ghostY = this.pieceY;
    while (!this.checkCollision(this.pieceX, ghostY + 1, this.currentPiece.shape)) {
      ghostY++;
    }
    return ghostY;
  }

  // Lock the current piece into the board and trigger line checks & attacks
  lockPiece() {
    if (this.isDead || !this.currentPiece) return;

    // Track exactly which board coordinates were filled by this piece
    const placedCells = [];
    const shape = this.currentPiece.shape;

    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        if (shape[r][c] !== 0) {
          const boardX = this.pieceX + c;
          const boardY = this.pieceY + r;

          // If a block locks at or above row 0 (or beyond visible top)
          if (boardY < 0) {
            this.isDead = true;
            triggerGameOver(this.id === '1P' ? '2P' : '1P', `${this.id} 블록이 상단에 도달했습니다!`);
            return;
          }

          this.board[boardY][boardX] = this.currentPiece.id;
          placedCells.push({ x: boardX, y: boardY });
        }
      }
    }

    // Check for game over condition: any block sitting at the very top row (row 0)
    // Note: in Tetris, if a piece locks and touches row 0, it is on the brink or game over
    // Let's check line clears first, because a line clear at row 0 could save them!
    this.clearLines(placedCells);

    if (this.isDead) return;

    // Check if any block remaining in row 0 after clear:
    // User request: "게임 종료는 한 명의 사용자의 블록이 화면의 상단에 닿을 때임"
    if (this.board[0].some(cell => cell !== 0)) {
      this.isDead = true;
      triggerGameOver(this.id === '1P' ? '2P' : '1P', `${this.id} 블록이 화면 상단에 닿았습니다!`);
      return;
    }

    this.spawnPiece();
    this.lastDropTime = performance.now();
    this.draw();
  }

  /**
   * CRITICAL ATTACK LOGIC:
   * "한 명의 사용자가 두 줄 이상의 블록을 채우면 다른 사용자의 블록 하단에 채워진 블록을 추가하되
   * 반드시 두 줄 이상의 블록 중 마지막에 채워진 부분은 제거하고 다른 사용자 화면의 하단에 추가해줘.
   * 반드시 두 줄 이상의 블록을 채워져야 하고 두 줄 이상의 채워진 블록은 다른 사용자 화면의 하단에
   * 추가하되 채워진 블록에서 마지막에 채워진 부분은 제거한 상태에서 추가되어야 해."
   */
  clearLines(placedCells) {
    const fullRows = [];
    for (let r = 0; r < ROWS; r++) {
      if (this.board[r].every(cell => cell !== 0)) {
        fullRows.push(r);
      }
    }

    const clearedCount = fullRows.length;
    if (clearedCount === 0) return;

    sounds.playClear(clearedCount);

    // Scoring
    const scoreTable = { 1: 100, 2: 300, 3: 600, 4: 1000 };
    this.score += scoreTable[clearedCount] || (clearedCount * 250);
    this.lines += clearedCount;
    this.updateStats();

    // =========================================================================
    // GARBAGE ATTACK PROCESSING
    // Condition: Cleared rows must be >= 2!
    // =========================================================================
    if (clearedCount >= 2) {
      const garbageLinesToSend = [];

      // For each cleared full row, determine the exact cells that were "마지막에 채워진 부분"
      // (the columns filled by the piece that just landed to complete this line).
      // These positions are REMOVED (left empty/hole), and the rest is added as filled garbage.
      for (const r of fullRows) {
        // Find which columns in row `r` were filled by the tetromino that just placed down
        const filledColsByLastPiece = placedCells
          .filter(cell => cell.y === r)
          .map(cell => cell.x);

        // Build the garbage line for opponent:
        const garbageRow = new Array(COLS).fill(GARBAGE_ID);

        // Remove the last filled parts (make them 0 / empty hole)
        if (filledColsByLastPiece.length > 0) {
          for (const col of filledColsByLastPiece) {
            garbageRow[col] = 0;
          }
        } else {
          // Fallback guarantee: at least 1 hole
          garbageRow[Math.floor(Math.random() * COLS)] = 0;
        }

        // If for some reason all columns became 0, keep at least one block
        if (garbageRow.every(c => c === 0)) {
          garbageRow[0] = GARBAGE_ID;
        }

        garbageLinesToSend.push(garbageRow);
      }

      // Attack opponent!
      const opponent = this.getOpponent();
      if (opponent && !opponent.isDead) {
        this.attacksSent += garbageLinesToSend.length;
        this.updateStats();
        sounds.playAttack();

        // Trigger visual attack banner and beam animation
        showAttackAnimation(this.id, opponent.id, garbageLinesToSend.length);

        // Push garbage lines to the opponent's bottom
        opponent.receiveGarbage(garbageLinesToSend, this.id);
      }
    }

    // Remove the cleared full rows from this player's board
    // and prepend new empty rows at the top
    for (let i = fullRows.length - 1; i >= 0; i--) {
      this.board.splice(fullRows[i], 1);
    }
    while (this.board.length < ROWS) {
      this.board.unshift(new Array(COLS).fill(0));
    }
  }

  // Receive garbage lines at the bottom of the board
  receiveGarbage(garbageRows, attackerId) {
    if (this.isDead) return;

    const count = garbageRows.length;

    // Check if pushing up will push any existing blocks above row 0 (or out of bounds)
    // If any block exists in the top `count` rows of the board, they get pushed past top -> GAME OVER!
    for (let r = 0; r < count; r++) {
      if (this.board[r].some(cell => cell !== 0)) {
        this.isDead = true;
        triggerGameOver(attackerId, `${this.id} 블록이 공격으로 인해 상단에 도달했습니다!`);
        return;
      }
    }

    // Remove `count` rows from top and push `garbageRows` at bottom
    this.board.splice(0, count);
    for (const gRow of garbageRows) {
      this.board.push([...gRow]);
    }

    // Shake screen effect
    const boardWrapper = this.container.querySelector('.game-board-wrapper');
    if (boardWrapper) {
      boardWrapper.classList.remove('shake');
      void boardWrapper.offsetWidth; // retrigger CSS reflow
      boardWrapper.classList.add('shake');
      setTimeout(() => boardWrapper.classList.remove('shake'), 450);
    }

    // Adjust current falling piece position if it is now colliding with new board
    if (this.currentPiece && this.checkCollision(this.pieceX, this.pieceY, this.currentPiece.shape)) {
      // Try shifting piece up
      let shifted = false;
      for (let offset = 1; offset <= count; offset++) {
        if (!this.checkCollision(this.pieceX, this.pieceY - offset, this.currentPiece.shape)) {
          this.pieceY -= offset;
          shifted = true;
          break;
        }
      }
      if (!shifted) {
        // If piece cannot fit even when pushed up, player is topped out!
        this.isDead = true;
        triggerGameOver(attackerId, `${this.id} 블록이 화면 상단에 닿았습니다!`);
        return;
      }
    }

    // Check if any block is in row 0 now
    if (this.board[0].some(cell => cell !== 0)) {
      this.isDead = true;
      triggerGameOver(attackerId, `${this.id} 블록이 화면 상단에 닿았습니다!`);
      return;
    }

    this.draw();
  }

  // Update fall timer
  update(now) {
    if (this.isDead || !this.currentPiece) return;

    if (now - this.lastDropTime > this.dropInterval) {
      if (!this.checkCollision(this.pieceX, this.pieceY + 1, this.currentPiece.shape)) {
        this.pieceY++;
      } else {
        this.lockPiece();
      }
      this.lastDropTime = now;
      this.draw();
    }
  }

  updateStats() {
    this.scoreEl.textContent = this.score.toLocaleString();
    this.linesEl.textContent = this.lines;
    this.attacksEl.textContent = this.attacksSent;
  }

  // ==========================================================================
  // RENDERING
  // ==========================================================================

  draw() {
    // Clear canvas
    this.ctx.fillStyle = '#060b14';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Draw grid lines
    this.drawGrid();

    // Draw fixed board blocks
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const val = this.board[r][c];
        if (val !== 0) {
          this.drawBlock(this.ctx, c * BLOCK_SIZE, r * BLOCK_SIZE, COLOR_MAP[val], val === GARBAGE_ID);
        }
      }
    }

    if (this.currentPiece && !this.isDead) {
      // Draw Ghost Piece
      const ghostY = this.getGhostY();
      const shape = this.currentPiece.shape;
      for (let r = 0; r < shape.length; r++) {
        for (let c = 0; c < shape[r].length; c++) {
          if (shape[r][c] !== 0) {
            const gx = (this.pieceX + c) * BLOCK_SIZE;
            const gy = (ghostY + r) * BLOCK_SIZE;
            this.drawGhostBlock(this.ctx, gx, gy, this.currentPiece.color);
          }
        }
      }

      // Draw Active Piece
      for (let r = 0; r < shape.length; r++) {
        for (let c = 0; c < shape[r].length; c++) {
          if (shape[r][c] !== 0) {
            const px = (this.pieceX + c) * BLOCK_SIZE;
            const py = (this.pieceY + r) * BLOCK_SIZE;
            this.drawBlock(this.ctx, px, py, this.currentPiece.color, false);
          }
        }
      }
    }
  }

  drawGrid() {
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.035)';
    this.ctx.lineWidth = 1;
    for (let x = 0; x <= this.canvas.width; x += BLOCK_SIZE) {
      this.ctx.beginPath();
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, this.canvas.height);
      this.ctx.stroke();
    }
    for (let y = 0; y <= this.canvas.height; y += BLOCK_SIZE) {
      this.ctx.beginPath();
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(this.canvas.width, y);
      this.ctx.stroke();
    }

    // Top danger line (Row 0 threshold)
    this.ctx.strokeStyle = 'rgba(255, 51, 102, 0.35)';
    this.ctx.lineWidth = 2;
    this.ctx.setLineDash([4, 4]);
    this.ctx.beginPath();
    this.ctx.moveTo(0, BLOCK_SIZE);
    this.ctx.lineTo(this.canvas.width, BLOCK_SIZE);
    this.ctx.stroke();
    this.ctx.setLineDash([]);
  }

  // Draw 3D beveled block
  drawBlock(ctx, x, y, color, isGarbage = false) {
    const size = BLOCK_SIZE;
    const padding = 1;

    ctx.save();
    if (isGarbage) {
      // Metallic Steel Garbage Block
      const grad = ctx.createLinearGradient(x, y, x + size, y + size);
      grad.addColorStop(0, '#64748b');
      grad.addColorStop(0.5, '#475569');
      grad.addColorStop(1, '#334155');
      ctx.fillStyle = grad;
      ctx.fillRect(x + padding, y + padding, size - padding * 2, size - padding * 2);

      // Warning stripes / rivet dots
      ctx.fillStyle = '#94a3b8';
      ctx.fillRect(x + 4, y + 4, 3, 3);
      ctx.fillRect(x + size - 7, y + 4, 3, 3);
      ctx.fillRect(x + 4, y + size - 7, 3, 3);
      ctx.fillRect(x + size - 7, y + size - 7, 3, 3);

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.strokeRect(x + 2, y + 2, size - 4, size - 4);
    } else {
      // Standard Tetromino Block with glossy highlight & depth
      ctx.fillStyle = color;
      ctx.fillRect(x + padding, y + padding, size - padding * 2, size - padding * 2);

      // Top & Left highlight
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.beginPath();
      ctx.moveTo(x + padding, y + padding);
      ctx.lineTo(x + size - padding, y + padding);
      ctx.lineTo(x + size - 5, y + 5);
      ctx.lineTo(x + 5, y + 5);
      ctx.lineTo(x + 5, y + size - 5);
      ctx.lineTo(x + padding, y + size - padding);
      ctx.closePath();
      ctx.fill();

      // Bottom & Right shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
      ctx.beginPath();
      ctx.moveTo(x + size - padding, y + padding);
      ctx.lineTo(x + size - padding, y + size - padding);
      ctx.lineTo(x + padding, y + size - padding);
      ctx.lineTo(x + 5, y + size - 5);
      ctx.lineTo(x + size - 5, y + size - 5);
      ctx.lineTo(x + size - 5, y + 5);
      ctx.closePath();
      ctx.fill();

      // Center square
      ctx.fillStyle = color;
      ctx.fillRect(x + 5, y + 5, size - 10, size - 10);
    }
    ctx.restore();
  }

  // Draw semi-transparent ghost block
  drawGhostBlock(ctx, x, y, color) {
    const size = BLOCK_SIZE;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.fillRect(x + 2, y + 2, size - 4, size - 4);
    ctx.strokeRect(x + 2, y + 2, size - 4, size - 4);
    ctx.restore();
  }

  // Draw Next Piece in preview box
  drawNext() {
    this.nextCtx.clearRect(0, 0, this.nextCanvas.width, this.nextCanvas.height);
    if (!this.nextPiece) return;

    const shape = this.nextPiece.shape;
    const miniSize = 20;
    const pieceWidth = shape[0].length * miniSize;
    const pieceHeight = shape.length * miniSize;

    // Center piece in next preview box
    const startX = Math.floor((this.nextCanvas.width - pieceWidth) / 2);
    const startY = Math.floor((this.nextCanvas.height - pieceHeight) / 2);

    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        if (shape[r][c] !== 0) {
          const bx = startX + c * miniSize;
          const by = startY + r * miniSize;
          this.nextCtx.fillStyle = this.nextPiece.color;
          this.nextCtx.fillRect(bx + 1, by + 1, miniSize - 2, miniSize - 2);

          this.nextCtx.fillStyle = 'rgba(255, 255, 255, 0.3)';
          this.nextCtx.fillRect(bx + 2, by + 2, miniSize - 4, 3);
        }
      }
    }
  }
}

// ============================================================================
// GAME MANAGER & KEYBOARD CONTROLS
// ============================================================================

let player1 = null;
let player2 = null;
let isPaused = false;
let isGameOver = false;
let animationFrameId = null;

// UI Elements
const pauseModal = document.getElementById('pause-modal');
const gameoverModal = document.getElementById('gameover-modal');
const rulesModal = document.getElementById('rules-modal');
const btnPause = document.getElementById('btn-pause');
const btnResume = document.getElementById('btn-resume');
const btnRestart = document.getElementById('btn-restart');
const btnModalRestart = document.getElementById('btn-modal-restart');
const btnPlayAgain = document.getElementById('btn-play-again');
const btnSound = document.getElementById('btn-sound');
const soundIcon = document.getElementById('sound-icon');
const btnRules = document.getElementById('btn-rules');
const btnCloseRules = document.getElementById('btn-close-rules');

const attackBanner = document.getElementById('attack-banner');
const attackBannerText = document.getElementById('attack-banner-text');
const attackBannerIcon = document.getElementById('attack-banner-icon');
const attackBeam = document.getElementById('attack-beam');

const winnerTitle = document.getElementById('winner-title');
const winnerDesc = document.getElementById('winner-desc');
const finalP1Score = document.getElementById('final-p1-score');
const finalP1Lines = document.getElementById('final-p1-lines');
const finalP2Score = document.getElementById('final-p2-score');
const finalP2Lines = document.getElementById('final-p2-lines');

// DAS (Delayed Auto Shift) & ARR (Auto Repeat Rate) configuration
const DAS_DELAY = 140; // ms before repeat starts
const ARR_RATE = 40;   // ms between repeat actions
const SOFT_DROP_RATE = 35; // ms between soft drop steps

const keyStates = {};

function initGame() {
  player1 = new TetrisPlayer('1P', 'p1-canvas', 'p1-next-canvas', 'p1-score', 'p1-lines', 'p1-attacks', 'p1-container', () => player2);
  player2 = new TetrisPlayer('2P', 'p2-canvas', 'p2-next-canvas', 'p2-score', 'p2-lines', 'p2-attacks', 'p2-container', () => player1);

  document.getElementById('p1-status').textContent = 'PLAYING';
  document.getElementById('p1-status').classList.remove('danger');
  document.getElementById('p2-status').textContent = 'PLAYING';
  document.getElementById('p2-status').classList.remove('danger');

  isPaused = false;
  isGameOver = false;

  pauseModal.classList.add('hidden');
  gameoverModal.classList.add('hidden');
  rulesModal.classList.add('hidden');

  btnPause.querySelector('.btn-text').textContent = '일시정지';
  btnPause.querySelector('.btn-icon').textContent = '⏸️';

  attackBanner.className = 'attack-banner';
  attackBannerIcon.textContent = '⚔️';
  attackBannerText.textContent = '배틀 시작! 2줄 이상 채워 상대방을 공격하세요!';

  if (animationFrameId) cancelAnimationFrame(animationFrameId);
  lastFrameTime = performance.now();
  animationFrameId = requestAnimationFrame(gameLoop);
}

// Visual Attack Animation & Notification Banner
function showAttackAnimation(attackerId, defenderId, linesCount) {
  // Update banner
  attackBanner.className = `attack-banner ${attackerId === '1P' ? 'p1-attack' : 'p2-attack'}`;
  attackBannerIcon.textContent = '⚡';
  attackBannerText.textContent = `${attackerId}가 ${linesCount}줄을 완성하여 ${defenderId}에게 방해 블록을 전송했습니다! (채워진 위치 제거됨)`;

  // Center laser beam
  attackBeam.className = `attack-beam ${attackerId === '1P' ? 'beam-to-right' : 'beam-to-left'}`;
  setTimeout(() => {
    attackBeam.className = 'attack-beam';
  }, 450);
}

// Game Over Handler
function triggerGameOver(winnerId, reason) {
  if (isGameOver) return;
  isGameOver = true;

  sounds.playGameOver();

  const p1Status = document.getElementById('p1-status');
  const p2Status = document.getElementById('p2-status');

  if (winnerId === '1P') {
    p1Status.textContent = 'WINNER 🏆';
    p1Status.classList.remove('danger');
    p2Status.textContent = 'DEFEAT 💀';
    p2Status.classList.add('danger');
    winnerTitle.textContent = '🎉 PLAYER 1 승리!';
    winnerTitle.style.color = 'var(--p1-primary)';
  } else {
    p2Status.textContent = 'WINNER 🏆';
    p2Status.classList.remove('danger');
    p1Status.textContent = 'DEFEAT 💀';
    p1Status.classList.add('danger');
    winnerTitle.textContent = '🎉 PLAYER 2 승리!';
    winnerTitle.style.color = 'var(--p2-primary)';
  }

  winnerDesc.textContent = reason;
  finalP1Score.textContent = player1.score.toLocaleString();
  finalP1Lines.textContent = `${player1.lines}줄 완성 / ${player1.attacksSent}줄 공격`;
  finalP2Score.textContent = player2.score.toLocaleString();
  finalP2Lines.textContent = `${player2.lines}줄 완성 / ${player2.attacksSent}줄 공격`;

  gameoverModal.classList.remove('hidden');
}

// Pause Toggle
function togglePause() {
  if (isGameOver) return;
  isPaused = !isPaused;

  if (isPaused) {
    pauseModal.classList.remove('hidden');
    btnPause.querySelector('.btn-text').textContent = '계속하기';
    btnPause.querySelector('.btn-icon').textContent = '▶️';
  } else {
    pauseModal.classList.add('hidden');
    btnPause.querySelector('.btn-text').textContent = '일시정지';
    btnPause.querySelector('.btn-icon').textContent = '⏸️';
    // Reset drop times so pieces don't instantly drop on resume
    const now = performance.now();
    player1.lastDropTime = now;
    player2.lastDropTime = now;
  }
}

// ============================================================================
// MAIN ANIMATION LOOP
// ============================================================================

let lastFrameTime = performance.now();

function gameLoop(now) {
  if (!isPaused && !isGameOver) {
    handleRepeatingKeys(now);
    player1.update(now);
    player2.update(now);
  }
  animationFrameId = requestAnimationFrame(gameLoop);
}

// ============================================================================
// KEYBOARD EVENT HANDLING (SIMULTANEOUS 2P CONTROLS)
// ============================================================================

/**
 * Key mappings according to prompt specifications:
 *
 * Player 1:
 * - Rotate: W (KeyW)
 * - Move: A (KeyA) / D (KeyD)
 * - Soft Drop: S (KeyS)
 * - Hard Drop: Left Shift (ShiftLeft)
 *
 * Player 2:
 * - Rotate: Up Arrow (ArrowUp)
 * - Move: Left Arrow (ArrowLeft) / Right Arrow (ArrowRight)
 * - Soft Drop: Down Arrow (ArrowDown)
 * - Hard Drop: Space (Space)
 */

window.addEventListener('keydown', (e) => {
  sounds.init();

  // Prevent default page scroll for game keys
  const preventKeys = ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyS', 'KeyA', 'KeyD', 'ShiftLeft'];
  if (preventKeys.includes(e.code)) {
    e.preventDefault();
  }

  // Pause hotkey: Esc or P
  if (e.code === 'Escape' || e.code === 'KeyP') {
    togglePause();
    return;
  }

  if (isPaused || isGameOver) return;

  // Discrete single-press actions
  if (!keyStates[e.code]) {
    keyStates[e.code] = {
      pressed: true,
      firstPressedTime: performance.now(),
      lastRepeatTime: performance.now()
    };

    // Instant actions on keydown:
    // --- Player 1 ---
    if (e.code === 'KeyW') {
      player1.rotate();
    } else if (e.code === 'KeyA') {
      player1.moveLeft();
    } else if (e.code === 'KeyD') {
      player1.moveRight();
    } else if (e.code === 'ShiftLeft') {
      player1.hardDrop();
    } else if (e.code === 'KeyS') {
      player1.softDrop();
    }

    // --- Player 2 ---
    if (e.code === 'ArrowUp') {
      player2.rotate();
    } else if (e.code === 'ArrowLeft') {
      player2.moveLeft();
    } else if (e.code === 'ArrowRight') {
      player2.moveRight();
    } else if (e.code === 'Space') {
      player2.hardDrop();
    } else if (e.code === 'ArrowDown') {
      player2.softDrop();
    }
  }
});

window.addEventListener('keyup', (e) => {
  if (keyStates[e.code]) {
    delete keyStates[e.code];
  }
});

// Window blur: reset all pressed keys to avoid stuck keys
window.addEventListener('blur', () => {
  for (let key in keyStates) {
    delete keyStates[key];
  }
});

// Process continuous DAS / ARR repeating movement
function handleRepeatingKeys(now) {
  for (let code in keyStates) {
    const state = keyStates[code];
    if (!state) continue;

    const timeHeld = now - state.firstPressedTime;

    // Player 1 Left/Right
    if (code === 'KeyA') {
      if (timeHeld > DAS_DELAY && now - state.lastRepeatTime > ARR_RATE) {
        player1.moveLeft();
        state.lastRepeatTime = now;
      }
    } else if (code === 'KeyD') {
      if (timeHeld > DAS_DELAY && now - state.lastRepeatTime > ARR_RATE) {
        player1.moveRight();
        state.lastRepeatTime = now;
      }
    } else if (code === 'KeyS') {
      if (now - state.lastRepeatTime > SOFT_DROP_RATE) {
        player1.softDrop();
        state.lastRepeatTime = now;
      }
    }

    // Player 2 Left/Right
    if (code === 'ArrowLeft') {
      if (timeHeld > DAS_DELAY && now - state.lastRepeatTime > ARR_RATE) {
        player2.moveLeft();
        state.lastRepeatTime = now;
      }
    } else if (code === 'ArrowRight') {
      if (timeHeld > DAS_DELAY && now - state.lastRepeatTime > ARR_RATE) {
        player2.moveRight();
        state.lastRepeatTime = now;
      }
    } else if (code === 'ArrowDown') {
      if (now - state.lastRepeatTime > SOFT_DROP_RATE) {
        player2.softDrop();
        state.lastRepeatTime = now;
      }
    }
  }
}

// ============================================================================
// UI BUTTON LISTENERS
// ============================================================================

btnPause.addEventListener('click', () => {
  sounds.init();
  togglePause();
});

btnResume.addEventListener('click', () => {
  sounds.init();
  togglePause();
});

btnRestart.addEventListener('click', () => {
  sounds.init();
  initGame();
});

btnModalRestart.addEventListener('click', () => {
  sounds.init();
  initGame();
});

btnPlayAgain.addEventListener('click', () => {
  sounds.init();
  initGame();
});

btnSound.addEventListener('click', () => {
  sounds.init();
  const isMuted = sounds.toggleMute();
  soundIcon.textContent = isMuted ? '🔇' : '🔊';
});

btnRules.addEventListener('click', () => {
  if (!isPaused && !isGameOver) togglePause();
  rulesModal.classList.remove('hidden');
});

btnCloseRules.addEventListener('click', () => {
  rulesModal.classList.add('hidden');
});

// Start the game on initial page load
window.addEventListener('DOMContentLoaded', () => {
  initGame();
});
