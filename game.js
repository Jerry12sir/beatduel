const canvas = document.querySelector("#gameCanvas");
const ctx = canvas.getContext("2d");

const scoreEl = document.querySelector("#score");
const comboEl = document.querySelector("#combo");
const livesEl = document.querySelector("#lives");
const judgementEl = document.querySelector("#judgement");
const countdownEl = document.querySelector("#countdown");
const progressEl = document.querySelector("#progress");
const startButton = document.querySelector("#startButton");
const fireButton = document.querySelector("#fireButton");
const iceButton = document.querySelector("#iceButton");
const songSelect = document.querySelector("#songSelect");
const songDurationEl = document.querySelector("#songDuration");
const songLink = document.querySelector("#songLink");
const creditEl = document.querySelector("#credit");

const tracks = [
  {
    title: "FAVELA",
    artist: "MXZI, Deno",
    bpm: 140,
    lengthSec: 75,
    url: "https://ncsmusic.s3.eu-west-1.amazonaws.com/tracks/000/002/003/favela-1762477273-EdjAqE9a7B.mp3",
    page: "https://ncs.io/FAVELA",
  },
  {
    title: "harinezumi",
    artist: "waera",
    bpm: 148,
    lengthSec: 90,
    url: "https://ncsmusic.s3.eu-west-1.amazonaws.com/tracks/000/001/848/harinezumi-1739530854-Dz5HzYsUJ1.mp3",
    page: "https://ncs.io/harinezumi",
  },
  {
    title: "Superhero",
    artist: "Alex Hagen",
    bpm: 156,
    lengthSec: 105,
    url: "https://ncsmusic.s3.eu-west-1.amazonaws.com/tracks/000/002/020/alex-hagen-superhero-1765328465-LA31zAZNoU.mp3",
    page: "https://ncs.io/AH_Superhero",
  },
];

const hitWindows = [
  { name: "Perfect", ms: 55, points: 1000 },
  { name: "Great", ms: 105, points: 650 },
  { name: "Good", ms: 165, points: 300 },
];

let selectedTrack = tracks[0];
let audio = new Audio(selectedTrack.url);
let beatMs = 60000 / selectedTrack.bpm;
let approachMs = beatMs * 2.35;
let notes = [];
let running = false;
let startTime = 0;
let score = 0;
let combo = 0;
let lives = 5;
let lastFrame = 0;
let countdownTimer = 0;
let pulse = 0;

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const rest = String(seconds % 60).padStart(2, "0");
  return `${minutes}:${rest}`;
}

function setTrack(index) {
  selectedTrack = tracks[index] || tracks[0];
  beatMs = 60000 / selectedTrack.bpm;
  approachMs = beatMs * 2.35;

  audio.pause();
  audio = new Audio(selectedTrack.url);
  audio.preload = "auto";
  audio.addEventListener("error", () => {
    setJudgement("Music unavailable, keep playing", "miss");
  });

  songDurationEl.textContent = formatTime(selectedTrack.lengthSec);
  songLink.href = selectedTrack.page;
  creditEl.textContent = `Song: ${selectedTrack.artist} - ${selectedTrack.title}. Music provided by NoCopyrightSounds.`;
  notes = makeChart();
  progressEl.style.width = "0%";
}

function makeChart() {
  const pattern = ["fire", "ice", "fire", "fire", "ice", "fire", "ice", "ice"];
  const chartLength = Math.floor((selectedTrack.lengthSec * 1000 - 2300) / beatMs);

  return Array.from({ length: chartLength }, (_, index) => {
    const spice = index % 11 === 7 ? 1 : index % 16 === 14 ? -1 : 0;
    return {
      type: pattern[(index + spice + pattern.length) % pattern.length],
      time: 1800 + index * beatMs,
      hit: false,
      missed: false,
    };
  });
}

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const scale = window.devicePixelRatio || 1;
  canvas.width = Math.floor(rect.width * scale);
  canvas.height = Math.floor(rect.height * scale);
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
}

function resetGame() {
  audio.pause();
  audio.currentTime = 0;
  notes = makeChart();
  score = 0;
  combo = 0;
  lives = 5;
  pulse = 0;
  startTime = performance.now() + 1600;
  countdownTimer = performance.now();
  running = true;
  judgementEl.textContent = "Listen...";
  startButton.textContent = "Restart";
  updateStats();

  setTimeout(() => {
    if (!running) return;
    audio.currentTime = 0;
    audio.play().catch(() => setJudgement("Tap again if music is blocked", "miss"));
  }, 1500);
}

