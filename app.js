
(function(){
"use strict";
var DEFAULT_STATE = {"v":1,"cotizacionUSD":0,"accounts":[{"id":"arq","name":"ARQ","currency":"ARS","initial":0},{"id":"provincia","name":"Banco Provincia","currency":"ARS","initial":0},{"id":"galicia","name":"Banco Galicia","currency":"ARS","initial":0},{"id":"personalpay","name":"Personal Pay","currency":"ARS","initial":0},{"id":"mp","name":"Mercado Pago","currency":"ARS","initial":0},{"id":"mpreservas","name":"Mercado Pago Reservas","currency":"ARS","initial":0},{"id":"claropay","name":"Claro Pay","currency":"ARS","initial":0},{"id":"astropay","name":"AstroPay","currency":"ARS","initial":0},{"id":"paypal","name":"PayPal","currency":"ARS","initial":0},{"id":"efectivo","name":"Efectivo","currency":"ARS","initial":0}],"categories":[{"id":"combustible","name":"Combustible","group":"Auto"},{"id":"peajes","name":"Peajes","group":"Auto"},{"id":"mantenimiento","name":"Service y repuestos","group":"Auto"},{"id":"seguro","name":"Seguro del auto","group":"Auto"},{"id":"patente","name":"Patente","group":"Auto"},{"id":"estacionamiento","name":"Estacionamiento","group":"Auto"},{"id":"lavado","name":"Lavado","group":"Auto"},{"id":"alquiler","name":"Alquiler y expensas","group":"Hogar"},{"id":"servicios","name":"Luz, gas, agua, internet","group":"Hogar"},{"id":"super","name":"Supermercado","group":"Hogar"},{"id":"comida","name":"Comida afuera y delivery","group":"Personal"},{"id":"salud","name":"Salud","group":"Personal"},{"id":"ropa","name":"Ropa","group":"Personal"},{"id":"celular","name":"Celular","group":"Personal"},{"id":"transporte","name":"Transporte público y apps","group":"Personal"},{"id":"suscripciones","name":"Software y suscripciones","group":"Trabajo"},{"id":"equipos","name":"Equipos","group":"Trabajo"},{"id":"diezmo","name":"Diezmo y ofrendas","group":"Iglesia"},{"id":"ministerio","name":"Gastos de ministerio","group":"Iglesia"},{"id":"impuestos","name":"Impuestos y monotributo","group":"Otros"},{"id":"comisiones","name":"Comisiones bancarias","group":"Otros"},{"id":"otros","name":"Otros","group":"Otros"}],"clients":[{"id":"exodo","name":"Exodo Led","amount":2000000,"conditional":false},{"id":"ceramico","name":"Centro del Cerámico","amount":405000,"conditional":false},{"id":"victoria","name":"La Victoria","amount":450000,"conditional":false},{"id":"grafikka","name":"La Grafikka","amount":400000,"conditional":false},{"id":"gloria","name":"Gloria Lema","amount":200000,"conditional":false},{"id":"lraudio","name":"LR Audio","amount":150000,"conditional":false},{"id":"premioexodo","name":"Premio por meta Exodo Led","amount":500000,"conditional":true}],"movements":[]};
var S = null;
var TABS = [["resumen","Resumen"],["movimientos","Movimientos"],["cuentas","Cuentas"],["ingresos","Ingresos"]];
var ui = {screen:"loading", tab:"resumen", month:todayISO().slice(0,7), modal:null, fType:"", fAcc:"", toast:"", authMode:"login", authMsg:"", authErr:false, busy:false};
var h = (location.hash||"").replace("#","");
if(TABS.some(function(t){return t[0]===h;})) ui.tab = h;

/* ---------- utilidades ---------- */
function todayISO(){ var d=new Date(); return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0"); }
function uid(){ return Date.now().toString(36)+Math.random().toString(36).slice(2,6); }
function esc(s){ return String(s==null?"":s).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c];}); }
function fmt(n,cur){ return new Intl.NumberFormat("es-AR",{style:"currency",currency:cur||"ARS",maximumFractionDigits:0}).format(Math.round(n||0)); }
function parseMonto(s){ s=String(s||"").replace(/[\s$]/g,"").replace(/US/i,""); if(!s) return NaN; if(s.indexOf(",")>-1){ s=s.replace(/\./g,"").replace(",","."); } else if(/^\d{1,3}(\.\d{3})+$/.test(s)){ s=s.replace(/\./g,""); } return Number(s); }
function monthLabel(k){ var p=k.split("-"); var t=new Intl.DateTimeFormat("es-AR",{month:"long",year:"numeric"}).format(new Date(+p[0],+p[1]-1,1)); return t.charAt(0).toUpperCase()+t.slice(1); }
function monthShort(k){ var p=k.split("-"); return new Intl.DateTimeFormat("es-AR",{month:"short"}).format(new Date(+p[0],+p[1]-1,1)).replace(".",""); }
function shiftMonth(k,d){ var p=k.split("-"); var dt=new Date(+p[0],+p[1]-1+d,1); return dt.getFullYear()+"-"+String(dt.getMonth()+1).padStart(2,"0"); }
function dateLabel(iso){ var p=iso.split("-"); return p[2]+"/"+p[1]; }
function acc(id){ return S.accounts.find(function(a){return a.id===id;}); }
function cat(id){ return S.categories.find(function(c){return c.id===id;}); }
function client(id){ return S.clients.find(function(c){return c.id===id;}); }
function accName(id){ var a=acc(id); return a?a.name:"(cuenta borrada)"; }
function toARS(amount, accId){ var a=acc(accId); if(a && a.currency==="USD") return amount*(S.cotizacionUSD||0); return amount; }
function balance(id){
  var a=acc(id); var b=a?(a.initial||0):0;
  S.movements.forEach(function(m){
    if(m.type==="ingreso" && m.account===id) b+=m.amount;
    else if(m.type==="gasto" && m.account===id) b-=m.amount;
    else if(m.type==="ajuste" && m.account===id) b+=m.amount;
    else if(m.type==="transfer"){ if(m.account===id) b-=m.amount; if(m.toAccount===id) b+=(m.amountTo!=null?m.amountTo:m.amount); }
  });
  return b;
}
function totalARS(){ return S.accounts.reduce(function(s,a){ return s+toARS(balance(a.id),a.id); },0); }
function inMonth(k){ return S.movements.filter(function(m){ return m.date.slice(0,7)===k; }); }
function monthStats(k){
  var ms=inMonth(k), inc=0, out=0, byCat={};
  ms.forEach(function(m){
    var v=toARS(m.amount,m.account);
    if(m.type==="ingreso") inc+=v;
    if(m.type==="gasto"){ out+=v; byCat[m.category]=(byCat[m.category]||0)+v; }
  });
  return {inc:inc,out:out,byCat:byCat,count:ms.length};
}
function clientPayment(cid,k){ return S.movements.find(function(m){ return m.type==="ingreso" && m.clientId===cid && m.period===k; }); }
function expected(){ var f=0,c=0; S.clients.forEach(function(x){ if(x.conditional) c+=x.amount; else f+=x.amount; }); return {fijo:f,cond:c}; }
function groups(){ var g=[]; S.categories.forEach(function(c){ if(g.indexOf(c.group)<0) g.push(c.group); }); return g; }

