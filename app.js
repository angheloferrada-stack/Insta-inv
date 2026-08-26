// ---------- datos base ----------
const CATEGORIES = [
  { id: "estudio", name: "Estudiar", pts: 10 },
  { id: "ejercicio", name: "Ejercicio", pts: 15 },
  { id: "lectura", name: "Leer", pts: 8 },
  { id: "sincelu", name: "Sin celular", pts: 12 },
  { id: "creativo", name: "Proyecto creativo", pts: 14 },
  { id: "personal", name: "Proyecto personal", pts: 14 },
  { id: "nada", name: "No hacer nada", pts: 9 },
];

const DEFAULT_USERS = [
  { id: "u1", name: "Vos" },
  { id: "u2", name: "Mica" },
  { id: "u3", name: "Fede" },
];

const MONTH_NAMES = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];

// ---------- estado ----------
const state = JSON.parse(localStorage.getItem("insta_inv_state") || "null") || {
  currentUser: "u1",
  users: DEFAULT_USERS,
  posts: seedPosts(),
};

function seedPosts() {
  const now = Date.now();
  const day = 86400000;
  return [
    { id: "p1", userId: "u2", catId: "ejercicio", pts: 15, ts: now - day * 0.3, votes: { u1: "up", u3: "up" } },
    { id: "p2", userId: "u3", catId: "creativo", pts: 14, ts: now - day * 0.6, votes: { u1: "up" } },
    { id: "p3", userId: "u1", catId: "estudio", pts: 10, ts: now - day * 1.1, votes: { u2: "up", u3: "up" } },
    { id: "p4", userId: "u2", catId: "nada", pts: 9, ts: now - day * 1.5, votes: { u1: "up", u3: "up" } },
    { id: "p5", userId: "u3", catId: "sincelu", pts: 12, ts: now - day * 2.2, votes: {} },
  ];
}

function save() {
  localStorage.setItem("insta_inv_state", JSON.stringify(state));
}

function catById(id) { return CATEGORIES.find(c => c.id === id); }
function userById(id) { return state.users.find(u => u.id === id); }
function initials(name) { return name.trim().slice(0, 2).toUpperCase(); }

