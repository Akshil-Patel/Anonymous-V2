/* -------------------------------------------------------------
   ANONYMOUS HQ — ENGINE & LOGIC (VANILLA JS)
   ------------------------------------------------------------- */

// State tracking
const state = {
  phase: 1, // 1: Dormant, 2: Ignition, 3: Booting, 4: Reveal, 5: Interactive
  initialized: false,
  soundEnabled: true,
  cursor: { x: 0, y: 0, targetX: 0, targetY: 0, isMoving: false },
  zoom: { scale: 1, targetScale: 1, x: 0, targetX: 0, y: 0, targetY: 0 },
  activeRoom: null,
};

// Canvas Setup
const canvas = document.getElementById('ambient-canvas');
const ctx = canvas.getContext('2d');
let width = (canvas.width = window.innerWidth);
let height = (canvas.height = window.innerHeight);

// Navigation Nodes Coordinates (percentages relative to viewport)
const nodeDefs = {
  command: { id: 'node-command', px: 0.50, py: 0.24, label: 'COMMAND CENTER' },
  operations: { id: 'node-operations', px: 0.15, py: 0.34, label: 'OPERATIONS' },
  intelligence: { id: 'node-intelligence', px: 0.85, py: 0.34, label: 'INTELLIGENCE' },
  agents: { id: 'node-agents', px: 0.12, py: 0.76, label: 'AGENTS' },
  'cyber-lab': { id: 'node-cyber-lab', px: 0.32, py: 0.84, label: 'CYBER LAB' },
  forensics: { id: 'node-forensics', px: 0.68, py: 0.84, label: 'FORENSICS' },
  vault: { id: 'node-vault', px: 0.88, py: 0.76, label: 'VAULT' },
};

// Map nodes with screen pixels
let nodes = {};
const colors = {
  bgPrimary: '#050507',
  accentColor: '#3b82f6',
};

function updateCachedColors() {
  colors.bgPrimary = getComputedStyle(document.documentElement).getPropertyValue('--bg-primary').trim() || '#050507';
  colors.accentColor = getComputedStyle(document.documentElement).getPropertyValue('--accent-color').trim() || '#3b82f6';
}

function calculateNodePositions() {
  const isFirstTime = Object.keys(nodes).length === 0;
  for (const [key, def] of Object.entries(nodeDefs)) {
    const x = def.px * width;
    const y = def.py * height;

    if (isFirstTime) {
      nodes[key] = {
        id: def.id,
        label: def.label,
        x: x,
        y: y,
        px: def.px,
        py: def.py,
        state: 'dormant', // dormant, booting, active
        glow: 0,
        radius: 4,
        el: document.getElementById(def.id)
      };
    } else {
      nodes[key].x = x;
      nodes[key].y = y;
      nodes[key].el = document.getElementById(def.id);
    }
  }
}
updateCachedColors();
calculateNodePositions();

// Connection network tree definition (source -> target) - Spiderweb pattern
const connectionDefs = [
  { from: 'command', to: 'operations' },
  { from: 'command', to: 'intelligence' },
  { from: 'command', to: 'cyber-lab' },
  { from: 'command', to: 'forensics' },

  { from: 'operations', to: 'agents' },
  { from: 'operations', to: 'cyber-lab' },
  { from: 'operations', to: 'intelligence' }, // horizontal cross link

  { from: 'intelligence', to: 'forensics' },
  { from: 'intelligence', to: 'vault' },

  { from: 'agents', to: 'cyber-lab' },
  { from: 'cyber-lab', to: 'forensics' },
  { from: 'forensics', to: 'vault' },

  // Outer support spiderweb links
  { from: 'agents', to: 'command' },
  { from: 'vault', to: 'command' }
];

let activeConnections = [];
let ignitionLines = []; // Click coordinate -> closest node

// Particle simulation data
const particles = [];
const particleCount = 70;
for (let i = 0; i < particleCount; i++) {
  particles.push({
    x: Math.random() * width,
    y: Math.random() * height,
    vx: (Math.random() - 0.5) * 0.15,
    vy: (Math.random() - 0.5) * 0.15,
    size: Math.random() * 2 + 0.5,
    alpha: Math.random() * 0.3 + 0.1,
    depth: Math.random() * 2 + 0.5, // Parallax depth factor
  });
}

// Cyber Data Streams
const dataStreams = [];

// Interactive Signal Waves (cursor click ripples)
const ripples = [];

// Audio Synthesizer Context
let audioCtx = null;
let masterGain = null;
let humGainNode = null;
let lastHoverSoundTime = 0;

function initAudio() {
  if (audioCtx) return;
  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    masterGain = audioCtx.createGain();
    masterGain.gain.setValueAtTime(0.08, audioCtx.currentTime); // keep it extremely clean & soft
    masterGain.connect(audioCtx.destination);
  } catch (err) {
    console.warn("Web Audio API failed to load: ", err);
  }
}

function playClickSound(freq = 600, decay = 0.05, gainVal = 0.12) {
  if (!audioCtx || !state.soundEnabled) return;
  const now = audioCtx.currentTime;
  const osc1 = audioCtx.createOscillator();
  const osc2 = audioCtx.createOscillator();
  const clickGain = audioCtx.createGain();

  osc1.type = 'sine';
  osc1.frequency.setValueAtTime(freq, now);

  osc2.type = 'sine';
  osc2.frequency.setValueAtTime(freq * 1.5, now); // Harmonious fifth chime

  clickGain.gain.setValueAtTime(gainVal, now);
  clickGain.gain.exponentialRampToValueAtTime(0.0001, now + decay);

  osc1.connect(clickGain);
  osc2.connect(clickGain);
  clickGain.connect(masterGain);

  osc1.start(now);
  osc2.start(now);
  osc1.stop(now + decay + 0.05);
  osc2.stop(now + decay + 0.05);
}

function playSweepSound() {
  if (!audioCtx || !state.soundEnabled) return;

  const osc = audioCtx.createOscillator();
  const gainNode = audioCtx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(80, audioCtx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(520, audioCtx.currentTime + 2.2);

  gainNode.gain.setValueAtTime(0.01, audioCtx.currentTime);
  gainNode.gain.linearRampToValueAtTime(0.35, audioCtx.currentTime + 0.3);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 2.4);

  osc.connect(gainNode);
  gainNode.connect(masterGain);

  osc.start();
  osc.stop(audioCtx.currentTime + 2.5);
}

function playAccessGrantedChime() {
  if (!audioCtx || !state.soundEnabled) return;

  // Warm electronic major/minor chord sequence (Vercel-like sleek reveal chime)
  const now = audioCtx.currentTime;
  const chord = [220.00, 277.18, 329.63, 440.00, 554.37]; // A major 9 triad (A3, C#4, E4, A4, C#5)

  chord.forEach((freq, i) => {
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    osc.type = 'sine';
    // Arpeggiated entry
    osc.frequency.setValueAtTime(freq, now + i * 0.07);

    gainNode.gain.setValueAtTime(0, now + i * 0.07);
    gainNode.gain.linearRampToValueAtTime(0.18, now + i * 0.07 + 0.04);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.07 + 2.2);

    osc.connect(gainNode);
    gainNode.connect(masterGain);

    osc.start(now + i * 0.07);
    osc.stop(now + i * 0.07 + 2.4);
  });
}

function playNodeHoverSound() {
  if (!audioCtx || !state.soundEnabled) return;

  const now = audioCtx.currentTime;
  const osc1 = audioCtx.createOscillator();
  const osc2 = audioCtx.createOscillator();
  const gainNode = audioCtx.createGain();
  const filter = audioCtx.createBiquadFilter();

  osc1.type = 'sine';
  osc2.type = 'triangle';

  // Harmonious cyber beep interval
  osc1.frequency.setValueAtTime(880, now);
  osc1.frequency.exponentialRampToValueAtTime(1200, now + 0.08);

  osc2.frequency.setValueAtTime(1320, now);
  osc2.frequency.exponentialRampToValueAtTime(1800, now + 0.08);

  filter.type = 'highpass';
  filter.frequency.setValueAtTime(800, now);

  gainNode.gain.setValueAtTime(0.03, now);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);

  osc1.connect(filter);
  osc2.connect(filter);
  filter.connect(gainNode);
  gainNode.connect(masterGain);

  osc1.start(now);
  osc2.start(now);
  osc1.stop(now + 0.1);
  osc2.stop(now + 0.1);
}

