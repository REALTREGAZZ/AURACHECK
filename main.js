import * as faceapi from 'face-api.js';
import { Capacitor } from '@capacitor/core';
import './style.css';

// === SOLICITUD DE PERMISO DE CÁMARA ===
async function requestCameraPermission() {
  console.log("\n═══════════════════════════════════════════════════════");
  console.log("📹 SOLICITANDO PERMISO DE CÁMARA");
  console.log("═══════════════════════════════════════════════════════");

  // Si no es Capacitor, permitir acceso directo
  if (window.Capacitor === undefined) {
    console.log("🌐 No es Capacitor, usando acceso directo a cámara");
    return true;
  }

  try {
    // ✅ Usar método estándar de Capacitor para permisos
    let Camera = null;
    try {
      const cameraModule = await import('@capacitor/camera');
      Camera = cameraModule.Camera;
    } catch {
      Camera = null;
    }

    if (Camera?.checkPermissions && Camera?.requestPermissions) {
      const cameraPermission = await Camera.checkPermissions();
      const state = cameraPermission.camera;

      console.log(`📹 Estado actual del permiso de cámara: ${state}`);

      if (state === 'prompt') {
        console.log("⏳ Pidiendo permiso al usuario...");
        const requestResult = await Camera.requestPermissions({ permissions: ['camera'] });
        console.log("🔍 Resultado de solicitud:", requestResult);

        if (requestResult.camera === 'granted') {
          console.log("✅ PERMISO DE CÁMARA CONCEDIDO");
          return true;
        }

        console.warn("❌ PERMISO DE CÁMARA DENEGADO");
        alert(
          "⚠️ Permiso de Cámara Requerido\n\n" +
            "AuraCheck necesita acceso a tu cámara para escanear tu vibe.\n\n" +
            "Por favor, autoriza el acceso a la cámara en la configuración de Android."
        );
        return false;
      }

      if (state === 'granted') {
        console.log("✅ PERMISO DE CÁMARA YA CONCEDIDO");
        return true;
      }

      console.warn("❌ PERMISO DE CÁMARA DENEGADO PERMANENTEMENTE");
      alert(
        "⚠️ Permiso de Cámara Denegado\n\n" +
          "Necesitas autorizar el acceso a la cámara en:\n" +
          "Configuración > Aplicaciones > AuraCheck > Permisos > Cámara"
      );
      return false;
    }

    console.warn("⚠️ Plugin de permisos no disponible, intentando solicitar permiso con getUserMedia...");

    try {
      const tmpStream = await navigator.mediaDevices.getUserMedia({ video: true });
      tmpStream.getTracks().forEach(t => t.stop());
      console.log("✅ PERMISO DE CÁMARA CONCEDIDO");
      return true;
    } catch (err) {
      console.warn("❌ PERMISO DE CÁMARA DENEGADO (getUserMedia)");
      alert(
        "⚠️ Permiso de Cámara Requerido\n\n" +
          "AuraCheck necesita acceso a tu cámara para escanear tu vibe.\n\n" +
          "Por favor, autoriza el acceso a la cámara en la configuración de Android."
      );
      return false;
    }
  } catch (e) {
    console.error("❌ Error solicitando permiso de cámara:", e);
    console.warn("Continuando sin validación de permisos (puede fallar en Android)");
    return true; // Intentar continuar de todas formas
  }
}

// === SISTEMA PREMIUM CON GOOGLE PLAY (SEGURO PARA VITE) ===
class PremiumManager {
  constructor() {
    this.isPremium = localStorage.getItem('vibescan_premium') === 'true';
    this.productId = 'premium_lifetime'; // ID en Google Play Console
    this.price = '$9.99 USD';
    this.IAP = null; // Será asignado desde Capacitor.Plugins en init()
    this.isNative = Capacitor.isNativePlatform();
  }

