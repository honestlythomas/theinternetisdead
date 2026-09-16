#!/usr/bin/env python3
from pathlib import Path
import csv, json, re, sqlite3

ROOT = Path(__file__).resolve().parent
STATUS = ROOT / 'response_status.csv'
DB = ROOT / 'outreach.sqlite'
PAGE = ROOT / 'index.html'

with STATUS.open(encoding='utf-8', newline='') as f:
    statuses = list(csv.DictReader(f))
status_map = {(r['sent_at'], r['subject']): r for r in statuses}

# Add response status to SQLite without conflating it with tone/classification.
con = sqlite3.connect(DB)
cols = {r[1] for r in con.execute('PRAGMA table_info(outreach)')}
if 'response_status' not in cols:
    con.execute("ALTER TABLE outreach ADD COLUMN response_status TEXT NOT NULL DEFAULT 'unknown'")
if 'response_note' not in cols:
    con.execute("ALTER TABLE outreach ADD COLUMN response_note TEXT NOT NULL DEFAULT ''")
for r in statuses:
    con.execute(
        'UPDATE outreach SET response_status=?, response_note=? WHERE sent_at=? AND subject=?',
        (r['response_status'], r['note'], r['sent_at'], r['subject'])
    )
con.commit(); con.close()

text = PAGE.read_text(encoding='utf-8')
m = re.search(r'const DATA=(\[.*?\]);\nconst root=', text, flags=re.S)
if not m:
    raise SystemExit('Could not locate embedded DATA payload in index.html')
data = json.loads(m.group(1))
for x in data:
    r = status_map.get((x['ts'], x['subject']))
    x['response_status'] = r['response_status'] if r else 'unknown'
    x['response_note'] = r['note'] if r else ''
text = text[:m.start(1)] + json.dumps(data, ensure_ascii=False) + text[m.end(1):]

# Styling: tone remains fill; response status is an independent outer ring.
text = text.replace(
    '.dot.selected{box-shadow:0 0 0 3px var(--accent)}',
    '.dot.unresponded{box-shadow:0 0 0 3px #f3f5f7,0 0 0 5px #081016}.dot.selected{box-shadow:0 0 0 3px var(--accent),0 0 0 5px #081016}.dot.unresponded.selected{box-shadow:0 0 0 3px #f3f5f7,0 0 0 6px var(--accent)}'
)
text = text.replace(
    '</div></header>\n<div class="controls">',
    '<span class="key"><i class="sw" style="background:transparent;border:2px solid #f3f5f7"></i>unresponded = white ring</span></div></header>\n<div class="controls">'
)
text = text.replace(
    '<button id="acct">Self-accountability</button>',
    '<button id="acct">Self-accountability</button><button id="unresponded">Unresponded only</button>'
)
text = text.replace(
    "let filter='all',acctOnly=false,selected=null;",
    "let filter='all',acctOnly=false,unrespondedOnly=false,selected=null;"
)
text = text.replace(
    "return (filter==='all'||x.cls===filter)&&(!acctOnly||x.accountability)&&(!z||JSON.stringify(x).toLowerCase().includes(z))",
    "return (filter==='all'||x.cls===filter)&&(!acctOnly||x.accountability)&&(!unrespondedOnly||x.response_status==='unresponded')&&(!z||JSON.stringify(x).toLowerCase().includes(z))"
)
text = text.replace(
    "b.className='dot '+x.cls;",
    "b.className='dot '+x.cls+(x.response_status==='unresponded'?' unresponded':'');"
)
text = text.replace(
    "<div style=\"margin-top:6px\">${esc(x.summary)}</div>`}",
    "<div class=\"small\" style=\"margin-top:5px\">Response: ${esc(x.response_status||'unknown')}</div><div style=\"margin-top:6px\">${esc(x.summary)}</div>`}"
)
text = text.replace(
    "<span class=\"badge\">${esc(x.theme)}</span></div>",
    "<span class=\"badge\">${esc(x.theme)}</span><span class=\"badge\">${esc(x.response_status||'unknown')}</span></div>"
)
text = text.replace(
    "${x.accountability?'<div style=\"color:var(--good)\">Self-accountability / correction / consent / repair marker</div>':''}`}",
    "${x.accountability?'<div style=\"color:var(--good)\">Self-accountability / correction / consent / repair marker</div>':''}${x.response_note?'<div class=\"meta\">Response audit: '+esc(x.response_note)+'</div>':''}` }"
)
text = text.replace(
    "acctBtn.addEventListener('click',()=>{acctOnly=!acctOnly;acctBtn.classList.toggle('active',acctOnly);render()});q.addEventListener('input',render);",
    "acctBtn.addEventListener('click',()=>{acctOnly=!acctOnly;acctBtn.classList.toggle('active',acctOnly);render()});document.getElementById('unresponded').addEventListener('click',e=>{unrespondedOnly=!unrespondedOnly;e.currentTarget.classList.toggle('active',unrespondedOnly);render()});q.addEventListener('input',render);"
)

PAGE.write_text(text, encoding='utf-8')
print(f'Applied {len(statuses)} verified response-status records')
