// 규원이 집까지 게임
// Players: 빵톨이 (left) and 제빵장 (right)
// Each has 20 blocks to reach "규원이집" at the top of their track.

const TRACK_LENGTH = 10; // 변경: 트랙 길이 10블록
const players = [
  { id: 'left', name: '빵톨이', pos: 0, skipNext: false },
  { id: 'right', name: '제빵장', pos: 0, skipNext: false }
];

let currentPlayerIndex = 0;
let isGameRunning = false;
let questionTimer = null;
let questionTimeLeft = 10; // 변경: 10초 타이머

const startBtn = document.getElementById('startBtn');
const resetBtn = document.getElementById('resetBtn');
const turnIndicator = document.getElementById('turn-indicator');
const trackLeft = document.getElementById('track-left');
const trackRight = document.getElementById('track-right');
const statusLeft = document.getElementById('status-left');
const statusRight = document.getElementById('status-right');

const pathChoices = document.getElementById('pathChoices');
const pathButtons = document.querySelectorAll('.path-btn');

const questionModal = document.getElementById('questionModal');
const questionText = document.getElementById('questionText');
const choicesContainer = document.getElementById('choices');
const timeLeftEl = document.getElementById('timeLeft');
const answerResult = document.getElementById('answerResult');
const closeAnswer = document.getElementById('closeAnswer');

const clapSound = document.getElementById('clapSound');

// Small question bank (elementary 5th grade level) - Korean
const QUESTION_BANK = [
  { q: '다음 중 포유류가 아닌 것은?', a: 2, choices: ['개', '토끼', '거미'] },
  { q: '태양계에서 가장 큰 행성은?', a: 1, choices: ['지구', '목성', '화성'] },
  { q: '물이 0도에서 얼고 100도에서 끓는 물질은?', a: 0, choices: ['물', '기름', '소금'] },
  { q: '한 달은 보통 몇 일일까?', a: 1, choices: ['28일', '30~31일', '7일'] },
  { q: '다음 중 식물의 일부분이 아닌 것은?', a: 2, choices: ['뿌리', '줄기', '곰팡이'] },
  { q: '우리 몸에서 산소를 운반하는 혈구는?', a: 0, choices: ['적혈구', '백혈구', '혈소판'] },
  { q: '한국의 수도는 어디인가요?', a: 0, choices: ['서울', '부산', '인천'] },
  { q: '한 시간은 몇 분일까요?', a: 2, choices: ['30분', '45분', '60분'] },
  { q: '다음 중 짝수인 수는?', a: 1, choices: ['7', '8', '9'] },
  { q: '물건을 세는 단위를 무엇이라고 하나요?', a: 2, choices: ['길이', '무게', '개수'] }
];

// OUTCOMES with weighted probabilities:
// 개똥 and 돌뿌리 should each be 10% 확률. 나머지(횡단보도, 길, 무빙워크)는 균등 분배.
// We'll create a weighted array for random selection.
const OUTCOME_WEIGHTS = [
  { name: '횡단보도', weight: 0.2667 },
  { name: '길', weight: 0.2667 },
  { name: '무빙워크', weight: 0.2666 },
  { name: '개똥', weight: 0.1 },
  { name: '돌뿌리', weight: 0.1 }
];

function weightedRandomOutcome(){
  const r = Math.random();
  let acc = 0;
  for(const o of OUTCOME_WEIGHTS){
    acc += o.weight;
    if(r <= acc) return o.name;
  }
  return OUTCOME_WEIGHTS[OUTCOME_WEIGHTS.length-1].name;
}

function initTracks(){
  // Create winding absolute-positioned blocks for each player's track.
  setupTrack(trackLeft, 'left');
  setupTrack(trackRight, 'right');
  // create player sprites
  createOrResetSprite('left');
  createOrResetSprite('right');
  renderPlayers();
}