function updateStats() {
  scoreEl.textContent = score.toLocaleString();
  comboEl.textContent = combo;
  livesEl.textContent = lives;
}

function setJudgement(text, type = "") {
  judgementEl.textContent = text;
  judgementEl.dataset.type = type;
}

function tap(type) {
  if (!running) return;

  const now = performance.now() - startTime;
  const candidates = notes
    .filter((note) => !note.hit && !note.missed && note.type === type)
    .map((note) => ({ note, delta: Math.abs(note.time - now) }))
    .sort((a, b) => a.delta - b.delta);

  const candidate = candidates[0];
  const grade = candidate && hitWindows.find((window) => candidate.delta <= window.ms);

  if (!candidate || !grade) {
    combo = 0;
    score = Math.max(0, score - 120);
    setJudgement("Miss", "miss");
    updateStats();
    pulse = 1;
    return;
  }

  candidate.note.hit = true;
  combo += 1;
  score += grade.points + combo * 18;
  setJudgement(grade.name, grade.name.toLowerCase());
  updateStats();
  pulse = 1;
}

function missOldNotes(now) {
  for (const note of notes) {
    if (!note.hit && !note.missed && now - note.time > hitWindows.at(-1).ms) {
      note.missed = true;
      combo = 0;
      lives -= 1;
      setJudgement("Miss", "miss");
      updateStats();
      pulse = 1;
    }
  }
}

function finishIfDone(now) {
  const lastNote = notes.at(-1);
  const finished = lastNote && now > selectedTrack.lengthSec * 1000;
  const defeated = lives <= 0;

  if (!finished && !defeated) return;

  running = false;
  audio.pause();
  const clear = lives > 0;
  countdownEl.textContent = clear ? "Stage Clear" : "Try Again";
  setJudgement(clear ? `Final Score ${score.toLocaleString()}` : "The rhythm broke", clear ? "perfect" : "miss");
  startButton.textContent = "Play Again";
}

