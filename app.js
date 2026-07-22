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
  command: { id: 'node-command', px: 0.45, py: 0.22, label: 'COMMAND CENTER' },
  operations: { id: 'node-operations', px: 0.2, py: 0.34, label: 'OPERATIONS' },
  intelligence: { id: 'node-intelligence', px: 0.75, py: 0.26, label: 'INTELLIGENCE' },
  agents: { id: 'node-agents', px: 0.16, py: 0.74, label: 'AGENTS' },
  'cyber-lab': { id: 'node-cyber-lab', px: 0.38, py: 0.76, label: 'CYBER LAB' },
  forensics: { id: 'node-forensics', px: 0.62, py: 0.72, label: 'FORENSICS' },
  vault: { id: 'node-vault', px: 0.84, py: 0.78, label: 'VAULT' },
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
  
  const osc = audioCtx.createOscillator();
  const gainNode = audioCtx.createGain();
  
  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
  
  gainNode.gain.setValueAtTime(gainVal, audioCtx.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + decay);
  
  osc.connect(gainNode);
  gainNode.connect(masterGain);
  
  osc.start();
  osc.stop(audioCtx.currentTime + decay + 0.05);
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
  node.addEventListener('click', function(e) {
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
  node.addEventListener('mouseenter', function() {
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

// Phase 1 -> Phase 2 (User clicks anywhere on dormant screen)
window.addEventListener('click', (e) => {
  if (state.phase !== 1) return;
  
  state.phase = 2;
  initAudio();
  
  // Hide prompt text in loader
  document.getElementById('dormant-prompt').style.opacity = 0;
  
  // Trigger system sound
  playClickSound(200, 0.2, 0.2);
  playSweepSound();
  
  // Setup ignition line coordinates from click to closest node
  const clickX = e.clientX;
  const clickY = e.clientY;
  
  // Add a ripple at click coordinate
  ripples.push({
    x: clickX,
    y: clickY,
    radius: 0,
    maxRadius: Math.max(width, height) * 0.9,
    speed: 6.5,
    alpha: 0.8,
  });
  
  // Identify the entry node (closest node to click)
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
  document.getElementById('dormant-screen').classList.add('fade-out');
  
  // Reveal main nav
  document.getElementById('main-nav').classList.remove('hidden');
});

// Sound Toggle control
const audioToggleBtn = document.getElementById('audio-toggle');
audioToggleBtn.addEventListener('click', (e) => {
  e.stopPropagation(); // Avoid triggering screen clicks
  state.soundEnabled = !state.soundEnabled;
  
  if (state.soundEnabled) {
    document.getElementById('audio-label').textContent = 'SOUND: ON';
    audioToggleBtn.classList.add('audio-active');
  } else {
    document.getElementById('audio-label').textContent = 'SOUND: OFF';
    audioToggleBtn.classList.remove('audio-active');
  }
  playClickSound(700, 0.05, 0.08);
});
// Activate visualizer animation by default since sound is on initially
audioToggleBtn.classList.add('audio-active');

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
  ctx.strokeStyle = 'rgba(59, 130, 246, 0.02)';
  ctx.lineWidth = 1;
  
  const gridSize = 80;
  
  // Apply camera translation/zoom factors
  ctx.translate(state.zoom.x, state.zoom.y);
  ctx.scale(state.zoom.scale, state.zoom.scale);
  
  // Add subtle parallax offset based on cursor movement
  const pxOffsetX = state.cursor.x * 0.03;
  const pxOffsetY = state.cursor.y * 0.03;
  
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

// -------------------------------------------------------------
// CORE GAMING / ANIMATION FRAME LOOP
// -------------------------------------------------------------
function tick() {
  ctx.fillStyle = colors.bgPrimary;
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