/* ---------- sincronización (Supabase) ---------- */
var CFG = window.FIN_CONFIG || {};
var SB = null, USER = null;
var sync = {state:"", dirty:false, timer:null, remoteAt:null};
function clone(o){ return JSON.parse(JSON.stringify(o)); }
function normalize(s){
  s = s && typeof s==="object" ? s : clone(DEFAULT_STATE);
  ["accounts","categories","clients","movements"].forEach(function(k){ if(!Array.isArray(s[k])) s[k]=clone(DEFAULT_STATE[k]); });
  if(typeof s.cotizacionUSD!=="number") s.cotizacionUSD=0;
  return s;
}
function cfgGet(){
  var u=CFG.supabaseUrl, k=CFG.supabaseAnonKey;
  if(!u||!k){ try{ var c=JSON.parse(localStorage.getItem("fin-config")||"null"); if(c){ u=c.url; k=c.key; } }catch(e){} }
  return (u&&k)?{url:u.trim().replace(/\/+$/,""),key:k.trim()}:null;
}
function lsKey(){ return "fin-state-"+(USER?USER.id:"anon"); }
function saveLocal(){ try{ localStorage.setItem(lsKey(), JSON.stringify({S:S,dirty:sync.dirty,remoteAt:sync.remoteAt})); }catch(e){} }
function loadLocal(){ try{ return JSON.parse(localStorage.getItem(lsKey())||"null"); }catch(e){ return null; } }
function commit(msg){
  sync.dirty=true; saveLocal(); render(); if(msg) toast(msg);
  clearTimeout(sync.timer); sync.timer=setTimeout(push,600);
}
function setSync(st){ sync.state=st; renderStatus(); }
function push(){
  if(!SB||!USER) return;
  if(!navigator.onLine){ setSync("offline"); return; }
  setSync("saving");
  var at=new Date().toISOString();
  SB.from("finanzas").upsert({user_id:USER.id,data:S,updated_at:at}).then(function(r){
    if(r.error){ setSync("error"); toast("No se pudo sincronizar: "+r.error.message); return; }
    sync.dirty=false; sync.remoteAt=at; saveLocal(); setSync("ok");
  },function(){ setSync("offline"); });
}
function pull(){
  if(!SB||!USER) return;
  if(!navigator.onLine){ setSync(sync.dirty?"offline":"offline"); return; }
  SB.from("finanzas").select("data,updated_at").eq("user_id",USER.id).maybeSingle().then(function(r){
    if(r.error){ setSync("error"); toast("No se pudo leer tus datos: "+r.error.message); return; }
    if(!r.data || sync.dirty){ push(); return; }
    if(r.data.updated_at!==sync.remoteAt){
      S=normalize(r.data.data); sync.remoteAt=r.data.updated_at; saveLocal();
      if(!ui.modal) render();
    }
    setSync("ok");
  },function(){ setSync("offline"); });
}
function startUser(u){
  USER={id:u.id,email:u.email};
  try{ localStorage.setItem("fin-last-user", JSON.stringify(USER)); }catch(e){}
  var l=loadLocal();
  if(l&&l.S){ S=normalize(l.S); sync.dirty=!!l.dirty; sync.remoteAt=l.remoteAt||null; }
  else { S=clone(DEFAULT_STATE); sync.dirty=false; sync.remoteAt=null; }
  try{ var m=localStorage.getItem("fin-month"); if(m) ui.month=m; }catch(e){}
  ui.screen="app"; render(); pull();
}
function lastUser(){ try{ return JSON.parse(localStorage.getItem("fin-last-user")||"null"); }catch(e){ return null; } }
function boot(){
  var c=cfgGet();
  if(!c){ ui.screen="setup"; render(); return; }
  if(!window.supabase||!window.supabase.createClient){ ui.screen="setup"; ui.authMsg="No se pudo cargar la librería de sincronización. Revisá tu conexión a internet y volvé a abrir la app."; ui.authErr=true; render(); return; }
  SB=window.supabase.createClient(c.url,c.key,{auth:{persistSession:true,autoRefreshToken:true,storageKey:"fin-auth"}});
  SB.auth.onAuthStateChange(function(ev,session){
    if(ev==="SIGNED_OUT"){ USER=null; S=null; ui.screen="login"; ui.modal=null; render(); }
    else if(session && (!USER || USER.id!==session.user.id) && (ev==="SIGNED_IN"||ev==="INITIAL_SESSION")) startUser(session.user);
  });
  SB.auth.getSession().then(function(r){
    var s=r&&r.data&&r.data.session;
    if(s){ if(!USER) startUser(s.user); }
    else if(!navigator.onLine && lastUser()){ startUser(lastUser()); }
    else if(!USER){ ui.screen="login"; render(); }
  },function(){ var lu=lastUser(); if(lu) startUser(lu); else { ui.screen="login"; render(); } });
}
window.addEventListener("online",function(){ if(sync.dirty) push(); else pull(); });
window.addEventListener("offline",function(){ setSync("offline"); });
document.addEventListener("visibilitychange",function(){ if(document.visibilityState==="visible"&&USER){ if(sync.dirty) push(); else pull(); } });
function statusText(){
  return {ok:"Sincronizado",saving:"Guardando…",offline:sync.dirty?"Sin conexión · se guarda al volver":"Sin conexión",error:"Error al sincronizar",
    "":"Conectando…"}[sync.state];
}
function renderStatus(){ var el=document.getElementById("syncstate"); if(el){ el.textContent=statusText(); el.className="savestate "+sync.state; } }
var tt=null;
function toast(t){ ui.toast=t; renderToast(); clearTimeout(tt); tt=setTimeout(function(){ ui.toast=""; renderToast(); },2200); }
function renderToast(){ var el=document.getElementById("toast"); if(!el) return; el.innerHTML=ui.toast?"<div class=\"toast\" role=\"status\">"+esc(ui.toast)+"</div>":""; }

/* ---------- vistas ---------- */
function render(){
  var app=document.getElementById("app");
  if(ui.screen!=="app"){ app.innerHTML=viewAuth()+"<div id=\"toast\"></div>"; renderToast(); var af=document.querySelector("[autofocus]"); if(af) af.focus(); return; }
  var html="<div class=\"wrap\">";
  html+="<header class=\"top\"><div class=\"brand\"><h1>Mis Finanzas</h1><p>Pesos argentinos · <span id=\"syncstate\" class=\"savestate "+sync.state+"\">"+esc(statusText())+"</span></p></div>";
  html+="<div class=\"monthnav\"><button data-act=\"prev\" aria-label=\"Mes anterior\">‹</button><span>"+esc(monthLabel(ui.month))+"</span><button data-act=\"next\" aria-label=\"Mes siguiente\">›</button></div>";
  html+="<div class=\"actions\"><button class=\"btn primary\" data-act=\"new\" data-type=\"gasto\">+ Gasto</button><button class=\"btn\" data-act=\"new\" data-type=\"ingreso\">+ Ingreso</button><button class=\"btn\" data-act=\"new\" data-type=\"transfer\">Transferir</button><button class=\"iconbtn\" data-act=\"settings\" aria-label=\"Ajustes\" title=\"Ajustes\">⚙</button></div></header>";
  html+="<nav class=\"tabs\">"+TABS.map(function(t){ return "<a href=\"#"+t[0]+"\" "+(ui.tab===t[0]?"aria-current=\"page\"":"")+">"+t[1]+"</a>"; }).join("")+"</nav>";
  if(ui.tab==="resumen") html+=viewResumen();
  if(ui.tab==="movimientos") html+=viewMovs();
  if(ui.tab==="cuentas") html+=viewCuentas();
  if(ui.tab==="ingresos") html+=viewIngresos();
  html+="</div><nav class=\"bottombar\" aria-label=\"Acciones rápidas\"><button class=\"btn primary\" data-act=\"new\" data-type=\"gasto\">+ Gasto</button><button class=\"btn\" data-act=\"new\" data-type=\"ingreso\">+ Ingreso</button><button class=\"btn\" data-act=\"new\" data-type=\"transfer\">Transferir</button><button class=\"iconbtn\" data-act=\"settings\" aria-label=\"Ajustes\">⚙</button></nav><div id=\"modal\">"+(ui.modal?viewModal():"")+"</div><div id=\"toast\"></div>";
  app.innerHTML=html; renderToast();
  if(ui.modal){ var f=document.querySelector(".modal [autofocus]"); if(f) f.focus(); }
}