// -------------------------------------------------------------
// SECTOR / ROOM EXPLORATION OVERLAYS (Phase 5 Zoom)
// -------------------------------------------------------------
const roomInfo = {
  command: {
    title: 'COMMAND DECK',
    subtitle: 'Central Directory & Operations control',
    details: 'The intelligence cell is coordinates actions. Operational readiness: nominal. Active nodes: 12. Security level: Tier-0.'
  },
  operations: {
    title: 'TACTICAL OPERATIONS',
    subtitle: 'Live system metrics & threat intelligence',
    details: 'System monitoring active. Network bandwidth: 4.8Gbps. Core telemetry is nominal. Scanning anomalies: zero active alerts.'
  },
  intelligence: {
    title: 'CYBER INTELLIGENCE',
    subtitle: 'Threat intelligence, signatures, and recon database',
    details: 'Accessing global threat feed... Scanning signatures... 1,024 vulnerabilities indexed. Zero active critical exploits detected.'
  },
  agents: {
    title: 'AGENT INDEX',
    subtitle: 'Personnel database & communications keys',
    details: 'Registry: SDMCET Cyber Club active roster. Verified members: 42. Active keys: AES-256. Command hierarchy initialized.'
  },
  'cyber-lab': {
    title: 'CYBERNETIC LABS',
    subtitle: 'Virtual testbed and exploit sandboxing',
    details: 'Environments loaded: 4. Active CTF challenges: 8. Kernel version: Linux 6.1-kali-amd64. Target servers initialized.'
  },
  forensics: {
    title: 'FORENSICS CELL',
    subtitle: 'Log inspection and forensic payloads',
    details: 'Telemetry data integrity check: OK. System audit log connected. Capture the Flag writeups decrypted and archived.'
  },
  vault: {
    title: 'THE CORE VAULT',
    subtitle: 'Archived tools, payloads, and certification logs',
    details: 'RESTRICTED SECTOR. Access tokens required for binary extraction. Verification keys matched. Cryptographic assets locked.'
  }
};

// Create the dynamic room details overlay structure in HTML
const detailOverlay = document.createElement('div');
detailOverlay.id = 'room-overlay';
detailOverlay.innerHTML = `
  <div class="overlay-frame">
    <div class="overlay-header">
      <span class="overlay-tag" id="over-tag">HQ_ROOM // SECURE</span>
      <button class="overlay-close" aria-label="Close sector">
        <span class="close-label">EXIT DECK [ESC]</span>
        <span class="close-cross"></span>
      </button>
    </div>
    <div class="overlay-body">
      <h2 id="over-title" class="overlay-title">SECTOR</h2>
      <p id="over-sub" class="overlay-subtitle">Sector subtitle</p>
      <div class="overlay-divider"></div>
      <div id="over-details" class="overlay-details">Detailed operational data and system logs.</div>
      <div class="mock-terminal">
        <div class="mock-line"><span class="mock-p">[system@anon-hq]:~$</span> cat status_log.txt</div>
        <div class="mock-line text-muted">Initialize decryption sequence... [OK]</div>
        <div class="mock-line text-muted">Verifying integrity signature... [OK]</div>
        <div class="mock-line text-active">Target connection secure. Session active.</div>
      </div>
    </div>
  </div>
`;
document.body.appendChild(detailOverlay);

// Close sector
function closeActiveRoom() {
  if (!state.activeRoom) return;

  playClickSound(300, 0.08, 0.08);
  state.activeRoom = null;
  state.zoom.targetScale = 1;
  state.zoom.targetX = 0;
  state.zoom.targetY = 0;

  detailOverlay.classList.remove('active');
  document.getElementById('hud-container').classList.remove('nav-clicked-transition');

  // Re-enable elements
  document.querySelectorAll('.nav-node').forEach(node => {
    node.style.pointerEvents = 'auto';
  });
}

document.querySelector('.overlay-close').addEventListener('click', closeActiveRoom);
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeActiveRoom();
});

// Setup room navigation clicks
document.querySelectorAll('.nav-node').forEach(node => {
  // Setup click handler
  node.addEventListener('click', function (e) {
    e.preventDefault();
    const roomKey = this.getAttribute('data-room');
    const info = roomInfo[roomKey];
    if (!info || state.phase < 5) return;

    playClickSound(500, 0.12, 0.1);
    state.activeRoom = roomKey;

    // Zoom into node coordinate — camera flies TOWARD the node
    const targetNode = nodes[roomKey];
    const zoomScale = 1.8;
    state.zoom.targetScale = zoomScale;
    // Offset: push the canvas so the node's position stays roughly where it is on screen
    // Formula: translate = nodeScreenPos - (nodeWorldPos * scale)
    // This keeps the node at its screen position while zooming in around it
    state.zoom.targetX = targetNode.x - (targetNode.x * zoomScale);
    state.zoom.targetY = targetNode.y - (targetNode.y * zoomScale);

    // Animate DOM HUD out
    document.getElementById('hud-container').classList.add('nav-clicked-transition');

    // Populate details card
    document.getElementById('over-title').textContent = info.title;
    document.getElementById('over-sub').textContent = info.subtitle;
    document.getElementById('over-details').textContent = info.details;
    document.getElementById('over-tag').textContent = `HQ_ROOM // ${roomKey.toUpperCase()}`;

    // Disable node clicks during overlay
    document.querySelectorAll('.nav-node').forEach(n => {
      n.style.pointerEvents = 'none';
    });

    setTimeout(() => {
      detailOverlay.classList.add('active');
    }, 450);
  });

  // Setup subtle audio hover feedback
  node.addEventListener('mouseenter', function () {
    if (state.phase < 5) return;
    const now = Date.now();
    if (now - lastHoverSoundTime > 150) {
      playNodeHoverSound();
      lastHoverSoundTime = now;
    }
  });
});

// -------------------------------------------------------------
// PHASES & STATE MACHINE TRANSITIONS
// -------------------------------------------------------------

// Automatic boot sequence without requiring click-based login
let bootTimer = null;

function startHackerBootSequence(clickX, clickY) {
  if (state.phase !== 1) return;
  if (bootTimer) clearTimeout(bootTimer);

  state.phase = 2;
  
  // Try initializing audio (browser might block initially, handled by interaction listeners below)
  initAudio();

  // Trigger system sound if audio context is active
  playClickSound(200, 0.2, 0.2);
  playSweepSound();

  // Add a ripple at click/center coordinate
  ripples.push({
    x: clickX,
    y: clickY,
    radius: 0,
    maxRadius: Math.max(width, height) * 0.9,
    speed: 6.5,
    alpha: 0.8,
  });

  // Identify the entry node (closest node to center/click)
  let closestNodeKey = 'command';
  let minDist = Infinity;
  for (const [key, node] of Object.entries(nodes)) {
    const d = Math.hypot(node.x - clickX, node.y - clickY);
    if (d < minDist) {
      minDist = d;
      closestNodeKey = key;
    }
  }

  // Start line trace towards entry node
  ignitionLines.push({
    startX: clickX,
    startY: clickY,
    endX: nodes[closestNodeKey].x,
    endY: nodes[closestNodeKey].y,
    progress: 0,
    targetNode: closestNodeKey,
  });

  // Fade out loader UI
  const dormantScreen = document.getElementById('dormant-screen');
  if (dormantScreen) {
    dormantScreen.classList.add('fade-out');
  }
}

// User can click early to bypass wait, but it is not required
window.addEventListener('click', (e) => {
  if (state.phase === 1) {
    startHackerBootSequence(e.clientX, e.clientY);
  }
});

// Auto-boot system after 2.8 seconds of quantum orbit loader animation
bootTimer = setTimeout(() => {
  if (state.phase === 1) {
    startHackerBootSequence(window.innerWidth / 2, window.innerHeight / 2);
  }
}, 2800);

// Global AudioContext Resumer for first user interaction (bypasses browser autoplay policy)
const resumeAudioOnInteraction = () => {
  initAudio();
  initArchiveAudio();
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  if (archiveAudioCtx && archiveAudioCtx.state === 'suspended') {
    archiveAudioCtx.resume();
  }
  
  // Restart drone if in the hallway
  const badge = document.getElementById('archive-year-badge');
  if (badge && badge.classList.contains('is-visible') && !isMusicSequencerActive) {
    startArchiveAmbientDrone();
  }
  
  // Remove self
  const events = ['click', 'mousedown', 'keydown', 'touchstart', 'wheel', 'mousemove'];
  events.forEach(evt => window.removeEventListener(evt, resumeAudioOnInteraction));
};

const events = ['click', 'mousedown', 'keydown', 'touchstart', 'wheel', 'mousemove'];
events.forEach(evt => window.addEventListener(evt, resumeAudioOnInteraction));

// Sound Toggle control
const audioToggleBtn = document.getElementById('audio-toggle');
audioToggleBtn.addEventListener('click', (e) => {
  e.stopPropagation(); // Avoid triggering screen clicks
  state.soundEnabled = !state.soundEnabled;

  if (state.soundEnabled) {
    document.getElementById('audio-label').textContent = 'SOUND: ON';
    audioToggleBtn.classList.add('audio-active');

    // Resume audio contexts if suspended
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
    if (archiveAudioCtx && archiveAudioCtx.state === 'suspended') archiveAudioCtx.resume();

    // Restart background sequencer if hallway is active
    const badge = document.getElementById('archive-year-badge');
    if (badge && badge.classList.contains('is-visible')) {
      startArchiveAmbientDrone();
    }
    playClickSound(700, 0.05, 0.08);
  } else {
    document.getElementById('audio-label').textContent = 'SOUND: OFF';
    audioToggleBtn.classList.remove('audio-active');

    // Immediately shut down all sound engines
    stopArchiveAmbientDrone();
    stopLoopingBuzzerAndAmbientFX();

    if (audioCtx) audioCtx.suspend();
    if (archiveAudioCtx) archiveAudioCtx.suspend();
  }
});
// Activate visualizer animation by default since sound is on initially
audioToggleBtn.classList.add('audio-active');

