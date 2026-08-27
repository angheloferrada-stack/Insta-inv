// ---------- firebase ----------
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js";
import {
  getFirestore, collection, addDoc, onSnapshot, doc, updateDoc,
  query, orderBy, where, getDocs,
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAo_WUWgf9Zb4dNBUkdSOQ29GTnHleF1Ik",
  authDomain: "insta-inv.firebaseapp.com",
  projectId: "insta-inv",
  storageBucket: "insta-inv.firebasestorage.app",
  messagingSenderId: "469488622220",
  appId: "1:469488622220:web:586acfd23cf209bafcb9a9",
};

const fbApp = initializeApp(firebaseConfig);
const db = getFirestore(fbApp);
const postsCol = collection(db, "posts");
const usersCol = collection(db, "users");

// ---------- datos base ----------
const CATEGORIES = [
  { id: "estudio", name: "Estudiar", pts: 10 },
  { id: "ejercicio", name: "Ejercicio", pts: 15 },
  { id: "lectura", name: "Leer", pts: 8 },
  { id: "creativo", name: "Proyecto creativo", pts: 14 },
  { id: "personal", name: "Proyecto personal", pts: 14 },
  { id: "nada", name: "No hacer nada", pts: 9 },
  { id: "monje", name: "Monje tibetano", pts: 40 },
];

const DEFAULT_USERS = [];

const MONTH_NAMES = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];

const COMBOS = [
  { cats: ["monje", "nada"], mult: 1.3, label: "Retiro real" },
  { cats: ["estudio", "lectura"], mult: 1.2, label: "Brain mode" },
  { cats: ["ejercicio", "personal"], mult: 1.25, label: "Cuerpo + proyecto" },
  { cats: ["creativo", "personal"], mult: 1.2, label: "Builder day" },
  { cats: ["estudio", "personal"], mult: 1.2, label: "Aprendizaje aplicado" },
  { cats: ["creativo", "lectura"], mult: 1.15, label: "Inspiración" },
  { cats: ["ejercicio", "nada"], mult: 1.15, label: "Cuerpo y mente" },
  { cats: ["monje", "creativo"], mult: 1.25, label: "Mente clara" },
  { cats: ["estudio", "ejercicio", "lectura"], mult: 1.4, label: "Día perfecto" },
];

// ---------- estado ----------
const state = {
  currentUser: localStorage.getItem("insta_inv_whoami") || null,
  users: DEFAULT_USERS,
  posts: [],
};

function catById(id) { return CATEGORIES.find(c => c.id === id); }
function userById(id) { return state.users.find(u => u.id === id); }
function initials(name) { return name.trim().slice(0, 2).toUpperCase(); }

function escapeHtml(str) {
  const d = document.createElement("div");
  d.textContent = str;
  return d.innerHTML;
}

