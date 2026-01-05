import * as faceapi from 'face-api.js';
import './style.css';

// --- State ---
// --- State ---
const state = {
  scanning: false,
  modelsLoaded: false,
  stream: null,
  mode: 'solo', // solo, duo, squad, glowup
  history: JSON.parse(localStorage.getItem('vibescan_history') || '[]'),
  scanCount: parseInt(localStorage.getItem('vibescan_count') || '0'),
  lastScanDate: localStorage.getItem('vibescan_last_date') || null
};

// --- Badges Definition ---
const BADGES = {
  SIGMA_MASTER: { id: 'sigma_master', emoji: '🗿', name: 'Sigma Master', desc: 'Sigma score > 90' },
  NPC_HUNTER: { id: 'npc_hunter', emoji: '💀', name: 'NPC Hunter', desc: 'Detected a pure NPC' },
  RIZZ_KING: { id: 'rizz_king', emoji: '👑', name: 'Rizz King', desc: 'Rizz > 85 (Premium)', premium: true },
  AURA_LEGEND: { id: 'aura_legend', emoji: '⚡', name: 'Aura Legend', desc: 'Aura > 5000 (Premium)', premium: true },
  MAIN_CHARACTER: { id: 'main_character', emoji: '🔥', name: 'Main Character', desc: '50+ Total Scans', premium: true }
};

// --- Elements ---
const screens = {
  landing: document.getElementById('landing-screen'),
  scanner: document.getElementById('scanner-screen'),
  result: document.getElementById('result-screen')
};
const video = document.getElementById('video-feed');
const canvas = document.getElementById('overlay-canvas');
const hudText = document.getElementById('hud-text');
const finalCard = document.getElementById('final-card');
const modeBtns = document.querySelectorAll('.mode-btn');

// --- Initialization ---
async function init() {
  console.log("Initializing VibeScan AI...");

  const isCapacitor = window.Capacitor !== undefined;
  const isProduction = !window.location.href.includes('localhost');
  
  let modelPath = 'models/';
  
  if (isCapacitor && isProduction) {
    modelPath = 'models/';
    console.log('📱 Running on Capacitor - using path:', modelPath);
  } else if (window.location.protocol === 'file:') {
    modelPath = 'models/';
    console.log('📁 Running from file:// - using path:', modelPath);
  } else {
    modelPath = './models/';
    console.log('🌐 Running on web - using path:', modelPath);
  }
  
  try {
    console.log(`Loading models from: ${modelPath}`);
    
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(modelPath),
      faceapi.nets.faceExpressionNet.loadFromUri(modelPath),
      faceapi.nets.faceLandmark68TinyNet.loadFromUri(modelPath)
    ]);
    
    state.modelsLoaded = true;
    console.log("✅ Models Loaded Successfully!");
    console.log("TinyFaceDetector:", faceapi.nets.tinyFaceDetector.isLoaded);
    console.log("FaceExpressionNet:", faceapi.nets.faceExpressionNet.isLoaded);
    console.log("FaceLandmark68TinyNet:", faceapi.nets.faceLandmark68TinyNet.isLoaded);
    
  } catch (e) {
    console.error("❌ Error loading models:", e);
    console.error("Attempted path:", modelPath);
    console.error("Protocol:", window.location.protocol);
    console.error("Capacitor available:", isCapacitor);
    
    console.log("Attempting fallback paths...");
    const fallbackPaths = ['models/', './models/', '/models/', 'assets/models/'];
    
    for (const fallbackPath of fallbackPaths) {
      try {
        console.log(`Trying fallback path: ${fallbackPath}`);
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(fallbackPath),
          faceapi.nets.faceExpressionNet.loadFromUri(fallbackPath),
          faceapi.nets.faceLandmark68TinyNet.loadFromUri(fallbackPath)
        ]);
        state.modelsLoaded = true;
        console.log("✅ Models loaded from fallback path:", fallbackPath);
        return;
      } catch (e2) {
        console.log(`Fallback path ${fallbackPath} failed, trying next...`);
        continue;
      }
    }
    
    alert(
      "Failed to load AI models.\n\n" +
      "Please ensure:\n" +
      "1. Models folder exists in public/models/\n" +
      "2. All .json and model files are present\n" +
      "3. Run 'npm run build' to generate dist folder"
    );
  }

  // Check Premium Status
  const isPremium = localStorage.getItem('vibescan_premium') === 'true';
  if (isPremium) {
    document.body.classList.add('is-premium');
    const supportBtn = document.querySelector('button[onclick*="payment.html"]');
    if (supportBtn) supportBtn.style.display = 'none';

    const premiumBadge = document.createElement('div');
    premiumBadge.innerHTML = '⭐ PREMIUM UNLOCKED';
    premiumBadge.style.cssText = 'color: #FFD700; font-weight: bold; margin-top: 20px; text-shadow: 0 0 10px #FFD700; font-size: 1.2rem;';

    const landingScreen = document.getElementById('landing-screen');
    const startBtn = document.getElementById('start-btn');
    if (landingScreen && startBtn) {
      landingScreen.insertBefore(premiumBadge, startBtn);
    }
  }

  // Event Listeners
  document.getElementById('start-btn').addEventListener('click', handleStartClick);
  document.getElementById('retry-btn').addEventListener('click', resetApp);

  // Premium Button Listener
  const premiumBtn = document.querySelector('button[onclick*="payment.html"]');
  if (premiumBtn) {
    premiumBtn.onclick = null;
    premiumBtn.addEventListener('click', (e) => {
      e.preventDefault();
      window.location.href = '/payment.html';
    });
  }

  const downloadBtn = document.getElementById('download-btn') || document.getElementById('share-btn');
  if (downloadBtn) downloadBtn.addEventListener('click', downloadResult);

  modeBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      const newMode = e.target.dataset.mode;
      const isPremium = localStorage.getItem('vibescan_premium') === 'true';

      if (newMode === 'glowup' && !isPremium) {
        if (confirm("💎 Premium Feature Locked\n\nUnlock Glow Up mode to see your Beauty Score & Looksmaxxing tips?")) {
          window.location.href = '/payment.html';
        }
        return;
      }

      modeBtns.forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      state.mode = newMode;
    });
  });
}

