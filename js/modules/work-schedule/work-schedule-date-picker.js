(function(){
'use strict';
if(window.__JLYWorkScheduleDatePickerInitialized)return;window.__JLYWorkScheduleDatePickerInitialized=true;
const pad=n=>String(n).padStart(2,'0'),iso=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
let selected=new Set(),cursor=new Date();
function parse(v){return new Set(String(v||'').split(/[\s,，、;；]+/).filter(x=>/^\d{4}-\d{2}-\d{2}$/.test(x)))}
function sync(textarea){textarea.value=[...selected].sort().join('\n');textarea.dispatchEvent(new Event('input',{bubbles:true}))}
function render(host,textarea){
 const y=cursor.getFullYear(),m=cursor.getMonth(),first=new Date(y,m,1),last=new Date(y,m+1,0),start=(first.getDay()+6)%7;
 let cells='';for(let i=0;i<start;i++)cells+='<span class="ws-cal-empty" aria-hidden="true"></span>';
 for(let day=1;day<=last.getDate();day++){const d=new Date(y,m,day),key=iso(d),on=selected.has(key);cells+=`<button type="button" class="ws-cal-day${on?' selected':''}" data-ws-date="${key}" aria-label="${key}" aria-pressed="${on}"><span>${day}</span></button>`}
 host.innerHTML=`<div class="ws-cal-head"><button type="button" data-ws-action="prev" aria-label="上個月">‹</button><strong>${y} 年 ${m+1} 月</strong><button type="button" data-ws-action="next" aria-label="下個月">›</button></div><div class="ws-cal-week"><span>一</span><span>二</span><span>三</span><span>四</span><span>五</span><span>六</span><span>日</span></div><div class="ws-cal-grid">${cells}</div><div class="ws-cal-foot"><span>已選 <strong>${selected.size}</strong> 天</span><button type="button" data-ws-action="clear">清除</button></div>`;
 host.onclick=e=>{const b=e.target.closest('button');if(!b||!host.contains(b))return;e.preventDefault();e.stopPropagation();const action=b.dataset.wsAction;if(action==='prev'){cursor=new Date(cursor.getFullYear(),cursor.getMonth()-1,1);render(host,textarea);return}if(action==='next'){cursor=new Date(cursor.getFullYear(),cursor.getMonth()+1,1);render(host,textarea);return}if(action==='clear'){selected.clear();sync(textarea);render(host,textarea);return}const key=b.dataset.wsDate;if(!key)return;selected.has(key)?selected.delete(key):selected.add(key);sync(textarea);render(host,textarea)};
}
function enhance(){const ta=document.getElementById('workMultiDateDates');if(!ta||ta.dataset.calendarEnhanced)return false;ta.dataset.calendarEnhanced='1';selected=parse(ta.value);const seed=[...selected][0],d=seed?new Date(`${seed}T00:00:00`):new Date();cursor=new Date(d.getFullYear(),d.getMonth(),1);ta.hidden=true;ta.required=false;const host=document.createElement('div');host.className='ws-calendar-picker';ta.parentNode.insertBefore(host,ta);const hint=ta.parentNode.querySelector('small');if(hint)hint.textContent='直接點選日期，可跨月份連續選擇。';render(host,ta);return true}
function wait(){let n=0;const tick=()=>{if(enhance()||++n>30)return;setTimeout(tick,50)};tick()}
document.addEventListener('click',e=>{if(e.target.closest?.('#workWorkspaceSchedule,#dashboardCreate'))wait()},true);
})();
