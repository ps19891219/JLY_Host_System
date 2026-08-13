(function () {
  "use strict";
  function bind(config) {
    const section = config.section, form = section.querySelector("#accountingQuickForm"), status = section.querySelector("#accountingFormStatus");
    section.querySelector("#accountingQuickOpen").addEventListener("click", () => { form.hidden = false; form.scrollIntoView({behavior:"smooth",block:"center"}); });
    section.querySelector("#accountingCancel").addEventListener("click", () => { form.hidden = true; status.hidden = true; });
    form.addEventListener("submit", async event => {
      event.preventDefault(); const button=section.querySelector("#accountingSave");
      button.disabled=true; button.textContent="儲存中…"; status.hidden=false; status.textContent="正在儲存…";
      try { await config.onSave({title:section.querySelector("#accountingTitle").value,amount:Number(section.querySelector("#accountingAmount").value),paidBy:section.querySelector("#accountingPaidBy").value}); status.textContent="✅ 已記下來，稍後可再分帳"; form.reset(); setTimeout(config.onReload,500); }
      catch(error){ status.textContent=error.message==="identity_required"?"請先完成 JLY 身分設定。":error.message==="activity_membership_required"?"只有這台車的正式成員可以新增帳目。":"儲存失敗，請稍後再試。"; button.disabled=false; button.textContent="記下來"; }
    });
  }
  window.JLYAccountingActions = { bind };
})();