function viewResumen(){
  var st=monthStats(ui.month), ex=expected(), tot=totalARS();
  var cobrado=0; S.clients.forEach(function(c){ var p=clientPayment(c.id,ui.month); if(p) cobrado+=toARS(p.amount,p.account); });
  var pct=ex.fijo?Math.min(100,cobrado/ex.fijo*100):0;
  var res=st.inc-st.out;
  var noBal=S.accounts.every(function(a){ return balance(a.id)===0; });
  var h="";
  if(noBal) h+="<div class=\"banner\">Primer paso: en <a href=\"#cuentas\">Cuentas</a>, tocá <b>Ajustar saldo</b> en cada una y cargá lo que tenés hoy (incluido el efectivo). Desde ahí, cada gasto e ingreso actualiza los saldos solo.</div>";
  h+="<section class=\"tiles\">";
  h+="<div class=\"tile hero\"><div class=\"lbl\">Disponible en todas las cuentas</div><div class=\"big num\">"+fmt(tot)+"</div><div class=\"sub\">"+S.accounts.length+" cuentas · efectivo incluido</div></div>";
  h+="<div class=\"tile\"><div class=\"lbl\">Cobrado de clientes este mes</div><div class=\"big num\">"+fmt(cobrado)+"</div><div class=\"sub num\">de "+fmt(ex.fijo)+" fijos"+(ex.cond?" + "+fmt(ex.cond)+" condicional":"")+"</div><div class=\"bar good\"><i style=\"width:"+pct.toFixed(1)+"%\"></i></div></div>";
  h+="<div class=\"tile\"><div class=\"lbl\">Gastos del mes</div><div class=\"big num neg\">"+fmt(st.out)+"</div><div class=\"sub\">"+(st.inc?Math.round(st.out/st.inc*100)+"% de lo que entró":"Sin ingresos registrados aún")+"</div></div>";
  h+="<div class=\"tile\"><div class=\"lbl\">Resultado del mes</div><div class=\"big num "+(res>=0?"pos":"neg")+"\">"+(res>0?"+":"")+fmt(res)+"</div><div class=\"sub num\">Ingresos "+fmt(st.inc)+"</div></div>";
  h+="</section><div class=\"grid\">";

  // ingresos del mes
  h+="<div class=\"card\"><h2>Ingresos de "+esc(monthLabel(ui.month).split(" ")[0].toLowerCase())+" <small><a href=\"#ingresos\">Ver todo</a></small></h2><div class=\"rows\">";
  S.clients.forEach(function(c){
    var p=clientPayment(c.id,ui.month);
    h+="<div class=\"row\"><div class=\"grow\"><div class=\"name\">"+esc(c.name)+"</div><div class=\"meta\">"+(p?"Cobrado el "+dateLabel(p.date)+" en "+esc(accName(p.account)):(c.conditional?"Condicional a la meta":"Pendiente"))+"</div></div><div class=\"amt num\">"+fmt(p?p.amount:c.amount, p?(acc(p.account)||{}).currency:"ARS")+"</div>"+(p?"<span class=\"pill good\">Cobrado</span>":"<button class=\"btn small\" data-act=\"cobrar\" data-id=\""+c.id+"\">Cobrar</button>")+"</div>";
  });
  h+="</div></div>";

  // gastos por categoría
  h+="<div class=\"card\"><h2>Gastos por categoría <small class=\"num\">"+fmt(st.out)+"</small></h2>";
  var max=0; Object.keys(st.byCat).forEach(function(k){ max=Math.max(max,st.byCat[k]); });
  if(!st.out) h+="<p class=\"empty\">Todavía no registraste gastos en "+esc(monthLabel(ui.month))+".</p>";
  groups().forEach(function(g){
    var cats=S.categories.filter(function(c){ return c.group===g && st.byCat[c.id]; });
    if(!cats.length) return;
    var gt=cats.reduce(function(s,c){ return s+st.byCat[c.id]; },0);
    h+="<div class=\"grouphead\">"+esc(g)+" · <span class=\"num\">"+fmt(gt)+"</span></div>";
    cats.sort(function(a,b){ return st.byCat[b.id]-st.byCat[a.id]; }).forEach(function(c){
      h+="<div class=\"catbar"+(g==="Auto"?" auto":"")+"\"><span>"+esc(c.name)+"</span><div class=\"track\"><i style=\"width:"+(st.byCat[c.id]/max*100).toFixed(1)+"%\"></i></div><span class=\"num\">"+fmt(st.byCat[c.id])+"</span></div>";
    });
  });
  h+="</div>";

  // auto
  var autoCats=S.categories.filter(function(c){ return c.group==="Auto"; });
  var autoTot=autoCats.reduce(function(s,c){ return s+(st.byCat[c.id]||0); },0);
  var prev3=0; for(var i=1;i<=3;i++){ var s2=monthStats(shiftMonth(ui.month,-i)); autoCats.forEach(function(c){ prev3+=(s2.byCat[c.id]||0); }); }
  h+="<div class=\"card\"><h2>Auto <small class=\"num\">"+fmt(autoTot)+" este mes</small></h2><div class=\"rows\">";
  autoCats.forEach(function(c){ h+="<div class=\"row\"><div class=\"grow\">"+esc(c.name)+"</div><div class=\"amt num\">"+fmt(st.byCat[c.id]||0)+"</div><button class=\"btn small ghost\" data-act=\"new\" data-type=\"gasto\" data-cat=\""+c.id+"\" aria-label=\"Cargar "+esc(c.name)+"\">+</button></div>"; });
  h+="</div><p class=\"meta\" style=\"color:var(--muted);font-size:13px;margin:10px 0 0\">Promedio de los 3 meses anteriores: <b class=\"num\">"+fmt(prev3/3)+"</b> por mes</p></div>";

  // saldos
  var accs=S.accounts.slice().sort(function(a,b){ return toARS(balance(b.id),b.id)-toARS(balance(a.id),a.id); });
  h+="<div class=\"card\"><h2>Saldos por cuenta <small><a href=\"#cuentas\">Ajustar</a></small></h2><div class=\"rows\">";
  accs.forEach(function(a){ var b=balance(a.id); h+="<div class=\"row\"><div class=\"grow\"><div class=\"name\">"+esc(a.name)+"</div>"+(a.currency==="USD"?"<div class=\"meta num\">≈ "+fmt(toARS(b,a.id))+"</div>":"")+"</div><div class=\"amt num"+(b<0?" neg":"")+"\">"+fmt(b,a.currency)+"</div></div>"; });
  h+="</div></div>";

  // 6 meses
  var months=[]; for(var j=5;j>=0;j--) months.push(shiftMonth(ui.month,-j));
  var data=months.map(function(k){ return monthStats(k); });
  var mx=Math.max.apply(null,data.map(function(d){ return Math.max(d.inc,d.out); }).concat([1]));
  h+="<div class=\"card\"><h2>Últimos 6 meses <small class=\"num\">máx. "+fmt(mx)+"</small></h2><div class=\"chart\" role=\"img\" aria-label=\"Ingresos y gastos de los últimos seis meses\">";
  data.forEach(function(d,ix){ h+="<div class=\"col\" title=\""+esc(monthLabel(months[ix]))+": ingresos "+fmt(d.inc)+", gastos "+fmt(d.out)+"\"><div class=\"pair\"><i class=\"in\" style=\"height:"+(d.inc/mx*100).toFixed(1)+"%\"></i><i class=\"out\" style=\"height:"+(d.out/mx*100).toFixed(1)+"%\"></i></div></div>"; });
  h+="</div><div class=\"chart-labels\">"+months.map(function(k){ return "<span>"+esc(monthShort(k))+"</span>"; }).join("")+"</div><div class=\"legend\"><span><b style=\"background:var(--good)\"></b>Ingresos</span><span><b style=\"background:var(--bad)\"></b>Gastos</span></div></div>";

  // últimos
  var last=S.movements.slice().sort(sortMov).slice(0,8);
  h+="<div class=\"card\"><h2>Últimos movimientos <small><a href=\"#movimientos\">Ver todos</a></small></h2><div class=\"rows\">";
  if(!last.length) h+="<p class=\"empty\">Cuando cargues un gasto o un cobro, aparece acá.</p>";
  last.forEach(function(m){ h+=movRow(m); });
  h+="</div></div></div>";
  return h;
}
function sortMov(a,b){ return a.date<b.date?1:a.date>b.date?-1:(b.ts||0)-(a.ts||0); }
function movDesc(m){
  if(m.type==="transfer") return accName(m.account)+" → "+accName(m.toAccount);
  if(m.type==="ajuste") return "Ajuste de saldo";
  if(m.clientId){ var c=client(m.clientId); return c?c.name:"Cliente"; }
  if(m.type==="ingreso") return m.note||"Ingreso";
  var c2=cat(m.category); return c2?c2.name:"Gasto";
}
function movSigned(m){
  var cur=(acc(m.account)||{}).currency;
  if(m.type==="ingreso") return "<span class=\"pos\">+"+fmt(m.amount,cur)+"</span>";
  if(m.type==="gasto") return "<span class=\"neg\">−"+fmt(m.amount,cur)+"</span>";
  if(m.type==="ajuste") return "<span class=\""+(m.amount>=0?"pos":"neg")+"\">"+(m.amount>=0?"+":"−")+fmt(Math.abs(m.amount),cur)+"</span>";
  return "<span>"+fmt(m.amount,cur)+"</span>";
}
function movRow(m){
  var meta=dateLabel(m.date)+" · "+(m.type==="transfer"?"Transferencia":esc(accName(m.account)))+(m.note&&m.type!=="ingreso"?" · "+esc(m.note):"")+(m.clientId&&m.note?" · "+esc(m.note):"");
  return "<div class=\"row\"><div class=\"grow\"><div class=\"name\">"+esc(movDesc(m))+"</div><div class=\"meta\">"+meta+"</div></div><div class=\"amt num\">"+movSigned(m)+"</div><button class=\"btn small ghost\" data-act=\"edit\" data-id=\""+m.id+"\">Editar</button></div>";
}

