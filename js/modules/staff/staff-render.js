console.log("staff-render.js 已成功載入！");

(function () {

function escapeHtml(text) {
    return String(text || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

function renderStaff(staffSlots) {

    if (!Array.isArray(staffSlots)) {
        staffSlots = [];
    }

    let html = `
        <section class="staff-section">

            <h3>🎭 工作人員</h3>

            <button
                type="button"
                class="staff-add-button"
            >
                ＋ 新增工作人員
            </button>

    `;

    if (staffSlots.length === 0) {

        html += `
            <div class="staff-empty">
                尚未建立任何工作人員
            </div>
        `;

    } else {

        staffSlots.forEach(function (staff) {

            html += `
                <div class="staff-card">

                    <div class="staff-label">
                        ${escapeHtml(staff.label)}
                    </div>

                    <div class="staff-name">
                        ${
                            staff.displayName ||
                            "尚未安排"
                        }
                    </div>

                </div>
            `;

        });

    }

    html += `
        </section>
    `;

    return html;
}

window.JLYStaffRender = {

    renderStaff

};

})();