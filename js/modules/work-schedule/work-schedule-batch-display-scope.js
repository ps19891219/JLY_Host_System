(function(){
'use strict';
if(window.__JLYWorkScheduleBatchDisplayScopeInitialized)return;
window.__JLYWorkScheduleBatchDisplayScopeInitialized=true;

const dashboard=window.JLYWorkScheduleDashboard;
const staffSlots=window.JLYWorkScheduleStaffSlots;
if(!dashboard||!staffSlots||typeof staffSlots.openBatch!=='function')return;

const originalOpenBatch=staffSlots.openBatch.bind(staffSlots);

function displayedRows(){
  const host=document.getElementById('scheduleDashboard');
  const scope=window.JLYWorkScheduleDisplayScope;
  if(!host?.querySelector('.date-search-result'))return null;
  return Array.isArray(scope?.rows)?scope.rows.slice():null;
}

staffSlots.openBatch=async function(){
  const scopedRows=displayedRows();
  if(!scopedRows)return originalOpenBatch();

  const originalGetRows=dashboard.getRows;
  dashboard.getRows=()=>scopedRows.slice();
  try{
    return await originalOpenBatch();
  }finally{
    dashboard.getRows=originalGetRows;
  }
};
})();