function setupTrack(container, side){
  // Create visible board-style cells (like Snakes-and-Ladders) stacked bottom -> top
  container.innerHTML = '';
  container.style.position = 'relative';
  // create grid wrapper centered in the track
  const grid = document.createElement('div');
  grid.className = 'track-grid';
  // create TRACK_LENGTH cells; we'll create bottom-to-top visually
  for(let i=1;i<=TRACK_LENGTH;i++){
    const cell = document.createElement('div');
    cell.className = 'cell';
    cell.dataset.index = i;
    cell.innerHTML = `<div class="cell-index">${i}</div>`;
    // prepend so the first appended ends up at the bottom
    grid.prepend(cell);
  }
  container.appendChild(grid);
  // adjust grid top/bottom to sit between house bottom and sprite head
  setTimeout(()=> adjustGrid(container, side), 60);
}

function adjustGrid(container, side){
  const grid = container.querySelector('.track-grid');
  if(!grid) return;
  const playerId = side === 'left' ? 'player-left' : 'player-right';
  const house = document.getElementById(side === 'left' ? 'house-left' : 'house-right');
  // compute house bottom relative to container
  const containerRect = container.getBoundingClientRect();
  const houseRect = house.getBoundingClientRect();
  const houseBottomRelative = houseRect.bottom - containerRect.top; // px from container top
  // find sprite inside this track (sprite appended into track)
  const sprite = container.querySelector('.sprite');
  const spriteHeight = sprite ? sprite.getBoundingClientRect().height : 84;
  const headPadding = 6; // space between head and first cell
  // set grid top and bottom so it spans between house bottom and sprite head
  const topPx = Math.round(houseBottomRelative + 8);
  const bottomPx = Math.round(spriteHeight + headPadding);
  grid.style.top = `${topPx}px`;
  grid.style.bottom = `${bottomPx}px`;
  grid.style.height = `calc(100% - ${topPx}px - ${bottomPx}px)`;
  // ensure sprites re-render now that grid sizing is finalized
  try{ renderPlayers(); }catch(e){ }
}

function createOrResetSprite(side){
  // attach sprite into the track container so positioning is relative to the track
  const container = side === 'left' ? document.getElementById('track-left') : document.getElementById('track-right');
  // remove existing sprite if any
  const existing = container.querySelector('.sprite');
  if(existing) existing.remove();
  const sp = document.createElement('div');
  sp.className = 'sprite';
  sp.id = `sprite-${side}`;
  // Insert a simple blocky SVG pixel-art for Minecraft-like character
  if(side === 'left'){
    sp.innerHTML = `
      <svg width="84" height="84" viewBox="0 0 56 56" xmlns="http://www.w3.org/2000/svg" aria-label="빵톨이">
        <!-- head (skin color) with brown stroke -->
        <rect x="8" y="4" width="40" height="24" fill="#f1c27d" stroke="#7a3f00" stroke-width="2" rx="2" />
        <!-- eyes -->
        <rect x="18" y="12" width="4" height="4" fill="#000" />
        <rect x="34" y="12" width="4" height="4" fill="#000" />
        <!-- small red nose -->
        <circle cx="28" cy="16" r="2" fill="#e11d2d" />
        <!-- body (skin-toned shirt) -->
        <rect x="12" y="28" width="32" height="20" fill="#f1c27d" stroke="#7a3f00" stroke-width="2" rx="3" />
      </svg>`;
  } else {
    sp.innerHTML = `
      <svg width="84" height="84" viewBox="0 0 56 56" xmlns="http://www.w3.org/2000/svg" aria-label="제빵장">
        <!-- head -->
        <rect x="8" y="10" width="40" height="18" fill="#ffeedd" stroke="#333" stroke-width="1" rx="2" />
        <!-- taller / peaked baker hat -->
        <polygon points="8,14 28,0 48,14" fill="#fff" stroke="#ddd" stroke-width="1" />
        <rect x="14" y="6" width="28" height="6" rx="3" fill="#fff" stroke="#ddd" stroke-width="1" />
        <!-- eyes -->
        <rect x="18" y="14" width="4" height="4" fill="#000" />
        <rect x="34" y="14" width="4" height="4" fill="#000" />
        <!-- body with buttons -->
        <rect x="12" y="28" width="32" height="20" fill="#ffffff" stroke="#cfcfcf" stroke-width="1" rx="3" />
        <!-- buttons -->
        <circle cx="28" cy="36" r="2" fill="#c49a3b" />
        <circle cx="28" cy="42" r="2" fill="#c49a3b" />
        <circle cx="28" cy="48" r="2" fill="#c49a3b" />
      </svg>`;
  }
  sp.style.position = 'absolute';
  // horizontally center; keep bottom coordinate as bottom of sprite
  sp.style.transform = 'translateX(-50%)';
  // put at bottom center initially (relative to track)
  sp.style.left = '50%'; sp.style.bottom = '0px';
  container.appendChild(sp);
}