  async init() {
    console.log("\n═══════════════════════════════════════════════════════");
    console.log("💎 INICIALIZANDO SISTEMA PREMIUM");
    console.log("═══════════════════════════════════════════════════════");
    
    // ✅ Si NO es nativo, salir limpiamente
    if (!this.isNative) {
      console.log("🌐 Plataforma web detectada - Premium simulado");
      console.log("💡 Google Play Billing solo disponible en Android");
      return;
    }
    
    // ✅ Si ES nativo, obtener plugin desde Capacitor.Plugins
    try {
      console.log("📱 Plataforma nativa detectada - Inicializando Google Play Billing");
      
      // OBTENER PLUGIN DESDE CAPACITOR (SIN IMPORTS)
      this.IAP = Capacitor.Plugins?.InAppPurchase;
      
      if (!this.IAP) {
        throw new Error('InAppPurchase no disponible en Capacitor.Plugins');
      }
      
      console.log("✅ Plugin InAppPurchase disponible en Capacitor.Plugins");
      
      // Inicializar plugin (si es necesario)
      try {
        if (typeof this.IAP.initialize === 'function') {
          await this.IAP.initialize({ ios: true, android: true });
          console.log("✅ Google Play Billing inicializado correctamente");
        }
      } catch (e) {
        console.log("ℹ️ Initialize no requerido o falló:", e.message);
      }
      
      // Escuchar compras
      if (typeof this.IAP.onPurchasesUpdated === 'function') {
        this.IAP.onPurchasesUpdated(async (result) => {
          console.log("🔔 Compras actualizadas:", result);
          await this.handlePurchaseUpdate(result);
        });
        console.log("✅ Listener de compras registrado");
      } else if (typeof this.IAP.addListener === 'function') {
        this.IAP.addListener('purchasesUpdated', async (result) => {
          console.log("🔔 Compras actualizadas:", result);
          await this.handlePurchaseUpdate(result);
        });
        console.log("✅ Listener de compras registrado");
      } else {
        console.log("ℹ️ No se encontró método para escuchar compras");
      }
      
      // Restaurar compras existentes
      await this.restorePurchases();
      
    } catch (e) {
      console.warn("⚠️ Error inicializando Google Play Billing:", e.message);
      console.log("ℹ️ Premium funcionará en modo simulado");
      this.IAP = null;
    }
  }

  async restorePurchases() {
    if (!this.IAP) return;

    try {
      if (typeof this.IAP.getPurchases === 'function') {
        const purchases = await this.IAP.getPurchases();
        await this.handlePurchaseUpdate(purchases);
        console.log("✅ Compras restauradas exitosamente");
      } else if (typeof this.IAP.restorePurchases === 'function') {
        const purchases = await this.IAP.restorePurchases();
        await this.handlePurchaseUpdate(purchases);
        console.log("✅ Compras restauradas exitosamente");
      } else {
        console.log("ℹ️ No se encontró método para restaurar compras");
      }
    } catch (e) {
      console.log("ℹ️ No se pudieron restaurar compras:", e.message);
    }
  }

  async handlePurchaseUpdate(purchasesOrResult) {
    const purchases = Array.isArray(purchasesOrResult)
      ? purchasesOrResult
      : (purchasesOrResult?.purchases || purchasesOrResult?.results || []);

    console.log("📋 Procesando compras:", purchases);

    for (const purchase of purchases) {
      if (purchase.productId !== this.productId) continue;

      const state = purchase.state || purchase.purchaseState || purchase.purchase_state;
      const isPurchased = state === 'Purchased' || state === 'PURCHASED' || state === 1 || state === '1';

      if (isPurchased) {
        console.log("✅ COMPRA EXITOSA DETECTADA");
        await this.activatePremium({ showAlert: false });

        try {
          // ✅ Reconocer compra en Google Play
          if (typeof this.IAP?.finishTransaction === 'function') {
            await this.IAP.finishTransaction({ purchase });
            console.log("✅ Transacción finalizada");
          } else if (typeof this.IAP?.acknowledgePurchase === 'function') {
            await this.IAP.acknowledgePurchase({ purchase });
            console.log("✅ Compra reconocida");
          }
        } catch (e) {
          console.log("ℹ️ No se pudo reconocer compra:", e.message);
          // No bloquear activación Premium por falta de acknowledge
        }
      }
    }
  }