function viewMovs(){
  var ms=inMonth(ui.month).filter(function(m){ return (!ui.fType||m.type===ui.fType)&&(!ui.fAcc||m.account===ui.fAcc||m.toAccount===ui.fAcc); }).sort(sortMov);
  var h="<div class=\"filters\"><select id=\"fType\" aria-label=\"Tipo\"><option value=\"\">Todos los tipos</option>"+[["gasto","Gastos"],["ingreso","Ingresos"],["transfer","Transferencias"],["ajuste","Ajustes"]].map(function(o){ return "<option value=\""+o[0]+"\""+(ui.fType===o[0]?" selected":"")+">"+o[1]+"</option>"; }).join("")+"</select>";
  h+="<select id=\"fAcc\" aria-label=\"Cuenta\"><option value=\"\">Todas las cuentas</option>"+S.accounts.map(function(a){ return "<option value=\""+a.id+"\""+(ui.fAcc===a.id?" selected":"")+">"+esc(a.name)+"</option>"; }).join("")+"</select>";
  h+="<span style=\"flex:1\"></span><button class=\"btn small\" data-act=\"csv\">Copiar como CSV</button></div>";
  h+="<div class=\"tablewrap\"><table><thead><tr><th>Fecha</th><th>Concepto</th><th>Cuenta</th><th>Nota</th><th class=\"r\">Monto</th><th></th></tr></thead><tbody>";
  if(!ms.length) h+="<tr><td colspan=\"6\" class=\"empty\">No hay movimientos en "+esc(monthLabel(ui.month))+" con estos filtros.</td></tr>";
  ms.forEach(function(m){
    var cg=m.type==="gasto"&&cat(m.category)?cat(m.category).group:(m.type==="ingreso"?"Ingreso":m.type==="transfer"?"Transferencia":"Ajuste");
    h+="<tr><td class=\"num\">"+dateLabel(m.date)+"</td><td><b>"+esc(movDesc(m))+"</b><br><span class=\"pill\">"+esc(cg)+"</span></td><td>"+esc(m.type==="transfer"?accName(m.account)+" → "+accName(m.toAccount):accName(m.account))+"</td><td>"+esc(m.note||"")+"</td><td class=\"r num\">"+movSigned(m)+"</td><td class=\"r\"><button class=\"btn small ghost\" data-act=\"edit\" data-id=\""+m.id+"\">Editar</button></td></tr>";
  });
  h+="</tbody></table></div>";
  var st=monthStats(ui.month);
  h+="<p class=\"num\" style=\"color:var(--muted);font-size:13px\">"+st.count+" movimientos en el mes · Ingresos "+fmt(st.inc)+" · Gastos "+fmt(st.out)+"</p>";
  return h;
}

function viewCuentas(){
  var h="<section class=\"tiles\"><div class=\"tile hero\"><div class=\"lbl\">Total disponible</div><div class=\"big num\">"+fmt(totalARS())+"</div><div class=\"sub\">"+(S.accounts.some(function(a){return a.currency==="USD";})?"Dólares convertidos a "+fmt(S.cotizacionUSD)+" por US$1":"Todas las cuentas en pesos")+"</div></div></section>";
  h+="<div class=\"acc-grid\">";
  S.accounts.forEach(function(a){
    var b=balance(a.id);
    h+="<div class=\"acc\"><div class=\"top\"><b>"+esc(a.name)+"</b><span class=\"pill"+(a.currency==="USD"?" acc":"")+"\">"+a.currency+"</span></div><div class=\"bal num"+(b<0?" neg":"")+"\">"+fmt(b,a.currency)+"</div>"+(a.currency==="USD"?"<div class=\"meta num\" style=\"color:var(--muted);font-size:13px\">≈ "+fmt(toARS(b,a.id))+"</div>":"")+"<div class=\"btns\"><button class=\"btn small\" data-act=\"ajuste\" data-id=\""+a.id+"\">Ajustar saldo</button><button class=\"btn small ghost\" data-act=\"editacc\" data-id=\""+a.id+"\">Editar</button></div></div>";
  });
  h+="<button class=\"acc\" style=\"align-items:center;justify-content:center;border-style:dashed;color:var(--muted);font-weight:600;min-height:140px\" data-act=\"newacc\">+ Agregar cuenta</button></div>";
  h+="<div class=\"card\" style=\"margin-top:16px\"><h2>Cotización del dólar</h2><p style=\"margin:0 0 10px;color:var(--muted);font-size:14px\">Si marcás PayPal, AstroPay u otra cuenta en dólares, el total se calcula con este valor.</p><div class=\"filters\"><label for=\"cot\">US$1 =</label><input id=\"cot\" type=\"text\" inputmode=\"decimal\" value=\""+(S.cotizacionUSD||"")+"\" placeholder=\"Ej: 1450\" style=\"width:140px\"><button class=\"btn small\" data-act=\"savecot\">Guardar</button></div></div>";
  return h;
}

