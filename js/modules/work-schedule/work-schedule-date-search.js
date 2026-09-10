(function(){
'use strict';
if(window.__JLYWorkScheduleDateSearchInitialized)return;
window.__JLYWorkScheduleDateSearchInitialized=true;
const $=id=>document.getElementById(id),form=$('scheduleDateSearch'),input=$('scheduleDateQuery'),clear=$('scheduleDateClear'),host=$('scheduleDashboard'),label=$('dashboardMonthLabel'),title=$('scheduleResultsTitle');
if(!form||!input||!host)return;
let targetDate='',pending=false;
const pad=n=>String(n).padStart(2,'0');
function parseDate(raw){const s=String(raw||'').trim().replace(/[.\-]/g,'/'),p=s.split('/').filter(Boolean).map(Number);let y,m,d;if(p.length===2){y=new Date().getFullYear();[m,d]=p}else if(p.length===3){[y,m,d]=p}else return null;if(y<100)y+=2000;const dt=new Date(y,m-1,d);if(dt.getFullYear()!==y||dt.getMonth()!==m-1||dt.getDate()!==d)return null;return{iso:`${y}-${pad(m)}-${pad(d)}`,year:y,month:m,day:d}}
function currentMonth(){const m=String(label?.textContent||'').match(/(\d{4})\s*年\s*(\d{1,2})\s*月/);return m?{year:Number(m[1]),month:Number(m[2])}:null}
function moveTo(parsed){const cur=currentMonth();if(!cur)return false;const diff=(parsed.year-cur.year)*12+(parsed.month-cur.month);if(!diff)return true;const btn=$(diff>0?'dashboardNext':'dashboardPrev');if(!btn)return false;pending=true;btn.click();return false}
function filterCards(){if(!targetDate)return;const cards=[...host.querySelectorAll('[data-group]')];let shown=0;cards.forEach(card=>{const key=String(card.dataset.group||'');const match=key.startsWith(targetDate+'|');card.hidden=!match;if(match)shown++});if(title){const [,m,d]=targetDate.split('-');title.textContent=`🔍 ${Number(m)}/${Number(d)} 班表`}if(!shown&&cards.length){const empty=document.createElement('div');empty.className='empty date-search-empty';empty.textContent=`${Number(targetDate.slice(5,7))}/${Number(targetDate.slice(8,10))} 沒有班表。`;host.appendChild(empty)}}
function clearFilter(){targetDate='';host.querySelectorAll('[data-group]').forEach(x=>x.hidden=false);host.querySelectorAll('.date-search-empty').forEach(x=>x.remove());if(title)title.textContent='班表';input.value=''}
form.addEventListener('submit',e=>{e.preventDefault();const parsed=parseDate(input.value);if(!parsed){alert('日期可以輸入 9/27；不同年份請輸入 2027/9/27。');input.focus();return}targetDate=parsed.iso;host.querySelectorAll('.date-search-empty').forEach(x=>x.remove());if(moveTo(parsed))filterCards()});
clear?.addEventListener('click',clearFilter);
window.addEventListener('jly:work-schedule:rows',()=>{if(!targetDate)return;const parsed=parseDate(targetDate);if(pending){pending=false;if(!moveTo(parsed))return}filterCards()});
})();
