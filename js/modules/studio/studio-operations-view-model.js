(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.JLYStudioOperationsViewModel=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';
const arr=v=>Array.isArray(v)?v:[],txt=v=>String(v==null?'':v).trim();
const OPEN=new Set(['pending','needs_action','adjustment_proposed','declined','invalidated']);
const ORDER={booking:1,activity_change:2,host_request:3,staff_issue:4,staff_confirmation:5,recruitment:6};
function normalize(x={}){return{id:txt(x.id),type:txt(x.type||'task'),status:txt(x.status||'pending'),title:txt(x.title)||fallbackTitle(x),subtitle:txt(x.subtitle),target:x.target||null,source:x.source||null,createdAt:x.createdAt||null,updatedAt:x.updatedAt||null};}
function fallbackTitle(x){return({booking:'新訂場待處理',activity_change:'場次異動待處理',host_request:'主揪申請待處理',staff_issue:'員工排班異常',staff_confirmation:'員工排班待確認',recruitment:'揪團待處理'})[txt(x.type)]||'待處理事項';}
function group(items=[]){const rows=arr(items).map(normalize).filter(x=>x.id&&OPEN.has(x.status));const buckets={booking:[],activity:[],staff:[],recruitment:[],other:[]};for(const x of rows){if(x.type==='booking')buckets.booking.push(x);else if(['activity_change','host_request'].includes(x.type))buckets.activity.push(x);else if(['staff_issue','staff_confirmation'].includes(x.type))buckets.staff.push(x);else if(x.type==='recruitment')buckets.recruitment.push(x);else buckets.other.push(x);}for(const v of Object.values(buckets))v.sort((a,b)=>(ORDER[a.type]||99)-(ORDER[b.type]||99)||String(a.createdAt||'').localeCompare(String(b.createdAt||'')));return buckets;}
function summary(items=[]){const b=group(items);return{total:Object.values(b).reduce((n,x)=>n+x.length,0),booking:b.booking.length,activity:b.activity.length,staff:b.staff.length,recruitment:b.recruitment.length,other:b.other.length};}
return{normalize,group,summary};
});