function renderPlayers(){
  // move sprite elements to corresponding block positions
  const leftContainer = trackLeft;
  const rightContainer = trackRight;
  const spriteL = document.getElementById('sprite-left');
  const spriteR = document.getElementById('sprite-right');

  // Snap sprite bottom to the bottom coordinate of the corresponding cell element
  function cellBottom(container, index){
    const grid = container.querySelector('.track-grid');
    if(!grid) return 0;
    const cells = Array.from(grid.querySelectorAll('.cell'));
    // index 0 -> pos 0 (bottom cell index 1)
    // map pos (0..TRACK_LENGTH) to bottom-based cell index in DOM order
    const bottomBased = Math.max(0, Math.min(cells.length-1, cells.length - 1 - index));
    const targetIdx = bottomBased;
    const rect = cells[targetIdx].getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    // bottom relative to container: distance from container bottom to cell bottom
    const bottomFromContainerBottom = Math.round(containerRect.bottom - rect.bottom);
    return bottomFromContainerBottom;
  }
  const leftY = cellBottom(leftContainer, players[0].pos);
  const rightY = cellBottom(rightContainer, players[1].pos);

  if(spriteL){
    spriteL.style.left = '50%';
    spriteL.style.bottom = `${leftY}px`;
  }
  if(spriteR){
    spriteR.style.left = '50%';
    spriteR.style.bottom = `${rightY}px`;
  }

  statusLeft.textContent = `위치: ${players[0].pos}/${TRACK_LENGTH}` + (players[0].skipNext? ' (다음칸 건너뜀)': '');
  statusRight.textContent = `위치: ${players[1].pos}/${TRACK_LENGTH}` + (players[1].skipNext? ' (다음칸 건너뜀)': '');
}

function chooseStarter(){
  currentPlayerIndex = Math.random() < 0.5 ? 0 : 1;
  turnIndicator.textContent = `${players[currentPlayerIndex].name}의 차례 (시작)`;
}

function startGame(){
  players.forEach(p => { p.pos = 0; p.skipNext = false; });
  initTracks();
  isGameRunning = true;
  chooseStarter();
  startBtn.disabled = true;
  // remove intro banner when the game starts
  const intro = document.getElementById('introBanner'); if(intro) intro.remove();
  // highlight starter and show arrows
  document.getElementById('player-left').classList.toggle('active', players[currentPlayerIndex].id === 'left');
  document.getElementById('player-right').classList.toggle('active', players[currentPlayerIndex].id === 'right');
  setTimeout(()=>{ openPathChoices(); }, 400);
}

function resetGame(){
  players.forEach(p => { p.pos = 0; p.skipNext = false; });
  initTracks();
  isGameRunning = false;
  startBtn.disabled = false;
  turnIndicator.textContent = '시작 전';
}

startBtn.addEventListener('click', ()=>{
  // mark todo in-progress -> completed
  players.forEach(p=>{p.pos=0;p.skipNext=false});
  initTracks();
  chooseStarter();
  isGameRunning = true;
  startBtn.disabled = true;
  const intro = document.getElementById('introBanner'); if(intro) intro.remove();
});
resetBtn.addEventListener('click', ()=>{ resetGame(); });

// Path click
pathButtons.forEach(btn=>{
  btn.addEventListener('click', ()=>{
    openQuestionForCurrentPlayer(btn.dataset.path);
  });
});