// Nav Pill Buttons Sound & Active state interaction
document.querySelectorAll('.nav-pill-btn').forEach(btn => {
  btn.addEventListener('mouseenter', () => {
    playClickSound(800, 0.03, 0.05);
  });
  btn.addEventListener('click', () => {
    if (btn.id === 'audio-toggle') return;
    playClickSound(1100, 0.06, 0.12);
    document.querySelectorAll('.nav-pill-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  });
});

// -------------------------------------------------------------
// SYSTEM NETWORK PATH GROWTH (Phase 3 Boot Sequence)
// -------------------------------------------------------------
function triggerNetworkBoot(startNodeKey) {
  state.phase = 3;
  nodes[startNodeKey].state = 'active';

  // Scan connections definition, launch those linked to startNodeKey in either direction
  connectionDefs.forEach(conn => {
    if (conn.from === startNodeKey && nodes[conn.to].state === 'dormant') {
      activeConnections.push({
        from: conn.from,
        to: conn.to,
        progress: 0,
        speed: 0.025 + Math.random() * 0.015,
      });
      nodes[conn.to].state = 'booting';
    } else if (conn.to === startNodeKey && nodes[conn.from].state === 'dormant') {
      activeConnections.push({
        from: conn.to,
        to: conn.from,
        progress: 0,
        speed: 0.025 + Math.random() * 0.015,
      });
      nodes[conn.from].state = 'booting';
    }
  });
}

function updateNetworkBoot() {
  if (state.phase !== 3) return;

  // Update normal connections
  activeConnections.forEach(conn => {
    if (conn.progress < 1) {
      conn.progress += conn.speed;

      // Add minor signals travelling on this active line
      if (Math.random() < 0.02) {
        addSignalParticle(conn.from, conn.to, conn.progress * 0.9);
      }

      if (conn.progress >= 1) {
        conn.progress = 1;
        const targetNodeKey = conn.to;
        const targetNode = nodes[targetNodeKey];
        targetNode.state = 'active';
        playClickSound(300 + Math.random() * 400, 0.04, 0.06);

        // Launch nested sub-connections from the newly awakened node
        connectionDefs.forEach(nextConn => {
          if (nextConn.from === targetNodeKey && nodes[nextConn.to].state === 'dormant') {
            activeConnections.push({
              from: nextConn.from,
              to: nextConn.to,
              progress: 0,
              speed: 0.025 + Math.random() * 0.015,
            });
            nodes[nextConn.to].state = 'booting';
          } else if (nextConn.to === targetNodeKey && nodes[nextConn.from].state === 'dormant') {
            activeConnections.push({
              from: nextConn.to,
              to: nextConn.from,
              progress: 0,
              speed: 0.025 + Math.random() * 0.015,
            });
            nodes[nextConn.from].state = 'booting';
          }
        });
      }
    }
  });

  // Check if all nodes are active
  const totalNodes = Object.keys(nodes).length;
  const activeNodes = Object.values(nodes).filter(n => n.state === 'active').length;

  if (activeNodes === totalNodes && activeConnections.every(c => c.progress >= 1)) {
    triggerRevealSequence();
  }
}


// -------------------------------------------------------------
// REVEAL ACCESS GRANTED SEQUENCE (Phase 4)
// -------------------------------------------------------------
function triggerRevealSequence() {
  state.phase = 4;

  // Brief pause and silent stillness before reveal
  setTimeout(() => {
    // Play warm chord sequence & fade in HUD
    playAccessGrantedChime();

    const hud = document.getElementById('hud-container');
    hud.classList.add('revealed');

    // Reveal navbar smoothly when main title is displayed
    const mainNav = document.getElementById('main-nav');
    if (mainNav) mainNav.classList.remove('hidden');

    // Switch state to fully Interactive exploration
    state.phase = 5;

    // Spawn secondary network pulse from Command Center
    ripples.push({
      x: nodes.command.x,
      y: nodes.command.y,
      radius: 0,
      maxRadius: width * 0.45,
      speed: 3.5,
      alpha: 0.5,
    });
  }, 700);
}

// -------------------------------------------------------------
// SIGNAL PARTICLES TRAVELLING PATHS
// -------------------------------------------------------------
const signalParticles = [];
function addSignalParticle(fromKey, toKey, startProgress = 0) {
  signalParticles.push({
    from: fromKey,
    to: toKey,
    progress: startProgress,
    speed: 0.006 + Math.random() * 0.005,
    size: 2,
  });
}

function updateSignalParticles() {
  for (let i = signalParticles.length - 1; i >= 0; i--) {
    const p = signalParticles[i];
    p.progress += p.speed;
    if (p.progress >= 1) {
      signalParticles.splice(i, 1);
    }
  }
}

// -------------------------------------------------------------
// CANVAS RENDER & DRAWING LOOP
// -------------------------------------------------------------
function drawGrid() {
  ctx.save();
  ctx.strokeStyle = 'rgba(59, 130, 246, 0.025)';
  ctx.lineWidth = 1;

  const gridSize = 80;

  // Apply camera translation/zoom factors
  ctx.translate(state.zoom.x, state.zoom.y);
  ctx.scale(state.zoom.scale, state.zoom.scale);

  // Add subtle parallax offset based on cursor movement + autonomous drift
  const timeDriftX = (Date.now() * 0.005) % gridSize;
  const timeDriftY = (Date.now() * 0.005) % gridSize;

  const pxOffsetX = state.cursor.x * 0.03 + timeDriftX;
  const pxOffsetY = state.cursor.y * 0.03 + timeDriftY;

  // Horizontal grid lines
  for (let y = 0; y < height * 2; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(-width, y + pxOffsetY - height * 0.5);
    ctx.lineTo(width * 2, y + pxOffsetY - height * 0.5);
    ctx.stroke();
  }

  // Vertical grid lines
  for (let x = 0; x < width * 2; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x + pxOffsetX - width * 0.5, -height);
    ctx.lineTo(x + pxOffsetX - width * 0.5, height * 2);
    ctx.stroke();
  }

  ctx.restore();
}

function drawNetworkLines() {
  ctx.save();
  ctx.translate(state.zoom.x, state.zoom.y);
  ctx.scale(state.zoom.scale, state.zoom.scale);

  // 1. Draw Ignition path (Phase 2)
  ignitionLines.forEach(line => {
    if (line.progress < 1) {
      line.progress += 0.045; // grows line faster (was 0.015)

      const currentX = line.startX + (line.endX - line.startX) * line.progress;
      const currentY = line.startY + (line.endY - line.startY) * line.progress;

      ctx.strokeStyle = 'rgba(59, 130, 246, 0.35)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(line.startX, line.startY);
      ctx.lineTo(currentX, currentY);
      ctx.stroke();

      // Node wakes up when line arrives
      if (line.progress >= 1) {
        line.progress = 1;
        triggerNetworkBoot(line.targetNode);
      }
    } else {
      // Line is fully drawn
      ctx.strokeStyle = 'rgba(59, 130, 246, 0.2)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(line.startX, line.startY);
      ctx.lineTo(line.endX, line.endY);
      ctx.stroke();
    }
  });

  // 2. Draw normal connection growth (Phase 3 & 5)
  activeConnections.forEach(conn => {
    const nodeFrom = nodes[conn.from];
    const nodeTo = nodes[conn.to];

    const currX = nodeFrom.x + (nodeTo.x - nodeFrom.x) * conn.progress;
    const currY = nodeFrom.y + (nodeTo.y - nodeFrom.y) * conn.progress;

    // Set drawing styles depending on phase status
    if (state.phase >= 5) {
      // fully static background connections
      ctx.strokeStyle = 'rgba(59, 130, 246, 0.08)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(nodeFrom.x, nodeFrom.y);
      ctx.lineTo(nodeTo.x, nodeTo.y);
      ctx.stroke();
    } else {
      ctx.strokeStyle = 'rgba(59, 130, 246, 0.25)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(nodeFrom.x, nodeFrom.y);
      ctx.lineTo(currX, currY);
      ctx.stroke();
    }
  });

  // 3. Draw active signals sliding on connections
  signalParticles.forEach(p => {
    const nodeFrom = nodes[p.from];
    const nodeTo = nodes[p.to];

    const sx = nodeFrom.x + (nodeTo.x - nodeFrom.x) * p.progress;
    const sy = nodeFrom.y + (nodeTo.y - nodeFrom.y) * p.progress;

    ctx.fillStyle = 'rgba(59, 130, 246, 0.65)';
    ctx.shadowColor = 'rgba(59, 130, 246, 0.8)';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(sx, sy, p.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0; // reset
  });

  ctx.restore();
}

function drawNodes() {
  if (state.phase < 2) return; // invisible in dormant state

  ctx.save();
  ctx.translate(state.zoom.x, state.zoom.y);
  ctx.scale(state.zoom.scale, state.zoom.scale);

  for (const [key, node] of Object.entries(nodes)) {
    if (node.state === 'dormant') continue;

    // Draw connections pulses on active nodes
    if (node.state === 'active') {
      node.glow += 0.012;
      const progress = node.glow % 1;
      const pulseSize = node.radius + progress * 15;
      const pulseAlpha = 0.22 * (1 - progress);

      ctx.strokeStyle = `rgba(59, 130, 246, ${pulseAlpha})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(node.x, node.y, pulseSize, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Inner node body
    ctx.fillStyle = node.state === 'active' ? 'rgba(59, 130, 246, 0.7)' : 'rgba(100, 116, 139, 0.4)';
    ctx.beginPath();
    ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
    ctx.fill();

    // Reposition matching HTML absolute element overlay
    if (node.el) {
      // Target position under zoom & translation camera matrices
      const targetScreenX = node.x * state.zoom.scale + state.zoom.x;
      const targetScreenY = node.y * state.zoom.scale + state.zoom.y;
      node.el.style.left = `${targetScreenX}px`;
      node.el.style.top = `${targetScreenY}px`;

      // Node visibility transition
      if (node.state === 'active' && state.phase >= 4) {
        node.el.style.opacity = 1;
        node.el.style.pointerEvents = 'auto';
      } else {
        node.el.style.opacity = 0;
        node.el.style.pointerEvents = 'none';
      }
    }
  }

  ctx.restore();
}

function drawParticles() {
  ctx.save();
  // Apply camera factors for parallax
  ctx.translate(state.zoom.x, state.zoom.y);
  ctx.scale(state.zoom.scale, state.zoom.scale);

  particles.forEach(p => {
    // Parallax motion: shift positions based on cursor velocities
    const parallaxX = state.cursor.x * 0.05 * p.depth;
    const parallaxY = state.cursor.y * 0.05 * p.depth;

    // Slow drift velocity updates
    p.x += p.vx;
    p.y += p.vy;

    // Boundaries loop
    if (p.x < 0) p.x = width;
    if (p.x > width) p.x = 0;
    if (p.y < 0) p.y = height;
    if (p.y > height) p.y = 0;

    ctx.fillStyle = `rgba(255, 255, 255, ${p.alpha})`;
    ctx.beginPath();
    ctx.arc(p.x + parallaxX, p.y + parallaxY, p.size, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.restore();
}

function drawRipples() {
  ctx.save();
  ctx.translate(state.zoom.x, state.zoom.y);
  ctx.scale(state.zoom.scale, state.zoom.scale);

  for (let i = ripples.length - 1; i >= 0; i--) {
    const r = ripples[i];
    r.radius += r.speed;
    r.alpha -= 0.01;

    if (r.alpha <= 0) {
      ripples.splice(i, 1);
      continue;
    }

    ctx.strokeStyle = `rgba(59, 130, 246, ${r.alpha})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();
}

function drawDataStreams() {
  ctx.save();
  ctx.translate(state.zoom.x, state.zoom.y);
  ctx.scale(state.zoom.scale, state.zoom.scale);

  for (let i = dataStreams.length - 1; i >= 0; i--) {
    const stream = dataStreams[i];

    // Move stream
    stream.x += stream.vx;
    stream.y += stream.vy;
    stream.progress += stream.speed;

    // Fade in and out based on progress
    let alpha = stream.alpha;
    if (stream.progress < 0.2) alpha = stream.alpha * (stream.progress / 0.2);
    if (stream.progress > 0.8) alpha = stream.alpha * ((1 - stream.progress) / 0.2);

    // Draw stream streak
    const grad = ctx.createLinearGradient(stream.x, stream.y, stream.x - stream.vx * stream.length, stream.y - stream.vy * stream.length);
    grad.addColorStop(0, `rgba(59, 130, 246, ${alpha})`);
    grad.addColorStop(1, `rgba(59, 130, 246, 0)`);

    ctx.strokeStyle = grad;
    ctx.lineWidth = stream.width;
    ctx.beginPath();
    ctx.moveTo(stream.x, stream.y);
    ctx.lineTo(stream.x - stream.vx * stream.length, stream.y - stream.vy * stream.length);
    ctx.stroke();

    if (stream.progress >= 1) {
      dataStreams.splice(i, 1);
    }
  }

  ctx.restore();
}

// -------------------------------------------------------------
// INTERACTIVE RIPPLES & VECTOR INTERACTION ON HOVER
// -------------------------------------------------------------
window.addEventListener('mousemove', (e) => {
  state.cursor.targetX = e.clientX;
  state.cursor.targetY = e.clientY;

  // Calculate relative delta for cursor movement state
  const d = Math.hypot(state.cursor.targetX - state.cursor.x, state.cursor.targetY - state.cursor.y);
  state.cursor.isMoving = d > 2;

  if (state.phase >= 5 && state.cursor.isMoving && Math.random() < 0.06) {
    // Generate weak trail particles
    ripples.push({
      x: e.clientX,
      y: e.clientY,
      radius: 2,
      maxRadius: 35,
      speed: 1,
      alpha: 0.15,
    });
  }
});

// Periodic signal triggers along connection lines in Interactive Phase
setInterval(() => {
  if (state.phase < 5 || state.activeRoom) return;
  // Select random connection and fire packet
  const randomConn = connectionDefs[Math.floor(Math.random() * connectionDefs.length)];
  addSignalParticle(randomConn.from, randomConn.to, 0);
}, 2200);

// Occasional Data Streams / Shooting Stars
setInterval(() => {
  if (state.phase < 4 || Math.random() > 0.4) return; // 40% chance every 3s

  const isHorizontal = Math.random() > 0.5;
  const speed = Math.random() * 15 + 10;

  dataStreams.push({
    x: isHorizontal ? (Math.random() > 0.5 ? 0 : width) : Math.random() * width,
    y: isHorizontal ? Math.random() * height : (Math.random() > 0.5 ? 0 : height),
    vx: isHorizontal ? (Math.random() > 0.5 ? speed : -speed) : 0,
    vy: isHorizontal ? 0 : (Math.random() > 0.5 ? speed : -speed),
    length: Math.random() * 20 + 10, // Trails based on velocity multiplier
    width: Math.random() * 1.5 + 0.5,
    alpha: Math.random() * 0.3 + 0.1,
    progress: 0,
    speed: Math.random() * 0.01 + 0.005 // Lifespan increment
  });
}, 3000);

// -------------------------------------------------------------
// CORE GAMING / ANIMATION FRAME LOOP
// -------------------------------------------------------------
function tick() {
  ctx.fillStyle = 'rgba(2, 3, 5, 0.96)';
  ctx.fillRect(0, 0, width, height);

  // Interpolate camera matrices (Zoom & translation)
  state.zoom.scale += (state.zoom.targetScale - state.zoom.scale) * 0.06;
  state.zoom.x += (state.zoom.targetX - state.zoom.x) * 0.06;
  state.zoom.y += (state.zoom.targetY - state.zoom.y) * 0.06;

  // Interpolate mouse coordinates (smooth lag damping)
  state.cursor.x += (state.cursor.targetX - state.cursor.x) * 0.08;
  state.cursor.y += (state.cursor.targetY - state.cursor.y) * 0.08;

  // Draw base structures
  drawGrid();
  drawDataStreams();
  drawParticles();
  drawNetworkLines();
  drawRipples();
  drawNodes();

  // Engine states
  updateNetworkBoot();
  updateSignalParticles();

  requestAnimationFrame(tick);
}

// Helpers
// (varColor removed for optimization)

// Resize event
window.addEventListener('resize', () => {
  width = canvas.width = window.innerWidth;
  height = canvas.height = window.innerHeight;
  updateCachedColors();
  calculateNodePositions();
});

// Start loop
requestAnimationFrame(tick);

// -------------------------------------------------------------
// MOBILE SWIPE GESTURES FOR NAVBAR
// -------------------------------------------------------------
let touchStartX = 0;
let touchEndX = 0;
let touchStartY = 0;
let touchEndY = 0;
let currentNavIndex = 0;
const navLinks = document.querySelectorAll('.nav-link');
const totalNavItems = navLinks.length;

function handleSwipe() {
  const diffX = touchStartX - touchEndX;
  const diffY = touchStartY - touchEndY;

  // Only trigger if horizontal swipe is larger than vertical swipe
  if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 50) {
    if (diffX > 0) {
      // Swiped left, go to next tab
      if (currentNavIndex < totalNavItems - 1) {
        changeNavTab(currentNavIndex + 1);
      }
    } else {
      // Swiped right, go to previous tab
      if (currentNavIndex > 0) {
        changeNavTab(currentNavIndex - 1);
      }
    }
  }
}

function changeNavTab(newIndex) {
  currentNavIndex = newIndex;

  // Update active state in UI
  navLinks.forEach((link, idx) => {
    if (idx === newIndex) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });

  // Mock transition effect
  const tabName = navLinks[newIndex].querySelector('.nav-text').textContent;
  triggerMockTransition(tabName);
}

function triggerMockTransition(tabName) {
  const hudContainer = document.getElementById('hud-container');
  hudContainer.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
  hudContainer.style.opacity = '0';
  hudContainer.style.transform = 'scale(1.05)';

  setTimeout(() => {
    // Optionally update the central title to reflect the mock page
    const titleEl = document.querySelector('.main-title');
    if (titleEl) {
      if (tabName === 'HOME') {
        titleEl.textContent = 'ANONYMOUS';
      } else {
        titleEl.textContent = tabName;
      }
    }

    // Fade back in
    hudContainer.style.opacity = '1';
    hudContainer.style.transform = 'scale(1)';
  }, 600);
}

// Support click navigation on desktop and mobile
navLinks.forEach((link, idx) => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    changeNavTab(idx);
  });
});

window.addEventListener('touchstart', e => {
  touchStartX = e.changedTouches[0].screenX;
  touchStartY = e.changedTouches[0].screenY;
});

window.addEventListener('touchend', e => {
  touchEndX = e.changedTouches[0].screenX;
  touchEndY = e.changedTouches[0].screenY;
  handleSwipe();
});

// -------------------------------------------------------------
// WEB AUDIO SYNTHESIZER — MUSICAL MUSEUM AMBIENT & VIRUS SOUNDS
// Zero external audio files needed, 100% web audio synthesis
// -------------------------------------------------------------
let archiveAudioCtx = null;
let epicMusicTimer = null;
let musicStep = 0;
let isMusicSequencerActive = false;
let isTensionHover = false;

function initArchiveAudio() {
  if (!archiveAudioCtx) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (AudioCtx) archiveAudioCtx = new AudioCtx();
  }
  if (archiveAudioCtx && archiveAudioCtx.state === 'suspended') {
    archiveAudioCtx.resume();
  }
}