function viewIngresos(){
  var ex=expected();
  var h="<section class=\"tiles\"><div class=\"tile\"><div class=\"lbl\">Ingresos fijos por mes</div><div class=\"big num\">"+fmt(ex.fijo)+"</div><div class=\"sub\">"+S.clients.filter(function(c){return !c.conditional;}).length+" clientes</div></div>";
  h+="<div class=\"tile\"><div class=\"lbl\">Con premios condicionales</div><div class=\"big num\">"+fmt(ex.fijo+ex.cond)+"</div><div class=\"sub num\">+"+fmt(ex.cond)+" si se cumplen las metas</div></div>";
  var cob=0, pend=0; S.clients.forEach(function(c){ var p=clientPayment(c.id,ui.month); if(p) cob+=toARS(p.amount,p.account); else if(!c.conditional) pend+=c.amount; });
  h+="<div class=\"tile\"><div class=\"lbl\">Falta cobrar en "+esc(monthLabel(ui.month).split(" ")[0].toLowerCase())+"</div><div class=\"big num "+(pend?"":"pos")+"\">"+fmt(pend)+"</div><div class=\"sub num\">Cobrado: "+fmt(cob)+"</div></div></section>";
  h+="<div class=\"tablewrap\"><table><thead><tr><th>Cliente</th><th class=\"r\">Monto mensual</th><th>Tipo</th><th>"+esc(monthLabel(ui.month))+"</th><th></th></tr></thead><tbody>";
  S.clients.forEach(function(c){
    var p=clientPayment(c.id,ui.month);
    h+="<tr><td><b>"+esc(c.name)+"</b></td><td class=\"r num\">"+fmt(c.amount)+"</td><td>"+(c.conditional?"<span class=\"pill warn\">Condicional</span>":"<span class=\"pill\">Fijo</span>")+"</td><td>"+(p?"<span class=\"pill good\">Cobrado "+dateLabel(p.date)+"</span> <span class=\"num\" style=\"color:var(--muted);font-size:13px\">"+fmt(p.amount,(acc(p.account)||{}).currency)+" · "+esc(accName(p.account))+"</span>":"<button class=\"btn small primary\" data-act=\"cobrar\" data-id=\""+c.id+"\">Registrar cobro</button>")+"</td><td class=\"r\">"+(p?"<button class=\"btn small ghost\" data-act=\"edit\" data-id=\""+p.id+"\">Ver cobro</button>":"")+"<button class=\"btn small ghost\" data-act=\"editcli\" data-id=\""+c.id+"\">Editar</button></td></tr>";
  });
  h+="</tbody></table></div><div style=\"margin-top:12px\"><button class=\"btn\" data-act=\"newcli\">+ Agregar cliente</button></div>";
  // otros ingresos del mes
  var others=inMonth(ui.month).filter(function(m){ return m.type==="ingreso"&&!m.clientId; });
  if(others.length){ h+="<div class=\"card\" style=\"margin-top:16px\"><h2>Otros ingresos del mes</h2><div class=\"rows\">"+others.sort(sortMov).map(movRow).join("")+"</div></div>"; }
  return h;
}

/* ---------- modales ---------- */
function accOptions(sel){ return S.accounts.map(function(a){ return "<option value=\""+a.id+"\""+(a.id===sel?" selected":"")+">"+esc(a.name)+(a.currency==="USD"?" (US$)":"")+"</option>"; }).join(""); }
function catOptions(sel){ return groups().map(function(g){ return "<optgroup label=\""+esc(g)+"\">"+S.categories.filter(function(c){return c.group===g;}).map(function(c){ return "<option value=\""+c.id+"\""+(c.id===sel?" selected":"")+">"+esc(c.name)+"</option>"; }).join("")+"</optgroup>"; }).join(""); }
function montoStr(n){ return n==null||n===""?"":new Intl.NumberFormat("es-AR",{maximumFractionDigits:2}).format(n); }

