#!/usr/bin/env python3
from pathlib import Path
import csv, json, sqlite3, html
from collections import Counter, defaultdict

ROOT = Path(__file__).resolve().parent
RAW = ROOT / 'raw_messages.csv'
THREADS = ROOT / 'thread_messages.csv'
ANNOTATIONS = ROOT / 'annotations.csv'
DB = ROOT / 'outreach.sqlite'
PAGE = ROOT / 'index.html'


def read_csv(path):
    if not path.exists():
        return []
    with path.open(encoding='utf-8', newline='') as f:
        return list(csv.DictReader(f))

raw = read_csv(RAW)
thread_rows = read_csv(THREADS)
annotations = {r['message_id']: r for r in read_csv(ANNOTATIONS) if r.get('message_id')}

# One source-of-truth row per sent Gmail message.
# Required columns: message_id,thread_id,sent_at,from_addr,to,cc,bcc,subject,snippet,body,display_url,body_status
raw.sort(key=lambda r: r.get('sent_at',''))

if DB.exists(): DB.unlink()
con = sqlite3.connect(DB)
con.execute('''CREATE TABLE sent_messages (
 message_id TEXT PRIMARY KEY,
 thread_id TEXT NOT NULL,
 sent_at TEXT NOT NULL,
 from_addr TEXT,
 recipients TEXT,
 cc TEXT,
 bcc TEXT,
 subject TEXT,
 snippet TEXT,
 body TEXT,
 display_url TEXT,
 body_status TEXT NOT NULL DEFAULT 'metadata_only',
 classification TEXT,
 theme TEXT,
 self_accountability INTEGER NOT NULL DEFAULT 0,
 response_status TEXT NOT NULL DEFAULT 'unknown'
)''')
con.execute('''CREATE TABLE thread_messages (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 thread_id TEXT NOT NULL,
 message_id TEXT NOT NULL,
 sent_at TEXT NOT NULL,
 direction TEXT NOT NULL CHECK(direction IN ('sent','reply','delivery_failure','other')),
 from_addr TEXT,
 recipients TEXT,
 subject TEXT,
 body TEXT,
 display_url TEXT
)''')

for r in raw:
    a = annotations.get(r['message_id'], {})
    con.execute('''INSERT INTO sent_messages VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)''',(
        r['message_id'], r.get('thread_id',''), r.get('sent_at',''), r.get('from_addr',''),
        r.get('to',''), r.get('cc',''), r.get('bcc',''), r.get('subject',''), r.get('snippet',''),
        r.get('body',''), r.get('display_url',''), r.get('body_status','metadata_only'),
        a.get('classification',''), a.get('theme',''), int(a.get('self_accountability') or 0),
        a.get('response_status','unknown')
    ))
for r in thread_rows:
    con.execute('''INSERT INTO thread_messages(thread_id,message_id,sent_at,direction,from_addr,recipients,subject,body,display_url)
                   VALUES (?,?,?,?,?,?,?,?,?)''',(
        r.get('thread_id',''),r.get('message_id',''),r.get('sent_at',''),r.get('direction','other'),
        r.get('from_addr',''),r.get('recipients',''),r.get('subject',''),r.get('body',''),r.get('display_url','')
    ))
con.commit(); con.close()

threads = defaultdict(list)
for r in thread_rows:
    threads[r.get('thread_id','')].append(r)
for vals in threads.values(): vals.sort(key=lambda r:r.get('sent_at',''))

records=[]
for r in raw:
    a=annotations.get(r['message_id'],{})
    records.append({
      'message_id':r['message_id'],'thread_id':r.get('thread_id',''),'ts':r.get('sent_at',''),
      'from':r.get('from_addr',''),'recipients':r.get('to',''),'cc':r.get('cc',''),'bcc':r.get('bcc',''),
      'subject':r.get('subject','') or '(No Subject)','snippet':r.get('snippet',''),'body':r.get('body',''),
      'body_status':r.get('body_status','metadata_only'),'url':r.get('display_url',''),
      'cls':a.get('classification',''),'theme':a.get('theme',''),'accountability':int(a.get('self_accountability') or 0),
      'response':a.get('response_status','unknown'), 'thread':threads.get(r.get('thread_id',''),[])
    })