// Epic dark chord progressions for House of the Dragon cello-style plucks
const arpeggioProgression = [
  // Am: A2, E3, A3, C4
  [110.00, 164.81, 220.00, 261.63],
  // F: F2, C3, F3, A3
  [87.31, 130.81, 174.61, 220.00],
  // Dm: D2, A2, D3, F3
  [73.42, 110.00, 146.83, 174.61],
  // Esus4 -> E: E2, B2, E3, G#3
  [82.41, 123.47, 164.81, 207.65]
];

function setTensionState(state) {
  isTensionHover = state;
}

function playEpicSequencerStep() {
  if (!archiveAudioCtx || !isMusicSequencerActive) return;
  try {
    const now = archiveAudioCtx.currentTime;

    // 1. Driving Arpeggiated Plucks (sawtooth cellos)
    const chordIndex = Math.floor(musicStep / 16) % arpeggioProgression.length;
    const notes = arpeggioProgression[chordIndex];
    const noteFreq = notes[musicStep % notes.length];

    const bassOsc = archiveAudioCtx.createOscillator();
    const bassGain = archiveAudioCtx.createGain();
    const bassFilter = archiveAudioCtx.createBiquadFilter();

    bassOsc.type = 'sawtooth';
    bassOsc.frequency.setValueAtTime(noteFreq, now);

    // Lowpass filter opens up dramatically under hover tension!
    bassFilter.type = 'lowpass';
    bassFilter.frequency.setValueAtTime(isTensionHover ? 1100 : 500, now);
    if (isTensionHover) {
      bassFilter.Q.setValueAtTime(4, now);
    }

    bassGain.gain.setValueAtTime(0, now);
    bassGain.gain.linearRampToValueAtTime(isTensionHover ? 0.05 : 0.025, now + 0.02);
    bassGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);

    bassOsc.connect(bassFilter);
    bassFilter.connect(bassGain);
    bassGain.connect(archiveAudioCtx.destination);

    bassOsc.start(now);
    bassOsc.stop(now + 0.28);

    // 2. Cinematic Taiko Drum Beats (quarter notes)
    if (musicStep % 2 === 0) {
      const drumOsc = archiveAudioCtx.createOscillator();
      const drumGain = archiveAudioCtx.createGain();

      drumOsc.type = 'sine';
      drumOsc.frequency.setValueAtTime(130, now);
      drumOsc.frequency.exponentialRampToValueAtTime(42, now + 0.12);

      drumGain.gain.setValueAtTime(isTensionHover ? 0.22 : 0.16, now);
      drumGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.55);

      drumOsc.connect(drumGain);
      drumGain.connect(archiveAudioCtx.destination);

      drumOsc.start(now);
      drumOsc.stop(now + 0.6);
    }

    // 3. Detuned Soaring Epic Chords (bar sweeps)
    if (musicStep % 16 === 0) {
      const chordNotes = arpeggioProgression[chordIndex];
      chordNotes.forEach((freq, idx) => {
        const strOsc1 = archiveAudioCtx.createOscillator();
        const strOsc2 = archiveAudioCtx.createOscillator();
        const strGain = archiveAudioCtx.createGain();

        strOsc1.type = 'triangle';
        strOsc2.type = 'sawtooth';

        // detuned strings soaring in higher register
        strOsc1.frequency.setValueAtTime(freq * 2 - 2, now);
        strOsc2.frequency.setValueAtTime(freq * 2 + 2, now);

        strGain.gain.setValueAtTime(0, now);
        strGain.gain.linearRampToValueAtTime(0.016, now + 1.2);
        strGain.gain.exponentialRampToValueAtTime(0.0001, now + 4.2);

        strOsc1.connect(strGain);
        strOsc2.connect(strGain);
        strGain.connect(archiveAudioCtx.destination);

        strOsc1.start(now);
        strOsc2.start(now);
        strOsc1.stop(now + 4.5);
        strOsc2.stop(now + 4.5);
      });
    }

    musicStep++;
  } catch (e) { }
}