// --- Daily Limit Logic ---
function canScanToday() {
  const isPremium = localStorage.getItem('vibescan_premium') === 'true';
  if (isPremium) return true;

  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const lastDate = state.lastScanDate;
  const dailyCount = parseInt(localStorage.getItem('vibescan_daily_count') || '0');

  if (lastDate !== today) {
    // New day, reset count
    localStorage.setItem('vibescan_last_date', today);
    localStorage.setItem('vibescan_daily_count', '0');
    state.lastScanDate = today;
    return true;
  }

  return dailyCount < 3;
}

function handleStartClick() {
  if (!canScanToday()) {
    alert("🚨 Daily Limit Reached!\n\nYou've used your 3 free scans today. Upgrade to Premium for unlimited scans and exclusive features!");
    window.location.href = '/payment.html';
    return;
  }
  startScanner();
}

// --- Navigation ---
function showScreen(name) {
  Object.values(screens).forEach(s => s.classList.remove('active'));
  screens[name].classList.add('active');
}

// --- Scanner Logic ---
async function startScanner() {
  if (!state.modelsLoaded) {
    alert("AI Models loading... please wait.");
    return;
  }

  showScreen('scanner');
  hudText.innerText = "INITIALIZING CAMERA...";

  try {
    state.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
    video.srcObject = state.stream;

    video.onloadedmetadata = () => {
      video.play();
      const displaySize = { width: video.videoWidth, height: video.videoHeight };
      faceapi.matchDimensions(canvas, displaySize);
      state.scanning = true;
      scanLoop();
    };
  } catch (err) {
    console.error("Camera error:", err);
    alert("Camera access denied. Please allow camera permissions.");
    showScreen('landing');
  }
}

