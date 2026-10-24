/* Shared play-session model. Person views contain references and compact cards only. */
(function(root){
 'use strict';
 const text=v=>String(v==null?'':v).trim(), idOK=v=>/^[A-Za-z0-9_-]{6,128}$/.test(text(v));
 const roles=new Set(['player','host','dm','npc']), attendance=new Set(['attended','absent','unconfirmed','cancelled']);
 function date(v){const m=text(v).match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);if(!m)return '';const y=+m[1],n=+m[2],d=+m[3],x=new Date(Date.UTC(y,n-1,d));return x.getUTCFullYear()===y&&x.getUTCMonth()===n-1&&x.getUTCDate()===d?`${y}-${String(n).padStart(2,'0')}-${String(d).padStart(2,'0')}`:''}
 function prepareSession(input){
  if(!input||typeof input!=='object'||Array.isArray(input))throw Error('場次格式不正確');
  const id=text(input.id), sourceType=input.sourceType==='car'?'car':'historical';
  if(sourceType==='car'?!/^car:[A-Za-z0-9_-]{4,128}$/.test(id):!/^hist:[A-Za-z0-9_-]{8,128}$/.test(id))throw Error('共同場次 ID 不正確');
  if(sourceType==='car'&&text(input.carId)!==id.slice(4))throw Error('正式車團必須沿用既有 Car ID');
  const status=text(input.status||'completed');
  if(!['completed','cancelled','cancelled_no_game','scheduled'].includes(status))throw Error('場次狀態不正確');
  const people=Array.isArray(input.participants)?input.participants:[];if(people.length>100)throw Error('參與者超過上限');
  const seen=new Set(), participants=people.map(p=>{const personId=text(p&&p.personId), role=text(p&&p.role), state=text(p&&p.attendance||'unconfirmed');if(!idOK(personId)||!roles.has(role)||!attendance.has(state))throw Error('參與者 Person／角色／出席狀態不正確');if(seen.has(personId))throw Error('同一 canonical Person 不得重複計入同一場');seen.add(personId);return {personId,role,attendance:state}});
  if(!text(input.scriptName)||text(input.scriptName).length>200)throw Error('劇本名稱不正確');
  const gameDate=date(input.date);if(!gameDate)throw Error('場次日期不正確');
  return {id,sourceType,carId:sourceType==='car'?text(input.carId):'',scriptName:text(input.scriptName),date:gameDate,time:text(input.time),place:text(input.place),status,participants,updatedAt:text(input.updatedAt)};
 }
 function countsAsPlayed(session,participant){return session.status==='completed'&&participant.attendance==='attended'}
 function card(session,participant){return {sessionId:session.id,sourceType:session.sourceType,carId:session.carId||'',scriptName:session.scriptName,date:session.date,time:session.time,place:session.place,role:participant.role,attendance:participant.attendance,countsAsPlayed:countsAsPlayed(session,participant)}}
 function buildPersonView(personId,sessions,revision=0){if(!idOK(personId)||!Array.isArray(sessions))throw Error('Person View 參數不正確');const rows=[],seen=new Set();for(const raw of sessions){const s=prepareSession(raw),p=s.participants.find(x=>x.personId===personId);if(!p)continue;if(seen.has(s.id))throw Error('Person View 場次重複');seen.add(s.id);rows.push(card(s,p))}rows.sort((a,b)=>b.date.localeCompare(a.date)||a.sessionId.localeCompare(b.sessionId));return {viewType:'person_play_history',schemaVersion:1,personId,revision,total:rows.length,playedCount:rows.filter(x=>x.countsAsPlayed).length,sessions:rows}}
 function applySessionToPersonView(personId,view,session,revision=0){const base=view&&Array.isArray(view.sessions)?view.sessions:[],next=base.filter(x=>x.sessionId!==session.id),participant=session.participants.find(x=>x.personId===personId);if(participant)next.push(card(session,participant));next.sort((a,b)=>b.date.localeCompare(a.date)||a.sessionId.localeCompare(b.sessionId));return {viewType:'person_play_history',schemaVersion:1,personId,revision,total:next.length,playedCount:next.filter(x=>x.countsAsPlayed).length,sessions:next}}
 function validatePersonView(view,personId){return !!view&&view.viewType==='person_play_history'&&view.schemaVersion===1&&view.personId===text(personId)&&Array.isArray(view.sessions)&&view.total===view.sessions.length&&view.playedCount===view.sessions.filter(x=>x.countsAsPlayed).length}
 const api=Object.freeze({prepareSession,buildPersonView,applySessionToPersonView,validatePersonView,countsAsPlayed,date});if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.JLYPlayHistoryCore=api;
})(typeof window!=='undefined'?window:null);
