from pathlib import Path
import re

# 1) Settled pairwise records must also consume their original legacy direction.
p = Path('shared/accounting/pairwise-obligation.js')
s = p.read_text(encoding='utf-8')
pattern = re.compile(r'  function applySettlements\(obligations, settlements\) \{.*?\n  \}\n\n  function buildPersonBalances', re.S)
replacement = '''  function applySettlements(obligations, settlements) {
    const buckets = (settlements || [])
      .filter(isCompatibleSettlement)
      .map(record => {
        const directions = new Set();
        const addDirection = (fromValue, toValue) => {
          const from = text(fromValue), to = text(toValue);
          if (from && to && from !== to) directions.add(`${from}\\u0000${to}`);
        };
        addDirection(record.fromPersonId, record.toPersonId);
        addDirection(record.originalFromPersonId, record.originalToPersonId);
        addDirection(record.debtorPersonId, record.receiverPersonId);
        return { remaining: amount(record.amount), directions };
      })
      .filter(bucket => bucket.remaining > 0 && bucket.directions.size > 0);

    return (obligations || [])
      .map(item => {
        const key = `${text(item.fromPersonId)}\\u0000${text(item.toPersonId)}`;
        let remaining = amount(item.amount), settledAmount = 0;
        for (const bucket of buckets) {
          if (!remaining || !bucket.remaining || !bucket.directions.has(key)) continue;
          const used = Math.min(remaining, bucket.remaining);
          remaining -= used;
          bucket.remaining -= used;
          settledAmount += used;
        }
        return {
          ...item,
          originalAmount: item.amount,
          settledAmount,
          amount: remaining
        };
      })
      .filter(item => item.amount > 0);
  }

  function buildPersonBalances'''
s2, n = pattern.subn(lambda _: replacement, s, count=1)
if n != 1:
    raise SystemExit('applySettlements replacement failed')
p.write_text(s2, encoding='utf-8')

# 2) Pending action rows resolve missing amount/counterparty from current pairwise view.
p = Path('js/modules/accounting/accounting-render.js')
s = p.read_text(encoding='utf-8')
pattern = re.compile(r'  function pendingActionHtml\(model,item\) \{.*?\n  \}\n  function buildDashboardHtml', re.S)
replacement = '''  function pendingActionHtml(model,item) {
    const type=item.actionType||"accounting_issue",responsibleId=item.responsiblePersonId||item.debtorPersonId||item.fromPersonId||"",transfers=model.netSettlement&&Array.isArray(model.netSettlement.transfers)?model.netSettlement.transfers:[],fallback=transfers.find(transfer=>type==="payment_confirmation"?transfer.toPersonId===responsibleId:transfer.fromPersonId===responsibleId)||null,fromPersonId=item.fromPersonId||item.debtorPersonId||fallback&&fallback.fromPersonId||"",toPersonId=item.toPersonId||item.receiverPersonId||fallback&&fallback.toPersonId||"",resolvedAmount=Number(item.amount||fallback&&fallback.amount||0),amountText=resolvedAmount?money(resolvedAmount):"",responsible=model.memberNames.get(responsibleId)||"待處理成員",otherId=responsibleId===fromPersonId?toPersonId:responsibleId===toPersonId?fromPersonId:toPersonId||fromPersonId,other=model.memberNames.get(otherId)||"",labels={pending_split:"尚未分帳",payment_due:"待付款",payment_confirmation:"已申報付款，待確認收到",settlement_rejected:"付款申報被退回",delegated_payment_acceptance:"待回覆代付請求",delegated_payment_due:"已接受代付，待實際付款",accounting_issue:"帳務待確認"},targetId=item.transactionId||"";
    const summary=other?`${responsible} → ${other}${amountText?` ${amountText}`:""}`:`${responsible}${amountText?` ${amountText}`:""}`;
    return `<article class="accounting-pending-index-row"><span><strong>${escape(summary)}</strong><small>${escape(labels[type]||type)}</small></span><button type="button" data-accounting-pending-action data-action-type="${escape(type)}" data-responsible-person-id="${escape(responsibleId)}" data-from-person-id="${escape(fromPersonId)}" data-to-person-id="${escape(toPersonId)}" data-amount="${resolvedAmount}" data-transaction-id="${escape(item.transactionId||"")}" data-settlement-id="${escape(item.settlementId||"")}" data-request-id="${escape(item.requestId||"")}" data-source-id="${escape(item.sourceId||targetId)}" data-source-type="${escape(item.sourceType||"")}">${type==="payment_confirmation"?"去確認":type==="pending_split"?"去分帳":"去處理"}</button></article>`;
  }
  function buildDashboardHtml'''
s2, n = pattern.subn(lambda _: replacement, s, count=1)
if n != 1:
    raise SystemExit('pendingActionHtml replacement failed')
