#!/usr/bin/env python3
from pathlib import Path
import csv, json, sqlite3

ROOT = Path(__file__).resolve().parent
SOURCE = ROOT / 'source.csv'
DB = ROOT / 'outreach.sqlite'
PAGE = ROOT / 'index.html'

with SOURCE.open(encoding='utf-8', newline='') as f:
    rows = list(csv.DictReader(f))

if DB.exists():
    DB.unlink()
con = sqlite3.connect(DB)
con.execute('''CREATE TABLE outreach (
 id INTEGER PRIMARY KEY,
 sent_at TEXT NOT NULL,
 subject TEXT NOT NULL,
 recipients TEXT NOT NULL,
 summary TEXT NOT NULL,
 classification TEXT NOT NULL CHECK(classification IN ('good_faith','mixed','intense')),
 theme TEXT NOT NULL,
 self_accountability INTEGER NOT NULL CHECK(self_accountability IN (0,1))
)''')
for i,r in enumerate(rows,1):
    con.execute('INSERT INTO outreach VALUES (?,?,?,?,?,?,?,?)',(
        i,r['sent_at'],r['subject'],r['recipients'],r['summary'],r['classification'],r['theme'],int(r['self_accountability'])
    ))
con.commit(); con.close()

records=[{
 'id':i,'ts':r['sent_at'],'subject':r['subject'],'recipients':r['recipients'],'summary':r['summary'],
 'cls':r['classification'],'theme':r['theme'],'accountability':int(r['self_accountability'])
} for i,r in enumerate(rows,1)]
payload=json.dumps(records,ensure_ascii=False)