  async requestPremium() {
    console.log("\n═══════════════════════════════════════════════════════");
    console.log("💳 INICIANDO COMPRA PREMIUM");
    console.log("═══════════════════════════════════════════════════════");

    if (this.isPremium) {
      console.log("✅ Usuario ya es Premium");
      alert("✨ Ya tienes acceso Premium\n\n¡Disfruta todas las funciones desbloqueadas!");
      return;
    }

    // ✅ Obtener plugin desde Capacitor.Plugins (SIN IMPORTS)
    const IAP = Capacitor.Plugins?.InAppPurchase;
    
    if (!IAP) {
      console.log("ℹ️ Simulando compra (Google Play Billing no disponible)");
      this.simulatePremiumPurchase();
      return;
    }

    try {
      console.log(`💳 Solicitando producto: ${this.productId}`);

      // Obtener detalles del producto desde Google Play
      const result = await IAP.getProducts({
        ios: [],
        android: [this.productId]
      });
      
      console.log("📦 Resultado de getProducts:", result);
      
      const products = result?.products || [];
      if (!products || products.length === 0) {
        console.error("❌ Producto no encontrado en Google Play Console");
        alert(
          "❌ Error en Compra\n\n" +
            "El producto Premium no está configurado en Google Play Console.\n\n" +
            "ID esperado: " + this.productId + "\n\n" +
            "Ve a: Google Play Console > Monetizar > Productos integrados"
        );
        return;
      }
      
      const product = products[0];
      console.log(`💰 Precio: ${product.localizedPrice}`);
      
      // Mostrar confirmación (precio fijo en USD)
      const confirmed = confirm(
        `💎 PREMIUM UNLOCK\n\n` +
          `Precio: ${this.price}\n\n` +
          `Desbloquea:\n` +
          `• Escaneos ilimitados\n` +
          `• Todos los badges\n` +
          `• Modo Glow Up (Beauty Score)\n` +
          `• Historial completo\n\n` +
          `¿Proceder al pago?`
      );
      
      if (!confirmed) {
        console.log("❌ Usuario canceló compra");
        return;
      }
      
      // Procesar compra
      console.log("⏳ Procesando compra en Google Play...");
      const purchaseResult = await IAP.purchaseProduct({
        productId: this.productId
      });
      
      console.log("📋 Resultado de compra:", purchaseResult);
      
      if (purchaseResult?.success) {
        console.log("✅ Compra exitosa desde Google Play");
        await this.activatePremium();
      } else {
        console.log("⏳ Compra pendiente de confirmación de Google Play");
      }
      
    } catch (e) {
      console.error("❌ Error en proceso de compra:", e);
      alert(
        "❌ Error en la Compra\n\n" +
          (e.message || "Error desconocido") + "\n\n" +
          "Por favor, intenta de nuevo más tarde."
      );
    }
  }

  simulatePremiumPurchase() {
    const simulatePayment = confirm(
      "💎 PREMIUM - $9.99 USD\n\n" +
        "Desbloquea:\n" +
        "• Escaneos ilimitados\n" +
        "• Todos los badges\n" +
        "• Modo Glow Up (Beauty Score)\n" +
        "• Historial completo\n\n" +
        "¿Confirmar compra? (simulada en web)"
    );
    
    if (simulatePayment) {
      this.activatePremium();
    }
  }

  applyPremiumUI() {
    document.body.classList.add('is-premium');

    const premiumBtn = document.querySelector('button[onclick*="payment.html"]');
    if (premiumBtn) premiumBtn.style.display = 'none';

    const landingScreen = document.getElementById('landing-screen');
    if (!landingScreen) return;

    if (document.getElementById('premium-badge')) return;

    const premiumBadge = document.createElement('div');
    premiumBadge.id = 'premium-badge';
    premiumBadge.innerHTML = '⭐ PREMIUM UNLOCKED';
    premiumBadge.style.cssText = `
        color: #FFD700;
        font-weight: bold;
        padding: 10px 20px;
        margin: 20px auto;
        text-shadow: 0 0 10px #FFD700;
        font-size: 1.1rem;
        border: 2px solid #FFD700;
        border-radius: 8px;
        text-align: center;
      `;

    const startBtn = document.getElementById('start-btn');
    if (startBtn) landingScreen.insertBefore(premiumBadge, startBtn);
    else landingScreen.appendChild(premiumBadge);
  }

