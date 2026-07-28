console.log("staff-controller.js 已成功載入！");

(function () {

function render(car) {

    if (
        !window.JLYStaffData ||
        !window.JLYStaffRender
    ) {
        return "";
    }

    const staffSlots =
        window.JLYStaffData.getStaffSlots(
            car
        );

    return window.JLYStaffRender.renderStaff(
        staffSlots
    );

}

window.JLYStaffController = {

    render

};

})();