function openPathChoices(){
  // show arrow buttons inside current player's area; arrows may be absent
  showPathArrows(players[currentPlayerIndex].id);
}

function showPathArrows(side){
  // remove existing arrows
  ['left','right'].forEach(s=>{
    const a = document.getElementById(`arrows-${s}`);
    if(a) a.innerHTML = '';
  });
  const container = document.getElementById(`arrows-${side}`);
  if(!container) return;
  // possible directions
  const dirs = ['left','straight','right'];
  // randomly decide if a path is present (20% chance to be missing each)
  dirs.forEach(d=>{
    const present = Math.random() > 0.2; // 80% chance present
    const btn = document.createElement('div');
    btn.className = 'arrow' + (present? '':' hidden');
    btn.dataset.path = d;
    btn.innerHTML = arrowSvg(d);
    if(present) btn.addEventListener('click', ()=>{ openQuestionForCurrentPlayer(d); });
    container.appendChild(btn);
  });
  // apply active highlight
  document.getElementById('player-left').classList.toggle('active', side==='left');
  document.getElementById('player-right').classList.toggle('active', side==='right');
}

function arrowSvg(dir){
  if(dir === 'left') return '&#8592;';
  if(dir === 'right') return '&#8594;';
  return '&#8593;';
}

function closePathChoices(){
  pathChoices.classList.add('hidden');
}

function openQuestionForCurrentPlayer(chosenPath){
  closePathChoices();
  if(!isGameRunning) return;
  const p = players[currentPlayerIndex];
  if(p.skipNext){
    // lose this turn
    p.skipNext = false;
    answerResult.textContent = `${p.name}는 돌뿌리로 다음 기회를 잃어 건너뜁니다.`;
    questionModal.classList.remove('hidden');
    setTimeout(()=>{ questionModal.classList.add('hidden'); advanceTurn(); }, 1200);
    return;
  }
  // show question modal
  const q = randomQuestion();
  showQuestionModal(q, chosenPath);
}

function randomQuestion(){
  return QUESTION_BANK[Math.floor(Math.random()*QUESTION_BANK.length)];
}

function showQuestionModal(q, chosenPath){
  questionText.textContent = q.q;
  choicesContainer.innerHTML = '';
  answerResult.textContent = '';
  closeAnswer.classList.add('hidden');
  q.choices.forEach((c,i)=>{
    const b = document.createElement('button');
    b.className = 'choice-btn';
    b.textContent = `${String.fromCharCode(65+i)}. ${c}`;
    b.addEventListener('click', ()=>{ selectAnswer(i, q.a, chosenPath); });
    choicesContainer.appendChild(b);
  });
  questionTimeLeft = 10; timeLeftEl.textContent = questionTimeLeft; // 10초
  questionModal.classList.remove('hidden');

  if(questionTimer) clearInterval(questionTimer);
  questionTimer = setInterval(()=>{
    questionTimeLeft -= 1;
    timeLeftEl.textContent = questionTimeLeft;
    if(questionTimeLeft<=0){
      clearInterval(questionTimer);
      // time over -> wrong
      markWrongAndContinue('시간 초과');
    }
  }, 1000);
}

function selectAnswer(choiceIndex, correctIndex, chosenPath){
  if(questionTimer) { clearInterval(questionTimer); questionTimer = null; }
  if(choiceIndex === correctIndex){
    answerResult.textContent = '정답! 결과를 기다리는 중...';
    closeAnswer.classList.remove('hidden');
    // pick random outcome
    setTimeout(()=>{ applyOutcome(weightedRandomOutcome(), chosenPath); }, 700);
  } else {
    markWrongAndContinue('오답');
  }
}

function markWrongAndContinue(reason){
  answerResult.textContent = reason + ' — 이동하지 않습니다.';
  closeAnswer.classList.remove('hidden');
  // wait then close modal and advance
  setTimeout(()=>{ questionModal.classList.add('hidden'); advanceTurn(); }, 1000);
}

// legacy: randomOutcome removed, use weightedRandomOutcome