async function hashPassword(pass) {
  const enc = new TextEncoder().encode("insta-inv-salt::" + pass);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

// ---------- identidad (cómo te llamai) ----------
async function initWhoami() {
  const overlay = document.getElementById("whoamiOverlay");
  if (state.currentUser && userById(state.currentUser)) {
    overlay.classList.add("hidden");
    return;
  }
  overlay.classList.remove("hidden");
  renderWhoamiForm();
}

function renderWhoamiForm() {
  const list = document.getElementById("whoamiList");
  const others = state.users.length
    ? `<div class="whoami-others">
        <div class="whoami-others-label">ya están en el grupo:</div>
        ${state.users.map(u => `<button class="whoami-choice small" data-name="${escapeHtml(u.name)}">${escapeHtml(u.name)}</button>`).join("")}
      </div>`
    : "";
  list.innerHTML = `
    <input type="text" id="whoamiInput" class="whoami-input" placeholder="tu nombre" maxlength="20">
    <input type="password" id="whoamiPass" class="whoami-input" placeholder="tu contraseña" maxlength="40">
    <div class="whoami-error" id="whoamiError"></div>
    <button class="primary-btn" id="whoamiSubmit">entrar</button>
    <div class="whoami-hint">si es tu primera vez, esa contraseña te va a quedar para siempre. no la pierdas.</div>
    ${others}
    <div class="sync-note">esto queda guardado en este celular</div>
  `;
  document.getElementById("whoamiSubmit").addEventListener("click", submitWhoami);
  document.getElementById("whoamiPass").addEventListener("keydown", (e) => {
    if (e.key === "Enter") submitWhoami();
  });
  list.querySelectorAll(".whoami-choice[data-name]").forEach(btn => {
    btn.addEventListener("click", () => {
      document.getElementById("whoamiInput").value = btn.dataset.name;
      document.getElementById("whoamiPass").focus();
    });
  });
}

async function submitWhoami() {
  const nameInput = document.getElementById("whoamiInput");
  const passInput = document.getElementById("whoamiPass");
  const errorBox = document.getElementById("whoamiError");
  const name = nameInput.value.trim();
  const pass = passInput.value;
  errorBox.textContent = "";

  if (!name) { nameInput.focus(); return; }
  if (!pass) { passInput.focus(); return; }

  const btn = document.getElementById("whoamiSubmit");
  btn.disabled = true;
  btn.textContent = "un toque...";

  try {
    const passHash = await hashPassword(pass);
    const existing = state.users.find(u => u.name.toLowerCase() === name.toLowerCase());

    if (existing) {
      if (existing.passHash !== passHash) {
        errorBox.textContent = "esa contraseña no es. probá de nuevo.";
        btn.disabled = false;
        btn.textContent = "entrar";
        return;
      }
      setIdentity(existing.id);
    } else {
      const newDoc = await addDoc(usersCol, { name, passHash, ts: Date.now() });
      setIdentity(newDoc.id);
    }
  } catch (err) {
    toast("no resultó, revisa tu conexión");
    btn.disabled = false;
    btn.textContent = "entrar";
  }
}

function setIdentity(id) {
  state.currentUser = id;
  localStorage.setItem("insta_inv_whoami", id);
  document.getElementById("whoamiOverlay").classList.add("hidden");
  showScreen("feed");
}

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
  return Object.values(post.votes || {}).filter(v => v === "up").length;
}
function isApproved(post) {
  return approvalsCount(post) >= 1;
}

// ---------- combos ----------
function dayKey(ts) { return new Date(ts).toDateString(); }

function comboForCats(catIds) {
  const set = new Set(catIds);
  let best = null;
  for (const combo of COMBOS) {
    if (combo.cats.every(c => set.has(c))) {
      if (!best || combo.mult > best.mult) best = combo;
    }
  }
  return best;
}

function dailyTotalsForUser(userId) {
  const byDay = {};
  state.posts
    .filter(p => p.userId === userId && isApproved(p))
    .forEach(p => {
      const k = dayKey(p.ts);
      if (!byDay[k]) byDay[k] = { posts: [], base: 0, ts: p.ts };
      byDay[k].posts.push(p);
      byDay[k].base += p.pts;
    });
  Object.values(byDay).forEach(d => {
    const combo = comboForCats(d.posts.map(p => p.catId));
    d.combo = combo;
    d.total = combo ? Math.round(d.base * combo.mult) : d.base;
  });
  return byDay;
}

function comboActiveForPost(post) {
  const byDay = dailyTotalsForUser(post.userId);
  const d = byDay[dayKey(post.ts)];
  return d ? d.combo : null;
}

