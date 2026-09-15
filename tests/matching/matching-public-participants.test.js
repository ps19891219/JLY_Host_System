const fs = require('fs');
const vm = require('vm');
const path = require('path');

const source = fs.readFileSync(path.join(__dirname, '../../js/matching/matching-public-participants.js'), 'utf8');

function loadWindow() {
  const window = {};
  vm.runInNewContext(source, { window, Object, String, Set });
  return window;
}

(function publicResponderAppearsWithoutJoiningCar() {
  const window = loadWindow();
  window.currentMatchingCar = {
    players: [],
    matching: {
      responses: {
        'line-U123': {
          participantType: 'line_user',
          participantKey: 'line:U123',
          participantId: 'person-123',
          participantName: '小明',
          lineUserId: 'U123',
          slotIds: ['2026-10-01|19:00'],
          status: 'submitted',
          source: 'public_matching_line'
        }
      }
    }
  };
  const players = window.currentMatchingCar.players;
  if (players.length !== 1) throw new Error('public LINE responder was not added to Matrix participants');
  if (players[0].playerId !== 'line:U123') throw new Error('Matrix participant key does not match response participantKey');
  if (players[0].playerName !== '小明') throw new Error('public responder display name missing');
  if (!players[0].matchingOnly) throw new Error('public responder must remain matching-only');
})();

(function existingPlayerIsNotDuplicatedByName() {
  const window = loadWindow();
  window.currentMatchingCar = {
    players: [{ id: 'player-1', playerName: '小明' }],
    matching: {
      responses: {
        'line-U123': {
          participantType: 'line_user',
          participantKey: 'line:U123',
          participantName: '小明',
          lineUserId: 'U123',
          status: 'submitted',
          source: 'public_matching_line'
        }
      }
    }
  };
  if (window.currentMatchingCar.players.length !== 1) throw new Error('existing player duplicated by public response');
})();

console.log('matching public participants regression: pass');