function startArchiveAmbientDrone() {
  initArchiveAudio();
  if (!archiveAudioCtx) return;
  if (isMusicSequencerActive) return;

  isMusicSequencerActive = true;
  musicStep = 0;
  playEpicSequencerStep();
  epicMusicTimer = setInterval(playEpicSequencerStep, 272); // 110 BPM 8th notes
}

function stopArchiveAmbientDrone() {
  isMusicSequencerActive = false;
  isTensionHover = false;
  if (epicMusicTimer) {
    clearInterval(epicMusicTimer);
    epicMusicTimer = null;
  }
}

let activeBuzzerOsc = null;
let activeBuzzerLfo = null;
let activeBuzzerGateLfo = null;
let activeBuzzerGain = null;

let activeAmbientFxOscs = [];
let activeAmbientFxGains = [];
let activeAmbientIntervals = [];

function startLoopingBuzzerAndAmbientFX(type) {
  initArchiveAudio();
  if (!archiveAudioCtx || !state.soundEnabled) return;

  const now = archiveAudioCtx.currentTime;

  // 1. High-intensity Industrial Emergency Siren Buzzer (FM Tremolo + Square Gated Pulse)
  try {
    activeBuzzerOsc = archiveAudioCtx.createOscillator();
    activeBuzzerLfo = archiveAudioCtx.createOscillator();
    activeBuzzerGateLfo = archiveAudioCtx.createOscillator();
    const lfoGain = archiveAudioCtx.createGain();
    const gateLfoGain = archiveAudioCtx.createGain();
    const gateGain = archiveAudioCtx.createGain();
    activeBuzzerGain = archiveAudioCtx.createGain();
    const bandpass = archiveAudioCtx.createBiquadFilter();

    activeBuzzerOsc.type = 'sawtooth';
    activeBuzzerOsc.frequency.setValueAtTime(115, now);

    activeBuzzerLfo.type = 'square';
    activeBuzzerLfo.frequency.setValueAtTime(15, now); // 15Hz tremolo buzzer modulation
    lfoGain.gain.setValueAtTime(120, now);

    bandpass.type = 'bandpass';
    bandpass.frequency.setValueAtTime(880, now);
    bandpass.Q.setValueAtTime(4.5, now);

    // Gating pulse: 2.2 Hz (alarm rate)
    activeBuzzerGateLfo.type = 'square';
    activeBuzzerGateLfo.frequency.setValueAtTime(2.2, now);

    gateLfoGain.gain.setValueAtTime(0.5, now);
    gateGain.gain.setValueAtTime(0.5, now); // Offsets between [0, 1]

    activeBuzzerGain.gain.setValueAtTime(0, now);
    activeBuzzerGain.gain.linearRampToValueAtTime(0.26, now + 1); // Balanced buzzer volume

    // Connections
    activeBuzzerLfo.connect(lfoGain);
    lfoGain.connect(activeBuzzerOsc.frequency);
    activeBuzzerOsc.connect(bandpass);

    activeBuzzerGateLfo.connect(gateLfoGain);
    gateLfoGain.connect(gateGain.gain);

    bandpass.connect(gateGain);
    gateGain.connect(activeBuzzerGain);
    activeBuzzerGain.connect(archiveAudioCtx.destination);

    activeBuzzerOsc.start(now);
    activeBuzzerLfo.start(now);
    activeBuzzerGateLfo.start(now);
  } catch (e) { }

  // 2. Extra Unique Subtle Sound Effects for each Attack Animation
  try {
    if (type === 'morris') {
      // Morris Worm: scratchy slithering noise sweeps (random plucky rustles)
      const playSlither = () => {
        if (!isMusicSequencerActive || !state.soundEnabled) return;
        const slitherOsc = archiveAudioCtx.createOscillator();
        const slitherGain = archiveAudioCtx.createGain();
        const slitherFilter = archiveAudioCtx.createBiquadFilter();

        slitherOsc.type = 'triangle';
        slitherOsc.frequency.setValueAtTime(60 + Math.random() * 80, archiveAudioCtx.currentTime);
        slitherOsc.frequency.exponentialRampToValueAtTime(220 + Math.random() * 100, archiveAudioCtx.currentTime + 0.15);

        slitherFilter.type = 'bandpass';
        slitherFilter.frequency.setValueAtTime(400, archiveAudioCtx.currentTime);

        slitherGain.gain.setValueAtTime(0.024, archiveAudioCtx.currentTime);
        slitherGain.gain.exponentialRampToValueAtTime(0.0001, archiveAudioCtx.currentTime + 0.18);

        slitherOsc.connect(slitherFilter);
        slitherFilter.connect(slitherGain);
        slitherGain.connect(archiveAudioCtx.destination);

        slitherOsc.start();
        slitherOsc.stop(archiveAudioCtx.currentTime + 0.2);
      };

      playSlither();
      const interval = setInterval(playSlither, 140);
      activeAmbientIntervals.push(interval);

    } else if (type === 'iloveyou') {
      // ILOVEYOU: glitchy falling heart crystalline drop pings
      const playHeartDrop = () => {
        if (!isMusicSequencerActive || !state.soundEnabled) return;
        const dropOsc = archiveAudioCtx.createOscillator();
        const dropGain = archiveAudioCtx.createGain();

        dropOsc.type = 'sine';
        dropOsc.frequency.setValueAtTime(1600 + Math.random() * 1200, archiveAudioCtx.currentTime);

        dropGain.gain.setValueAtTime(0.018, archiveAudioCtx.currentTime);
        dropGain.gain.exponentialRampToValueAtTime(0.0001, archiveAudioCtx.currentTime + 0.45);

        dropOsc.connect(dropGain);
        dropGain.connect(archiveAudioCtx.destination);

        dropOsc.start();
        dropOsc.stop(archiveAudioCtx.currentTime + 0.5);
      };

      playHeartDrop();
      const interval = setInterval(playHeartDrop, 280);
      activeAmbientIntervals.push(interval);

    } else if (type === 'stuxnet') {
      // Stuxnet: heavy resonant rotating motor centrifuge vibration
      const motorOsc1 = archiveAudioCtx.createOscillator();
      const motorOsc2 = archiveAudioCtx.createOscillator();
      const motorGain = archiveAudioCtx.createGain();
      const motorLfo = archiveAudioCtx.createOscillator();
      const motorLfoGain = archiveAudioCtx.createGain();

      motorOsc1.type = 'triangle';
      motorOsc1.frequency.setValueAtTime(52, now);

      motorOsc2.type = 'sine';
      motorOsc2.frequency.setValueAtTime(54, now);

      motorLfo.type = 'sine';
      motorLfo.frequency.setValueAtTime(4, now); // 4Hz rotating phase sweeps

      motorLfoGain.gain.setValueAtTime(0.012, now);

      motorGain.gain.setValueAtTime(0.034, now);

      motorLfo.connect(motorLfoGain);
      motorLfoGain.connect(motorGain.gain);

      motorOsc1.connect(motorGain);
      motorOsc2.connect(motorGain);
      motorGain.connect(archiveAudioCtx.destination);

      motorOsc1.start(now);
      motorOsc2.start(now);
      motorLfo.start(now);

      activeAmbientFxOscs.push(motorOsc1, motorOsc2, motorLfo);
      activeAmbientFxGains.push(motorGain);

    } else if (type === 'mirai') {
      // Mirai: rapid scanning DDoS network ping laser sweeps
      const playMiraiPing = () => {
        if (!isMusicSequencerActive || !state.soundEnabled) return;
        const pingOsc = archiveAudioCtx.createOscillator();
        const pingGain = archiveAudioCtx.createGain();

        pingOsc.type = 'sine';
        pingOsc.frequency.setValueAtTime(1400, archiveAudioCtx.currentTime);
        pingOsc.frequency.exponentialRampToValueAtTime(500, archiveAudioCtx.currentTime + 0.08);

        pingGain.gain.setValueAtTime(0.02, archiveAudioCtx.currentTime);
        pingGain.gain.exponentialRampToValueAtTime(0.0001, archiveAudioCtx.currentTime + 0.08);

        pingOsc.connect(pingGain);
        pingGain.connect(archiveAudioCtx.destination);

        pingOsc.start();
        pingOsc.stop(archiveAudioCtx.currentTime + 0.1);
      };

      playMiraiPing();
      const interval = setInterval(playMiraiPing, 220);
      activeAmbientIntervals.push(interval);

    } else if (type === 'wannacry') {
      // WannaCry: low heavy EternalBlue alarm drone
      const droneOsc1 = archiveAudioCtx.createOscillator();
      const droneOsc2 = archiveAudioCtx.createOscillator();
      const droneGain = archiveAudioCtx.createGain();
      const filter = archiveAudioCtx.createBiquadFilter();

      droneOsc1.type = 'sawtooth';
      droneOsc1.frequency.setValueAtTime(51.91, now); // G#1

      droneOsc2.type = 'sawtooth';
      droneOsc2.frequency.setValueAtTime(77.78, now); // D#2

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(180, now);

      droneGain.gain.setValueAtTime(0, now);
      droneGain.gain.linearRampToValueAtTime(0.048, now + 0.2);

      droneOsc1.connect(filter);
      droneOsc2.connect(filter);
      filter.connect(droneGain);
      droneGain.connect(archiveAudioCtx.destination);

      droneOsc1.start(now);
      droneOsc2.start(now);

      activeAmbientFxOscs.push(droneOsc1, droneOsc2);
      activeAmbientFxGains.push(droneGain);

    } else if (type === 'solarwinds') {
      // SolarWinds: satellite uplink telemetry data sweeps
      const playSolarSweep = () => {
        if (!isMusicSequencerActive || !state.soundEnabled) return;
        const sweepOsc = archiveAudioCtx.createOscillator();
        const sweepGain = archiveAudioCtx.createGain();

        sweepOsc.type = 'square';
        sweepOsc.frequency.setValueAtTime(2800, archiveAudioCtx.currentTime);
        sweepOsc.frequency.exponentialRampToValueAtTime(3600, archiveAudioCtx.currentTime + 0.05);

        sweepGain.gain.setValueAtTime(0.009, archiveAudioCtx.currentTime);
        sweepGain.gain.exponentialRampToValueAtTime(0.0001, archiveAudioCtx.currentTime + 0.06);

        sweepOsc.connect(sweepGain);
        sweepGain.connect(archiveAudioCtx.destination);

        sweepOsc.start();
        sweepOsc.stop(archiveAudioCtx.currentTime + 0.08);
      };

      playSolarSweep();
      const interval = setInterval(playSolarSweep, 180);
      activeAmbientIntervals.push(interval);
    }
  } catch (e) { }
}