month_counts=Counter(r['ts'][:7] for r in records if r.get('ts'))
payload=json.dumps(records,ensure_ascii=False)
month_payload=json.dumps(dict(sorted(month_counts.items())),ensure_ascii=False)

page='''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Outreach Record — Raw Email Timeline</title><style>
:root{--bg:#090c10;--panel:#121821;--ink:#edf3f8;--muted:#9aa9b6;--line:#2a3440;--good:#69d98c;--mixed:#e8bd55;--intense:#e96969;--accent:#75d9ff;--reply:#8dd8ff;--fail:#ff8a8a}
*{box-sizing:border-box}body{margin:0;background:#090c10;color:var(--ink);font-family:system-ui,-apple-system,Segoe UI,sans-serif}main{width:min(1280px,calc(100% - 20px));margin:auto;padding:26px 0 70px}header,.panel{border:1px solid var(--line);background:#10151d;border-radius:14px;padding:20px}h1{font-size:clamp(2rem,5vw,4.2rem);line-height:.96;letter-spacing:-.04em;margin:.25rem 0 1rem}.lede{max-width:90ch;color:#cbd5df;line-height:1.55}.meta{color:var(--muted);font:12px ui-monospace,monospace}.stats{display:flex;gap:8px;flex-wrap:wrap;margin:14px 0}.stat{border:1px solid var(--line);background:var(--panel);padding:10px 13px;border-radius:9px}.stat b{font-size:1.35rem}.controls{display:flex;gap:8px;flex-wrap:wrap;margin:14px 0}.controls button,.controls input{background:#0d131a;color:var(--ink);border:1px solid #35414d;border-radius:8px;padding:10px 12px}.controls input{min-width:min(340px,100%)}button{cursor:pointer}.timeline-shell{border:1px solid var(--line);background:#0b1016;border-radius:14px;padding:12px;overflow:hidden}.timeline{position:relative;height:450px;touch-action:pan-y}.axis{position:absolute;left:28px;right:28px;top:345px;height:2px;background:#46515c}.tick{position:absolute;top:335px;width:1px;height:22px;background:#596672}.tick-label{position:absolute;top:362px;transform:translateX(-50%);font:12px ui-monospace,monospace;color:var(--muted);white-space:nowrap}.dot{position:absolute;width:11px;height:11px;border-radius:50%;transform:translate(-50%,-50%);border:2px solid #071016;background:#9aa9b6;cursor:pointer}.dot.good_faith{background:var(--good)}.dot.mixed{background:var(--mixed)}.dot.intense{background:var(--intense)}.dot.unresponded{box-shadow:0 0 0 2px #fff}.dot.selected{outline:3px solid var(--accent)}.dot.dim{opacity:.1;pointer-events:none}.stem{position:absolute;width:1px;background:#34404a;transform:translateX(-50%);pointer-events:none}.tooltip{position:absolute;z-index:5;max-width:390px;background:#111923;border:1px solid #46515c;border-radius:10px;padding:12px;box-shadow:0 12px 30px #0009;display:none;pointer-events:none}.detail{margin-top:14px}.thread{display:grid;gap:12px;margin-top:15px}.msg{border:1px solid var(--line);border-radius:10px;padding:14px;background:#0c1218}.msg.reply{border-left:4px solid var(--reply)}.msg.delivery_failure{border-left:4px solid var(--fail)}.msg.sent{border-left:4px solid var(--accent)}.msg pre{white-space:pre-wrap;overflow-wrap:anywhere;font:inherit;line-height:1.48;margin:.8rem 0 0}.badge{display:inline-block;border:1px solid currentColor;border-radius:999px;padding:3px 7px;font-size:.74rem;margin-right:5px}.warn{color:#ffd28c}.empty{color:var(--muted)}.zoomreadout{font:12px ui-monospace,monospace;color:var(--muted);align-self:center}a{color:var(--accent)}
@media(max-width:700px){main{width:calc(100% - 10px)}header,.panel{padding:14px}.controls input{width:100%}}
</style></head><body><main>
<header><div class="meta">RAW GMAIL OUTREACH ARCHIVE</div><h1>The emails are the record.</h1><p class="lede">Every dot is an actual sent Gmail message. The timeline is driven by raw message metadata rather than curated milestones. Click a message to see its exact stored body and, where retrieved, the entire Gmail thread in chronological order. Classification is annotation only; it never replaces the source email.</p><div class="stats" id="stats"></div></header>
<div class="controls"><input id="q" type="search" placeholder="Search subject, recipient, body, or thread"><button id="unresp">Unresponded only</button><button id="zoomOut">−</button><button id="zoomIn">+</button><button id="resetZoom">Full span</button><span class="zoomreadout" id="zoomReadout"></span></div>
<section class="timeline-shell"><div class="timeline" id="timeline"><div class="axis"></div><div class="tooltip" id="tip"></div></div></section>
<section class="panel detail" id="detail"><div class="empty">Select an email dot to open its message and thread.</div></section>
<script>
const DATA=__DATA__, MONTHS=__MONTHS__;const root=document.getElementById('timeline'),detail=document.getElementById('detail'),tip=document.getElementById('tip'),q=document.getElementById('q'),zoomReadout=document.getElementById('zoomReadout');let selected=null,unresp=false;
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
document.getElementById('stats').innerHTML=`<div class=stat><b>${DATA.length}</b><div class=meta>sent messages indexed</div></div>`+Object.entries(MONTHS).map(([m,n])=>`<div class=stat><b>${n}</b><div class=meta>${esc(m)}</div></div>`).join('');
const times=DATA.map(x=>new Date(x.ts).getTime()).filter(Number.isFinite),fullStart=Math.min(...times),fullEnd=Math.max(...times);let viewStart=fullStart,viewEnd=fullEnd;const MIN_WINDOW=30*60e3;
function clamp(){let s=Math.max(MIN_WINDOW,Math.min(fullEnd-fullStart,viewEnd-viewStart)),m=(viewStart+viewEnd)/2;viewStart=m-s/2;viewEnd=m+s/2;if(viewStart<fullStart){viewEnd+=fullStart-viewStart;viewStart=fullStart}if(viewEnd>fullEnd){viewStart-=viewEnd-fullEnd;viewEnd=fullEnd}}
function xpos(ms){return 28+((ms-viewStart)/(viewEnd-viewStart||1))*(root.clientWidth-56)}function step(span){const a=[3600e3,3*3600e3,6*3600e3,12*3600e3,86400e3,2*86400e3,7*86400e3,14*86400e3,30*86400e3];return a.find(x=>span/x<=8)||90*86400e3}function ticks(){root.querySelectorAll('.tick,.tick-label').forEach(n=>n.remove());const sp=viewEnd-viewStart,st=step(sp);for(let t=Math.ceil(viewStart/st)*st;t<=viewEnd;t+=st){let x=xpos(t);if(x<20||x>root.clientWidth-20)continue;let a=document.createElement('div');a.className='tick';a.style.left=x+'px';root.appendChild(a);let l=document.createElement('div');l.className='tick-label';l.style.left=x+'px';let d=new Date(t);l.textContent=st<86400e3?d.toLocaleString(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}):d.toLocaleDateString(undefined,{month:'short',day:'numeric'});root.appendChild(l)}const h=sp/36e5;zoomReadout.textContent=h<48?`${h.toFixed(1)} h visible`:h<2160?`${(h/24).toFixed(1)} days visible`:`${(h/24/30.44).toFixed(1)} months visible`}
function matches(x){let z=q.value.trim().toLowerCase();return (!unresp||x.response==='unresponded')&&(!z||JSON.stringify(x).toLowerCase().includes(z))}
function render(){root.querySelectorAll('.dot,.stem').forEach(n=>n.remove());ticks();const buckets={};DATA.filter(x=>{let t=new Date(x.ts).getTime();return t>=viewStart&&t<=viewEnd}).forEach(x=>{let ms=new Date(x.ts).getTime(),px=Math.round(xpos(ms)/7),n=buckets[px]??0;buckets[px]=n+1;let xv=xpos(ms),yv=300-(n%13)*20,st=document.createElement('div');st.className='stem';st.style.left=xv+'px';st.style.top=yv+'px';st.style.height=(345-yv)+'px';root.appendChild(st);let b=document.createElement('button');b.type='button';b.className=`dot ${x.cls||''} ${x.response==='unresponded'?'unresponded':''}`;b.style.left=xv+'px';b.style.top=yv+'px';if(!matches(x)){b.classList.add('dim');st.style.opacity='.08'}if(selected===x.message_id)b.classList.add('selected');b.addEventListener('mouseenter',()=>showTip(b,x));b.addEventListener('mouseleave',()=>tip.style.display='none');b.addEventListener('click',()=>pin(x));root.appendChild(b)})}
function showTip(el,x){tip.innerHTML=`<div class=meta>${esc(new Date(x.ts).toLocaleString())}</div><b>${esc(x.subject)}</b><div class=meta>To: ${esc(x.recipients)}</div><div>${esc(x.snippet)}</div>`;tip.style.display='block';let er=el.getBoundingClientRect(),rr=root.getBoundingClientRect(),left=er.left-rr.left+14,top=er.top-rr.top-10;if(left+400>root.clientWidth)left=Math.max(8,left-400);tip.style.left=left+'px';tip.style.top=Math.max(8,top)+'px'}
function msgHtml(m){let label=m.direction==='sent'?'SENT':m.direction==='reply'?'REPLY':m.direction==='delivery_failure'?'DELIVERY FAILURE':'OTHER';return `<article class="msg ${esc(m.direction)}"><div><span class=badge>${label}</span><span class=meta>${esc(new Date(m.sent_at).toLocaleString())}</span></div><div class=meta>From: ${esc(m.from_addr)}<br>To: ${esc(m.recipients)}</div><strong>${esc(m.subject||'(No Subject)')}</strong><pre>${esc(m.body)}</pre></article>`}
function pin(x){selected=x.message_id;render();let thread=x.thread||[],threadBlock=thread.length?`<h3>Entire retrieved thread (${thread.length} messages)</h3><div class=thread>${thread.map(msgHtml).join('')}</div>`:`<p class=warn>Full thread has not yet been retrieved for this message. The raw sent-message record is still indexed below.</p>`;detail.innerHTML=`<div><span class=badge>${esc(x.response)}</span>${x.cls?`<span class=badge>${esc(x.cls)}</span>`:''}</div><div class=meta>${esc(new Date(x.ts).toLocaleString())} · Gmail message ${esc(x.message_id)} · thread ${esc(x.thread_id)}</div><h2>${esc(x.subject)}</h2><div><strong>To:</strong> ${esc(x.recipients)}</div><pre style="white-space:pre-wrap;overflow-wrap:anywhere">${esc(x.body||x.snippet)}</pre>${x.body_status!=='full'?'<p class=warn>Full body retrieval pending; displaying the exact Gmail snippet currently stored.</p>':''}${threadBlock}${x.url?`<p><a href="${esc(x.url)}">Open original in Gmail</a></p>`:''}`}
function zoomAt(f,a=root.clientWidth/2){let r=Math.max(0,Math.min(1,(a-28)/Math.max(1,root.clientWidth-56))),anchor=viewStart+r*(viewEnd-viewStart),ns=Math.max(MIN_WINDOW,Math.min(fullEnd-fullStart,(viewEnd-viewStart)*f));viewStart=anchor-r*ns;viewEnd=viewStart+ns;clamp();render()}root.addEventListener('wheel',e=>{e.preventDefault();let r=root.getBoundingClientRect();zoomAt(e.deltaY>0?1.35:.74,e.clientX-r.left)},{passive:false});document.getElementById('zoomIn').onclick=()=>zoomAt(.6);document.getElementById('zoomOut').onclick=()=>zoomAt(1.67);document.getElementById('resetZoom').onclick=()=>{viewStart=fullStart;viewEnd=fullEnd;render()};document.getElementById('unresp').onclick=e=>{unresp=!unresp;e.currentTarget.style.outline=unresp?'2px solid var(--accent)':'';render()};q.oninput=render;window.onresize=render;render();
</script></main></body></html>'''.replace('__DATA__',payload).replace('__MONTHS__',month_payload)
PAGE.write_text(page,encoding='utf-8')
print(f'Built raw archive: {len(raw)} sent messages, {len(thread_rows)} thread messages')
