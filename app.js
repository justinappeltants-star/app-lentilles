(() => {
  const USERS_KEY = "lentilles-local-users-v1";
  const SESSION_KEY = "lentilles-local-session-v1";
  const ADMIN_NAME = "admin";
  const ADMIN_PASSWORD = "admin1234";
  const storedSession = sessionStorage.getItem(SESSION_KEY) || localStorage.getItem(SESSION_KEY);
  let activeUser = storedSession ? JSON.parse(storedSession) : null;
  let KEY = "lentilles-tracker-v1:" + (activeUser?.username || "locked");
  const defaults = { entries: {}, theme: "ocean", mode: "dark", hours: 12 };
  let state = loadState();
  let shownDate = new Date();
  const $ = (id) => document.getElementById(id);
  const pad = (n) => String(n).padStart(2, "0");
  const dateKey = (d) => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  const parseKey = (key) => { const [y,m,d] = key.split("-").map(Number); return new Date(y,m-1,d); };
  const sortedKeys = () => Object.keys(state.entries).filter(k => state.entries[k]).sort();
  const entryDetails = entry => entry && typeof entry === "object" ? entry : { occasion: "Non précisé", hours: Number(state.hours)||12, minutes: 0 };
  let pendingDateKey = null;
  let pendingDeleteKey = null;
  function loadState() {
    try { return { ...defaults, ...JSON.parse(localStorage.getItem(KEY) || "{}") }; }
    catch { return { ...defaults }; }
  }
  function save() { localStorage.setItem(KEY, JSON.stringify(state)); }
  async function hashPassword(value) {
    const bytes = new TextEncoder().encode(value);
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2,"0")).join("");
  }
  function getUsers() {
    try { return JSON.parse(localStorage.getItem(USERS_KEY) || "[]"); } catch { return []; }
  }
  async function initializeAccounts() {
    const users = getUsers();
    if (!users.some(u => u.username === ADMIN_NAME)) {
      users.push({username:ADMIN_NAME,passwordHash:await hashPassword(ADMIN_PASSWORD),role:"admin"});
      localStorage.setItem(USERS_KEY,JSON.stringify(users));
    }
  }
  function setSession(user, remember) {
    const value = JSON.stringify({username:user.username,role:user.role});
    sessionStorage.removeItem(SESSION_KEY); localStorage.removeItem(SESSION_KEY);
    (remember ? localStorage : sessionStorage).setItem(SESSION_KEY,value);
  }
  function showApp(user) {
    activeUser = user;
    KEY = "lentilles-tracker-v1:" + user.username;
    $("authScreen").hidden = true; $("appShell").hidden = false;
    $("userChip").textContent = user.role === "admin" ? "Admin · "+user.username : user.username;
    state = loadState();
    render();
  }
  function showLogin() {
    $("appShell").hidden = true; $("authScreen").hidden = false;
  }
  function setupAuth() {
    const loginForm=$("loginForm"), registerForm=$("registerForm"), switchBtn=$("switchAuth");
    let registering=false;
    switchBtn.addEventListener("click",()=>{
      registering=!registering; loginForm.hidden=registering; registerForm.hidden=!registering;
      $("authTitle").textContent=registering?"Créer un compte":"Content de te revoir";
      $("authDescription").textContent=registering?"Crée ton espace personnel sur cet appareil.":"Connecte-toi pour retrouver ton calendrier.";
      switchBtn.textContent=registering?"J'ai déjà un compte":"Créer un compte"; $("authMessage").textContent="";
    });
    loginForm.addEventListener("submit",async e=>{
      e.preventDefault(); const username=$("loginUsername").value.trim().toLowerCase(), password=$("loginPassword").value;
      const user=getUsers().find(u=>u.username===username);
      if(!user || user.passwordHash!==await hashPassword(password)){ $("authMessage").textContent="Nom d'utilisateur ou mot de passe incorrect."; return; }
      const sessionUser={username:user.username,role:user.role}; setSession(sessionUser,$("rememberMe").checked); showApp(sessionUser);
    });
    registerForm.addEventListener("submit",async e=>{
      e.preventDefault(); const username=$("registerUsername").value.trim().toLowerCase(), password=$("registerPassword").value;
      if(!/^[a-z0-9_-]{3,24}$/.test(username)){ $("authMessage").textContent="Utilise 3 à 24 caractères : lettres, chiffres, _ ou -."; return; }
      if(password.length<6){ $("authMessage").textContent="Le mot de passe doit contenir au moins 6 caractères."; return; }
      const users=getUsers(); if(users.some(u=>u.username===username)){ $("authMessage").textContent="Ce nom d'utilisateur est déjà pris."; return; }
      users.push({username,passwordHash:await hashPassword(password),role:"user"}); localStorage.setItem(USERS_KEY,JSON.stringify(users));
      const sessionUser={username,role:"user"}; setSession(sessionUser,$("registerRemember").checked); showApp(sessionUser);
    });
    $("logoutBtn").addEventListener("click",()=>{
      sessionStorage.removeItem(SESSION_KEY); localStorage.removeItem(SESSION_KEY); activeUser=null; location.reload();
    });
  }
  function toast(message) {
    const el = $("toast"); el.textContent = message; el.classList.add("show");
    clearTimeout(toast.timer); toast.timer = setTimeout(() => el.classList.remove("show"), 2300);
  }
  function applyAppearance() {
    document.documentElement.dataset.theme = state.theme;
    const mode = state.mode === "auto" ? (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark") : state.mode;
    document.documentElement.dataset.mode = mode;
    $("themeSelect").value = state.theme; $("modeSelect").value = state.mode; $("hoursSelect").value = String(state.hours);
  }
  function streaks() {
    const keys = sortedKeys(); if (!keys.length) return {current:0,best:0};
    const set = new Set(keys); let best=0, run=0, prev=null;
    for (const key of keys) { const d=parseKey(key); run = prev && (d-prev)===86400000 ? run+1 : 1; best=Math.max(best,run); prev=d; }
    let current=0; const cursor=new Date(); cursor.setHours(0,0,0,0);
    if (!set.has(dateKey(cursor))) cursor.setDate(cursor.getDate()-1);
    while(set.has(dateKey(cursor))) { current++; cursor.setDate(cursor.getDate()-1); }
    return {current,best};
  }
  function renderCalendar() {
    const year=shownDate.getFullYear(), month=shownDate.getMonth();
    $("monthLabel").textContent = new Intl.DateTimeFormat("fr-BE",{month:"long",year:"numeric"}).format(shownDate);
    const first=new Date(year,month,1), days=new Date(year,month+1,0).getDate();
    const offset=(first.getDay()+6)%7, today=dateKey(new Date()), grid=$("calendarGrid"); grid.innerHTML="";
    for(let i=0;i<offset;i++){const blank=document.createElement("span");blank.setAttribute("aria-hidden","true");grid.append(blank);}
    for(let day=1;day<=days;day++){
      const d=new Date(year,month,day), key=dateKey(d), btn=document.createElement("button");
      btn.className="day"; btn.textContent=day; btn.type="button";
      if(state.entries[key]) btn.classList.add("done");
      if(key===today) btn.classList.add("today");
      btn.setAttribute("aria-label", `${day} ${$("monthLabel").textContent}${state.entries[key]?", lentilles portées":""}`);
      btn.setAttribute("aria-pressed",String(Boolean(state.entries[key])));
      btn.addEventListener("click",()=>{ if(state.entries[key]) { openDeleteDialog(key); return; } openEntryDialog(key); }); const detail="Motif : "+(e.occasion||"Non précisé")+"\nDurée : "+(Number(e.hours)||0)+" h "+(Number(e.minutes)||0)+" min"; if(confirm("Cette journée contient déjà des informations.\n\n"+detail+"\n\nVeux-tu vraiment supprimer ces données ?")){delete state.entries[key];save();render();toast("Journée supprimée.");} return; } openEntryDialog(key); });
      grid.append(btn);
    }
    const keys=sortedKeys(), monthPrefix=`${year}-${pad(month+1)}-`;
    $("totalDays").textContent=keys.length; $("monthDays").textContent=keys.filter(k=>k.startsWith(monthPrefix)).length;
    $("currentStreak").textContent=streaks().current;
  }
  function openDeleteDialog(key) {
    pendingDeleteKey = key;
    const e = entryDetails(state.entries[key]);
    $("deleteDateLabel").textContent = new Intl.DateTimeFormat("fr-BE",{weekday:"long",day:"numeric",month:"long",year:"numeric"}).format(parseKey(key));
    $("deleteOccasion").textContent = e.occasion || "Non précisé";
    $("deleteDuration").textContent = (Number(e.hours)||0) + " h " + (Number(e.minutes)||0) + " min";
    $("deleteDialog").showModal();
  }
  $("cancelDeleteBtn").addEventListener("click", () => { $("deleteDialog").close(); pendingDeleteKey = null; });
  $("confirmDeleteBtn").addEventListener("click", () => {
    if (!pendingDeleteKey || !state.entries[pendingDeleteKey]) return;
    delete state.entries[pendingDeleteKey]; save(); $("deleteDialog").close(); pendingDeleteKey = null; render(); toast("Journée supprimée.");
  });
  function openEntryDialog(key) {
    pendingDateKey = key;
    $("entryDateLabel").textContent = new Intl.DateTimeFormat("fr-BE",{weekday:"long",day:"numeric",month:"long",year:"numeric"}).format(parseKey(key));
    $("occasionSelect").value = "Loisirs";
    $("durationHours").value = "2";
    $("durationMinutes").value = "0";
    $("entryMessage").textContent = "";
    $("entryDialog").showModal();
  }
  $("entryForm").addEventListener("submit", e => {
    e.preventDefault();
    if (!pendingDateKey) return;
    const hours = Number($("durationHours").value), minutes = Number($("durationMinutes").value);
    if (!Number.isInteger(hours) || hours < 0 || hours > 24 || !Number.isInteger(minutes) || minutes < 0 || minutes > 59 || (hours === 0 && minutes === 0)) {
      $("entryMessage").textContent = "Indique une durée valide supérieure à zéro."; return;
    }
    state.entries[pendingDateKey] = { occasion: $("occasionSelect").value, hours, minutes };
    save(); $("entryDialog").close(); pendingDateKey = null; render(); toast("Journée enregistrée.");
  });
  $("cancelEntryBtn").addEventListener("click", () => { $("entryDialog").close(); pendingDateKey = null; });
  function renderStats() {
    const keys=sortedKeys(), streak=streaks(), hours=keys.length*Number(state.hours);
    $("statsTotal").textContent=keys.length; $("bestStreak").textContent=streak.best; $("hoursTotal").textContent=hours.toLocaleString("fr-BE",{maximumFractionDigits:1})+" h";
    const year=new Date().getFullYear(), months=Array.from({length:12},(_,i)=>keys.filter(k=>k.startsWith(`${year}-${pad(i+1)}-`)).length), max=Math.max(1,...months);
    const labels=["Jan","Fév","Mar","Avr","Mai","Juin","Juil","Aoû","Sep","Oct","Nov","Déc"];
    $("monthlyBars").innerHTML=months.map((v,i)=>`<div class="bar-item"><span class="bar-value">${v||""}</span><div class="bar-track"><div class="bar-fill" style="height:${v/max*100}%"></div></div><span class="bar-month">${labels[i]}</span></div>`).join("");
    const levels=[1,10,30,50,100,200,365];
    $("badges").innerHTML=levels.map((n,i)=>`<div class="badge-item ${keys.length<n?"locked":""}"><span class="badge-icon">${["🌱","✨","🌿","⭐","🏅","💎","🏆"][i]}</span><div><strong>${n} jour${n>1?"s":""}</strong><span>${keys.length>=n?"Obtenu":"Encore "+(n-keys.length)}</span></div></div>`).join("");
  }
  function render() {
    renderCalendar(); renderStats(); applyAppearance();
    $("todayLabel").textContent=new Intl.DateTimeFormat("fr-BE",{weekday:"long",day:"numeric",month:"long"}).format(new Date());
  }
  document.querySelectorAll(".nav-button").forEach(btn=>btn.addEventListener("click",()=>{
    document.querySelectorAll(".nav-button").forEach(b=>b.classList.toggle("active",b===btn));
    document.querySelectorAll(".view").forEach(v=>v.classList.toggle("active",v.id===btn.dataset.view));
  }));
  $("prevMonth").addEventListener("click",()=>{shownDate.setMonth(shownDate.getMonth()-1);renderCalendar();});
  $("nextMonth").addEventListener("click",()=>{shownDate.setMonth(shownDate.getMonth()+1);renderCalendar();});
  $("themeSelect").addEventListener("change",e=>{state.theme=e.target.value;save();applyAppearance();});
  $("modeSelect").addEventListener("change",e=>{state.mode=e.target.value;save();applyAppearance();});
  $("hoursSelect").addEventListener("change",e=>{state.hours=Number(e.target.value);save();renderStats();});
  $("exportBtn").addEventListener("click",()=>{
    const blob=new Blob([JSON.stringify({app:"Lentilles",version:1,exportedAt:new Date().toISOString(),data:state},null,2)],{type:"application/json"});
    const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download="sauvegarde-lentilles.json";a.click();URL.revokeObjectURL(url);toast("Sauvegarde exportée.");
  });
  $("importFile").addEventListener("change",async e=>{
    const file=e.target.files[0];if(!file)return;
    try{const parsed=JSON.parse(await file.text()),incoming=parsed.data||parsed;
      if(!incoming||typeof incoming.entries!=="object"||Array.isArray(incoming.entries))throw new Error("format");
      state={...defaults,...incoming,entries:incoming.entries};save();render();$("settingsMessage").textContent="Sauvegarde importée avec succès.";toast("Sauvegarde importée.");
    }catch{$("settingsMessage").textContent="Fichier invalide. Choisis une sauvegarde JSON de l'application.";toast("Import impossible.");}
    e.target.value="";
  });
  $("clearBtn").addEventListener("click",()=>{
    if(!confirm("Effacer toutes les journées et les préférences enregistrées sur cet appareil pour ce compte ? Cette action est irréversible."))return;
    state={...defaults};save();render();$("settingsMessage").textContent="Les données locales ont été effacées.";toast("Données effacées.");
  });
  async function boot(){
    await initializeAccounts(); setupAuth();
    if(activeUser && getUsers().some(u=>u.username===activeUser.username && u.role===activeUser.role)) showApp(activeUser);
    else {sessionStorage.removeItem(SESSION_KEY);localStorage.removeItem(SESSION_KEY);showLogin();}
    if("serviceWorker" in navigator && location.protocol.startsWith("http")) navigator.serviceWorker.register("/service-worker.js").catch(()=>{});
  }
  boot();
})();