function stopLoopingBuzzerAndAmbientFX() {
  const now = archiveAudioCtx ? archiveAudioCtx.currentTime : 0;

  // Stop buzzer alarm loop smoothly
  try {
    if (activeBuzzerGain && archiveAudioCtx) {
      activeBuzzerGain.gain.cancelScheduledValues(now);
      activeBuzzerGain.gain.linearRampToValueAtTime(0, now + 0.12);
    }
    setTimeout(() => {
      if (activeBuzzerOsc) { activeBuzzerOsc.stop(); activeBuzzerOsc = null; }
      if (activeBuzzerLfo) { activeBuzzerLfo.stop(); activeBuzzerLfo = null; }
      if (activeBuzzerGateLfo) { activeBuzzerGateLfo.stop(); activeBuzzerGateLfo = null; }
    }, 150);
  } catch (e) { }

  // Clear any active interval loops
  activeAmbientIntervals.forEach(clearInterval);
  activeAmbientIntervals = [];

  // Stop ambient unique oscillators
  activeAmbientFxOscs.forEach(osc => {
    try { osc.stop(); } catch (e) { }
  });
  activeAmbientFxOscs = [];

  activeAmbientFxGains.forEach(gain => {
    try {
      gain.gain.cancelScheduledValues(now);
      gain.gain.linearRampToValueAtTime(0, now + 0.1);
    } catch (e) { }
  });
  activeAmbientFxGains = [];
}

// Emergency Buzzer Alarm & Glitch Riser Takeover Sound FX
function playDramaticAttackTakeoverSound(type) {
  initArchiveAudio();
  if (!archiveAudioCtx || !state.soundEnabled) return;
  try {
    const now = archiveAudioCtx.currentTime;

    // 1. Deep Sub-bass Drop Visual Boom
    const subOsc = archiveAudioCtx.createOscillator();
    const subGain = archiveAudioCtx.createGain();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(160, now);
    subOsc.frequency.exponentialRampToValueAtTime(32, now + 0.65);
    subGain.gain.setValueAtTime(0.24, now);
    subGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.7);
    subOsc.connect(subGain);
    subGain.connect(archiveAudioCtx.destination);
    subOsc.start(now); subOsc.stop(now + 0.75);

    // 2. High Frequency Cyber Riser
    const riseOsc = archiveAudioCtx.createOscillator();
    const riseGain = archiveAudioCtx.createGain();
    riseOsc.type = 'sawtooth';
    riseOsc.frequency.setValueAtTime(180, now);
    riseOsc.frequency.exponentialRampToValueAtTime(2600, now + 0.45);
    riseGain.gain.setValueAtTime(0.06, now);
    riseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);
    riseOsc.connect(riseGain);
    riseGain.connect(archiveAudioCtx.destination);
    riseOsc.start(now); riseOsc.stop(now + 0.5);
  } catch (e) { }
}

