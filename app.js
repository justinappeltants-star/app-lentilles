(() => {
  const KEY = "lentilles-tracker-v1";
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
  function save() { localStorage.setItem(KEY, JSON.stringify(state)); }
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
    if(!confirm("Effacer toutes les journées et les préférences enregistrées sur cet appareil ? Cette action est irréversible."))return;
    state={...defaults};save();render();$("settingsMessage").textContent="Les données locales ont été effacées.";toast("Données effacées.");
  });
  if("serviceWorker" in navigator && location.protocol.startsWith("http")) navigator.serviceWorker.register("/service-worker.js").catch(()=>{});
  render();
})();