s = s2
old = '    return rowsHtml+editor;'
new = '    const fullEditorToggle=canEditTotal?`<button type="button" class="accounting-split-full-edit-toggle">調整整筆分帳</button>`:"";\n    return rowsHtml+fullEditorToggle+editor;'
if s.count(old) != 1:
    raise SystemExit('splitRows return marker missing')
s = s.replace(old, new, 1)
p.write_text(s, encoding='utf-8')

# 3) Split amount click edits only that amount in place.
p = Path('js/modules/accounting/accounting-actions.js')
s = p.read_text(encoding='utf-8')
pattern = re.compile(r'    section\.querySelectorAll\("\.accounting-split-edit-toggle"\)\.forEach\(button=>\{.*?\n    \}\);\n\n    section\.querySelectorAll\("\.accounting-split-inline-editor"\)\.forEach\(form=>\{', re.S)
replacement = '''    section.querySelectorAll(".accounting-split-edit-toggle").forEach(button=>{
      button.addEventListener("click",()=>{
        const article=button.closest(".accounting-entry"),form=article&&article.querySelector(".accounting-split-inline-editor"),target=form&&form.querySelector(`[data-inline-split-id="${button.dataset.splitId}"]`);
        if(!form||!target||target.disabled||button.parentElement.querySelector(".accounting-split-row-editor"))return;
        const original=String(target.value||"0"),wrapper=document.createElement("span");
        wrapper.className="accounting-split-row-editor";
        wrapper.innerHTML=`<input type="number" min="0" step="1" inputmode="numeric" value="${original}" aria-label="修改分帳金額"><button type="button" data-inline-row-save>確認</button><button type="button" data-inline-row-cancel>取消</button><small hidden></small>`;
        button.hidden=true;button.after(wrapper);
        const input=wrapper.querySelector("input"),status=wrapper.querySelector("small"),saveRow=wrapper.querySelector("[data-inline-row-save]"),cancelRow=wrapper.querySelector("[data-inline-row-cancel]");
        const syncDraft=()=>{target.value=input.value;const inputs=[...form.querySelectorAll("[data-inline-split-id]")],totalInput=form.querySelector("[data-inline-total]"),total=Number(totalInput?totalInput.value:form.dataset.total||0),values=inputs.map(node=>Number(node.value)),valid=Number.isFinite(total)&&total>0&&values.every(value=>Number.isFinite(value)&&value>=0),allocated=valid?values.reduce((sum,value)=>sum+value,0):0,diff=total-allocated;status.hidden=valid&&diff===0;status.textContent=!valid?"請輸入正確金額":diff>0?`還差 $${diff.toLocaleString("zh-TW")}`:`超過 $${Math.abs(diff).toLocaleString("zh-TW")}`;return valid&&diff===0;};
        input.addEventListener("input",syncDraft);
        cancelRow.addEventListener("click",()=>{target.value=original;wrapper.remove();button.hidden=false;});
        saveRow.addEventListener("click",()=>{if(!syncDraft())return;saveRow.disabled=true;cancelRow.disabled=true;if(typeof form.requestSubmit==="function")form.requestSubmit();else form.dispatchEvent(new Event("submit",{bubbles:true,cancelable:true}));});
        input.focus();input.select();syncDraft();
      });
    });

    section.querySelectorAll(".accounting-split-full-edit-toggle").forEach(button=>button.addEventListener("click",()=>{
      const article=button.closest(".accounting-entry"),editor=article&&article.querySelector(".accounting-split-inline-editor");if(!editor)return;
      article.querySelectorAll(".accounting-split-row-editor [data-inline-row-cancel]").forEach(cancel=>cancel.click());
      editor.hidden=false;button.closest(".accounting-split-list")?.classList.add("is-editing");
      const first=editor.querySelector("[data-inline-split-id]:not([disabled])");if(first){first.focus();first.select();}
    }));

    section.querySelectorAll(".accounting-split-inline-editor").forEach(form=>{'''
s2, n = pattern.subn(lambda _: replacement, s, count=1)
if n != 1:
    raise SystemExit('split click handler replacement failed')
p.write_text(s2, encoding='utf-8')

# 4) Pending navigation opens Person card even when old action has no sourceId.
p = Path('js/modules/accounting/accounting-controller.js')
s = p.read_text(encoding='utf-8')
old = 'else if(state.view==="people"&&state.personId&&state.sourceId){const target=peoplePanel.querySelector(`[data-accounting-person-id="${CSS.escape(state.personId)}"]`);if(target){target.classList.add("accounting-navigation-target");const toggle=target.querySelector(".accounting-person-toggle"),detail=target.querySelector(".accounting-person-detail");if(detail&&detail.hidden)toggle.click();}}'
new = 'else if(state.view==="people"&&state.personId){const target=peoplePanel.querySelector(`[data-accounting-person-id="${CSS.escape(state.personId)}"]`);if(target){target.classList.add("accounting-navigation-target");const toggle=target.querySelector(".accounting-person-toggle"),detail=target.querySelector(".accounting-person-detail");if(detail&&detail.hidden)toggle.click();const settlementTarget=state.settlementId&&target.querySelector(`[data-settlement-id="${CSS.escape(state.settlementId)}"]`);if(settlementTarget)settlementTarget.classList.add("accounting-navigation-target");const actionTarget=state.subview==="payable"&&target.querySelector(".accounting-person-pay-toggle");if(actionTarget)actionTarget.classList.add("accounting-navigation-target");}}'
if s.count(old) != 1:
    raise SystemExit('applyTarget people marker missing')
