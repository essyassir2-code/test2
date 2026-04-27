/*
  FILE 3: game.js
  Core game logic: modes, canvas rendering, hit detection, stats, settings
*/

(function() {
  // ---------- DOM Elements ----------
  const canvas = document.getElementById('aimCanvas');
  const ctx = canvas.getContext('2d');
  const scoreSpan = document.getElementById('scoreDisplay');
  const accuracySpan = document.getElementById('accuracyDisplay');
  const hitsSpan = document.getElementById('hitsDisplay');
  const shotsSpan = document.getElementById('shotsDisplay');
  const highscoreSpan = document.getElementById('highscoreDisplay');
  const feedbackDiv = document.getElementById('feedbackMsg');
  const modeDesc = document.getElementById('modeDesc');
  
  // Mode buttons
  const modeTrackingBtn = document.getElementById('modeTracking');
  const modeFlickBtn = document.getElementById('modeFlick');
  const modeReactionBtn = document.getElementById('modeReaction');
  const resetSessionBtn = document.getElementById('resetSessionBtn');
  const resetAllBtn = document.getElementById('resetAllBtn');
  const sensitivitySlider = document.getElementById('sensitivitySlider');
  const sensitivityVal = document.getElementById('sensitivityVal');
  
  // Crosshair buttons
  const crossBtns = document.querySelectorAll('.cross-btn');
  
  // Game state
  let currentMode = 'tracking'; // 'tracking', 'flick', 'reaction'
  let score = 0;
  let hits = 0;
  let shots = 0;
  let highScore = 0;
  let sensitivity = 1.0;
  let crosshairType = 'dot';
  
  // Animation & targets
  let animationId = null;
  let trackingTarget = { x: 200, y: 200, size: 52, vx: 2.2, vy: 1.9 };
  let flickTargets = []; // single target for flick & reaction
  let canvasWidth = 1000, canvasHeight = 600;
  
  // Mouse coordinates for custom crosshair
  let mouseX = -100, mouseY = -100;
  
  // Feedback timeout
  let feedbackTimeout = null;
  
  // ---------- Helper Functions ----------
  function updateUI() {
    scoreSpan.textContent = score;
    hitsSpan.textContent = hits;
    shotsSpan.textContent = shots;
    let acc = shots === 0 ? 0 : ((hits / shots) * 100).toFixed(0);
    accuracySpan.textContent = acc;
    if (score > highScore) {
      highScore = score;
      localStorage.setItem('nova_highscore', highScore);
      highscoreSpan.textContent = highScore;
    } else {
      highscoreSpan.textContent = highScore;
    }
  }
  
  function showFeedback(msg, isHit = true) {
    if (feedbackTimeout) clearTimeout(feedbackTimeout);
    feedbackDiv.textContent = msg;
    feedbackDiv.style.color = isHit ? '#b9ffb0' : '#ffa098';
    feedbackTimeout = setTimeout(() => {
      feedbackDiv.textContent = '';
      feedbackDiv.style.color = '#b9e0ff';
    }, 320);
  }
  
  function randomPosition(padding = 55, objSize = 52) {
    const maxX = canvasWidth - objSize - padding;
    const maxY = canvasHeight - objSize - padding;
    return {
      x: Math.max(padding, Math.min(maxX, padding + Math.random() * (maxX - padding))),
      y: Math.max(padding, Math.min(maxY, padding + Math.random() * (maxY - padding)))
    };
  }
  
  // Resize canvas observer
  function resizeCanvas() {
    const rect = canvas.parentElement.getBoundingClientRect();
    canvasWidth = rect.width;
    canvasHeight = rect.height;
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    if (currentMode === 'tracking') {
      // clamp tracking target inside new bounds
      trackingTarget.x = Math.min(Math.max(trackingTarget.x, 20), canvasWidth - trackingTarget.size - 20);
      trackingTarget.y = Math.min(Math.max(trackingTarget.y, 20), canvasHeight - trackingTarget.size - 20);
    } else {
      regenerateModeTarget();
    }
  }
  
  function regenerateModeTarget() {
    if (currentMode === 'flick' || currentMode === 'reaction') {
      const pos = randomPosition(60, 52);
      flickTargets = [{ id: Date.now(), x: pos.x, y: pos.y, size: 52 }];
    }
  }
  
  // Reset session (keep highscore)
  function resetSession() {
    score = 0;
    hits = 0;
    shots = 0;
    updateUI();
    showFeedback('⟳ Session reset', false);
    if (currentMode === 'tracking') {
      // recenter tracking target
      trackingTarget.x = canvasWidth / 2 - trackingTarget.size/2;
      trackingTarget.y = canvasHeight / 2 - trackingTarget.size/2;
      trackingTarget.vx = (Math.random() > 0.5 ? 2.0 : -2.0) * (0.8 + sensitivity * 0.3);
      trackingTarget.vy = (Math.random() > 0.5 ? 1.8 : -1.8) * (0.8 + sensitivity * 0.3);
    } else {
      regenerateModeTarget();
    }
  }
  
  function resetAllProgress() {
    highScore = 0;
    localStorage.removeItem('nova_highscore');
    resetSession();
    highscoreSpan.textContent = 0;
    showFeedback('All stats wiped', false);
  }
  
  // hit handling
  function registerHit() {
    let points = 0;
    if (currentMode === 'tracking') points = 10;
    else if (currentMode === 'flick') points = 15;
    else points = 25; // reaction
    
    score += points;
    hits++;
    shots++;
    updateUI();
    showFeedback(`+${points} ${currentMode.toUpperCase()}!`, true);
    
    if (currentMode === 'tracking') {
      // tracking: target stays, just increase difficulty / speed pulse?
      let spd = 0.9 + sensitivity * 0.4;
      trackingTarget.vx = (Math.abs(trackingTarget.vx) + 0.25) * (trackingTarget.vx > 0 ? 1 : -1);
      trackingTarget.vy = (Math.abs(trackingTarget.vy) + 0.2) * (trackingTarget.vy > 0 ? 1 : -1);
      let maxSpeed = 6.2;
      trackingTarget.vx = Math.min(maxSpeed, Math.max(-maxSpeed, trackingTarget.vx));
      trackingTarget.vy = Math.min(maxSpeed, Math.max(-maxSpeed, trackingTarget.vy));
    } else {
      // flick & reaction: respawn target at new random location
      regenerateModeTarget();
    }
  }
  
  function registerMiss() {
    shots++;
    updateUI();
    showFeedback('miss', false);
  }
  
  // hit detection on click
  function handleCanvasClick(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    let clickX = (e.clientX - rect.left) * scaleX;
    let clickY = (e.clientY - rect.top) * scaleY;
    
    if (currentMode === 'tracking') {
      const t = trackingTarget;
      if (clickX >= t.x && clickX <= t.x + t.size && clickY >= t.y && clickY <= t.y + t.size) {
        registerHit();
      } else {
        registerMiss();
      }
    } 
    else if (currentMode === 'flick' || currentMode === 'reaction') {
      if (flickTargets.length === 0) return;
      const target = flickTargets[0];
      if (clickX >= target.x && clickX <= target.x + target.size && clickY >= target.y && clickY <= target.y + target.size) {
        registerHit();
      } else {
        registerMiss();
      }
    }
  }
  
  // ---------- Mode Logic & Animation ----------
  function updateTrackingMovement() {
    let speedFactor = 0.9 + sensitivity * 0.45;
    let dx = trackingTarget.vx * speedFactor;
    let dy = trackingTarget.vy * speedFactor;
    let newX = trackingTarget.x + dx;
    let newY = trackingTarget.y + dy;
    if (newX <= 15 || newX + trackingTarget.size >= canvasWidth - 15) {
      trackingTarget.vx *= -1;
      newX = trackingTarget.x + trackingTarget.vx * speedFactor;
    }
    if (newY <= 15 || newY + trackingTarget.size >= canvasHeight - 15) {
      trackingTarget.vy *= -1;
      newY = trackingTarget.y + trackingTarget.vy * speedFactor;
    }
    trackingTarget.x = Math.min(Math.max(newX, 12), canvasWidth - trackingTarget.size - 12);
    trackingTarget.y = Math.min(Math.max(newY, 12), canvasHeight - trackingTarget.size - 12);
  }
  
  // Drawing
  function drawTargets() {
    if (currentMode === 'tracking') {
      ctx.shadowBlur = 8;
      ctx.shadowColor = "#ff4d8a";
      ctx.fillStyle = "#ff3b6f";
      ctx.beginPath();
      ctx.ellipse(trackingTarget.x + trackingTarget.size/2, trackingTarget.y + trackingTarget.size/2, trackingTarget.size/2, trackingTarget.size/2, 0, 0, Math.PI*2);
      ctx.fill();
      ctx.fillStyle = "white";
      ctx.font = "bold 22px monospace";
      ctx.fillText("⬤", trackingTarget.x + trackingTarget.size/2 - 9, trackingTarget.y + trackingTarget.size/2 + 7);
      ctx.shadowBlur = 0;
    } 
    else if ((currentMode === 'flick' || currentMode === 'reaction') && flickTargets.length) {
      const t = flickTargets[0];
      ctx.shadowBlur = 6;
      ctx.fillStyle = currentMode === 'flick' ? "#3d9eff" : "#ffaa33";
      ctx.beginPath();
      ctx.rect(t.x, t.y, t.size, t.size);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 26px 'Segoe UI'";
      ctx.fillText(currentMode === 'flick' ? "⚡" : "!", t.x + 14, t.y + 38);
      ctx.shadowBlur = 0;
    }
  }
  
  function drawCrosshair() {
    if (mouseX < 0 || mouseY < 0 || mouseX > canvasWidth || mouseY > canvasHeight) return;
    ctx.beginPath();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.shadowBlur = 0;
    if (crosshairType === 'dot') {
      ctx.arc(mouseX, mouseY, 4, 0, 2*Math.PI);
      ctx.fillStyle = "#ffffffcc";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(mouseX, mouseY, 2, 0, 2*Math.PI);
      ctx.fillStyle = "white";
      ctx.fill();
    } else if (crosshairType === 'cross') {
      ctx.moveTo(mouseX-12, mouseY);
      ctx.lineTo(mouseX-4, mouseY);
      ctx.moveTo(mouseX+4, mouseY);
      ctx.lineTo(mouseX+12, mouseY);
      ctx.moveTo(mouseX, mouseY-12);
      ctx.lineTo(mouseX, mouseY-4);
      ctx.moveTo(mouseX, mouseY+4);
      ctx.lineTo(mouseX, mouseY+12);
      ctx.stroke();
    } else if (crosshairType === 'circle') {
      ctx.beginPath();
      ctx.arc(mouseX, mouseY, 8, 0, 2*Math.PI);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(mouseX, mouseY, 3, 0, 2*Math.PI);
      ctx.fillStyle = "white";
      ctx.fill();
    }
  }
  
  function drawBackground() {
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    ctx.strokeStyle = "rgba(80, 120, 200, 0.2)";
    ctx.lineWidth = 0.5;
    for (let i = 0; i < canvasWidth; i += 45) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, canvasHeight);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(canvasWidth, i);
      ctx.stroke();
    }
  }
  
  // Render loop
  function render() {
    drawBackground();
    drawTargets();
    drawCrosshair();
  }
  
  function updateGame() {
    if (currentMode === 'tracking') {
      updateTrackingMovement();
    }
    render();
    animationId = requestAnimationFrame(updateGame);
  }
  
  // Mouse tracking for crosshair
  function onMouseMove(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    mouseX = (e.clientX - rect.left) * scaleX;
    mouseY = (e.clientY - rect.top) * scaleY;
    mouseX = Math.min(Math.max(mouseX, 0), canvasWidth);
    mouseY = Math.min(Math.max(mouseY, 0), canvasHeight);
  }
  
  // ---------- Mode Switching ----------
  function setMode(mode) {
    currentMode = mode;
    // reset session stats but keep highscore, but also reset targets
    score = 0;
    hits = 0;
    shots = 0;
    updateUI();
    if (mode === 'tracking') {
      trackingTarget = {
        x: canvasWidth/2 - 26,
        y: canvasHeight/2 - 26,
        size: 52,
        vx: (Math.random() > 0.5 ? 2.1 : -2.1) * (0.7 + sensitivity * 0.3),
        vy: (Math.random() > 0.5 ? 1.9 : -1.9) * (0.7 + sensitivity * 0.3)
      };
      flickTargets = [];
      modeDesc.textContent = "Follow the moving orb — consistent tracking trains smooth mouse control.";
    } else {
      trackingTarget = null;
      regenerateModeTarget();
      if (mode === 'flick') modeDesc.textContent = "Click static targets as fast as possible — flick precision & speed.";
      else modeDesc.textContent = "React & click explosive targets — reduces reaction time.";
    }
    // update active ui
    [modeTrackingBtn, modeFlickBtn, modeReactionBtn].forEach(btn => btn.classList.remove('active'));
    if (mode === 'tracking') modeTrackingBtn.classList.add('active');
    if (mode === 'flick') modeFlickBtn.classList.add('active');
    if (mode === 'reaction') modeReactionBtn.classList.add('active');
    showFeedback(`${mode.toUpperCase()} MODE`, false);
  }
  
  // Sensitivity update
  function updateSensitivity(val) {
    sensitivity = parseFloat(val);
    sensitivityVal.textContent = sensitivity.toFixed(2);
  }
  
  // Crosshair change
  function setCrosshair(type) {
    crosshairType = type;
    crossBtns.forEach(btn => btn.classList.remove('active'));
    document.querySelector(`.cross-btn[data-cross="${type}"]`).classList.add('active');
  }
  
  // Event binding & init
  function init() {
    // load highscore
    const saved = localStorage.getItem('nova_highscore');
    if (saved) highScore = parseInt(saved);
    highscoreSpan.textContent = highScore;
    
    resizeCanvas();
    window.addEventListener('resize', () => { resizeCanvas(); if(currentMode !== 'tracking') regenerateModeTarget(); });
    canvas.addEventListener('click', handleCanvasClick);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mouseleave', () => { mouseX = -100; });
    
    modeTrackingBtn.addEventListener('click', () => setMode('tracking'));
    modeFlickBtn.addEventListener('click', () => setMode('flick'));
    modeReactionBtn.addEventListener('click', () => setMode('reaction'));
    resetSessionBtn.addEventListener('click', resetSession);
    resetAllBtn.addEventListener('click', resetAllProgress);
    sensitivitySlider.addEventListener('input', (e) => updateSensitivity(e.target.value));
    document.querySelector('[data-cross="dot"]').addEventListener('click', () => setCrosshair('dot'));
    document.querySelector('[data-cross="cross"]').addEventListener('click', () => setCrosshair('cross'));
    document.querySelector('[data-cross="circle"]').addEventListener('click', () => setCrosshair('circle'));
    
    updateSensitivity(sensitivitySlider.value);
    setCrosshair('dot');
    setMode('tracking');
    updateUI();
    animationId = requestAnimationFrame(updateGame);
  }
  
  init();
})();