  async activatePremium({ showAlert } = { showAlert: true }) {
    console.log("\n═══════════════════════════════════════════════════════");
    console.log("✅ ACTIVANDO PREMIUM");
    console.log("═══════════════════════════════════════════════════════");

    try {
      this.isPremium = true;
      localStorage.setItem('vibescan_premium', 'true');
      localStorage.setItem('vibescan_premium_date', new Date().toISOString());

      this.applyPremiumUI();

      console.log("✅ Premium activado exitosamente");

      if (showAlert) {
        alert(
          "🎉 ¡Bienvenido a Premium!\n\nAhora disfrutas de:\n" +
            "• Escaneos ilimitados\n" +
            "• Todos los badges\n" +
            "• Modo Glow Up\n" +
            "• Historial completo"
        );
      }
    } catch (e) {
      console.error("❌ Error activando Premium:", e);
    }
  }

  isPremiumUser() {
    return this.isPremium;
  }
}

// Instancia global de Premium
const premiumManager = new PremiumManager();

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

// === DIAGNÓSTICO Y CARGA DE MODELOS (v5) ===
async function testModelAccess() {
  console.log("\n═══════════════════════════════════════════════════════");
  console.log("🔍 DIAGNÓSTICO DE MODELOS V5");
  console.log("═══════════════════════════════════════════════════════");
  
  console.log(`Protocol: ${window.location.protocol}`);
  console.log(`Origin: ${window.location.origin}`);
  console.log(`Capacitor: ${window.Capacitor !== undefined}`);
  
  return { success: true };
}

async function loadAIModels() {
  console.log("\n═══════════════════════════════════════════════════════");
  console.log("🤖 CARGANDO MODELOS DE IA (V5)");
  console.log("═══════════════════════════════════════════════════════");

  const isCapacitor = window.Capacitor !== undefined;
  const isAndroid = isCapacitor && (
    (typeof Capacitor?.getPlatform === 'function' && Capacitor.getPlatform() === 'android') ||
    window.Capacitor?.platform?.name === 'android'
  );
  
  console.log(`Capacitor: ${isCapacitor}`);
  console.log(`Android: ${isAndroid}`);

  // Rutas a intentar (orden de preferencia)
  const modelPaths = [
    // 1. Ruta absoluta con origin (web + Android)
    `${window.location.origin}/models/`,
    // 2. Ruta relativa (web dev)
    './models/',
    // 3. Android asset (último recurso)
    'file:///android_asset/public/models/'
  ];

  for (const modelPath of modelPaths) {
    try {
      console.log(`\n📂 Intentando: ${modelPath}`);
      
      const startTime = performance.now();
      
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(modelPath),
        faceapi.nets.faceExpressionNet.loadFromUri(modelPath),
        faceapi.nets.faceLandmark68TinyNet.loadFromUri(modelPath)
      ]);
      
      const endTime = performance.now();
      state.modelsLoaded = true;
      
      console.log(`✅ MODELOS CARGADOS EN ${(endTime - startTime).toFixed(2)}ms`);
      console.log(`   Ruta exitosa: ${modelPath}`);
      console.log("   - TinyFaceDetector ✓");
      console.log("   - FaceExpressionNet ✓");
      console.log("   - FaceLandmark68TinyNet ✓");
      
      return { success: true, path: modelPath };
      
    } catch (e) {
      console.warn(`⚠️ Falló: ${modelPath}`);
      console.warn(`   Error: ${e.message}`);
      continue;
    }
  }
  
  console.error("\n❌ FALLO CRÍTICO: No se cargaron los modelos");
  console.error("Rutas intentadas:");
  modelPaths.forEach((p, i) => console.error(`  ${i + 1}. ${p}`));
  
  alert(
    "❌ FALLO DE MODELOS\n\n" +
    "No se pudieron cargar los modelos de IA.\n\n" +
    "Soluciones:\n" +
    "1. Verifica que public/models/ contiene archivos .bin y .json\n" +
    "2. Ejecuta: npm run build\n" +
    "3. Ejecuta: npx cap sync android"
  );
  
  return { success: false, path: null };
}

