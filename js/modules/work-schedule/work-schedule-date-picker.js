(function(){
'use strict';
if(window.__JLYWorkScheduleDatePickerInitialized)return;window.__JLYWorkScheduleDatePickerInitialized=true;
const pad=n=>String(n).padStart(2,'0'),iso=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
let selected=new Set(),cursor=new Date();
function parse(v){return new Set(String(v||'').split(/[\s,，、;；]+/).filter(x=>/^\d{4}-\d{2}-\d{2}$/.test(x)))}
function sync(textarea){textarea.value=[...selected].sort().join('\n');textarea.dispatchEvent(new Event('input',{bubbles:true}))}
function render(host,textarea){
 const y=cursor.getFullYear(),m=cursor.getMonth(),first=new Date(y,m,1),last=new Date(y,m+1,0),start=(first.getDay()+6)%7;
 let cells='';for(let i=0;i<start;i++)cells+='<span class="ws-cal-empty"></span>';
 for(let day=1;day<=last.getDate();day++){const d=new Date(y,m,day),key=iso(d),on=selected.has(key);cells+=`<button type="button" class="ws-cal-day${on?' selected':''}" data-ws-date="${key}" aria-pressed="${on}">${day}</button>`}
 host.innerHTML=`<div class="ws-cal-head"><button type="button" data-ws-cal-prev>‹</button><strong>${y} 年 ${m+1} 月</strong><button type="button" data-ws-cal-next>›</button></div><div class="ws-cal-week"><span>一</span><span>二</span><span>三</span><span>四</span><span>五</span><span>六</span><span>日</span></div><div class="ws-cal-grid">${cells}</div><div class="ws-cal-foot"><span>已選 <strong>${selected.size}</strong> 天</span><button type="button" data-ws-cal-clear>清除</button></div>`;
 host.querySelector('[data-ws-cal-prev]').onclick=()=>{cursor=new Date(y,m-1,1);render(host,textarea)};
 host.querySelector('[data-ws-cal-next]').onclick=()=>{cursor=new Date(y,m+1,1);render(host,textarea)};
 host.querySelector('[data-ws-cal-clear]').onclick=()=>{selected.clear();sync(textarea);render(host,textarea)};
 host.querySelectorAll('[data-ws-date]').forEach(b=>b.onclick=()=>{selected.has(b.dataset.wsDate)?selected.delete(b.dataset.wsDate):selected.add(b.dataset.wsDate);sync(textarea);render(host,textarea)});
}
function enhance(){const ta=document.getElementById('workMultiDateDates');if(!ta||ta.dataset.calendarEnhanced)return false;ta.dataset.calendarEnhanced='1';selected=parse(ta.value);const seed=[...selected][0],d=seed?new Date(`${seed}T00:00:00`):new Date();cursor=new Date(d.getFullYear(),d.getMonth(),1);ta.hidden=true;ta.required=false;const host=document.createElement('div');host.className='ws-calendar-picker';ta.parentNode.insertBefore(host,ta);const hint=ta.parentNode.querySelector('small');if(hint)hint.textContent='直接點選日期，可跨月份連續選擇。';render(host,ta);return true}
function wait(){let n=0;const tick=()=>{if(enhance()||++n>30)return;setTimeout(tick,50)};tick()}
document.addEventListener('click',e=>{if(e.target.closest?.('#workWorkspaceSchedule,#dashboardCreate'))wait()},true);
})();