p.write_text(s.replace(old,new,1), encoding='utf-8')

# 5) Mobile-safe row editor styling.
p = Path('css/pages/accounting.css')
s = p.read_text(encoding='utf-8')
css = '\n.accounting-split-row-editor{display:inline-flex;align-items:center;justify-content:flex-end;gap:6px;flex-wrap:wrap;max-width:100%}.accounting-split-row-editor input{width:92px;min-width:0;padding:8px 10px;text-align:right}.accounting-split-row-editor button{min-height:38px;padding:7px 10px}.accounting-split-row-editor small{flex-basis:100%;text-align:right;color:#9a5a00}.accounting-split-full-edit-toggle{margin:8px 0 4px auto;display:block;font-size:.9rem}.accounting-navigation-target{scroll-margin-top:110px}\n@media(max-width:520px){.accounting-split-row-editor{width:min(100%,260px)}.accounting-split-row-editor input{flex:1 1 88px}.accounting-split-row-editor button{flex:0 0 auto}}\n'
if '.accounting-split-row-editor{' not in s:
    s += css
p.write_text(s, encoding='utf-8')

# 6) Cache versions.
p = Path('pages/car-detail.html')
s = p.read_text(encoding='utf-8')
replacements = [
    ('../css/pages/accounting.css?v=34','../css/pages/accounting.css?v=35'),
    ('/shared/accounting/pairwise-obligation.js?v=2','/shared/accounting/pairwise-obligation.js?v=3'),
    ('/js/modules/accounting/accounting-render.js?v=23','/js/modules/accounting/accounting-render.js?v=24'),
    ('/js/modules/accounting/accounting-actions.js?v=13','/js/modules/accounting/accounting-actions.js?v=14'),
    ('/js/modules/accounting/accounting-controller.js?v=39','/js/modules/accounting/accounting-controller.js?v=40'),
]
for old,new in replacements:
    if s.count(old) != 1:
        raise SystemExit(f'cache marker missing: {old}')
    s = s.replace(old,new,1)
p.write_text(s, encoding='utf-8')

# 7) Regression tests.
p = Path('tests/accounting/accounting-live-regressions.test.js')
p.write_text('''"use strict";\nconst test = require("node:test");\nconst assert = require("node:assert/strict");\nconst fs = require("node:fs");\nconst path = require("node:path");\nconst pairwise = require("../../shared/accounting/pairwise-obligation");\n\ntest("settled payment consumes the original legacy pair direction", () => {\n  const remaining = pairwise.applySettlements([\n    { obligationId:"o1", fromPersonId:"legacy-debtor", toPersonId:"legacy-receiver", amount:212 },\n    { obligationId:"o2", fromPersonId:"me", toPersonId:"other", amount:87 }\n  ], [\n    { status:"settled", fromPersonId:"canonical-debtor", toPersonId:"canonical-receiver", originalFromPersonId:"legacy-debtor", originalToPersonId:"legacy-receiver", amount:212 }\n  ]);\n  assert.deepEqual(remaining.map(item => ({fromPersonId:item.fromPersonId,toPersonId:item.toPersonId,amount:item.amount})), [\n    { fromPersonId:"me", toPersonId:"other", amount:87 }\n  ]);\n});\n\ntest("pending action row fills missing counterparty and amount from current pairwise transfer", () => {\n  const render = fs.readFileSync(path.join(__dirname,"../../js/modules/accounting/accounting-render.js"),"utf8");\n  assert.match(render,/fallback=transfers\\.find/);\n  assert.match(render,/data-amount=/);\n});\n\ntest("pending navigation opens a Person card without requiring sourceId", () => {\n  const controller = fs.readFileSync(path.join(__dirname,"../../js/modules/accounting/accounting-controller.js"),"utf8");\n  assert.equal(controller.includes('state.view==="people"&&state.personId&&state.sourceId'), false);\n  assert.equal(controller.includes('state.view==="people"&&state.personId'), true);\n});\n\ntest("split amount click edits selected amount in place and keeps full editor explicit", () => {\n  const actions = fs.readFileSync(path.join(__dirname,"../../js/modules/accounting/accounting-actions.js"),"utf8");\n  const render = fs.readFileSync(path.join(__dirname,"../../js/modules/accounting/accounting-render.js"),"utf8");\n  assert.match(actions,/accounting-split-row-editor/);\n  assert.match(actions,/accounting-split-full-edit-toggle/);\n  assert.match(render,/調整整筆分帳/);\n});\n''', encoding='utf-8')