// Unique Sound FX for each Exhibit Micro-Interaction
function playExhibitSound(type) {
  initArchiveAudio();
  if (!archiveAudioCtx) return;
  try {
    const now = archiveAudioCtx.currentTime;
    const osc = archiveAudioCtx.createOscillator();
    const gain = archiveAudioCtx.createGain();

    if (type === 'morris') {
      osc.type = 'square';
      osc.frequency.setValueAtTime(800, now);
      osc.frequency.exponentialRampToValueAtTime(150, now + 0.08);
      gain.gain.setValueAtTime(0.04, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      osc.connect(gain);
      osc.start(now); osc.stop(now + 0.08);
    } else if (type === 'iloveyou') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(659.25, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.2);
      gain.gain.setValueAtTime(0.03, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc.connect(gain);
      osc.start(now); osc.stop(now + 0.25);
    } else if (type === 'stuxnet') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(300, now);
      osc.frequency.linearRampToValueAtTime(120, now + 0.15);
      gain.gain.setValueAtTime(0.05, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      osc.connect(gain);
      osc.start(now); osc.stop(now + 0.15);
    } else if (type === 'mirai') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1200, now);
      osc.frequency.exponentialRampToValueAtTime(400, now + 0.1);
      gain.gain.setValueAtTime(0.03, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
      osc.connect(gain);
      osc.start(now); osc.stop(now + 0.1);
    } else if (type === 'wannacry') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.linearRampToValueAtTime(110, now + 0.3);
      gain.gain.setValueAtTime(0.03, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      osc.connect(gain);
      osc.start(now); osc.stop(now + 0.3);
    } else if (type === 'solarwinds') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(1760, now + 0.18);
      gain.gain.setValueAtTime(0.03, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
      osc.connect(gain);
      osc.start(now); osc.stop(now + 0.18);
    } else {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, now);
      osc.frequency.exponentialRampToValueAtTime(1046.50, now + 0.3);
      gain.gain.setValueAtTime(0.04, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      osc.connect(gain);
      osc.start(now); osc.stop(now + 0.3);
    }
  } catch (e) { }
}

// -------------------------------------------------------------
// THE ARCHIVE — Spatial Cyber Museum Engine
// -------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;

  // Navbar remains securely pinned at top without translating off-screen
  const mainNavEl = document.getElementById('main-nav');

  const hallway = document.getElementById('archive-hallway');
  const yearBadge = document.getElementById('archive-year-badge');
  const yearVal = document.getElementById('archive-year-val');
  const exhibits = document.querySelectorAll('.spatial-exhibit');

  if (!hallway || exhibits.length === 0) return;

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  ScrollTrigger.create({
    trigger: hallway,
    start: 'top 60%',
    end: 'bottom 20%',
    onEnter: () => {
      if (yearBadge) yearBadge.classList.add('is-visible');
      startArchiveAmbientDrone();
    },
    onLeave: () => {
      if (yearBadge) yearBadge.classList.remove('is-visible');
      stopArchiveAmbientDrone();
    },
    onEnterBack: () => {
      if (yearBadge) yearBadge.classList.add('is-visible');
      startArchiveAmbientDrone();
    },
    onLeaveBack: () => {
      if (yearBadge) yearBadge.classList.remove('is-visible');
      stopArchiveAmbientDrone();
    }
  });

  exhibits.forEach((exhibitEl) => {
    const year = exhibitEl.getAttribute('data-year');
    const exhibitType = exhibitEl.getAttribute('data-exhibit');

    ScrollTrigger.create({
      trigger: exhibitEl,
      start: 'top 70%',
      end: 'bottom 30%',
      onToggle: (self) => {
        if (self.isActive) {
          exhibits.forEach(e => e.classList.remove('is-active'));
          exhibitEl.classList.add('is-active');

          if (yearVal && year) {
            yearVal.textContent = year;
          }
          playExhibitSound(exhibitType);
        }
      }
    });

    if (!prefersReducedMotion) {
      const visualArea = exhibitEl.querySelector('.exhibit-spatial-visual');
      if (visualArea) {
        let hoverTimer = null;

        const triggerInfection = () => {
          document.body.className = document.body.className.replace(/\binfect-\S+/g, '').trim();
          document.body.classList.add(`infect-${exhibitType}`);
          document.body.classList.remove('cursor-tension');
          document.body.classList.add('cursor-freakout');
          playDramaticAttackTakeoverSound(exhibitType);
          startLoopingBuzzerAndAmbientFX(exhibitType);
          startExhibitEffect(exhibitType);
        };

        const clearInfection = () => {
          if (hoverTimer) clearTimeout(hoverTimer);
          setTensionState(false);
          document.body.classList.remove('cursor-tension', 'cursor-freakout');
          document.body.className = document.body.className.replace(/\binfect-\S+/g, '').trim();
          stopLoopingBuzzerAndAmbientFX();
          stopExhibitEffect();
        };

        visualArea.addEventListener('mouseenter', () => {
          setTensionState(true);
          document.body.classList.add('cursor-tension');
          playExhibitSound(exhibitType);
          hoverTimer = setTimeout(triggerInfection, 700);
        });

        visualArea.addEventListener('mousemove', (e) => {
          effectMouseX = e.clientX;
          effectMouseY = e.clientY;
          const rect = visualArea.getBoundingClientRect();
          const x = (e.clientX - rect.left - rect.width / 2) * 0.08;
          const y = (e.clientY - rect.top - rect.height / 2) * 0.08;
          visualArea.style.transform = `translate3d(${x}px, ${y}px, 0)`;
        });

        visualArea.addEventListener('mouseleave', () => {
          visualArea.style.transform = 'translate3d(0, 0, 0)';
          clearInfection();
        });

        visualArea.addEventListener('touchstart', (e) => {
          if (e.touches && e.touches[0]) {
            effectMouseX = e.touches[0].clientX;
            effectMouseY = e.touches[0].clientY;
          }
          setTensionState(true);
          document.body.classList.add('cursor-tension');
          playExhibitSound(exhibitType);
          hoverTimer = setTimeout(triggerInfection, 500);
        }, { passive: true });

        visualArea.addEventListener('touchend', clearInfection);
        visualArea.addEventListener('touchcancel', clearInfection);
      }
    }
  });

  const handoffExhibit = document.getElementById('exhibit-handoff');
  if (handoffExhibit) {
    handoffExhibit.addEventListener('click', () => {
      playExhibitSound('handoff');
      window.scrollTo({
        top: handoffExhibit.offsetTop + handoffExhibit.offsetHeight + 50,
        behavior: 'smooth'
      });
    });
  }
});

// -------------------------------------------------------------
// REAL-TIME DRAMATIC CANVAS ANIMATION ENGINE FOR ARCHIVE EXHIBITS
// -------------------------------------------------------------
let archiveEffectCanvas = null;
let archiveEffectCtx = null;
let activeEffectType = null;
let effectParticles = [];
let effectAnimFrame = null;
let effectMouseX = 0;
let effectMouseY = 0;

function initArchiveEffectCanvas() {
  archiveEffectCanvas = document.getElementById('archive-effect-canvas');
  if (!archiveEffectCanvas) return;
  archiveEffectCtx = archiveEffectCanvas.getContext('2d');
  resizeEffectCanvas();
  window.addEventListener('resize', resizeEffectCanvas);
}

function resizeEffectCanvas() {
  if (!archiveEffectCanvas) return;
  archiveEffectCanvas.width = window.innerWidth;
  archiveEffectCanvas.height = window.innerHeight;
}

