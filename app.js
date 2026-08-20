/**
 * RAJAGEETHAN A // APPLE ULTRA-MINIMALIST F1 PORTFOLIO ENGINE
 * Trajectory-aware forward magnetic snapping, 60fps/120fps frame easing,
 * and edge-to-edge 360° F1 canvas renderer.
 *
 * PERFORMANCE: WebP frames + 3-wave progressive loading for instant first paint.
 */

(function () {
  'use strict';

  // --- Configuration ---
  const TOTAL_FRAMES = 161; // 0000.webp to 0160.webp
  const FOLDER_PATH = 'Blender/';
  const FRAME_EXT = '.webp';
  const KEYFRAMES = [0, 30, 60, 90, 120, 150];

  // Physics Parameters
  const FRICTION = 0.88;               // Inertia velocity decay rate
  const VELOCITY_SENSITIVITY = 0.0028; // Wheel input multiplier
  const LERP_SPEED = 12.0;             // Time-based frame easing factor
  const SNAP_SPRING_SPEED = 6.0;       // Magnetic spring pull speed

  // --- DOM Elements ---
  const canvas = document.getElementById('f1-canvas');
  const ctx = canvas.getContext('2d', { alpha: false });

  const navItems = document.querySelectorAll('.nav-item');
  const sections = document.querySelectorAll('.keyframe-section');

  // --- State Variables ---
  const images = new Array(TOTAL_FRAMES).fill(null);
  let loadedCount = 0;
  let wave2Ready = false;

  let currentFrame = 0;
  let targetFrame = 0;
  let velocity = 0;

  let touchStartY = 0;
  let bgGradient = null;

  // --- Loading Overlay ---
  const overlay = document.getElementById('loading-overlay');
  const progressBar = document.getElementById('loading-progress-bar');
  const progressLabel = document.getElementById('loading-label');

  function updateLoadingUI(loaded, total) {
    const pct = Math.round((loaded / total) * 100);
    if (progressBar) progressBar.style.width = pct + '%';
    if (progressLabel) progressLabel.textContent = pct + '%';
  }

  function hideOverlay() {
    if (overlay) {
      overlay.classList.add('hidden');
      // Remove from DOM after transition ends
      overlay.addEventListener('transitionend', () => overlay.remove(), { once: true });
    }
  }

  // --- Frame Src Helper ---
  function frameSrc(index) {
    return `${FOLDER_PATH}${String(index).padStart(4, '0')}${FRAME_EXT}`;
  }

  // --- Load a Single Frame Promise ---
  function loadFrame(index) {
    return new Promise((resolve) => {
      if (images[index] && images[index].complete && images[index].naturalWidth > 0) {
        resolve(index);
        return;
      }
      const img = new Image();
      img.src = frameSrc(index);

      const done = () => {
        images[index] = img;
        loadedCount++;
        updateLoadingUI(loadedCount, TOTAL_FRAMES);
        resolve(index);
      };

      img.onload = () => {
        if ('decode' in img) {
          img.decode().then(done).catch(done);
        } else {
          done();
        }
      };
      img.onerror = () => {
        console.error(`Failed to load frame ${index}`);
        images[index] = null;
        loadedCount++;
        updateLoadingUI(loadedCount, TOTAL_FRAMES);
        resolve(index);
      };
    });
  }

  // --- 1. Three-Wave Progressive Preload ---
  async function preloadFrames() {
    // WAVE 1: Frame 0 only — instant first paint
    await loadFrame(0);
    renderCurrentFrame();

    // WAVE 2: All keyframes — enables navigation immediately
    const keyframeLoads = KEYFRAMES.map((kf) => loadFrame(kf));
    await Promise.all(keyframeLoads);
    wave2Ready = true;
    hideOverlay(); // Hide loading screen — site is interactive

    // WAVE 3: All remaining frames in background (batched to avoid network saturation)
    const remaining = [];
    for (let i = 0; i < TOTAL_FRAMES; i++) {
      if (!KEYFRAMES.includes(i)) remaining.push(i);
    }

    // Load in batches of 10 to avoid hammering the network
    const BATCH_SIZE = 10;
    for (let b = 0; b < remaining.length; b += BATCH_SIZE) {
      const batch = remaining.slice(b, b + BATCH_SIZE).map((i) => loadFrame(i));
      await Promise.all(batch);
    }
  }

  // --- 2. Fullscreen Canvas Rendering ---
  function resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const vWidth = window.innerWidth;
    const vHeight = window.innerHeight;

    canvas.width = vWidth * dpr;
    canvas.height = vHeight * dpr;
    ctx.scale(dpr, dpr);

    bgGradient = ctx.createRadialGradient(
      vWidth / 2, vHeight / 2, vHeight * 0.1,
      vWidth / 2, vHeight / 2, vWidth * 0.75
    );
    bgGradient.addColorStop(0, '#141414');
    bgGradient.addColorStop(1, '#080808');

    renderCurrentFrame();
  }

  function renderCurrentFrame() {
    // Clamp current frame strictly within [0, 160]
    const index = Math.max(0, Math.min(160, Math.round(currentFrame)));
    const img = images[index];

    if (!img || !img.complete || img.naturalWidth === 0) return;

    const vWidth = window.innerWidth;
    const vHeight = window.innerHeight;

    const imgAspect = img.naturalWidth / img.naturalHeight;
    const vAspect = vWidth / vHeight;

    let drawW, drawH;
    const margin = 1.0;

    if (vAspect > imgAspect) {
      drawW = vWidth * margin;
      drawH = drawW / imgAspect;
    } else {
      drawH = vHeight * margin;
      drawW = drawH * imgAspect;
    }

    const drawX = (vWidth - drawW) / 2;
    const drawY = (vHeight - drawH) / 2;

    ctx.fillStyle = bgGradient || '#080808';
    ctx.fillRect(0, 0, vWidth, vHeight);
    ctx.drawImage(img, drawX, drawY, drawW, drawH);

    updateSectionVisibility(index);
  }

  // --- 3. Keyframe Section Visibility & Trajectory Magnetic Snap ---
  function updateSectionVisibility(frameIndex) {
    let closestKeyframe = KEYFRAMES[0];
    let minDistance = 999;

    KEYFRAMES.forEach((kf) => {
      const dist = Math.abs(kf - frameIndex);
      if (dist < minDistance) {
        minDistance = dist;
        closestKeyframe = kf;
      }
    });

    sections.forEach((sec) => {
      const kf = parseInt(sec.getAttribute('data-frame'), 10);
      const linearDist = Math.abs(kf - frameIndex);

      if (linearDist <= 10) {
        sec.classList.add('active');
      } else {
        sec.classList.remove('active');
      }
    });

    navItems.forEach((btn) => {
      const kf = parseInt(btn.getAttribute('data-keyframe'), 10);
      if (kf === closestKeyframe && minDistance < 14) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }

  function applyTrajectoryMagneticSnap(deltaSec) {
    // Only engage magnetic snap when scrolling momentum has slowed down
    if (Math.abs(velocity) < 0.15) {
      // Calculate projected rest frame incorporating current momentum trajectory
      const projectedRest = targetFrame + (velocity * (1 / (1 - FRICTION)));

      let nearestKf = KEYFRAMES[0];
      let minDiff = 999;

      KEYFRAMES.forEach((kf) => {
        const diff = kf - projectedRest;
        if (Math.abs(diff) < Math.abs(minDiff)) {
          minDiff = diff;
          nearestKf = kf;
        }
      });

      // Smoothly spring pull targetFrame towards the trajectory-projected keyframe
      const pullDiff = nearestKf - targetFrame;
      if (Math.abs(pullDiff) <= 22) {
        const snapEase = 1 - Math.exp(-SNAP_SPRING_SPEED * deltaSec);
        targetFrame += pullDiff * snapEase;
      }
    }
  }

  // --- 4. Time-Based Physics & Animation Loop ---
  function startRenderLoop() {
    let lastTime = performance.now();

    function animate(currentTime) {
      const deltaSec = Math.min(0.033, (currentTime - lastTime) / 1000);
      lastTime = currentTime;

      // Time-compensated friction decay
      velocity *= Math.pow(FRICTION, deltaSec * 60);
      if (Math.abs(velocity) < 0.0001) velocity = 0;

      targetFrame += velocity;
      targetFrame = Math.max(0, Math.min(150, targetFrame));

      // Trajectory-aware forward magnetic snap
      applyTrajectoryMagneticSnap(deltaSec);

      // Time-based smooth exponential frame easing
      const frameDiff = targetFrame - currentFrame;
      const lerpEase = 1 - Math.exp(-LERP_SPEED * deltaSec);
      currentFrame += frameDiff * lerpEase;
      currentFrame = Math.max(0, Math.min(150, currentFrame));

      renderCurrentFrame();
      requestAnimationFrame(animate);
    }
    requestAnimationFrame(animate);
  }

  // --- 5. Jump Navigation API ---
  window.appJumpTo = function (targetKf) {
    velocity = 0;
    targetFrame = Math.max(0, Math.min(150, targetKf));
  };

  // --- 6. Inputs & Event Listeners ---
  function setupEventListeners() {
    window.addEventListener('resize', resizeCanvas);

    window.addEventListener('wheel', (e) => {
      e.preventDefault();

      let rawDelta = e.deltaY;
      if (e.deltaMode === 1) rawDelta *= 16;
      if (e.deltaMode === 2) rawDelta *= 400;

      // Clamp max input spike per wheel event for smooth easing
      const clampedDelta = Math.max(-80, Math.min(80, rawDelta));
      velocity += clampedDelta * VELOCITY_SENSITIVITY;
    }, { passive: false });

    window.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        touchStartY = e.touches[0].clientY;
      }
    }, { passive: true });

    window.addEventListener('touchmove', (e) => {
      if (e.touches.length === 1) {
        e.preventDefault();
        const currentY = e.touches[0].clientY;
        const deltaY = touchStartY - currentY;
        touchStartY = currentY;

        velocity += deltaY * 0.012;
      }
    }, { passive: false });

    window.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
        velocity += 1.0;
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        e.preventDefault();
        velocity -= 1.0;
      }
    });

    navItems.forEach((btn) => {
      btn.addEventListener('click', () => {
        const kf = parseInt(btn.getAttribute('data-keyframe'), 10);
        window.appJumpTo(kf);
      });
    });
  }

  // --- Initialize ---
  setupEventListeners();
  resizeCanvas();
  preloadFrames();
  startRenderLoop();

})();
