(function(){
'use strict';
const params=new URLSearchParams(location.search);
const studio=String(params.get('studio')||'').trim();
if(!studio)return;
const staffEntry=`/pages/work-schedule-staff.html?studio=${encodeURIComponent(studio)}`;
window.JLYWorkScheduleStaffEntry={studio,staffEntry};
})();