// --- Initialization ---
async function init() {
  console.log("Initializing VibeScan AI...");

  // 1. EJECUTAR DIAGNÓSTICO DE MODELOS
  const diagnostico = await testModelAccess();
  console.log("📋 Resultado diagnóstico:", diagnostico);

  // 2. INICIALIZAR SISTEMA PREMIUM
  await premiumManager.init();

  // 3. SOLICITAR PERMISO DE CÁMARA (NO ABRIR CÁMARA AÚN)
  console.log("\n═══════════════════════════════════════════════════════");
  console.log("🔐 PREPARANDO PERMISOS");
  console.log("═══════════════════════════════════════════════════════");
  const hasCameraPermission = await requestCameraPermission();

  if (!hasCameraPermission) {
    console.warn("⚠️ Usuario debe autorizar cámara antes de escanear");
    // No bloquear la app, solo mostrar advertencia cuando intente escanear
  }

  // 4. CARGAR MODELOS DE IA
  const modelResult = await loadAIModels();

  if (!modelResult.success) {
    console.error("❌ Modelos no disponibles, app puede fallar");
    // Continuar de todas formas (algunos tests pueden no usar modelos)
  }

  // 5. SETUP PREMIUM - Verificar estado al iniciar
  if (premiumManager.isPremiumUser()) {
    console.log("⭐ Usuario Premium detectado");
    premiumManager.applyPremiumUI();
  }

  // 6. FORZAR ORIENTACIÓN VERTICAL (Capacitor)
  if (window.Capacitor !== undefined) {
    try {
      const { ScreenOrientation } = await import('@capacitor/screen-orientation');
      await ScreenOrientation.lock({ orientation: 'portrait' });
      console.log("📱 Orientación forzada a portrait");
    } catch (e) {
      console.log("ℹ️ ScreenOrientation no disponible");
    }
  }

  // 7. EVENT LISTENERS
  document.getElementById('start-btn').addEventListener('click', async () => {
    // Verificar permiso de cámara antes de usar
    const hasPermission = await requestCameraPermission();
    if (hasPermission) {
      await handleStartClick();
    } else {
      console.error("❌ Permiso de cámara denegado, no se puede escanear");
      alert("Se requiere permiso de cámara para escanear.");
    }
  });

  document.getElementById('retry-btn').addEventListener('click', resetApp);

  const premiumBtn = document.querySelector('button[onclick*="payment.html"]');
  if (premiumBtn) {
    premiumBtn.onclick = null;
    premiumBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      await premiumManager.requestPremium();
    });
  }

  const downloadBtn = document.getElementById('download-btn') || document.getElementById('share-btn');
  if (downloadBtn) downloadBtn.addEventListener('click', downloadResult);

  modeBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      const newMode = e.target.dataset.mode;
      const isPremium = premiumManager.isPremiumUser();

      if (newMode === 'glowup' && !isPremium) {
        if (confirm("💎 Modo Glow Up - Premium\n\nUnlock para ver tu Beauty Score y consejos de Looksmaxxing?\n\n$9.99 USD")) {
          premiumManager.requestPremium();
        }
        return;
      }

      modeBtns.forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      state.mode = newMode;
    });
  });

  console.log("\n✅ INICIALIZACIÓN COMPLETADA");
  console.log("═══════════════════════════════════════════════════════\n");
}

// --- Daily Limit Logic ---
function canScanToday() {
  const isPremium = premiumManager.isPremiumUser();
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

async function handleStartClick() {
  if (!canScanToday()) {
    const shouldUpgrade = confirm(
      "🚨 Daily Limit Reached!\n\n" +
        "You've used your 3 free scans today.\n\n" +
        "Upgrade to Premium for unlimited scans and exclusive features?"
    );

    if (shouldUpgrade) {
      await premiumManager.requestPremium();
    }
    return;
  }

  await startScanner();
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

  const hasPermission = await requestCameraPermission();
  if (!hasPermission) {
    console.error("❌ Permiso de cámara denegado, no se puede iniciar el scanner");
    alert("Se requiere permiso de cámara para escanear.");
    showScreen('landing');
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
  const isPremium = premiumManager.isPremiumUser();
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