function viewModal(){
  var M=ui.modal, h="<div class=\"modal-bg\" data-act=\"closebg\"><div class=\"modal\" role=\"dialog\" aria-modal=\"true\" aria-labelledby=\"mt\">";
  if(M.kind==="mov"){
    var m=M.data, t=m.type;
    var titles={gasto:"Gasto",ingreso:"Ingreso",transfer:"Transferencia",ajuste:"Ajuste de saldo"};
    h+="<h3 id=\"mt\">"+(M.edit?"Editar ":"Nuevo ")+titles[t].toLowerCase()+"</h3>";
    if(t!=="ajuste") h+="<div class=\"seg\" role=\"group\" aria-label=\"Tipo\">"+["gasto","ingreso","transfer"].map(function(x){ return "<button type=\"button\" data-act=\"settype\" data-type=\""+x+"\" aria-pressed=\""+(t===x)+"\">"+titles[x]+"</button>"; }).join("")+"</div>";
    h+="<form id=\"fmov\"><div class=\"two\"><div class=\"field\"><label for=\"m_amount\">Monto"+(t==="ajuste"?" (positivo o negativo)":"")+"</label><input id=\"m_amount\" type=\"text\" inputmode=\"decimal\" required autofocus value=\""+esc(montoStr(m.amount))+"\" placeholder=\"Ej: 25.000\"></div><div class=\"field\"><label for=\"m_date\">Fecha</label><input id=\"m_date\" type=\"date\" required value=\""+esc(m.date)+"\"></div></div>";
    h+="<div class=\"field\"><label for=\"m_acc\">"+(t==="transfer"?"Desde":t==="ingreso"?"Entra en":"Cuenta")+"</label><select id=\"m_acc\">"+accOptions(m.account)+"</select></div>";
    if(t==="transfer"){
      h+="<div class=\"field\"><label for=\"m_to\">Hacia</label><select id=\"m_to\">"+accOptions(m.toAccount)+"</select></div>";
      h+="<div class=\"field\"><label for=\"m_amountTo\">Monto que llega (solo si cambia la moneda)</label><input id=\"m_amountTo\" type=\"text\" inputmode=\"decimal\" value=\""+esc(montoStr(m.amountTo))+"\" placeholder=\"Igual al monto\"></div>";
    }
    if(t==="gasto") h+="<div class=\"field\"><label for=\"m_cat\">Categoría</label><select id=\"m_cat\">"+catOptions(m.category)+"</select></div>";
    if(t==="ingreso"){
      h+="<div class=\"two\"><div class=\"field\"><label for=\"m_cli\">Cliente</label><select id=\"m_cli\"><option value=\"\">Otro ingreso</option>"+S.clients.map(function(c){ return "<option value=\""+c.id+"\""+(c.id===m.clientId?" selected":"")+">"+esc(c.name)+"</option>"; }).join("")+"</select></div><div class=\"field\"><label for=\"m_period\">Corresponde al mes</label><input id=\"m_period\" type=\"month\" value=\""+esc(m.period||m.date.slice(0,7))+"\"></div></div>";
    }
    h+="<div class=\"field\"><label for=\"m_note\">Nota</label><input id=\"m_note\" type=\"text\" value=\""+esc(m.note||"")+"\" placeholder=\""+(t==="gasto"?"Ej: YPF ruta 2":"Opcional")+"\"></div>";
    h+="<div class=\"foot\">"+(M.edit?"<button type=\"button\" class=\"btn danger\" data-act=\"delmov\">Eliminar</button>":"<span></span>")+"<span class=\"actions\"><button type=\"button\" class=\"btn\" data-act=\"close\">Cancelar</button><button type=\"submit\" class=\"btn primary\">Guardar</button></span></div></form>";
  }
  if(M.kind==="ajuste"){
    var a=acc(M.id), b=balance(M.id);
    h+="<h3 id=\"mt\">Ajustar saldo · "+esc(a.name)+"</h3><p style=\"margin:0 0 12px;color:var(--muted);font-size:14px\">Saldo según la plataforma: <b class=\"num\">"+fmt(b,a.currency)+"</b>. Escribí lo que ves hoy en la app del banco (o lo que tenés en la billetera) y se registra la diferencia.</p>";
    h+="<form id=\"fajuste\"><div class=\"field\"><label for=\"aj_val\">Saldo real hoy</label><input id=\"aj_val\" type=\"text\" inputmode=\"decimal\" required autofocus placeholder=\"Ej: 350.000\"></div><div class=\"foot\"><span></span><span class=\"actions\"><button type=\"button\" class=\"btn\" data-act=\"close\">Cancelar</button><button type=\"submit\" class=\"btn primary\">Guardar saldo</button></span></div></form>";
  }
  if(M.kind==="acc"){
    var x=M.id?acc(M.id):{name:"",currency:"ARS"};
    h+="<h3 id=\"mt\">"+(M.id?"Editar cuenta":"Nueva cuenta")+"</h3><form id=\"facc\"><div class=\"field\"><label for=\"a_name\">Nombre</label><input id=\"a_name\" type=\"text\" required autofocus value=\""+esc(x.name)+"\" placeholder=\"Ej: Ualá\"></div><div class=\"field\"><label for=\"a_cur\">Moneda</label><select id=\"a_cur\"><option value=\"ARS\""+(x.currency==="ARS"?" selected":"")+">Pesos (ARS)</option><option value=\"USD\""+(x.currency==="USD"?" selected":"")+">Dólares (USD)</option></select></div>";
    h+="<div class=\"foot\">"+(M.id?"<button type=\"button\" class=\"btn danger\" data-act=\"delacc\">Eliminar cuenta</button>":"<span></span>")+"<span class=\"actions\"><button type=\"button\" class=\"btn\" data-act=\"close\">Cancelar</button><button type=\"submit\" class=\"btn primary\">Guardar</button></span></div></form>";
  }
  if(M.kind==="cli"){
    var c=M.id?client(M.id):{name:"",amount:"",conditional:false};
    h+="<h3 id=\"mt\">"+(M.id?"Editar cliente":"Nuevo cliente")+"</h3><form id=\"fcli\"><div class=\"field\"><label for=\"c_name\">Nombre</label><input id=\"c_name\" type=\"text\" required autofocus value=\""+esc(c.name)+"\"></div><div class=\"field\"><label for=\"c_amount\">Monto mensual</label><input id=\"c_amount\" type=\"text\" inputmode=\"decimal\" required value=\""+esc(montoStr(c.amount))+"\"></div><label class=\"chk\"><input id=\"c_cond\" type=\"checkbox\""+(c.conditional?" checked":"")+"> Es condicional (premio, bono por meta)</label>";
    h+="<div class=\"foot\">"+(M.id?"<button type=\"button\" class=\"btn danger\" data-act=\"delcli\">Eliminar</button>":"<span></span>")+"<span class=\"actions\"><button type=\"button\" class=\"btn\" data-act=\"close\">Cancelar</button><button type=\"submit\" class=\"btn primary\">Guardar</button></span></div></form>";
  }
  if(M.kind==="settings") h+=viewSettings();
  if(M.kind==="confirm"){
    h+="<h3 id=\"mt\">"+esc(M.title)+"</h3><p style=\"margin:0 0 16px;color:var(--muted)\">"+esc(M.text)+"</p><div class=\"foot\"><span></span><span class=\"actions\"><button type=\"button\" class=\"btn\" data-act=\"close\" autofocus>Cancelar</button><button type=\"button\" class=\"btn primary\" data-act=\"confirmyes\" style=\"background:var(--bad);border-color:var(--bad)\">"+esc(M.yes||"Eliminar")+"</button></span></div>";
  }
  return h+"</div></div>";
}

function defaultDate(){ var t=todayISO(); return t.slice(0,7)===ui.month?t:ui.month+"-01"; }
function openNew(type,catId){
  var lastAcc=(S.movements.slice().sort(sortMov)[0]||{}).account||(S.accounts[0]||{}).id;
  ui.modal={kind:"mov",edit:false,data:{type:type,date:defaultDate(),account:type==="gasto"?(acc("efectivo")?"efectivo":lastAcc):lastAcc,toAccount:(S.accounts[1]||{}).id,amount:"",category:catId||"combustible",note:""}};
  render();
}
function readModalIntoData(){
  var d=ui.modal.data, g=function(id){ var el=document.getElementById(id); return el?el.value:null; };
  var a=g("m_amount"); if(a!=null) d.amount=parseMonto(a);
  if(g("m_date")) d.date=g("m_date");
  if(g("m_acc")) d.account=g("m_acc");
  if(g("m_to")) d.toAccount=g("m_to");
  if(g("m_cat")) d.category=g("m_cat");
  if(g("m_cli")!=null) d.clientId=g("m_cli")||null;
  if(g("m_period")) d.period=g("m_period");
  if(g("m_note")!=null) d.note=g("m_note");
  var at=g("m_amountTo"); if(at!=null) d.amountTo=at?parseMonto(at):null;
  if(isNaN(d.amount)) d.amount="";
}


