// ---------- datos base ----------
const CATEGORIES = [
  { id: "estudio", name: "Estudiar", pts: 10 },
  { id: "ejercicio", name: "Ejercicio", pts: 15 },
  { id: "lectura", name: "Leer", pts: 8 },
  { id: "sincelu", name: "Sin celular", pts: 12 },
  { id: "creativo", name: "Proyecto creativo", pts: 14 },
  { id: "personal", name: "Proyecto personal", pts: 14 },
  { id: "nada", name: "No hacer nada", pts: 9 },
  { id: "monje", name: "Monje tibetano", pts: 40 },
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
    { id: "p1", userId: "u2", catId: "ejercicio", pts: 15, ts: now - day * 0.3, votes: { u1: "up", u3: "up" }, photos: [], desc: "" },
    { id: "p2", userId: "u3", catId: "creativo", pts: 14, ts: now - day * 0.6, votes: { u1: "up" }, photos: [], desc: "" },
    { id: "p3", userId: "u1", catId: "estudio", pts: 10, ts: now - day * 1.1, votes: { u2: "up", u3: "up" }, photos: [], desc: "" },
    { id: "p4", userId: "u2", catId: "nada", pts: 9, ts: now - day * 1.5, votes: { u1: "up", u3: "up" }, photos: [], desc: "" },
    { id: "p5", userId: "u3", catId: "sincelu", pts: 12, ts: now - day * 2.2, votes: {}, photos: [], desc: "" },
  ];
}

function save() {
  localStorage.setItem("insta_inv_state", JSON.stringify(state));
}

function escapeHtml(str) {
  const d = document.createElement("div");
  d.textContent = str;
  return d.innerHTML;
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
    const photos = p.photos && p.photos.length
      ? `<div class="post-photos ${p.photos.length > 1 ? "multi" : ""}">${p.photos.map(src => `<img src="${src}" alt="foto de prueba">`).join("")}</div>`
      : `<div class="post-photo">sin foto</div>`;
    const desc = p.desc ? `<div class="post-desc">${escapeHtml(p.desc)}</div>` : "";
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
      ${photos}
      ${desc}
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
let pendingPhotos = [];

function fileToDataUrl(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(file);
  });
}

function renderPublish() {
  selectedCat = null;
  pendingPhotos = [];
  document.getElementById("descInput").value = "";
  renderPhotoGrid();
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

function renderPhotoGrid() {
  const grid = document.getElementById("photoGrid");
  grid.innerHTML = pendingPhotos.map((src, i) => `
    <div class="photo-thumb">
      <img src="${src}" alt="foto ${i + 1}">
      <button class="photo-remove" data-idx="${i}">✕</button>
    </div>`).join("") + `
    <button class="photo-add" id="addPhotoBtn">+</button>`;

  grid.querySelectorAll(".photo-remove").forEach(btn => {
    btn.addEventListener("click", () => {
      pendingPhotos.splice(Number(btn.dataset.idx), 1);
      renderPhotoGrid();
      checkPublishReady();
    });
  });
  document.getElementById("addPhotoBtn").addEventListener("click", () => {
    document.getElementById("fileInput").click();
  });
}

function bindPublishEvents() {
  document.getElementById("fileInput").addEventListener("change", async (e) => {
    const files = Array.from(e.target.files || []);
    for (const file of files) {
      pendingPhotos.push(await fileToDataUrl(file));
    }
    e.target.value = "";
    renderPhotoGrid();
    checkPublishReady();
  });
}

function checkPublishReady() {
  document.getElementById("publishBtn").disabled = !(selectedCat && pendingPhotos.length > 0);
}

document.getElementById("publishBtn").addEventListener("click", () => {
  if (!selectedCat || !pendingPhotos.length) return;
  const cat = catById(selectedCat);
  state.posts.unshift({
    id: "p" + Date.now(),
    userId: state.currentUser,
    catId: cat.id,
    pts: cat.pts,
    ts: Date.now(),
    votes: {},
    photos: [...pendingPhotos],
    desc: document.getElementById("descInput").value.trim(),
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