function applyOutcome(outcome, chosenPath){
  const p = players[currentPlayerIndex];
  answerResult.textContent = `결과: ${outcome}`;
  // apply rules
  if(outcome === '횡단보도'){
    // show win/lose buttons
    const winLose = document.createElement('div');
    const winBtn = document.createElement('button');
    winBtn.textContent = '이김';
    const loseBtn = document.createElement('button');
    loseBtn.textContent = '짐';
    winLose.appendChild(winBtn); winLose.appendChild(loseBtn);
    answerResult.appendChild(winLose);
    winBtn.addEventListener('click', ()=>{
      // 이김 -> 직진 1
      movePlayer(p, 1);
      closeAfterOutcome();
    });
    loseBtn.addEventListener('click', ()=>{
      // 짐 -> 이동 없음
      closeAfterOutcome();
    });
  } else if(outcome === '길'){
    movePlayer(p, 1); closeAfterOutcome();
  } else if(outcome === '무빙워크'){
    movePlayer(p, 1); // twice
    // small delay then second move
    setTimeout(()=>{ movePlayer(p, 1); finalizeAfterDelay(); }, 300);
    setTimeout(()=>{ closeAfterOutcome(); }, 700);
  } else if(outcome === '개똥'){
    movePlayer(p, -2); closeAfterOutcome();
  } else if(outcome === '돌뿌리'){
    p.skipNext = true; closeAfterOutcome();
  }
}

function movePlayer(player, delta){
  if(delta > 0){
    player.pos = Math.min(TRACK_LENGTH, player.pos + delta);
  } else {
    player.pos = Math.max(0, player.pos + delta);
  }
  renderPlayers();
  checkVictory(player);
}

function checkVictory(player){
  if(player.pos >= TRACK_LENGTH){
    endGameWithWinner(player);
  }
}

function endGameWithWinner(player){
  isGameRunning = false;
  questionModal.classList.add('hidden');
  turnIndicator.textContent = `${player.name} 승리!`;
  startBtn.disabled = false;
  // fireworks and claps on winner's side
  const side = player.id === 'left'? document.getElementById('player-left') : document.getElementById('player-right');
  const fw = document.createElement('div'); fw.className = 'fireworks'; fw.innerHTML = '<div style="position:absolute;left:50%;top:20%;transform:translateX(-50%);">🎆🎆🎆</div>';
  side.appendChild(fw);
  // play simple clap using WebAudio or built-in beep
  playClap();
}

function playClap(){
  try{
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'triangle'; o.frequency.value = 800;
    g.gain.value = 0.0001;
    o.connect(g); g.connect(ctx.destination);
    o.start();
    g.gain.exponentialRampToValueAtTime(0.5, ctx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
    o.stop(ctx.currentTime + 0.3);
  }catch(e){ console.log('no audio', e); }
}

function closeAfterOutcome(){
  // small delay to let player see
  setTimeout(()=>{ questionModal.classList.add('hidden'); advanceTurn(); }, 600);
}

function finalizeAfterDelay(){ renderPlayers(); }

function advanceTurn(){
  // switch player
  currentPlayerIndex = (currentPlayerIndex + 1) % players.length;
  turnIndicator.textContent = `${players[currentPlayerIndex].name}의 차례`;
  // open path choices automatically for the current player
  if(isGameRunning) setTimeout(()=>{ openPathChoices(); }, 400);
}

// add click to tracks so players can click to start when it's their turn
trackLeft.parentNode.addEventListener('click', ()=>{
  if(!isGameRunning) return;
  if(players[currentPlayerIndex].id !== 'left') return;
  openPathChoices();
});
trackRight.parentNode.addEventListener('click', ()=>{
  if(!isGameRunning) return;
  if(players[currentPlayerIndex].id !== 'right') return;
  openPathChoices();
});

// initialize
initTracks();
turnIndicator.textContent = '';

// mark first todo completed
(function completeTodo(){
  try{
    // no-op: the manage_todo_list already created todos; we'll update statuses later if needed.
  }catch(e){ }
})();
