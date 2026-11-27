(() => {
  const SESSION_KEY = "lentilles-cloud-session-v1";
  const config = window.LENTILLES_SUPABASE_CONFIG;
  const supabase = window.supabase.createClient(config.url, config.anonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
  let activeUser = null;
  let cloudSyncBusy = false;
  let KEY = "lentilles-tracker-v1:locked";
  const defaults = { entries: {}, theme: "ocean", mode: "dark", hours: 12 };
  let state = loadState();
  let shownDate = new Date();
  const $ = (id) => document.getElementById(id);
  const pad = (n) => String(n).padStart(2, "0");
  const dateKey = (d) => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  const parseKey = (key) => { const [y,m,d] = key.split("-").map(Number); return new Date(y,m-1,d); };
  const sortedKeys = () => Object.keys(state.entries).filter(k => state.entries[k]).sort();
  function loadState() {
    try { return { ...defaults, ...JSON.parse(localStorage.getItem(KEY) || "{}") }; }
    catch { return { ...defaults }; }
  }
  function save() {
    localStorage.setItem(KEY, JSON.stringify(state));
    syncCloudEntries().catch(error => {
      console.error("Supabase sync:", error);
      $("settingsMessage").textContent = "Synchronisation impossible. Vérifie ta connexion.";
    });
  }
  async function syncCloudEntries() {
    if (!activeUser || cloudSyncBusy) return;
    cloudSyncBusy = true;
    try {
      const { data: existing, error } = await supabase.from("daily_entries").select("entry_date").eq("user_id", activeUser.id);
      if (error) throw error;
      const wanted = sortedKeys();
      const obsolete = (existing || []).filter(row => !wanted.includes(row.entry_date)).map(row => row.entry_date);
      if (obsolete.length) {
        const { error: deleteError } = await supabase.from("daily_entries").delete().eq("user_id", activeUser.id).in("entry_date", obsolete);
        if (deleteError) throw deleteError;
      }
      if (wanted.length) {
        const rows = wanted.map(entry_date => ({ user_id: activeUser.id, entry_date }));
        const { error: upsertError } = await supabase.from("daily_entries").upsert(rows, { onConflict: "user_id,entry_date" });
        if (upsertError) throw upsertError;
      }
    } finally { cloudSyncBusy = false; }
  }
  async function loadCloudUser(authUser) {
    const { data: profile, error: profileError } = await supabase.from("profiles").select("username,role").eq("id", authUser.id).single();
    if (profileError || !profile) throw profileError || new Error("Profil introuvable.");
    return { id: authUser.id, username: profile.username, role: profile.role };
  }
  async function showApp(user) {
    activeUser = user;
    KEY = "lentilles-tracker-v1:" + user.username;
    $("authScreen").hidden = true; $("appShell").hidden = false;
    $("userChip").textContent = user.role === "admin" ? "Admin · " + user.username : user.username;
    state = loadState();
    const { data: rows, error } = await supabase.from("daily_entries").select("entry_date").eq("user_id", user.id);
    if (error) throw error;
    if (!rows.length && sortedKeys().length) {
      await syncCloudEntries();
    } else {
      state.entries = Object.fromEntries(rows.map(row => [row.entry_date, true]));
      localStorage.setItem(KEY, JSON.stringify(state));
    }
    $("adminNav").hidden = user.role !== "admin";
    if (user.role === "admin") await renderAdmin();
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
    loginForm.addEventListener("submit", async e => {
      e.preventDefault();
      const username = $("loginUsername").value.trim().toLowerCase(), password = $("loginPassword").value;
      if (!/^[a-z0-9_-]{3,24}$/.test(username)) { $("authMessage").textContent = "Nom d'utilisateur ou mot de passe incorrect."; return; }
      const { error } = await supabase.auth.signInWithPassword({ email: username + "@users.lentilles.invalid", password });
      if (error) { $("authMessage").textContent = "Connexion impossible. Vérifie tes identifiants."; return; }
      try { const { data } = await supabase.auth.getUser(); await showApp(await loadCloudUser(data.user)); }
      catch (err) { $("authMessage").textContent = "Profil inaccessible : " + err.message; }
    });
    registerForm.addEventListener("submit", async e => {
      e.preventDefault();
      const username = $("registerUsername").value.trim().toLowerCase(), password = $("registerPassword").value;
      if (!/^[a-z0-9_-]{3,24}$/.test(username)) { $("authMessage").textContent = "Utilise 3 à 24 caractères : lettres, chiffres, _ ou -."; return; }
      if (password.length < 8) { $("authMessage").textContent = "Choisis un mot de passe d'au moins 8 caractères."; return; }
      const { data, error } = await supabase.auth.signUp({
        email: username + "@users.lentilles.invalid",
        password,
        options: { data: { username } }
      });
      if (error) { $("authMessage").textContent = error.message.includes("already") ? "Ce nom d'utilisateur est déjà pris." : "Inscription impossible : " + error.message; return; }
      if (!data.session) { $("authMessage").textContent = "Inscription reçue. L'administrateur doit désactiver la confirmation d'e-mail dans Supabase Auth pour ce mode de connexion par nom d'utilisateur."; return; }
      try { await showApp(await loadCloudUser(data.user)); }
      catch (err) { $("authMessage").textContent = "Compte créé, mais profil inaccessible : " + err.message; }
    });
    $("logoutBtn").addEventListener("click", async () => { await supabase.auth.signOut(); activeUser = null; location.reload(); });
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
      btn.addEventListener("click",()=>{ if(state.entries[key]) delete state.entries[key]; else state.entries[key]=true; save(); render(); });
      grid.append(btn);
    }
    const keys=sortedKeys(), monthPrefix=`${year}-${pad(month+1)}-`;
    $("totalDays").textContent=keys.length; $("monthDays").textContent=keys.filter(k=>k.startsWith(monthPrefix)).length;
    $("currentStreak").textContent=streaks().current;
  }
  function renderStats() {
    const keys=sortedKeys(), streak=streaks(), hours=keys.length*Number(state.hours);
    $("statsTotal").textContent=keys.length; $("bestStreak").textContent=streak.best; $("hoursTotal").textContent=hours.toLocaleString("fr-BE")+" h";
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
  async function renderAdmin() {
    const host = $("adminUsers");
    host.innerHTML = "<p class='muted'>Chargement des comptes…</p>";
    const { data: profiles, error } = await supabase.from("profiles").select("id,username,role,created_at").order("created_at", { ascending: false });
    if (error) { host.textContent = "Impossible de charger les utilisateurs : " + error.message; return; }
    if (!profiles.length) { host.textContent = "Aucun compte enregistré."; return; }
    host.innerHTML = "";
    for (const profile of profiles) {
      const { data: entries, error: entriesError } = await supabase.from("daily_entries").select("entry_date").eq("user_id", profile.id).order("entry_date", { ascending: false });
      const card = document.createElement("article");
      card.className = "admin-user-card";
      const heading = document.createElement("div");
      heading.className = "admin-user-heading";
      const name = document.createElement("strong");
      name.textContent = profile.username + (profile.role === "admin" ? " · Administrateur" : "");
      const count = document.createElement("span");
      count.textContent = entriesError ? "Calendrier indisponible" : (entries || []).length + " jour(s) enregistré(s)";
      heading.append(name, count);
      const dates = document.createElement("p");
      dates.className = "muted admin-dates";
      dates.textContent = entriesError ? entriesError.message : (entries || []).map(x => new Intl.DateTimeFormat("fr-BE").format(new Date(x.entry_date + "T12:00:00"))).join(" · ") || "Aucune journée enregistrée.";
      card.append(heading, dates);
      host.append(card);
    }
  }
  async function boot() {
    setupAuth();
    if (!config || !window.supabase) { showLogin(); $("authMessage").textContent = "Configuration Supabase manquante."; return; }
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      try { await showApp(await loadCloudUser(session.user)); }
      catch (error) { console.error(error); await supabase.auth.signOut(); showLogin(); }
    } else showLogin();
    if ("serviceWorker" in navigator && location.protocol.startsWith("http")) navigator.serviceWorker.register("/service-worker.js").catch(() => {});
  }
  boot();
})();