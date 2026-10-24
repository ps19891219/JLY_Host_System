'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
test('Person merge dry-run reads only the single canonical Prepared View and has no recursive scan path',()=>{const s=fs.readFileSync('scripts/person-canonical-migration-dry-run.js','utf8');assert.match(s,/collection\("personDirectoryViews"\)\.doc\("canonical"\)\.get\(\)/);assert.doesNotMatch(s,/listCollections\(|collection\("players"\)\.get\(/);assert.match(s,/PREPARED_VIEW_ONLY_DRY_RUN/);assert.match(s,/HISTORICAL_REFERENCE_SNAPSHOT_REQUIRED/)});
test('play-history page offers visible LINE identity actions and a bounded MyCar picker',()=>{
  const html=fs.readFileSync('pages/my-play-history.html','utf8'),js=fs.readFileSync('js/play-history-page.js','utf8'),api=fs.readFileSync('api/play-history.js','utf8'),service=fs.readFileSync('services/play-history/service.js','utf8');
  assert.match(html,/id="switchLine"/);
  assert.match(html,/id="identityName"/);
  assert.match(html,/id="carPicker"/);
  assert.match(js,/switchLine'\)\.onclick = login/);
  assert.match(js,/action=my_cars/);
  assert.match(api,/action==="my_cars"/);
  assert.match(service,/collection\("myCarViews"\)/);
  assert.doesNotMatch(service.slice(service.indexOf('async function getMyEndedCars'),service.indexOf('async function peopleForManager')),/collection\("cars"\)|collection\("players"\)|\.where\(/);
});
test('play-history page reads only the authenticated server API and never imports local previews',()=>{const html=fs.readFileSync('pages/my-play-history.html','utf8'),js=fs.readFileSync('js/play-history-page.js','utf8'),api=fs.readFileSync('api/play-history.js','utf8');assert.match(html,/舊預覽資料不會自動匯入/);assert.doesNotMatch(js,/localStorage|sessionStorage/);assert.match(js,/\/api\/play-history\?action=me/);assert.match(api,/authorizedSession/);assert.match(api,/no-store/)});