page='''<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Outreach Record — Interactive Timeline</title>
<style>
:root{--bg:#090c10;--panel:#121821;--ink:#edf3f8;--muted:#9aa9b6;--line:#2a3440;--good:#69d98c;--mixed:#e8bd55;--intense:#e96969;--accent:#75d9ff}
*{box-sizing:border-box}body{margin:0;background:linear-gradient(#080a0d,#111722);color:var(--ink);font-family:system-ui,-apple-system,Segoe UI,sans-serif}main{width:min(1240px,calc(100% - 24px));margin:auto;padding:28px 0 64px}header,.panel{border:1px solid var(--line);background:#10151d;border-radius:14px;padding:22px}h1{font-size:clamp(2rem,5vw,4rem);line-height:.96;letter-spacing:-.04em;margin:.25rem 0 1rem}.lede{max-width:86ch;color:#cbd5df;line-height:1.55}.meta{color:var(--muted);font:12px ui-monospace,monospace}.controls{display:flex;gap:8px;flex-wrap:wrap;margin:14px 0}.controls button,.controls input{background:#0d131a;color:var(--ink);border:1px solid #35414d;border-radius:8px;padding:10px 12px}.controls input{min-width:min(340px,100%)}button{cursor:pointer}button.active{outline:2px solid var(--accent)}.legend{display:flex;gap:14px;flex-wrap:wrap;color:var(--muted);font-size:.88rem}.key{display:inline-flex;align-items:center;gap:6px}.sw{width:10px;height:10px;border-radius:50%;display:inline-block}.timeline-shell{margin-top:16px;border:1px solid var(--line);background:#0b1016;border-radius:14px;padding:12px;overflow-x:auto}.timeline-wrap{position:relative;min-width:1000px;height:420px}.axis{position:absolute;left:28px;right:28px;top:330px;height:2px;background:#46515c}.tick{position:absolute;top:320px;width:1px;height:22px;background:#596672}.tick-label{position:absolute;top:347px;transform:translateX(-50%);font:12px ui-monospace,monospace;color:var(--muted);white-space:nowrap}.dot{position:absolute;width:12px;height:12px;border-radius:50%;transform:translate(-50%,-50%);border:2px solid #081016;cursor:pointer;outline:none}.dot.good_faith{background:var(--good)}.dot.mixed{background:var(--mixed)}.dot.intense{background:var(--intense)}.dot.dim{opacity:.12;pointer-events:none}.dot.selected{box-shadow:0 0 0 3px var(--accent)}.stem{position:absolute;width:1px;background:#34404a;transform:translateX(-50%);pointer-events:none}.tooltip{position:absolute;z-index:5;max-width:360px;background:#111923;border:1px solid #46515c;border-radius:10px;padding:12px;box-shadow:0 12px 30px #0008;pointer-events:none;display:none}.tooltip b{display:block;margin:4px 0}.tooltip .small{font-size:.78rem;color:var(--muted)}.detail{margin-top:14px;display:grid;grid-template-columns:1fr;gap:8px}.detail h2{margin:0;font-size:1.15rem}.detail .summary{color:#d9e1e8;line-height:1.5}.badge{display:inline-block;border:1px solid currentColor;border-radius:999px;padding:3px 7px;font-size:.75rem;margin-right:6px}.empty{color:var(--muted)}footer{color:var(--muted);font-size:.8rem;margin-top:18px}.count{font-weight:700}
@media(max-width:700px){main{width:min(100% - 12px,1240px)}header,.panel{padding:16px}.timeline-wrap{min-width:900px}.controls input{width:100%}}
</style></head>
<body><main>
<header><div class="meta">EMAIL OUTREACH CHRONOLOGY / MAY 2026 → SEPTEMBER 16, 2026</div><h1>Every email is a point in time.</h1><p class="lede">Each dot represents one sent email. Hover a dot to preview the date, subject, recipients, classification, and message summary. Click or tap a dot to pin that email below the timeline. Filters change which emails remain active without destroying the chronology.</p><div class="legend"><span class="key"><i class="sw" style="background:var(--good)"></i>good-faith process</span><span class="key"><i class="sw" style="background:var(--mixed)"></i>mixed</span><span class="key"><i class="sw" style="background:var(--intense)"></i>intense/reactive</span></div></header>
<div class="controls"><input id="q" type="search" placeholder="Search subject, recipient, theme, or summary"><button data-f="all" class="active">All</button><button data-f="good_faith">Good-faith</button><button data-f="mixed">Mixed</button><button data-f="intense">Intense</button><button id="acct">Self-accountability</button></div>
<section class="timeline-shell"><div class="timeline-wrap" id="timeline"><div class="axis"></div><div class="tooltip" id="tip"></div></div></section>
<section class="panel detail" id="detail"><div class="empty">Select an email dot to pin its details here.</div></section>
<footer><span class="count" id="count"></span> records loaded from the chronology database. The SQLite database and this page are generated from the same source rows.</footer>
<script>
const DATA=__PAYLOAD__;
const root=document.getElementById('timeline'),tip=document.getElementById('tip'),detail=document.getElementById('detail'),q=document.getElementById('q'),acctBtn=document.getElementById('acct'),countEl=document.getElementById('count');
let filter='all',acctOnly=false,selected=null;
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const dates=DATA.map(x=>new Date(x.ts));
const minDate=new Date(Math.min(...dates)),maxDate=new Date(Math.max(...dates));
const start=new Date(minDate.getFullYear(),minDate.getMonth(),1),end=new Date(maxDate.getFullYear(),maxDate.getMonth()+1,1);
const span=end-start||1;
function xpos(d){return 28+((d-start)/span)*(root.clientWidth-56)}
function laneFor(i){return 285-(i%11)*23}
function addTicks(){let d=new Date(start);while(d<=end){let x=xpos(d);let t=document.createElement('div');t.className='tick';t.style.left=x+'px';root.appendChild(t);let l=document.createElement('div');l.className='tick-label';l.style.left=x+'px';l.textContent=d.toLocaleDateString(undefined,{month:'short',year:'2-digit'});root.appendChild(l);d=new Date(d.getFullYear(),d.getMonth()+1,1)}}
function matches(x){const z=q.value.trim().toLowerCase();return (filter==='all'||x.cls===filter)&&(!acctOnly||x.accountability)&&(!z||JSON.stringify(x).toLowerCase().includes(z))}
function tooltipHTML(x){return `<div class="small">${esc(new Date(x.ts).toLocaleString())}</div><b>${esc(x.subject||'(No Subject)')}</b><div class="small">To: ${esc(x.recipients)}</div><div style="margin-top:6px">${esc(x.summary)}</div>`}
function pin(x){selected=x.id;document.querySelectorAll('.dot').forEach(d=>d.classList.toggle('selected',Number(d.dataset.id)===x.id));detail.innerHTML=`<div><span class="badge">${esc(x.cls.replace('_',' '))}</span><span class="badge">${esc(x.theme)}</span></div><div class="meta">${esc(new Date(x.ts).toLocaleString())}</div><h2>${esc(x.subject||'(No Subject)')}</h2><div><strong>Recipients:</strong> ${esc(x.recipients)}</div><div class="summary">${esc(x.summary)}</div>${x.accountability?'<div style="color:var(--good)">Self-accountability / correction / consent / repair marker</div>':''}`}
function render(){root.querySelectorAll('.dot,.stem').forEach(n=>n.remove());let active=0;const sameDay={};DATA.forEach(x=>{const day=x.ts.slice(0,10);const n=sameDay[day]??0;sameDay[day]=n+1;const d=new Date(x.ts),xv=xpos(d),yv=laneFor(n);const stem=document.createElement('div');stem.className='stem';stem.style.left=xv+'px';stem.style.top=yv+'px';stem.style.height=(330-yv)+'px';root.appendChild(stem);const b=document.createElement('button');b.type='button';b.className='dot '+x.cls;b.dataset.id=x.id;b.setAttribute('aria-label',`${x.subject}, ${new Date(x.ts).toLocaleString()}`);b.style.left=xv+'px';b.style.top=yv+'px';if(!matches(x)){b.classList.add('dim');stem.style.opacity='.08'}else active++;if(selected===x.id)b.classList.add('selected');b.addEventListener('mouseenter',()=>showTip(b,x));b.addEventListener('mouseleave',hideTip);b.addEventListener('focus',()=>showTip(b,x));b.addEventListener('blur',hideTip);b.addEventListener('click',()=>pin(x));root.appendChild(b)});countEl.textContent=`${active} of ${DATA.length}`}
function showTip(el,x){tip.innerHTML=tooltipHTML(x);tip.style.display='block';const er=el.getBoundingClientRect(),rr=root.getBoundingClientRect();let left=er.left-rr.left+14,top=er.top-rr.top-10;if(left+370>root.clientWidth)left=Math.max(8,left-370);if(top<8)top=24;tip.style.left=left+'px';tip.style.top=top+'px'}
function hideTip(){tip.style.display='none'}
addTicks();render();
document.querySelectorAll('[data-f]').forEach(b=>b.addEventListener('click',()=>{filter=b.dataset.f;document.querySelectorAll('[data-f]').forEach(x=>x.classList.remove('active'));b.classList.add('active');render()}));
acctBtn.addEventListener('click',()=>{acctOnly=!acctOnly;acctBtn.classList.toggle('active',acctOnly);render()});q.addEventListener('input',render);window.addEventListener('resize',()=>{root.querySelectorAll('.tick,.tick-label').forEach(n=>n.remove());addTicks();render()});
</script></main></body></html>'''.replace('__PAYLOAD__',payload)
PAGE.write_text(page,encoding='utf-8')
print(f'Built {PAGE} and {DB} with {len(rows)} records')
