/* JLY Play History: pure preparation layer. No Firebase writes, no identity claims. */
(function(root){
  'use strict';
  const MAX_ROSTER=100, MAX_NAME=200;
  const text=v=>String(v==null?'':v).trim();
  const validId=id=>/^[A-Za-z0-9_-]{6,128}$/.test(text(id));
  function date(value){
    const match=text(value).match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
    if(!match)return '';
    const y=+match[1],m=+match[2],d=+match[3],v=new Date(Date.UTC(y,m-1,d));
    return v.getUTCFullYear()===y&&v.getUTCMonth()===m-1&&v.getUTCDate()===d?[y,String(m).padStart(2,'0'),String(d).padStart(2,'0')].join('-'):'';
  }
  function roster(value){
    if(!Array.isArray(value)||value.length>MAX_ROSTER)throw Error('車友名單格式或數量不正確');
    const names=value.map(text);
    if(names.some(n=>!n||n.length>MAX_NAME))throw Error('車友暱稱格式不正確');
    return Array.from(new Set(names));
  }
  function prepareSession(input){
    if(!input||typeof input!=='object'||Array.isArray(input))throw Error('場次格式不正確');
    const id=text(input.id),name=text(input.name),rawDate=text(input.rawDate||input.date),gameDate=date(input.date||input.rawDate);
    if(!/^r[a-z0-9]{8,40}$/i.test(id)||!name||name.length>200)throw Error('場次 ID 或劇本名稱不正確');
    const names=roster(input.roster||[]);
    const candidates={};
    const source=input.candidates||{};
    if(!source||typeof source!=='object'||Array.isArray(source))throw Error('Person 候選格式不正確');
    for(const [nickname,personId] of Object.entries(source)){
      if(!names.includes(nickname)||!validId(personId))throw Error('Person 候選與車友名單不一致');
      candidates[nickname]=text(personId);
    }
    const link=text(input.link);
    if(link&&!/^car:[A-Za-z0-9_-]{4,128}$/.test(link))throw Error('車團關聯格式不正確');
    return {id,name,date:gameDate,rawDate,time:text(input.time),place:text(input.place),roster:names,candidates,link,attendance:'unverified'};
  }
  function buildReadView(viewerId,sessions,revision){
    if(!validId(viewerId))throw Error('玩家身分 ID 格式不正確');
    if(!Array.isArray(sessions))throw Error('場次清單格式不正確');
    const seen=new Set();
    const items=sessions.map(item=>{
      const session=prepareSession(item);
      if(seen.has(session.id))throw Error('場次 ID 重複，未建立快照');
      seen.add(session.id);
      return session;
    });
    const view={viewType:'play_history_index',schemaVersion:1,viewerId:text(viewerId),revision:Number.isSafeInteger(revision)&&revision>=0?revision:0,total:items.length,sessions:items};
    if(new TextEncoder().encode(JSON.stringify(view)).length>700000)throw Error('快照過大，需採用分頁 Prepared View');
    return view;
  }
  function validateReadView(view,viewerId){
    return !!view&&view.viewType==='play_history_index'&&view.schemaVersion===1&&view.viewerId===text(viewerId)&&Array.isArray(view.sessions)&&view.total===view.sessions.length;
  }
  const api=Object.freeze({prepareSession,buildReadView,validateReadView,date});
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.JLYPlayHistoryCore=api;
})(typeof window!=='undefined'?window:null);