async function scanLoop() {
  if (!state.scanning) return;

  const displaySize = { width: video.videoWidth, height: video.videoHeight };
  if (canvas.width !== displaySize.width || canvas.height !== displaySize.height) {
    faceapi.matchDimensions(canvas, displaySize);
  }

  const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.3 });
  const detections = await faceapi.detectAllFaces(video, options)
    .withFaceLandmarks(true)
    .withFaceExpressions();

  const resizedDetections = faceapi.resizeResults(detections, displaySize);
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (resizedDetections.length > 0) {
    const faceCount = resizedDetections.length;
    let ready = false;

    if (state.mode === 'solo' && faceCount >= 1) ready = true;
    else if (state.mode === 'duo' && faceCount >= 2) ready = true;
    else if (state.mode === 'squad' && faceCount >= 3) ready = true;
    else if (state.mode === 'glowup' && faceCount >= 1) ready = true;

    resizedDetections.forEach(det => {
      const box = det.detection.box;
      ctx.strokeStyle = ready ? '#00FF7F' : '#8A2BE2';
      ctx.lineWidth = 2;
      ctx.strokeRect(box.x, box.y, box.width, box.height);
    });

    if (ready) {
      hudText.innerText = `TARGETS ACQUIRED (${faceCount}) - ANALYZING...`;
      analyzeVibe(resizedDetections);
    } else {
      hudText.innerText = state.mode === 'duo' ? "WAITING FOR 2ND PLAYER..." :
        (state.mode === 'squad' ? "ASSEMBLE THE SQUAD..." : "ALIGN FACE...");
    }
  } else {
    hudText.innerText = "SEARCHING...";
  }

  requestAnimationFrame(scanLoop);
}

// --- Vibe Analysis ---
let analysisFrames = 0;
const ANALYSIS_DURATION = 30;
let vibeAccumulator = [];

function analyzeVibe(detections) {
  if (vibeAccumulator.length !== detections.length) {
    vibeAccumulator = detections.map(() => ({
      neutral: 0, happy: 0, sad: 0, angry: 0, fearful: 0, disgusted: 0, surprised: 0
    }));
    analysisFrames = 0;
  }

  detections.forEach((det, i) => {
    const expr = det.expressions;
    for (const [k, v] of Object.entries(expr)) {
      vibeAccumulator[i][k] += v;
    }
  });

  analysisFrames++;
  if (analysisFrames >= ANALYSIS_DURATION) {
    finishAnalysis(detections);
  }
}

function finishAnalysis(lastDetections) {
  state.scanning = false;

  const results = vibeAccumulator.map((acc, i) => {
    const avg = {};
    for (const [k, v] of Object.entries(acc)) {
      avg[k] = v / analysisFrames;
    }
    return calculateStats(avg, lastDetections[i]);
  });

  // Update Stats
  state.scanCount++;
  localStorage.setItem('vibescan_count', state.scanCount);

  const dailyCount = parseInt(localStorage.getItem('vibescan_daily_count') || '0');
  localStorage.setItem('vibescan_daily_count', dailyCount + 1);

  const history = JSON.parse(localStorage.getItem('vibescan_history') || '[]');
  history.push({
    timestamp: Date.now(),
    aura: results[0].aura,
    vibe: results[0].mainVibe,
    mode: state.mode
  });
  if (history.length > 100) history.shift();
  localStorage.setItem('vibescan_history', JSON.stringify(history));

  // Check for new badges
  checkBadges(results[0]);

  generateCard(results);
  state.stream.getTracks().forEach(t => t.stop());
  showScreen('result');

  analysisFrames = 0;
  vibeAccumulator = [];
}

function checkBadges(result) {
  const isPremium = localStorage.getItem('vibescan_premium') === 'true';
  const currentBadges = JSON.parse(localStorage.getItem('vibescan_badges') || '[]');
  const newBadges = [];

  if (result.scores.Sigma > 90 && !currentBadges.includes('sigma_master')) newBadges.push('sigma_master');
  if (result.scores.NPC > 90 && !currentBadges.includes('npc_hunter')) newBadges.push('npc_hunter');

  if (isPremium) {
    if (result.scores.Rizz > 85 && !currentBadges.includes('rizz_king')) newBadges.push('rizz_king');
    if (result.aura > 5000 && !currentBadges.includes('aura_legend')) newBadges.push('aura_legend');
    if (state.scanCount >= 50 && !currentBadges.includes('main_character')) newBadges.push('main_character');
  }

  if (newBadges.length > 0) {
    const updated = [...currentBadges, ...newBadges];
    localStorage.setItem('vibescan_badges', JSON.stringify(updated));
    console.log("New Badges Unlocked:", newBadges);
  }
}