/* ---------- pantallas de acceso ---------- */
function viewAuth(){
  var h="<div class=\"auth\"><div class=\"modal\"><div class=\"logo\">$</div>";
  if(ui.screen==="loading"){ return h+"<h3>Mis Finanzas</h3><p>Cargando…</p></div></div>"; }
  if(ui.msgHtml===undefined) ui.msgHtml="";
  var msg=ui.authMsg?"<div class=\"msg"+(ui.authErr?" err":"")+"\" role=\"status\">"+esc(ui.authMsg)+"</div>":"";
  if(ui.screen==="setup"){
    return h+"<h3 id=\"mt\">Conectar tu base de datos</h3><p>Pegá los datos de tu proyecto de Supabase (Project Settings → API). Se guardan solo en este dispositivo. Si los pusiste en config.js, esta pantalla no aparece.</p>"+msg+
      "<form id=\"fsetup\"><div class=\"field\"><label for=\"s_url\">Project URL</label><input id=\"s_url\" type=\"text\" required autofocus placeholder=\"https://xxxx.supabase.co\" autocapitalize=\"off\" autocorrect=\"off\"></div><div class=\"field\"><label for=\"s_key\">anon public key</label><input id=\"s_key\" type=\"text\" required placeholder=\"eyJhbGciOi…\" autocapitalize=\"off\" autocorrect=\"off\"></div><button class=\"btn primary\" type=\"submit\" style=\"width:100%\">Guardar y continuar</button></form></div></div>";
  }
  var signup=ui.authMode==="signup";
  return h+"<h3 id=\"mt\">"+(signup?"Crear tu cuenta":"Entrar")+"</h3><p>"+(signup?"Usá tu email y una contraseña. Con la misma cuenta entrás desde la Mac y el iPhone.":"Tus cuentas, gastos e ingresos, sincronizados entre la Mac y el iPhone.")+"</p>"+msg+
    "<form id=\"fauth\"><div class=\"field\"><label for=\"u_email\">Email</label><input id=\"u_email\" type=\"email\" required autofocus autocomplete=\"email\" autocapitalize=\"off\"></div><div class=\"field\"><label for=\"u_pass\">Contraseña</label><input id=\"u_pass\" type=\"password\" required minlength=\"6\" autocomplete=\""+(signup?"new-password":"current-password")+"\"></div>"+
    "<button class=\"btn primary\" type=\"submit\" style=\"width:100%\""+(ui.busy?" disabled":"")+">"+(ui.busy?"Un momento…":(signup?"Crear cuenta":"Entrar"))+"</button></form>"+
    "<p style=\"margin:14px 0 0;text-align:center\"><button class=\"linkbtn\" data-act=\"authmode\">"+(signup?"Ya tengo cuenta, quiero entrar":"Es la primera vez: crear cuenta")+"</button></p></div></div>";
}
function viewSettings(){
  var h="<h3 id=\"mt\">Ajustes</h3><div class=\"stack\">";
  h+="<p style=\"margin:0;color:var(--muted);font-size:14px\">Sesión: <b>"+esc(USER?USER.email:"")+"</b><br>Estado: "+esc(statusText())+"</p>";
  h+="<div class=\"grouphead\" style=\"margin-top:10px\">Copia de seguridad</div><div class=\"actions\"><button class=\"btn small\" data-act=\"exportfile\">Descargar copia (.json)</button><button class=\"btn small\" data-act=\"exportcopy\">Copiar datos</button></div>";
  h+="<div class=\"grouphead\" style=\"margin-top:10px\">Restaurar una copia</div><input id=\"imp_file\" type=\"file\" accept=\"application/json,.json\"><textarea id=\"imp_text\" placeholder=\"…o pegá acá el contenido de la copia\"></textarea><div><button class=\"btn small\" data-act=\"importdo\">Restaurar</button></div>";
  h+="<div class=\"grouphead\" style=\"margin-top:10px\">Cuenta</div><div class=\"actions\"><button class=\"btn small\" data-act=\"syncnow\">Sincronizar ahora</button><button class=\"btn small danger\" data-act=\"logout\">Cerrar sesión</button></div>";
  return h+"</div><div class=\"foot\" style=\"margin-top:16px\"><span></span><button type=\"button\" class=\"btn\" data-act=\"close\">Cerrar</button></div>";
}
function applyImport(txt){
  var o; try{ o=JSON.parse(txt); }catch(e){ toast("Esa copia no es válida (no es JSON)"); return; }
  if(o&&o.S) o=o.S;
  if(!o||!Array.isArray(o.accounts)||!Array.isArray(o.movements)){ toast("A esa copia le faltan las cuentas o los movimientos"); return; }
  ui.modal={kind:"confirm",title:"¿Restaurar esta copia?",text:"Reemplaza todos los datos actuales por los de la copia ("+o.accounts.length+" cuentas, "+o.movements.length+" movimientos).",yes:"Restaurar",then:function(){ S=normalize(o); commit("Copia restaurada"); }};
  render();
}

