#!/usr/bin/env python3
from pathlib import Path
import csv, html, json, sqlite3

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

page='''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Outreach Record — May to September 2026</title><style>
:root{--bg:#090c10;--panel:#121821;--ink:#edf3f8;--muted:#9aa9b6;--line:#2a3440;--good:#7cf2a0;--mixed:#ffd166;--intense:#ff6b6b;--accent:#75d9ff}*{box-sizing:border-box}body{margin:0;background:linear-gradient(#080a0d,#111722);color:var(--ink);font-family:system-ui,-apple-system,Segoe UI,sans-serif}main{width:min(1160px,calc(100% - 28px));margin:auto;padding:36px 0 72px}header,.method{border:1px solid var(--line);background:#10151d;border-radius:14px;padding:26px}h1{font-size:clamp(2.2rem,6vw,4.5rem);line-height:.95;letter-spacing:-.05em;margin:.2rem 0 1rem}p{line-height:1.55}.lede{max-width:82ch;color:#cbd5df}.callout{border-left:4px solid var(--accent);background:#0c1218;padding:13px 16px;margin-top:20px}.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:16px 0}.stat{border:1px solid var(--line);background:var(--panel);padding:15px;border-radius:10px}.stat b{display:block;font-size:1.8rem}.stat span{color:var(--muted);font-size:.82rem}.controls{display:flex;gap:8px;flex-wrap:wrap;position:sticky;top:0;background:#090c10ee;padding:12px;border:1px solid var(--line);border-radius:10px;z-index:2}button,input,select{background:#0d131a;color:var(--ink);border:1px solid #35414d;border-radius:8px;padding:10px}button{cursor:pointer}button.active{outline:2px solid var(--accent)}.timeline{display:grid;gap:10px;margin-top:18px}article{border:1px solid var(--line);border-left-width:5px;background:var(--panel);padding:17px;border-radius:10px}article.good_faith{border-left-color:var(--good)}article.mixed{border-left-color:var(--mixed)}article.intense{border-left-color:var(--intense)}.meta{display:flex;gap:7px;flex-wrap:wrap;color:var(--muted);font:12px ui-monospace,monospace}.badge{border:1px solid currentColor;padding:3px 7px;border-radius:999px}h2{font-size:1.05rem;margin:9px 0}.summary{color:#d5dee7;margin:0}.to{color:#b8c5d1;font-size:.9rem;margin-top:9px}.acct{color:var(--good);font-size:.84rem;margin-top:9px}.method{margin-top:22px}.method h2{font-size:1.35rem}footer{color:var(--muted);margin-top:24px;font-size:.8rem}@media(max-width:700px){.stats{grid-template-columns:1fr 1fr}.controls{position:static}}
</style></head><body><main><header><div class="meta">OUTREACH CHRONOLOGY / MAY 2026 → SEPTEMBER 16, 2026</div><h1>The record is not one kind of email.</h1><p class="lede">This page separates sustained good-faith attempts to engage with family, disability services, mental-health services, housing supports, legal and oversight bodies, and community organizations from messages written at moments of severe distress. The purpose is not to hide intensity. It is to stop intensity from erasing the larger process record.</p><div class="callout"><strong>Core process issue:</strong> repeated requests for clear responsibility, continuity, informed consent, accompaniment, timelines, and practical support were often made in process-directed language. The record also contains reactive messages. Both are shown, but they are not treated as interchangeable.</div></header><div class="stats" id="stats"></div><div class="controls"><input id="q" type="search" placeholder="Search subject, recipient, theme…"><select id="month"><option value="">All months</option></select><button data-f="all" class="active">All</button><button data-f="good_faith">Good-faith process</button><button data-f="mixed">Mixed</button><button data-f="intense">Intense/reactive</button><button id="acct">Self-accountability only</button></div><section class="method"><h2>Classification and accountability</h2><p><strong>Good-faith process engagement</strong> means the message contains a concrete request, follow-up, formal complaint, consent decision, boundary, clarification, repair, gratitude, or request for defined responsibility.</p><p><strong>Mixed</strong> means distress or confrontational framing is present, but a coherent process request or clarification remains.</p><p><strong>Intense/reactive</strong> means anger, accusation, or despair dominates. Those messages remain visible rather than being deleted or disguised.</p><p><strong>Self-accountability</strong> is marked when the sender apologizes, corrects the record, acknowledges another person's effort, narrows a request, clarifies consent, or accepts responsibility for his part. This chronology does not claim personal perfection. It documents repeated attempts to participate in a process while also describing how the process itself affected identity, agency, and trust.</p><p>This is a curated chronology of substantive outreach, not every email sent. The accompanying SQLite database is generated from the same source rows.</p></section><div class="timeline" id="timeline"></div><footer>Source: connected Gmail Sent records reviewed for this chronology. Curated summaries are descriptive, not findings about recipient motive or legal liability.</footer><script>const DATA=__PAYLOAD__;let f='all',acct=false;const esc=s=>String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));const months=[...new Set(DATA.map(x=>x.ts.slice(0,7)))].sort();months.forEach(m=>month.insertAdjacentHTML('beforeend',`<option>${m}</option>`));const count=k=>DATA.filter(x=>x.cls===k).length;stats.innerHTML=[[DATA.length,'curated records'],[count('good_faith'),'good-faith process'],[count('mixed'),'mixed'],[count('intense'),'intense/reactive']].map(x=>`<div class=stat><b>${x[0]}</b><span>${x[1]}</span></div>`).join('');document.querySelectorAll('[data-f]').forEach(b=>b.onclick=()=>{f=b.dataset.f;document.querySelectorAll('[data-f]').forEach(x=>x.classList.remove('active'));b.classList.add('active');render()});acct.onclick=e=>{acct=!acct;e.currentTarget.classList.toggle('active',acct);render()};q.oninput=render;month.onchange=render;function render(){let z=q.value.toLowerCase(),m=month.value;timeline.innerHTML=DATA.filter(x=>(f==='all'||x.cls===f)&&(!acct||x.accountability)&&(!m||x.ts.startsWith(m))&&(!z||JSON.stringify(x).toLowerCase().includes(z))).map(x=>`<article class="${x.cls}"><div class=meta><span>${esc(new Date(x.ts).toLocaleString())}</span><span class=badge>${esc(x.cls.replace('_',' '))}</span><span class=badge>${esc(x.theme)}</span></div><h2>${esc(x.subject)}</h2><p class=summary>${esc(x.summary)}</p><div class=to>To: ${esc(x.recipients)}</div>${x.accountability?'<div class=acct>✓ self-accountability / correction / consent / repair marker</div>':''}</article>`).join('')||'<p>No records match.</p>'}render();</script></main></body></html>'''.replace('__PAYLOAD__',payload)
PAGE.write_text(page,encoding='utf-8')
print(f'Built {PAGE} and {DB}')