// --- Stats Calculation ---
function calculateStats(expr, detection) {
  const landmarks = detection.landmarks;
  const box = detection.detection.box;
  const imageArea = video.videoWidth * video.videoHeight;
  const faceArea = box.width * box.height;
  const faceCoverage = faceArea / imageArea;

  const npcScore = (expr.neutral * 90) + (expr.fearful * 10);
  const jaw = landmarks.getJawOutline();
  const jawWidth = Math.abs(jaw[16].x - jaw[0].x);
  const jawRatio = jawWidth / box.height;
  const sigmaScore = (expr.neutral * 40) + (expr.angry * 40) + ((jawRatio - 0.7) * 100);

  const mouth = landmarks.getMouth();
  const mouthTilt = Math.abs(mouth[0].y - mouth[6].y);
  const leftEye = landmarks.getLeftEye();
  const rightEye = landmarks.getRightEye();
  const avgEyeOpen = (Math.abs(leftEye[1].y - leftEye[5].y) + Math.abs(rightEye[1].y - rightEye[5].y)) / 2;
  const eyeRatio = avgEyeOpen / box.height;

  const rizzScore = (expr.happy * 30) + (mouthTilt * 2) + ((0.05 - eyeRatio) * 500) + (expr.neutral * 20);
  const nose = landmarks.getNose();
  const headTilt = Math.abs(nose[3].x - jaw[8].x);
  const villainScore = (expr.angry * 70) + (expr.disgusted * 30) + (headTilt * 0.5);
  const glazeScore = (expr.surprised * 50) + (expr.happy * 30) + (eyeRatio * 200);
  const gyatScore = ((jawRatio - 0.75) * 400);

  let aura = 1000;
  aura += (faceCoverage * 5000);
  aura += (sigmaScore * 20) + (rizzScore * 15) + (villainScore * 15);
  aura -= (npcScore * 10) + (glazeScore * 15);
  if (expr.angry > 0.5) aura *= 1.2;
  if (expr.fearful > 0.5) aura *= 0.5;

  const clamp = (n) => Math.min(100, Math.max(0, Math.round(n)));
  const scores = {
    NPC: clamp(npcScore), Sigma: clamp(sigmaScore), Rizz: clamp(rizzScore),
    Villain: clamp(villainScore), Glazing: clamp(glazeScore), Gyat: clamp(gyatScore)
  };

  const vibes = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const mainVibe = vibes[0][0];

  const badges = [];
  const currentBadges = JSON.parse(localStorage.getItem('vibescan_badges') || '[]');
  currentBadges.forEach(bid => {
    const b = Object.values(BADGES).find(x => x.id === bid);
    if (b) badges.push(`${b.emoji} ${b.name}`);
  });

  const phrases = {
    NPC: ["Default Settings Detected 💀", "Bro is running on Windows 95", "Zero thoughts, head empty"],
    Sigma: ["Bateman Stare Locked 🗿", "Grindset Mindset Active", "Lonely at the top"],
    Rizz: ["Hide your girlfriends 🥶", "Unspoken Rizz Detected", "Menace to society"],
    Villain: ["Villain Arc Loading... 😈", "Who hurt you bro?", "Demon Time"],
    Glazing: ["Professional Glazer 🍩", "Simp levels critical", "Bro thinks he's on the team"],
    Gyat: ["Level 10 Gyat Detected", "Ohio Final Boss", "Skibidi Rizz"]
  };

  const phraseList = phrases[mainVibe] || phrases['NPC'];
  const phrase = phraseList[Math.floor(Math.random() * phraseList.length)];

  let beautyScore = 0;
  if (state.mode === 'glowup') {
    const leftEyeW = Math.abs(landmarks.getLeftEye()[3].x - landmarks.getLeftEye()[0].x);
    const rightEyeW = Math.abs(landmarks.getRightEye()[3].x - landmarks.getRightEye()[0].x);
    const symmetry = 1 - (Math.abs(leftEyeW - rightEyeW) / ((leftEyeW + rightEyeW) / 2));
    const ratio = box.height / box.width;
    const ratioScore = Math.max(0, 1 - Math.abs(1.618 - ratio));
    beautyScore = Math.min(100, Math.max(10, Math.round(((symmetry * 40) + (ratioScore * 30) + (jawRatio * 30)) * 1.1)));
  }

  return { scores, mainVibe, badges, phrase, aura: Math.round(aura), beautyScore };
}