function startExhibitEffect(type) {
  activeEffectType = type;
  if (!archiveEffectCanvas) initArchiveEffectCanvas();
  if (!archiveEffectCanvas) return;

  archiveEffectCanvas.style.opacity = '1';
  effectParticles = [];

  if (type === 'morris') {
    // Spawn 14 slithering phosphor green worms
    for (let i = 0; i < 14; i++) {
      const headX = Math.random() * window.innerWidth;
      const headY = Math.random() * window.innerHeight;
      const length = 12 + Math.floor(Math.random() * 8);
      const points = [];
      for (let j = 0; j < length; j++) points.push({ x: headX - j * 8, y: headY });
      effectParticles.push({
        type: 'worm',
        points: points,
        angle: Math.random() * Math.PI * 2,
        speed: 2 + Math.random() * 2.5,
        wiggleFreq: 0.15 + Math.random() * 0.1,
        wiggleAmp: 0.8 + Math.random() * 0.5,
        time: Math.random() * 100,
        symbols: ['01', '0x7F', '/sh', 'fingerd', 'fork()', '128.32', 'PID:3891', 'WORM']
      });
    }
  } else if (type === 'iloveyou') {
    // Spawn falling VBScript heart rain
    for (let i = 0; i < 40; i++) {
      effectParticles.push({
        type: 'heart',
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        vy: 1.5 + Math.random() * 3,
        size: 10 + Math.random() * 18,
        text: Math.random() > 0.5 ? 'LOVE-LETTER-FOR-YOU.TXT.vbs' : '♥',
        opacity: 0.4 + Math.random() * 0.6
      });
    }
  } else if (type === 'stuxnet') {
    // SCADA centrifuge sparks & rotor rings
    for (let i = 0; i < 35; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 30 + Math.random() * 120;
      effectParticles.push({
        type: 'spark',
        x: (effectMouseX || window.innerWidth / 2) + Math.cos(angle) * dist,
        y: (effectMouseY || window.innerHeight / 2) + Math.sin(angle) * dist,
        vx: (Math.random() - 0.5) * 6,
        vy: (Math.random() - 0.5) * 6,
        life: 1,
        color: Math.random() > 0.4 ? '#f43f5e' : '#fbbf24'
      });
    }
  } else if (type === 'mirai') {
    // DDoS laser beams shooting from screen edges to cursor
    for (let i = 0; i < 16; i++) {
      const side = Math.floor(Math.random() * 4);
      let sx = 0, sy = 0;
      if (side === 0) { sx = Math.random() * window.innerWidth; sy = 0; }
      else if (side === 1) { sx = window.innerWidth; sy = Math.random() * window.innerHeight; }
      else if (side === 2) { sx = Math.random() * window.innerWidth; sy = window.innerHeight; }
      else { sx = 0; sy = Math.random() * window.innerHeight; }

      effectParticles.push({
        type: 'laser',
        sx: sx,
        sy: sy,
        pulse: Math.random() * Math.PI * 2,
        speed: 0.05 + Math.random() * 0.05
      });
    }
  } else if (type === 'wannacry') {
    // EternalBlue red shockwave rings
    for (let i = 0; i < 6; i++) {
      effectParticles.push({
        type: 'ring',
        r: i * 35,
        maxR: 280,
        opacity: 1 - i * 0.15
      });
    }
  } else if (type === 'solarwinds') {
    // SUNBURST backdoor data streams
    for (let i = 0; i < 20; i++) {
      effectParticles.push({
        type: 'stream',
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        vx: 3 + Math.random() * 5,
        text: 'SUNBURST_BACKDOOR_PAYLOAD_0x' + Math.floor(Math.random() * 9999)
      });
    }
  }

  if (!effectAnimFrame) renderEffectLoop();
}

function stopExhibitEffect() {
  activeEffectType = null;
  if (archiveEffectCanvas) archiveEffectCanvas.style.opacity = '0';
  if (effectAnimFrame) {
    cancelAnimationFrame(effectAnimFrame);
    effectAnimFrame = null;
  }
}

function renderEffectLoop() {
  if (!activeEffectType || !archiveEffectCtx) {
    effectAnimFrame = null;
    return;
  }

  const ctx = archiveEffectCtx;
  const w = archiveEffectCanvas.width;
  const h = archiveEffectCanvas.height;

  ctx.clearRect(0, 0, w, h);

  if (activeEffectType === 'morris') {
    // Render Slithering Code Worms
    effectParticles.forEach(p => {
      p.time += p.wiggleFreq;
      p.angle += Math.sin(p.time) * 0.1;
      const head = p.points[0];
      head.x += Math.cos(p.angle) * p.speed;
      head.y += Math.sin(p.angle) * p.speed;

      if (head.x < 0) head.x = w;
      if (head.x > w) head.x = 0;
      if (head.y < 0) head.y = h;
      if (head.y > h) head.y = 0;

      for (let j = p.points.length - 1; j > 0; j--) {
        const seg = p.points[j];
        const prev = p.points[j - 1];
        const dx = prev.x - seg.x;
        const dy = prev.y - seg.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 8) {
          seg.x = prev.x - (dx / dist) * 8;
          seg.y = prev.y - (dy / dist) * 8;
        }
      }

      ctx.beginPath();
      ctx.moveTo(p.points[0].x, p.points[0].y);
      for (let j = 1; j < p.points.length; j++) {
        ctx.lineTo(p.points[j].x, p.points[j].y);
      }
      ctx.strokeStyle = 'rgba(0, 255, 102, 0.7)';
      ctx.lineWidth = 4;
      ctx.shadowColor = '#00ff66';
      ctx.shadowBlur = 12;
      ctx.stroke();
      ctx.shadowBlur = 0;

      ctx.fillStyle = '#00ff66';
      ctx.font = '10px monospace';
      ctx.fillText(p.symbols[Math.floor(p.time) % p.symbols.length], head.x + 8, head.y + 4);
    });
  } else if (activeEffectType === 'iloveyou') {
    // Render Falling VBScript & Heart Matrix Rain
    effectParticles.forEach(p => {
      p.y += p.vy;
      if (p.y > h) p.y = -20;

      ctx.fillStyle = `rgba(244, 63, 94, ${p.opacity})`;
      ctx.font = `${p.size}px sans-serif`;
      ctx.shadowColor = '#f43f5e';
      ctx.shadowBlur = 10;
      ctx.fillText(p.text, p.x, p.y);
      ctx.shadowBlur = 0;
    });
  } else if (activeEffectType === 'stuxnet') {
    // Render Spinning Centrifuge Rotor & SCADA Electrical Sparks
    ctx.save();
    ctx.translate(effectMouseX || w / 2, effectMouseY || h / 2);
    ctx.strokeStyle = 'rgba(244, 63, 94, 0.6)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 80 + Math.sin(Date.now() * 0.01) * 15, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    effectParticles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.life -= 0.02;
      if (p.life <= 0) {
        p.x = effectMouseX || w / 2;
        p.y = effectMouseY || h / 2;
        p.life = 1;
      }
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2);
      ctx.fill();
    });
  } else if (activeEffectType === 'mirai') {
    // Render 1.2 Tbps DDoS Laser Beams
    effectParticles.forEach(p => {
      p.pulse += p.speed;
      ctx.strokeStyle = `rgba(96, 165, 250, ${0.4 + Math.sin(p.pulse) * 0.3})`;
      ctx.lineWidth = 2;
      ctx.shadowColor = '#60a5fa';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.moveTo(p.sx, p.sy);
      ctx.lineTo(effectMouseX || w / 2, effectMouseY || h / 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
    });
  } else if (activeEffectType === 'wannacry') {
    // Render EternalBlue Red Shockwave Rings centered to the screen
    effectParticles.forEach(p => {
      p.r += 2.5;
      if (p.r > p.maxR) p.r = 0;
      ctx.strokeStyle = `rgba(225, 29, 72, ${1 - p.r / p.maxR})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, p.r, 0, Math.PI * 2);
      ctx.stroke();
    });
  } else if (activeEffectType === 'solarwinds') {
    // Render SUNBURST Data Streams
    effectParticles.forEach(p => {
      p.x += p.vx;
      if (p.x > w) p.x = -200;
      ctx.fillStyle = '#06b6d4';
      ctx.font = '11px monospace';
      ctx.shadowColor = '#06b6d4';
      ctx.shadowBlur = 8;
      ctx.fillText(p.text, p.x, p.y);
      ctx.shadowBlur = 0;
    });
  }

  effectAnimFrame = requestAnimationFrame(renderEffectLoop);
}

// -------------------------------------------------------------
// TACTICAL CYBER CUSTOM CURSOR ENGINE
// -------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  const cursorDot = document.getElementById('cyber-cursor-dot');
  const cursorRing = document.getElementById('cyber-cursor-ring');
  if (!cursorDot || !cursorRing) return;

  let mouseX = 0, mouseY = 0;
  let ringX = 0, ringY = 0;
  let hideTimeout;

  // Track mouse coordinates
  window.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;

    // Show cursor on movement
    cursorDot.style.opacity = '1';
    cursorRing.style.opacity = '1';

    // Immediate update for precision dot
    cursorDot.style.transform = `translate3d(${mouseX}px, ${mouseY}px, 0)`;

    // Clear auto-hide timeout
    clearTimeout(hideTimeout);
    hideTimeout = setTimeout(() => {
      cursorDot.style.opacity = '0';
      cursorRing.style.opacity = '0';
    }, 3000);
  });

  // Smooth lerp update for tracking reticle ring
  function updateRingPosition() {
    ringX += (mouseX - ringX) * 0.15;
    ringY += (mouseY - ringY) * 0.15;

    cursorRing.style.transform = `translate3d(${ringX}px, ${ringY}px, 0)`;
    requestAnimationFrame(updateRingPosition);
  }
  updateRingPosition();

  // Track active click state
  window.addEventListener('mousedown', () => {
    document.body.classList.add('cursor-active');
  });

  window.addEventListener('mouseup', () => {
    document.body.classList.remove('cursor-active');
  });

  // Track hover status on interactive elements
  function addHoverListeners() {
    const interactiveSelectors = 'a, button, input, select, textarea, label, [role="button"], .nav-node, .spatial-exhibit, .nav-pill-btn';
    document.querySelectorAll(interactiveSelectors).forEach(el => {
      if (el.dataset.hasCursorListeners) return;
      el.dataset.hasCursorListeners = 'true';

      el.addEventListener('mouseenter', () => {
        document.body.classList.add('cursor-hover');
      });
      el.addEventListener('mouseleave', () => {
        document.body.classList.remove('cursor-hover');
      });
    });
  }

  // Dynamic initialization for static + async loaded elements
  addHoverListeners();

  // Re-observe periodically or on DOM changes
  const observer = new MutationObserver(() => {
    addHoverListeners();
  });
  observer.observe(document.body, { childList: true, subtree: true });

  // Hide cursor when leaving viewport
  document.addEventListener('mouseleave', () => {
    cursorDot.style.opacity = '0';
    cursorRing.style.opacity = '0';
  });
});





