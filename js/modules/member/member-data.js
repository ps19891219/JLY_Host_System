console.log("member-data.js 已成功載入！");

(function () {

  /*
   * 暫時使用測試資料。
   * 下一步改成讀 Firestore。
   */
  const temporaryMembers = [
    {
      memberId: "temp-kevin",
      displayName: "凱威"
    },
    {
      memberId: "temp-xiaomei",
      displayName: "小美"
    },
    {
      memberId: "temp-azhe",
      displayName: "阿哲"
    },
    {
      memberId: "temp-xiaoan",
      displayName: "小安"
    }
  ];

  async function getMembers(options = {}) {

    return [...temporaryMembers];

  }

  window.JLYMemberData = {

    getMembers

  };

})();