// --- Card Generation ---
function generateCard(results) {
  const cardCanvas = document.createElement('canvas');
  cardCanvas.width = 1080; cardCanvas.height = 1920;
  const ctx = cardCanvas.getContext('2d');

  ctx.fillStyle = '#0D0D0D';
  ctx.fillRect(0, 0, cardCanvas.width, cardCanvas.height);

  const vRatio = video.videoWidth / video.videoHeight;
  const cRatio = cardCanvas.width / cardCanvas.height;
  let drawW, drawH, startX, startY;

  if (vRatio > cRatio) {
    drawH = cardCanvas.height; drawW = drawH * vRatio;
    startX = (cardCanvas.width - drawW) / 2; startY = 0;
  } else {
    drawW = cardCanvas.width; drawH = drawW / vRatio;
    startX = 0; startY = (cardCanvas.height - drawH) / 2;
  }

  ctx.save();
  ctx.scale(-1, 1);
  ctx.drawImage(video, -startX - drawW, startY, drawW, drawH);
  ctx.restore();

  const grad = ctx.createLinearGradient(0, cardCanvas.height / 2, 0, cardCanvas.height);
  grad.addColorStop(0, 'transparent'); grad.addColorStop(0.8, '#0D0D0D');
  ctx.fillStyle = grad; ctx.fillRect(0, 0, cardCanvas.width, cardCanvas.height);

  ctx.font = 'bold 80px "Russo One"'; ctx.fillStyle = '#8A2BE2'; ctx.textAlign = 'center';
  ctx.fillText('VIBESCAN AI', cardCanvas.width / 2, 120);

  if (state.mode === 'duo' && results.length >= 2) renderDuo(ctx, results, cardCanvas.width, cardCanvas.height);
  else if (state.mode === 'glowup') renderGlowUp(ctx, results[0], cardCanvas.width, cardCanvas.height);
  else renderSolo(ctx, results[0], cardCanvas.width, cardCanvas.height);

  const dataUrl = cardCanvas.toDataURL('image/png');
  const img = document.createElement('img');
  img.src = dataUrl;
  finalCard.innerHTML = '';
  finalCard.appendChild(img);
}

