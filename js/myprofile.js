console.log("myprofile.js 已成功載入！");

const db = window.db;

async function saveMyProfile() {

    const displayName = document.getElementById("displayName").value.trim();
    const defaultPosition = document.getElementById("defaultPosition").value;
    const isCrossPlay = document.getElementById("defaultCrossPlay").checked;

    if (!displayName) {
        alert("請輸入玩家名稱");
        return;
    }

    try {

        const currentPlayerId = localStorage.getItem("currentPlayerId");

        const data = {

            displayName,

            defaultPosition,

            isCrossPlay,

            memberType: "guest",

            isLineLinked: false,

            playCount: 0,

            updatedAt: new Date().toISOString()

        };

        if (currentPlayerId) {

            await db
                .collection("players")
                .doc(currentPlayerId)
                .update(data);

            alert("玩家資料已更新！");

        } else {

            data.createdAt = new Date().toISOString();

            const docRef = await db
                .collection("players")
                .add(data);

            localStorage.setItem("currentPlayerId", docRef.id);
            localStorage.setItem("currentPlayerName", displayName);

            alert("玩家資料建立成功！");

        }

    } catch (error) {

        console.error(error);

        alert(error.message);

    }

}

window.saveMyProfile = saveMyProfile;