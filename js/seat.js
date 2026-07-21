console.log("seat.js 已成功載入！");

/**
 * 建立席位
 */
function buildSlots(car) {

    if (Array.isArray(car.slots) && car.slots.length > 0) {
        return car.slots;
    }

    const slots = [];

    let seatNumber = 1;

    const male = Number(car.maleSlots || 0);
    const female = Number(car.femaleSlots || 0);

    const total = Number(car.totalPeople || 0);

    // 男女模式
    if (male + female > 0) {

        for (let i = 0; i < male; i++) {

            slots.push({
                slotId: seatNumber++,
                type: "male",
                playerId: null,
                originalType: "male"
            });

        }

        for (let i = 0; i < female; i++) {

            slots.push({
                slotId: seatNumber++,
                type: "female",
                playerId: null,
                originalType: "female"
            });

        }

    }

    // 不限模式
    else {

        for (let i = 0; i < total; i++) {

            slots.push({
                slotId: seatNumber++,
                type: "flex",
                playerId: null,
                originalType: "flex"
            });

        }

    }

    return slots;

}

/**
 * 取得席位
 */
function getSlots(car){

    if(!car.slots){

        car.slots = buildSlots(car);

    }

    return car.slots;

}

/**
 * 取得空位數
 */
function getEmptySeatCount(car){

    return getSlots(car).filter(function(slot){

        return !slot.playerId;

    }).length;

}

/**
 * 玩家坐下
 */
function assignPlayerToSeat(car, slotId, playerId){

    const slot = getSlots(car).find(function(item){

        return item.slotId === slotId;

    });

    if(!slot){

        return false;

    }

    slot.playerId = playerId;

    return true;

}

/**
 * 玩家離席
 */
function removePlayerFromSeat(car, playerId){

    getSlots(car).forEach(function(slot){

        if(slot.playerId === playerId){

            slot.playerId = null;

        }

    });

}