function renderSolo(ctx, stats, w, h) {
  ctx.font = 'bold 80px "Russo One"';
  ctx.fillStyle = stats.aura > 3000 ? '#00FF7F' : (stats.aura < 0 ? '#FF0000' : '#8A2BE2');
  ctx.textAlign = 'center';
  ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 20;
  ctx.fillText(`AURA: ${stats.aura}`, w / 2, 250);
  ctx.shadowBlur = 0;

  ctx.font = 'bold 160px "Inter"'; ctx.fillStyle = '#ffffff';
  ctx.shadowColor = '#8A2BE2'; ctx.shadowBlur = 30;
  ctx.fillText(stats.mainVibe.toUpperCase(), w / 2, h - 750);
  ctx.shadowBlur = 0;

  ctx.font = 'italic 50px "Inter"'; ctx.fillStyle = '#00f3ff';
  ctx.fillText(`"${stats.phrase}"`, w / 2, h - 650);

  let y = h - 500;
  const metrics = ['NPC', 'Sigma', 'Rizz', 'Villain', 'Glazing', 'Gyat'];
  metrics.forEach((m, i) => {
    const col = i % 2; const row = Math.floor(i / 2);
    const x = col === 0 ? 150 : 600; const yPos = y + (row * 100);
    ctx.font = 'bold 35px "Inter"'; ctx.fillStyle = '#aaa'; ctx.textAlign = 'left';
    ctx.fillText(m, x, yPos);
    ctx.fillStyle = '#fff'; ctx.textAlign = 'right';
    ctx.fillText(`${stats.scores[m]}%`, x + 350, yPos);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)'; ctx.fillRect(x, yPos + 15, 350, 12);
    ctx.fillStyle = stats.scores[m] > 80 ? '#00FF7F' : (stats.scores[m] > 50 ? '#8A2BE2' : '#FF0055');
    ctx.fillRect(x, yPos + 15, 350 * (stats.scores[m] / 100), 12);
  });

  if (stats.badges.length > 0) {
    ctx.font = 'bold 40px "Inter"'; ctx.fillStyle = '#FFD700'; ctx.textAlign = 'center';
    ctx.fillText("🏆 BADGES UNLOCKED 🏆", w / 2, h - 180);
    ctx.font = '50px "Segoe UI Emoji"'; ctx.fillStyle = '#fff';
    ctx.fillText(stats.badges.join('   '), w / 2, h - 110);
  }

  const history = JSON.parse(localStorage.getItem('vibescan_history') || '[]');
  const rank = history.filter(h => h.aura > stats.aura).length + 1;
  ctx.font = 'bold 30px "Inter"'; ctx.fillStyle = '#8A2BE2'; ctx.textAlign = 'right';
  ctx.fillText(`#${rank} LOCAL RANK`, w - 50, 50);
}

function renderDuo(ctx, results, w, h) {
  const p1 = results[0]; const p2 = results[1];
  ctx.font = 'bold 100px "Russo One"'; ctx.fillStyle = '#fff'; ctx.fillText("VS", w / 2, h - 800);
  ctx.textAlign = 'left'; ctx.fillStyle = '#00FF7F'; ctx.fillText(p1.mainVibe, 100, h - 700);
  ctx.textAlign = 'right'; ctx.fillStyle = '#8A2BE2'; ctx.fillText(p2.mainVibe, w - 100, h - 700);
  ctx.textAlign = 'center'; ctx.font = 'bold 80px "Inter"'; ctx.fillStyle = '#FFD700';
  ctx.fillText(`${p1.aura > p2.aura ? "LEFT" : "RIGHT"} MOGS 🏆`, w / 2, h - 300);
}

function renderGlowUp(ctx, stats, w, h) {
  const score = stats.beautyScore;
  const color = score > 90 ? '#00FF7F' : (score > 70 ? '#8A2BE2' : '#FF0055');
  ctx.beginPath(); ctx.arc(w / 2, h / 2 - 100, 250, 0, 2 * Math.PI);
  ctx.lineWidth = 20; ctx.strokeStyle = color; ctx.stroke();
  ctx.font = 'bold 200px "Russo One"'; ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
  ctx.fillText(score, w / 2, h / 2 - 40);
  ctx.font = 'bold 50px "Inter"'; ctx.fillStyle = color; ctx.fillText("BEAUTY SCORE", w / 2, h / 2 + 60);

  let feedback = score > 90 ? "ABSOLUTE MODEL TIER ✨" : (score > 80 ? "HIGH TIER HUMAN 🔥" : (score > 60 ? "POTENTIAL DETECTED 📈" : "IT'S OVER FOR YOU 💀"));
  ctx.font = 'italic 60px "Inter"'; ctx.fillStyle = '#fff'; ctx.fillText(feedback, w / 2, h - 500);
}

function downloadResult() {
  const img = finalCard.querySelector('img');
  if (img) {
    const link = document.createElement('a');
    link.href = img.src; link.download = 'vibescan-result.png'; link.click();
  }
}

function resetApp() {
  showScreen('landing');
  finalCard.innerHTML = '';
}

init();
