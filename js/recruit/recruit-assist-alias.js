console.log("recruit-assist-alias.js 已成功載入！");

(function () {
  "use strict";

  const relations = window.JLYCarRelations;
  const data = window.JLYRecruitData;

  if (
    !relations ||
    !data ||
    typeof relations.getAssistRecruitingCarIds !== "function" ||
    typeof data.resolveOwnerIdentityIds !== "function"
  ) {
    return;
  }

  const getAssistRecruitingCarIds =
    relations.getAssistRecruitingCarIds.bind(relations);

  relations.getAssistRecruitingCarIds = async function (playerId) {
    const identityIds = await data.resolveOwnerIdentityIds(playerId);
    const ids = identityIds.length ? identityIds : [playerId];

    const groups = await Promise.all(
      ids.map(function (identityId) {
        return getAssistRecruitingCarIds(identityId).catch(function () {
          return [];
        });
      })
    );

    return Array.from(
      new Set(
        groups.reduce(function (all, carIds) {
          return all.concat(Array.isArray(carIds) ? carIds : []);
        }, [])
      )
    );
  };
})();
