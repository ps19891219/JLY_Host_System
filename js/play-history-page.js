(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const esc = value => String(value == null ? '' : value).replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
  let view = null;
  let viewer = null;
  let people = [];
  let editing = null;

  async function api(url, method = 'GET', payload) {
    const response = await fetch(url, {
      method,
      credentials: 'same-origin',
      headers: method === 'POST' ? { 'Content-Type': 'application/json' } : undefined,
      body: payload ? JSON.stringify(payload) : undefined
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'request_failed');
    return data;
  }

  function login() {
    window.JLYLineLogin?.start({
      returnPath: location.pathname + location.search,
      returnUrl: location.href,
      purpose: 'play_history_view'
    }).catch(error => { $('gateText').textContent = `LINE 登入無法啟動：${error.message || error}`; });
  }

  function showGate(message, showLogin = true) {
    $('gateText').textContent = message;
    $('login').classList.toggle('hidden', !showLogin);
  }

  function cardHtml(row) {
    const roles = { host: '主揪', player: '玩家', dm: 'DM', npc: 'NPC' };
    const attendance = { unconfirmed: '出席未確認', absent: '未出席', cancelled: '已取消' };
    return `<article class="card session"><div class="main"><div class="title">${esc(row.scriptName)}</div>` +
      `<div class="meta">${esc(row.date)}${row.time ? ` · ${esc(row.time)}` : ''}${row.place ? ` · ${esc(row.place)}` : ''}</div>` +
      `<div><span class="badge">${esc(roles[row.role] || row.role)}</span><span class="badge ${row.countsAsPlayed ? 'played' : ''}">` +
      `${row.countsAsPlayed ? '已計入已玩' : esc(attendance[row.attendance] || '未計入')}</span>` +
      `<span class="badge">${row.sourceType === 'car' ? '既有車團' : '歷史補登'}</span></div>` +
      `<div class="actions"><button data-detail="${esc(row.sessionId)}">查看共同參與者</button>` +
      `${viewer?.manager && row.sourceType === 'historical' ? `<button data-edit="${esc(row.sessionId)}">編輯</button>` : ''}</div></div></article>`;
  }

  function render() {
    const rows = (view?.sessions || []).filter(row => {
      const search = $('search').value.trim().toLowerCase();
      if (search && !row.scriptName.toLowerCase().includes(search)) return false;
      const filter = $('filter').value;
      return filter === 'all' || (filter === 'played' ? row.countsAsPlayed : !row.countsAsPlayed);
    });
    $('played').textContent = String(view?.playedCount || 0);
    $('total').textContent = String(view?.total || 0);
    $('people').textContent = String(rows.length);
    $('list').innerHTML = rows.length ? rows.map(cardHtml).join('') : '<p class="muted">目前沒有遊玩紀錄。</p>';
  }

  function roleSelect(value = 'player') {
    return `<select class="role"><option value="player" ${value === 'player' ? 'selected' : ''}>玩家</option>` +
      `<option value="host" ${value === 'host' ? 'selected' : ''}>主揪</option><option value="dm" ${value === 'dm' ? 'selected' : ''}>DM</option>` +
      `<option value="npc" ${value === 'npc' ? 'selected' : ''}>NPC</option></select>`;
  }

  function attendanceSelect(value = 'attended') {
    return `<select class="attendance"><option value="attended" ${value === 'attended' ? 'selected' : ''}>已出席</option>` +
      `<option value="unconfirmed" ${value === 'unconfirmed' ? 'selected' : ''}>未確認</option>` +
      `<option value="absent" ${value === 'absent' ? 'selected' : ''}>未出席</option>` +
      `<option value="cancelled" ${value === 'cancelled' ? 'selected' : ''}>已取消</option></select>`;
  }

  function addRow(personId = '', role = 'player', attendance = 'attended', containerId = 'roster', displayName = '') {
    const container = $(containerId);
    const options = people.slice();
    if (personId && !options.some(person => person.id === personId)) {
      options.push({ id: personId, displayName: displayName || personId });
    }
    const row = document.createElement('div');
    row.className = 'participant-row';
    row.innerHTML = `<select class="person"><option value="">選擇 Person</option>${options.map(person =>
      `<option value="${esc(person.id)}" ${person.id === personId ? 'selected' : ''}>${esc(person.displayName)}${person.memberType ? ` · ${esc(person.memberType)}` : ''}</option>`
    ).join('')}</select>${roleSelect(role)}${attendanceSelect(attendance)}<button type="button" class="remove">移除</button>`;
    row.querySelector('.remove').onclick = () => row.remove();
    container.appendChild(row);
  }

  function readParticipants(containerId = 'roster') {
    return [...$(containerId).querySelectorAll('.participant-row')].map(row => ({
      personId: row.querySelector('.person').value,
      role: row.querySelector('.role').value,
      attendance: row.querySelector('.attendance').value
    })).filter(person => person.personId);
  }

  async function load() {
    try {
      const result = await api('/api/play-history?action=me');
      viewer = result.viewer;
      $('identityName').textContent = (viewer?.displayName || 'LINE 已登入') + ' · 已連結 JLY';
      view = result.view || { sessions: [], total: 0, playedCount: 0 };
      $('gate').classList.add('hidden');
      $('app').classList.remove('hidden');
      $('carManager').classList.remove('hidden');
      if (viewer.manager) {
        $('manager').classList.remove('hidden');
        const directory = await api('/api/play-history?action=people');
        people = directory.people || [];
        if (!editing && !$('roster').children.length) addRow();
      }
      render();
    } catch (error) {
      $('app').classList.add('hidden');
      $('gate').classList.remove('hidden');
      if (error.message === 'line_login_required' || error.message === 'identity_not_linked') {
        showGate(error.message === 'identity_not_linked'
          ? '此 LINE 帳號尚未完成既有 Person 身分認領。請先從既有車團／身分認領流程完成連結，再回到此頁。'
          : '請先使用已連結 JLY Person 的 LINE 帳號登入。');
      } else {
        showGate(`讀取失敗：${error.message}`, false);
      }
    }
  }

  function resetForm() {
    editing = null;
    $('scriptName').value = '';
    $('date').value = '';
    $('time').value = '';
    $('place').value = '';
    $('sessionId').value = '';
    $('roster').innerHTML = '';
    addRow();
    $('saveHistory').textContent = '儲存共同場次';
  }

  function edit(id, detail) {
    editing = id;
    $('sessionId').value = id;
    $('scriptName').value = detail.scriptName;
    $('date').value = detail.date;
    $('time').value = detail.time || '';
    $('place').value = detail.place || '';
    $('roster').innerHTML = '';
    detail.participants.forEach(person => addRow(person.personId, person.role, person.attendance));
    $('saveHistory').textContent = '更新共同場次';
    $('manager').scrollIntoView({ behavior: 'smooth' });
  }

  $('login').onclick = login;
  $('switchLine').onclick = login;
  $('carPicker').onchange = () => {
    $('carId').value = $('carPicker').value;
    $('carRoster').innerHTML = '';
  };
  $('refreshCars').onclick = async () => {
    const button = $('refreshCars');
    button.disabled = true;
    $('carPickerHint').textContent = '讀取既有「我的車」索引中…';
    try {
      const result = await api('/api/play-history?action=my_cars');
      const picker = $('carPicker');
      picker.innerHTML = '<option value="">選擇一台已結束車團</option>';
      for (const car of result.cars || []) {
        const option = document.createElement('option');
        option.value = car.carId;
        option.textContent = [car.scriptName, car.gameDate, car.gameTime].filter(Boolean).join(' · ');
        picker.appendChild(option);
      }
      $('carPickerHint').textContent = result.cars?.length
        ? `找到 ${result.cars.length} 台已結束車團，選擇後點「帶入這台車的參與名單」。`
        : '尚未從「我的車」找到已結束的車團。可以先到「我的車」確認場次狀態，或使用原 Car ID。';
    } catch (error) {
      $('carPickerHint').textContent = '無法讀取「我的車」清單：' + error.message + '。仍可使用原 Car ID。';
    } finally { button.disabled = false; }
  };
  $('search').oninput = render;
  $('filter').onchange = render;
  $('addParticipant').onclick = () => addRow();
  $('saveHistory').onclick = async () => {
    try {
      const participants = readParticipants();
      if (!participants.length) throw new Error('至少加入一位參與者');
      const result = await api('/api/play-history', 'POST', {
        action: 'history_upsert',
        id: $('sessionId').value.trim() || undefined,
        scriptName: $('scriptName').value.trim(), date: $('date').value,
        time: $('time').value, place: $('place').value.trim(), status: 'completed', participants
      });
      $('status').textContent = `共同場次已儲存：${result.result.sessionId}`;
      resetForm();
      await load();
    } catch (error) {
      $('status').textContent = `儲存失敗：${error.message}`;
      $('status').className = 'error';
    }
  };

  $('loadCarRoster').onclick = async () => {
    try {
      const carId = $('carId').value.trim();
      if (!carId) throw new Error('請先讀取並選擇已結束車團，或輸入既有 Car ID');
      const result = await api(`/api/play-history?action=car_roster&carId=${encodeURIComponent(carId)}`);
      $('carRoster').innerHTML = '';
      $('carPicker').value = [...$('carPicker').options].some(option => option.value === carId) ? carId : '';
      result.participants.forEach(person => addRow(person.personId, person.role, person.attendance, 'carRoster', person.displayName));
      $('status').textContent = `已帶入 ${result.participants.length} 位 Car 參與者，請確認實際出席狀態。`;
      $('status').className = 'success';
    } catch (error) {
      $('status').textContent = `讀取 Car 名單失敗：${error.message}`;
      $('status').className = 'error';
    }
  };

  $('completeCar').onclick = async () => {
    try {
      const carId = $('carId').value.trim();
      if (!carId) throw new Error('請輸入既有 Car ID');
      const attendance = Object.fromEntries(readParticipants('carRoster').map(person => [person.personId, person.attendance]));
      const result = await api('/api/play-history', 'POST', { action: 'car_complete', carId, attendance });
      $('status').textContent = `已更新既有 Car：${result.result.sessionId}；沒有建立第二台車。`;
      $('status').className = 'success';
      await load();
    } catch (error) {
      $('status').textContent = `更新 Car 失敗：${error.message}`;
      $('status').className = 'error';
    }
  };

  $('list').onclick = async event => {
    const editButton = event.target.closest('[data-edit]');
    const detailButton = event.target.closest('[data-detail]');
    if (editButton) {
      try {
        const result = await api(`/api/play-history?action=session&id=${encodeURIComponent(editButton.dataset.edit)}`);
        edit(editButton.dataset.edit, result.session);
      } catch (error) {
        $('status').textContent = `讀取場次失敗：${error.message}`;
      }
      return;
    }
    if (!detailButton) return;
    try {
      const result = await api(`/api/play-history?action=session&id=${encodeURIComponent(detailButton.dataset.detail)}`);
      $('detailTitle').textContent = result.session.scriptName;
      $('detailMeta').textContent = `${result.session.date}${result.session.time ? ` · ${result.session.time}` : ''}${result.session.place ? ` · ${result.session.place}` : ''}`;
      $('detailRoster').innerHTML = result.participants.map(person =>
        `<li>${esc(person.displayName || 'JLY 人員')} · ${esc(({ host: '主揪', player: '玩家', dm: 'DM', npc: 'NPC' })[person.role] || person.role)}` +
        ` · ${esc(({ attended: '已出席', absent: '未出席', cancelled: '已取消', unconfirmed: '未確認' })[person.attendance] || person.attendance)}</li>`
      ).join('');
      $('editSession').classList.toggle('hidden', !viewer?.manager || result.session.sourceType !== 'historical');
      $('editSession').onclick = () => {
        document.querySelector('#detail').close();
        edit(result.session.id, result.session);
      };
      $('detail').showModal();
    } catch (error) {
      $('status').textContent = `無法查看參與名單：${error.message}`;
    }
  };
  $('closeDetail').onclick = () => $('detail').close();
  load();
})();