/* ---------- eventos ---------- */
document.addEventListener("click",function(e){
  var el=e.target.closest("[data-act]"); if(!el) return;
  var act=el.getAttribute("data-act"), id=el.getAttribute("data-id");
  if(act==="closebg"){ if(e.target===el){ ui.modal=null; render(); } return; }
  e.preventDefault();
  if(act==="prev"||act==="next"){ ui.month=shiftMonth(ui.month,act==="prev"?-1:1); try{ localStorage.setItem("fin-month",ui.month); }catch(x){} render(); }
  else if(act==="new"){ openNew(el.getAttribute("data-type"),el.getAttribute("data-cat")); }
  else if(act==="settype"){ readModalIntoData(); ui.modal.data.type=el.getAttribute("data-type"); if(ui.modal.data.type==="gasto"&&!ui.modal.data.category) ui.modal.data.category="combustible"; render(); }
  else if(act==="close"){ ui.modal=null; render(); }
  else if(act==="edit"){ var m=S.movements.find(function(x){return x.id===id;}); if(m){ ui.modal={kind:m.type==="ajuste"?"mov":"mov",edit:true,data:JSON.parse(JSON.stringify(m))}; render(); } }
  else if(act==="cobrar"){ var c=client(id); var mp=acc("mp")?"mp":(S.accounts[0]||{}).id; ui.modal={kind:"mov",edit:false,data:{type:"ingreso",date:defaultDate(),account:mp,amount:c.amount,clientId:c.id,period:ui.month,note:""}}; render(); }
  else if(act==="delmov"){ var mid=ui.modal.data.id; ui.modal={kind:"confirm",title:"¿Eliminar este movimiento?",text:"El saldo de la cuenta se recalcula sin él.",then:function(){ S.movements=S.movements.filter(function(x){return x.id!==mid;}); commit("Movimiento eliminado"); }}; render(); }
  else if(act==="ajuste"){ ui.modal={kind:"ajuste",id:id}; render(); }
  else if(act==="editacc"){ ui.modal={kind:"acc",id:id}; render(); }
  else if(act==="newacc"){ ui.modal={kind:"acc",id:null}; render(); }
  else if(act==="delacc"){ var aid=ui.modal.id; var n=S.movements.filter(function(x){return x.account===aid||x.toAccount===aid;}).length; ui.modal={kind:"confirm",title:"¿Eliminar "+accName(aid)+"?",text:n?"También se borran sus "+n+" movimientos.":"La cuenta no tiene movimientos.",then:function(){ S.accounts=S.accounts.filter(function(a){return a.id!==aid;}); S.movements=S.movements.filter(function(x){return x.account!==aid&&x.toAccount!==aid;}); commit("Cuenta eliminada"); }}; render(); }
  else if(act==="newcli"){ ui.modal={kind:"cli",id:null}; render(); }
  else if(act==="editcli"){ ui.modal={kind:"cli",id:id}; render(); }
  else if(act==="delcli"){ var cid=ui.modal.id; ui.modal={kind:"confirm",title:"¿Eliminar "+client(cid).name+"?",text:"Los cobros ya registrados quedan como ingresos en sus cuentas.",then:function(){ S.clients=S.clients.filter(function(c){return c.id!==cid;}); S.movements.forEach(function(m){ if(m.clientId===cid){ m.note=(m.note?m.note+" · ":"")+client2name; } }); commit("Cliente eliminado"); }}; var client2name=client(cid).name; render(); }
  else if(act==="confirmyes"){ var fn=ui.modal.then; ui.modal=null; fn(); }
  else if(act==="savecot"){ var v=parseMonto(document.getElementById("cot").value); if(isNaN(v)||v<0){ toast("Escribí un número, por ejemplo 1450"); return; } S.cotizacionUSD=v; commit("Cotización guardada"); }
  else if(act==="settings"){ ui.modal={kind:"settings"}; render(); }
  else if(act==="authmode"){ ui.authMode=ui.authMode==="signup"?"login":"signup"; ui.authMsg=""; render(); }
  else if(act==="logout"){ ui.modal=null; var lk=lsKey(); SB.auth.signOut().then(function(){ try{ localStorage.removeItem(lk); localStorage.removeItem("fin-last-user"); }catch(e){} }); }
  else if(act==="syncnow"){ if(sync.dirty) push(); else pull(); toast("Sincronizando…"); }
  else if(act==="exportcopy"){ navigator.clipboard.writeText(JSON.stringify(S)).then(function(){ toast("Datos copiados"); },function(){ toast("No se pudo copiar"); }); }
  else if(act==="exportfile"){ var blob=new Blob([JSON.stringify(S,null,1)],{type:"application/json"}); var a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download="mis-finanzas-"+todayISO()+".json"; document.body.appendChild(a); a.click(); setTimeout(function(){ URL.revokeObjectURL(a.href); a.remove(); },1000); }
  else if(act==="importdo"){ var fi=document.getElementById("imp_file"), tx=document.getElementById("imp_text").value.trim(); if(fi.files&&fi.files[0]){ fi.files[0].text().then(applyImport); } else if(tx){ applyImport(tx); } else toast("Elegí un archivo o pegá la copia"); }
  else if(act==="csv"){
    var rows=[["Fecha","Tipo","Concepto","Cuenta","Hacia","Categoría","Monto","Nota"]];
    inMonth(ui.month).sort(sortMov).forEach(function(m){ rows.push([m.date,m.type,movDesc(m),accName(m.account),m.toAccount?accName(m.toAccount):"",m.category&&cat(m.category)?cat(m.category).name:"",String(m.amount).replace(".",","),m.note||""]); });
    var csv=rows.map(function(r){ return r.map(function(c){ return "\""+String(c).replace(/"/g,"\"\"")+"\""; }).join(";"); }).join("\n");
    navigator.clipboard.writeText(csv).then(function(){ toast("Copiado. Pegalo en una planilla."); },function(){ toast("No se pudo copiar desde esta vista."); });
  }
});
document.addEventListener("change",function(e){
  if(e.target.id==="fType"){ ui.fType=e.target.value; render(); }
  if(e.target.id==="fAcc"){ ui.fAcc=e.target.value; render(); }
});
document.addEventListener("keydown",function(e){ if(e.key==="Escape"&&ui.modal){ ui.modal=null; render(); } });
document.addEventListener("submit",function(e){
  e.preventDefault();
  var f=e.target.id;
  if(f==="fsetup"){
    var su=document.getElementById("s_url").value.trim(), sk=document.getElementById("s_key").value.trim();
    if(!/^https:\/\//.test(su)){ ui.authMsg="La URL tiene que empezar con https://"; ui.authErr=true; render(); return; }
    try{ localStorage.setItem("fin-config",JSON.stringify({url:su,key:sk})); }catch(x){}
    ui.authMsg=""; boot(); return;
  }
  if(f==="fauth"){
    var em=document.getElementById("u_email").value.trim(), pw=document.getElementById("u_pass").value;
    ui.busy=true; ui.authMsg=""; render();
    var p= ui.authMode==="signup" ? SB.auth.signUp({email:em,password:pw,options:{emailRedirectTo:location.origin+location.pathname}}) : SB.auth.signInWithPassword({email:em,password:pw});
    p.then(function(r){
      ui.busy=false;
      if(r.error){ ui.authErr=true; ui.authMsg=/Invalid login/i.test(r.error.message)?"Email o contraseña incorrectos.":/not confirmed/i.test(r.error.message)?"Todavía no confirmaste el email. Buscá el mensaje de Supabase en tu correo.":r.error.message; render(); return; }
      if(ui.authMode==="signup" && !r.data.session){ ui.authErr=false; ui.authMsg="Listo. Te mandamos un email para confirmar la cuenta: abrilo, tocá el enlace y después entrá acá."; ui.authMode="login"; render(); return; }
      if(r.data.session && !USER) startUser(r.data.session.user);
    },function(){ ui.busy=false; ui.authErr=true; ui.authMsg="Sin conexión. Probá de nuevo cuando tengas internet."; render(); });
    return;
  }
  if(f==="fmov"){
    readModalIntoData(); var d=ui.modal.data;
    if(!(typeof d.amount==="number"&&isFinite(d.amount))||(d.type!=="ajuste"&&d.amount<=0)){ toast("Revisá el monto: tiene que ser un número mayor a cero"); return; }
    if(d.type==="transfer"&&d.account===d.toAccount){ toast("Elegí dos cuentas distintas"); return; }
    var clean={id:d.id||uid(),ts:d.ts||Date.now(),type:d.type,date:d.date,account:d.account,amount:d.amount,note:(d.note||"").trim()};
    if(d.type==="gasto") clean.category=d.category;
    if(d.type==="transfer"){ clean.toAccount=d.toAccount; if(d.amountTo!=null&&!isNaN(d.amountTo)) clean.amountTo=d.amountTo; }
    if(d.type==="ingreso"&&d.clientId){ clean.clientId=d.clientId; clean.period=d.period||d.date.slice(0,7); var dup=S.movements.find(function(x){ return x.id!==clean.id&&x.type==="ingreso"&&x.clientId===clean.clientId&&x.period===clean.period; }); if(dup){ toast("Ese cliente ya tiene un cobro en ese mes. Editá el existente."); return; } }
    var ix=S.movements.findIndex(function(x){return x.id===clean.id;});
    if(ix>-1) S.movements[ix]=clean; else S.movements.push(clean);
    ui.modal=null; commit(ix>-1?"Movimiento actualizado":"Movimiento guardado");
  }
  if(f==="fajuste"){
    var v=parseMonto(document.getElementById("aj_val").value); if(isNaN(v)){ toast("Escribí un número, por ejemplo 350.000"); return; }
    var aid=ui.modal.id, diff=v-balance(aid);
    if(Math.abs(diff)<0.005){ ui.modal=null; render(); toast("El saldo ya coincide"); return; }
    S.movements.push({id:uid(),ts:Date.now(),type:"ajuste",date:todayISO(),account:aid,amount:Math.round(diff*100)/100,note:"Saldo informado: "+fmt(v,(acc(aid)||{}).currency)});
    ui.modal=null; commit("Saldo de "+accName(aid)+" actualizado");
  }
  if(f==="facc"){
    var name=document.getElementById("a_name").value.trim(), cur=document.getElementById("a_cur").value; if(!name) return;
    if(ui.modal.id){ var a=acc(ui.modal.id); a.name=name; a.currency=cur; } else S.accounts.push({id:uid(),name:name,currency:cur,initial:0});
    ui.modal=null; commit("Cuenta guardada");
  }
  if(f==="fcli"){
    var cn=document.getElementById("c_name").value.trim(), ca=parseMonto(document.getElementById("c_amount").value), cc=document.getElementById("c_cond").checked;
    if(!cn||isNaN(ca)||ca<0){ toast("Revisá el nombre y el monto"); return; }
    if(ui.modal.id){ var c=client(ui.modal.id); c.name=cn; c.amount=ca; c.conditional=cc; } else S.clients.push({id:uid(),name:cn,amount:ca,conditional:cc});
    ui.modal=null; commit("Cliente guardado");
  }
});
window.addEventListener("hashchange",function(){ var t=(location.hash||"").replace("#",""); if(TABS.some(function(x){return x[0]===t;})){ ui.tab=t; render(); window.scrollTo(0,0); } });

render();
if("serviceWorker" in navigator){ window.addEventListener("load",function(){ navigator.serviceWorker.register("sw.js").catch(function(){}); }); }
boot();
})();