function drawBackground(width, height, now) {
  const beat = Math.sin((now / beatMs) * Math.PI * 2) * 0.5 + 0.5;
  const glow = 0.22 + beat * 0.12 + pulse * 0.18;

  const fireGradient = ctx.createRadialGradient(width * 0.26, height * 0.52, 20, width * 0.26, height * 0.52, width * 0.44);
  fireGradient.addColorStop(0, `rgba(255, 90, 46, ${glow})`);
  fireGradient.addColorStop(1, "rgba(255, 90, 46, 0)");

  const iceGradient = ctx.createRadialGradient(width * 0.74, height * 0.52, 20, width * 0.74, height * 0.52, width * 0.44);
  iceGradient.addColorStop(0, `rgba(103, 216, 255, ${glow})`);
  iceGradient.addColorStop(1, "rgba(103, 216, 255, 0)");

  ctx.fillStyle = "#161312";
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = fireGradient;
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = iceGradient;
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 1;
  for (let i = 0; i < 16; i += 1) {
    const y = (height / 16) * i + ((now / 22) % (height / 16));
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
}

function drawTarget(width, height, now) {
  const cx = width / 2;
  const cy = height * 0.53;
  const beatScale = 1 + Math.sin((now / beatMs) * Math.PI * 2) * 0.035 + pulse * 0.08;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(beatScale, beatScale);

  ctx.lineWidth = 8;
  ctx.strokeStyle = "rgba(255,255,255,0.22)";
  ctx.beginPath();
  ctx.arc(0, 0, 88, 0, Math.PI * 2);
  ctx.stroke();

  ctx.lineWidth = 4;
  ctx.strokeStyle = "rgba(255,211,109,0.9)";
  ctx.beginPath();
  ctx.arc(0, 0, 62, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = "rgba(255,248,238,0.96)";
  ctx.beginPath();
  ctx.arc(0, 0, 28, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#191514";
  ctx.font = "900 18px system-ui";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("BEAT", 0, 1);
  ctx.restore();
}

function drawNote(note, width, height, now) {
  const progress = 1 - (note.time - now) / approachMs;
  if (progress < 0 || progress > 1.14 || note.hit || note.missed) return;

  const centerX = width / 2;
  const sideX = note.type === "fire" ? width * 0.12 : width * 0.88;
  const x = sideX + (centerX - sideX) * progress;
  const y = height * 0.53 + Math.sin(progress * Math.PI) * -height * 0.18;
  const radius = 30 + progress * 18;
  const color = note.type === "fire" ? "#ff5a2e" : "#67d8ff";
  const dark = note.type === "fire" ? "#4a1007" : "#062a39";

  ctx.save();
  ctx.globalAlpha = Math.min(1, progress + 0.1);
  ctx.shadowBlur = 28;
  ctx.shadowColor = color;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = dark;
  ctx.font = `950 ${Math.max(20, radius * 0.72)}px system-ui`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(note.type === "fire" ? "F" : "I", x, y + 1);
  ctx.restore();
}

function drawDancers(width, height, now) {
  const bounce = Math.sin((now / beatMs) * Math.PI * 2) * 10;
  const dancers = [
    { x: width * 0.27, color: "#ff5a2e", lean: -1 },
    { x: width * 0.73, color: "#67d8ff", lean: 1 },
  ];

  for (const dancer of dancers) {
    const floor = height * 0.83;
    const headY = floor - 118 + bounce;

    ctx.save();
    ctx.translate(dancer.x, headY);
    ctx.rotate((Math.sin(now / 220) * dancer.lean * Math.PI) / 36);
    ctx.strokeStyle = dancer.color;
    ctx.lineWidth = 10;
    ctx.lineCap = "round";
    ctx.shadowBlur = 20;
    ctx.shadowColor = dancer.color;

    ctx.beginPath();
    ctx.arc(0, 0, 22, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, 26);
    ctx.lineTo(0, 82);
    ctx.moveTo(0, 44);
    ctx.lineTo(-44 * dancer.lean, 28);
    ctx.moveTo(0, 48);
    ctx.lineTo(42 * dancer.lean, 20);
    ctx.moveTo(0, 82);
    ctx.lineTo(-28, 130);
    ctx.moveTo(0, 82);
    ctx.lineTo(32, 126);
    ctx.stroke();
    ctx.restore();
  }
}

function draw() {
  resizeCanvas();
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  const now = running ? performance.now() - startTime : 0;

  drawBackground(width, height, Math.max(now, 0));
  drawDancers(width, height, Math.max(now, 0));
  drawTarget(width, height, Math.max(now, 0));

  for (const note of notes) {
    drawNote(note, width, height, now);
  }

  if (running) {
    progressEl.style.width = `${Math.min(100, Math.max(0, (now / (selectedTrack.lengthSec * 1000)) * 100))}%`;
  }
}

function frame(timestamp) {
  const elapsed = timestamp - lastFrame;
  lastFrame = timestamp;
  pulse = Math.max(0, pulse - elapsed / 220);

  if (running) {
    const now = timestamp - startTime;
    const count = Math.ceil((startTime - timestamp) / 500);
    countdownEl.textContent = count > 0 ? count : "Go";
    if (timestamp - countdownTimer > 2500) countdownEl.textContent = "";
    missOldNotes(now);
    finishIfDone(now);
  }

  draw();
  requestAnimationFrame(frame);
}

function flash(button) {
  button.classList.add("active");
  setTimeout(() => button.classList.remove("active"), 110);
}

startButton.addEventListener("click", resetGame);
fireButton.addEventListener("click", () => {
  flash(fireButton);
  tap("fire");
});
iceButton.addEventListener("click", () => {
  flash(iceButton);
  tap("ice");
});

window.addEventListener("keydown", (event) => {
  if (event.repeat) return;

  if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") {
    event.preventDefault();
    flash(fireButton);
    tap("fire");
  }

  if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") {
    event.preventDefault();
    flash(iceButton);
    tap("ice");
  }

  if (event.key === " " || event.key === "Enter") {
    event.preventDefault();
    resetGame();
  }
});

songSelect.addEventListener("change", () => {
  running = false;
  countdownEl.textContent = "Ready?";
  startButton.textContent = "Start";
  setTrack(Number(songSelect.value));
  draw();
});

tracks.forEach((track, index) => {
  const option = document.createElement("option");
  option.value = String(index);
  option.textContent = `${track.artist} - ${track.title}`;
  songSelect.append(option);
});

window.addEventListener("resize", resizeCanvas);
setTrack(0);
resizeCanvas();
requestAnimationFrame(frame);