// ---------- puntos y racha ----------
function pointsForUserInSeason(userId, key) {
  const byDay = dailyTotalsForUser(userId);
  return Object.values(byDay)
    .filter(d => seasonKey(d.ts) === key)
    .reduce((sum, d) => sum + d.total, 0);
}
function totalPointsForUser(userId) {
  const byDay = dailyTotalsForUser(userId);
  return Object.values(byDay).reduce((sum, d) => sum + d.total, 0);
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
  if (!state.currentUser) return;
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
    if (!u) return "";
    const cat = catById(p.catId);
    const approved = isApproved(p);
    const myVote = (p.votes || {})[state.currentUser];
    const isMine = p.userId === state.currentUser;
    const restNote = p.catId === "nada" ? `<div class="rest-note">el descanso también cuenta.</div>` : "";
    const photos = p.photos && p.photos.length
      ? `<div class="post-photos ${p.photos.length > 1 ? "multi" : ""}">${p.photos.map(src => `<img src="${src}" alt="foto de prueba">`).join("")}</div>`
      : `<div class="post-photo">sin foto</div>`;
    const desc = p.desc ? `<div class="post-desc">${escapeHtml(p.desc)}</div>` : "";
    const combo = approved ? comboActiveForPost(p) : null;
    const comboTag = combo ? `<div class="combo-tag">🔗 combo ${combo.label} ×${combo.mult}</div>` : "";
    const comments = p.comments || [];
    const commentsHtml = comments.map(c => `
      <div class="comment-row">
        <span class="comment-name">${userById(c.userId)?.name || "?"}</span>
        <span class="comment-text">${escapeHtml(c.text)}</span>
      </div>`).join("");
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
      ${comboTag}
      <div class="post-foot">
        <div class="points-badge">${approved ? "+" + p.pts : "pendiente"} pts</div>
        ${isMine
          ? `<div class="verify-status">${approvalsCount(p)} aprobación${approvalsCount(p) === 1 ? "" : "es"}</div>`
          : `<div class="verify-row">
              <button class="vbtn approve ${myVote === "up" ? "active" : ""}" data-post="${p.id}" data-vote="up">✓ va</button>
              <button class="vbtn reject ${myVote === "down" ? "active" : ""}" data-post="${p.id}" data-vote="down">✕ sospechoso</button>
            </div>`
        }
      </div>
      <div class="comments-block">
        ${commentsHtml}
        <div class="comment-input-row">
          <input type="text" class="comment-input" placeholder="deja un comentario..." data-post="${p.id}">
          <button class="comment-send" data-post="${p.id}">enviar</button>
        </div>
      </div>
    </div>`;
  }).join("");

  list.querySelectorAll(".vbtn").forEach(btn => {
    btn.addEventListener("click", () => vote(btn.dataset.post, btn.dataset.vote));
  });
  list.querySelectorAll(".comment-send").forEach(btn => {
    btn.addEventListener("click", () => submitComment(btn.dataset.post));
  });
  list.querySelectorAll(".comment-input").forEach(input => {
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") submitComment(input.dataset.post);
    });
  });
}

async function vote(postId, val) {
  const post = state.posts.find(p => p.id === postId);
  if (!post) return;
  const votes = { ...(post.votes || {}) };
  votes[state.currentUser] = votes[state.currentUser] === val ? undefined : val;
  if (votes[state.currentUser] === undefined) delete votes[state.currentUser];
  try {
    await updateDoc(doc(db, "posts", postId), { votes });
  } catch (err) {
    toast("no se pudo votar, revisa tu conexión");
  }
}

async function submitComment(postId) {
  const input = document.querySelector(`.comment-input[data-post="${postId}"]`);
  const text = input.value.trim();
  if (!text) return;
  const post = state.posts.find(p => p.id === postId);
  if (!post) return;
  const comments = [...(post.comments || []), { userId: state.currentUser, text, ts: Date.now() }];
  input.value = "";
  try {
    await updateDoc(doc(db, "posts", postId), { comments });
  } catch (err) {
    toast("no se pudo comentar, revisa tu conexión");
  }
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

// ---------- utilidad: comprimir foto antes de guardar ----------
function fileToCompressedDataUrl(file, maxDim = 900, quality = 0.6) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onload = () => { img.src = reader.result; };
    reader.onerror = reject;
    img.onload = () => {
      let { width, height } = img;
      if (width > height && width > maxDim) {
        height = Math.round(height * (maxDim / width));
        width = maxDim;
      } else if (height > maxDim) {
        width = Math.round(width * (maxDim / height));
        height = maxDim;
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      canvas.getContext("2d").drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ---------- render: publicar ----------
let selectedCat = null;
let pendingPhotos = [];

function renderPublish() {
  selectedCat = null;
  pendingPhotos = [];
  document.getElementById("descInput").value = "";
  renderPhotoGrid();
  bindPublishEvents();
  document.getElementById("comboInfo").innerHTML = COMBOS.map(c => `
    <div class="combo-info-row">
      <span>${c.cats.map(id => catById(id).name).join(" + ")}</span>
      <span class="combo-info-mult">×${c.mult}</span>
    </div>`).join("");
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
  const input = document.getElementById("fileInput");
  input.onchange = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length) toast("dale, procesando las fotos...");
    for (const file of files) {
      try {
        pendingPhotos.push(await fileToCompressedDataUrl(file));
      } catch (err) { /* ignore fallo de una foto */ }
    }
    e.target.value = "";
    renderPhotoGrid();
    checkPublishReady();
  };
}

function checkPublishReady() {
  document.getElementById("publishBtn").disabled = !(selectedCat && pendingPhotos.length > 0);
}

document.getElementById("publishBtn").addEventListener("click", async () => {
  if (!selectedCat || !pendingPhotos.length) return;
  const cat = catById(selectedCat);
  const btn = document.getElementById("publishBtn");
  btn.disabled = true;
  btn.textContent = "publicando...";
  try {
    await addDoc(postsCol, {
      userId: state.currentUser,
      catId: cat.id,
      pts: cat.pts,
      ts: Date.now(),
      votes: {},
      photos: pendingPhotos,
      desc: document.getElementById("descInput").value.trim(),
      comments: [],
    });
    toast("subido. a esperar que te aprueben 👀");
    showScreen("feed");
  } catch (err) {
    toast("no se pudo publicar, revisa tu conexión");
  } finally {
    btn.textContent = "publicar";
  }
});

// ---------- render: perfil ----------
function renderProfile() {
  const u = userById(state.currentUser);
  if (!u) return;
  document.getElementById("profileAvatar").textContent = initials(u.name);
  document.getElementById("profileName").textContent = u.name;
  document.getElementById("profileSub").textContent = `${totalPointsForUser(u.id)} pts histórico`;
  document.getElementById("statTotal").textContent = totalPointsForUser(u.id);
  document.getElementById("statMonth").textContent = pointsForUserInSeason(u.id, currentSeasonKey());
  document.getElementById("statStreak").textContent = currentStreak(u.id);

  document.getElementById("userSwitcher").innerHTML = "";

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
        <div class="rank-streak">${approved ? "aprobado" : "pendiente"}</div>
      </div>
      <div class="tpts">${approved ? "+" + p.pts : "—"}</div>
    </div>`;
  }).join("");
}

// ---------- init ----------
showScreen("feed");

const usersQuery = query(usersCol, orderBy("ts", "asc"));
let whoamiChecked = false;
onSnapshot(usersQuery, (snap) => {
  state.users = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  if (!whoamiChecked) {
    whoamiChecked = true;
    initWhoami();
  } else if (document.getElementById("whoamiOverlay").classList.contains("hidden") === false) {
    renderWhoamiForm();
  }
  const activeScreen = document.querySelector(".screen.active")?.id;
  if (activeScreen === "screen-feed") renderFeed();
  if (activeScreen === "screen-ranking") renderRanking();
  if (activeScreen === "screen-profile") renderProfile();
});

const postsQuery = query(postsCol, orderBy("ts", "desc"));
onSnapshot(postsQuery, (snap) => {
  state.posts = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  const activeScreen = document.querySelector(".screen.active")?.id;
  if (activeScreen === "screen-feed") renderFeed();
  if (activeScreen === "screen-ranking") renderRanking();
  if (activeScreen === "screen-profile") renderProfile();
}, (err) => {
  toast("sin conexión con el servidor");
});

// ---------- service worker ----------
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("service-worker.js").catch(() => {});
  });
}