// ---------- temporada ----------
function seasonKey(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${d.getMonth()}`;
}
function currentSeasonKey() { return seasonKey(Date.now()); }
function seasonLabelFor(key) {
  const [y, m] = key.split("-").map(Number);
  return `${MONTH_NAMES[m]} ${y}`;
}
function daysLeftInMonth() {
  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return end.getDate() - now.getDate();
}

// ---------- verificación ----------
function approvalsCount(post) {
  return Object.values(post.votes).filter(v => v === "up").length;
}
function isApproved(post) {
  // con grupo chico: 1 aprobación de otro usuario ya cuenta
  return approvalsCount(post) >= 1;
}

// ---------- puntos y racha ----------
function pointsForUserInSeason(userId, key) {
  return state.posts
    .filter(p => p.userId === userId && seasonKey(p.ts) === key && isApproved(p))
    .reduce((sum, p) => sum + p.pts, 0);
}
function totalPointsForUser(userId) {
  return state.posts
    .filter(p => p.userId === userId && isApproved(p))
    .reduce((sum, p) => sum + p.pts, 0);
}
function currentStreak(userId) {
  const days = new Set(
    state.posts.filter(p => p.userId === userId && isApproved(p))
      .map(p => new Date(p.ts).toDateString())
  );
  let streak = 0;
  let cursor = new Date();
  while (days.has(cursor.toDateString())) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

// ---------- navegación ----------
function showScreen(name) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  document.getElementById(`screen-${name}`).classList.add("active");
  document.querySelectorAll(".navbtn").forEach(b => b.classList.toggle("active", b.dataset.screen === name));
  if (name === "feed") renderFeed();
  if (name === "ranking") renderRanking();
  if (name === "profile") renderProfile();
  if (name === "publish") renderPublish();
}
document.querySelectorAll(".navbtn").forEach(btn => {
  btn.addEventListener("click", () => showScreen(btn.dataset.screen));
});

// ---------- toast ----------
function toast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 1800);
}

// ---------- render: topbar ----------
function renderTopbar() {
  document.getElementById("myStreakPill").textContent = `🔥 ${currentStreak(state.currentUser)} días`;
  document.getElementById("seasonLabel").textContent = seasonLabelFor(currentSeasonKey());
  document.getElementById("daysLeft").textContent = `${daysLeftInMonth()} días`;
}

// ---------- render: feed ----------
function timeAgo(ts) {
  const diff = Date.now() - ts;
  const h = Math.floor(diff / 3600000);
  if (h < 1) return "hace instantes";
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  return `hace ${d} d`;
}

function renderFeed() {
  renderTopbar();
  const list = document.getElementById("feedList");
  const posts = [...state.posts].sort((a, b) => b.ts - a.ts);
  if (!posts.length) {
    list.innerHTML = `<div class="empty-state">nadie publicó todavía. arrancá vos.</div>`;
    return;
  }
  list.innerHTML = posts.map(p => {
    const u = userById(p.userId);
    const cat = catById(p.catId);
    const approved = isApproved(p);
    const myVote = p.votes[state.currentUser];
    const isMine = p.userId === state.currentUser;
    const restNote = p.catId === "nada" ? `<div class="rest-note">el descanso también cuenta.</div>` : "";
    return `
    <div class="post-card">
      <div class="post-head">
        <div class="avatar">${initials(u.name)}</div>
        <div class="who">
          <div class="name">${u.name}</div>
          <div class="meta">${timeAgo(p.ts)}</div>
        </div>
        <div class="cat-tag">${cat.name}</div>
      </div>
      <div class="post-photo">foto de prueba</div>
      ${restNote}
      <div class="post-foot">
        <div class="points-badge">${approved ? "+" + p.pts : "pendiente"} pts</div>
        ${isMine
          ? `<div class="verify-status">${approvalsCount(p)} aprobación${approvalsCount(p) === 1 ? "" : "es"}</div>`
          : `<div class="verify-row">
              <button class="vbtn approve ${myVote === "up" ? "active" : ""}" onclick="vote('${p.id}','up')">✓ válido</button>
              <button class="vbtn reject ${myVote === "down" ? "active" : ""}" onclick="vote('${p.id}','down')">✕ dudoso</button>
            </div>`
        }
      </div>
    </div>`;
  }).join("");
}

function vote(postId, val) {
  const post = state.posts.find(p => p.id === postId);
  post.votes[state.currentUser] = post.votes[state.currentUser] === val ? undefined : val;
  if (post.votes[state.currentUser] === undefined) delete post.votes[state.currentUser];
  save();
  renderFeed();
}

// ---------- render: ranking ----------
function renderRanking() {
  const key = currentSeasonKey();
  const rows = state.users
    .map(u => ({ u, pts: pointsForUserInSeason(u.id, key), streak: currentStreak(u.id) }))
    .sort((a, b) => b.pts - a.pts);
  document.getElementById("rankList").innerHTML = rows.map((r, i) => `
    <div class="rank-row">
      <div class="rank-num">${i + 1}</div>
      <div class="avatar">${initials(r.u.name)}</div>
      <div class="rank-info">
        <div class="rank-name">${r.u.name}</div>
        <div class="rank-streak">racha: ${r.streak} días</div>
      </div>
      <div class="rank-points">${r.pts}</div>
    </div>`).join("");

  const seasonsSeen = [...new Set(state.posts.map(p => seasonKey(p.ts)))].filter(k => k !== key);
  const past = document.getElementById("pastSeasons");
  if (!seasonsSeen.length) {
    past.innerHTML = `<div class="empty-state">todavía no hay temporadas cerradas.</div>`;
    return;
  }
  past.innerHTML = seasonsSeen.map(k => {
    const winner = [...state.users].map(u => ({ u, pts: pointsForUserInSeason(u.id, k) })).sort((a, b) => b.pts - a.pts)[0];
    return `<div class="past-season"><span>${seasonLabelFor(k)}</span><span class="winner">ganó ${winner.u.name} · ${winner.pts} pts</span></div>`;
  }).join("");
}

// ---------- render: publicar ----------
let selectedCat = null;
let pendingPhoto = null;

function renderPublish() {
  selectedCat = null;
  pendingPhoto = null;
  document.getElementById("uploadBox").innerHTML = `toca para sacar o elegir una foto<input type="file" id="fileInput" accept="image/*" capture="environment" style="display:none">`;
  document.getElementById("uploadBox").classList.remove("has-photo");
  bindPublishEvents();
  document.getElementById("catGrid").innerHTML = CATEGORIES.map(c => `
    <button class="cat-choice" data-cat="${c.id}">
      <div class="cname">${c.name}</div>
      <div class="cpts">${c.pts} pts</div>
    </button>`).join("");
  document.querySelectorAll(".cat-choice").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".cat-choice").forEach(b => b.classList.remove("selected"));
      btn.classList.add("selected");
      selectedCat = btn.dataset.cat;
      checkPublishReady();
    });
  });
  checkPublishReady();
}

function bindPublishEvents() {
  const box = document.getElementById("uploadBox");
  box.addEventListener("click", () => document.getElementById("fileInput").click());
  document.getElementById("fileInput").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    pendingPhoto = true;
    box.classList.add("has-photo");
    box.innerHTML = `<img src="${URL.createObjectURL(file)}" alt="foto de prueba">`;
    checkPublishReady();
  });
}

function checkPublishReady() {
  document.getElementById("publishBtn").disabled = !(selectedCat && pendingPhoto);
}

document.getElementById("publishBtn").addEventListener("click", () => {
  if (!selectedCat || !pendingPhoto) return;
  const cat = catById(selectedCat);
  state.posts.unshift({
    id: "p" + Date.now(),
    userId: state.currentUser,
    catId: cat.id,
    pts: cat.pts,
    ts: Date.now(),
    votes: {},
  });
  save();
  toast("publicado. a esperar aprobación 👀");
  showScreen("feed");
});

// ---------- render: perfil ----------
function renderProfile() {
  const u = userById(state.currentUser);
  document.getElementById("profileAvatar").textContent = initials(u.name);
  document.getElementById("profileName").textContent = u.name;
  document.getElementById("profileSub").textContent = `${totalPointsForUser(u.id)} pts histórico`;
  document.getElementById("statTotal").textContent = totalPointsForUser(u.id);
  document.getElementById("statMonth").textContent = pointsForUserInSeason(u.id, currentSeasonKey());
  document.getElementById("statStreak").textContent = currentStreak(u.id);

  document.getElementById("userSwitcher").innerHTML = state.users.map(usr => `
    <button class="cat-choice ${usr.id === state.currentUser ? "selected" : ""}" onclick="switchUser('${usr.id}')">
      <div class="cname">${usr.name}</div>
      <div class="cpts">cambiar a este perfil</div>
    </button>`).join("");

  const mine = state.posts.filter(p => p.userId === state.currentUser).sort((a, b) => b.ts - a.ts);
  const list = document.getElementById("timelineList");
  if (!mine.length) {
    list.innerHTML = `<div class="empty-state">todavía no hay nada en tu bitácora.</div>`;
    return;
  }
  list.innerHTML = mine.map(p => {
    const d = new Date(p.ts);
    const cat = catById(p.catId);
    const approved = isApproved(p);
    return `
    <div class="timeline-item">
      <div class="tdate">${d.getDate()}/${d.getMonth() + 1}</div>
      <div class="tbody">
        <div class="ttitle">${cat.name}</div>
        <div class="rank-streak">${approved ? "aprobado" : "pendiente de aprobación"}</div>
      </div>
      <div class="tpts">${approved ? "+" + p.pts : "—"}</div>
    </div>`;
  }).join("");
}

function switchUser(id) {
  state.currentUser = id;
  save();
  renderProfile();
  renderTopbar();
}

// ---------- init ----------
renderFeed();

// ---------- service worker ----------
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("service-worker.js").catch(() => {});
  });
}
