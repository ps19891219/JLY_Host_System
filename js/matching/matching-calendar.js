(function () {
  "use strict";

  function pad(value) {
    return String(value).padStart(
      2,
      "0"
    );
  }

  function toDateKey(date) {
    return (
      date.getFullYear() +
      "-" +
      pad(date.getMonth() + 1) +
      "-" +
      pad(date.getDate())
    );
  }

  function parseDateKey(dateKey) {
    const parts =
      String(dateKey || "")
        .split("-")
        .map(Number);

    if (parts.length !== 3) {
      return null;
    }

    return new Date(
      parts[0],
      parts[1] - 1,
      parts[2]
    );
  }

  function formatMonthTitle(
    year,
    month
  ) {
    return (
      year +
      " 年 " +
      (month + 1) +
      " 月"
    );
  }

  function getSelectedDates() {
    const car =
      window.currentMatchingCar;

    const dates =
      car &&
      car.matching &&
      Array.isArray(
        car.matching.selectedDates
      )
        ? car.matching.selectedDates
        : [];

    return new Set(dates);
  }

  function setSelectedDates(
    dateKeys
  ) {
    const car =
      window.currentMatchingCar;

    if (
      !car ||
      !car.matching
    ) {
      return;
    }

    car.matching = {
      ...car.matching,

      selectedDates:
        Array.from(
          new Set(dateKeys)
        ).sort()
    };
  }

  function getCalendarState() {
    if (
      !window
        .JLYMatchingCalendarState
    ) {
      const now =
        new Date();

      window
        .JLYMatchingCalendarState = {
          year:
            now.getFullYear(),

          month:
            now.getMonth()
        };
    }

    return window
      .JLYMatchingCalendarState;
  }

  function buildCalendarDays(
    year,
    month
  ) {
    const firstDay =
      new Date(
        year,
        month,
        1
      );

    const lastDay =
      new Date(
        year,
        month + 1,
        0
      );

    const previousMonthLast =
      new Date(
        year,
        month,
        0
      );

    const leadingCount =
      firstDay.getDay();

    const days = [];

    for (
      let index =
        leadingCount - 1;
      index >= 0;
      index -= 1
    ) {
      const date =
        new Date(
          year,
          month - 1,
          previousMonthLast
            .getDate() -
            index
        );

      days.push({
        date,
        isCurrentMonth:
          false
      });
    }

    for (
      let day = 1;
      day <=
      lastDay.getDate();
      day += 1
    ) {
      days.push({
        date:
          new Date(
            year,
            month,
            day
          ),

        isCurrentMonth:
          true
      });
    }

    while (
      days.length % 7 !== 0
    ) {
      const offset =
        days.length -
        leadingCount -
        lastDay.getDate() +
        1;

      days.push({
        date:
          new Date(
            year,
            month + 1,
            offset
          ),

        isCurrentMonth:
          false
      });
    }

    return days;
  }

  function renderCalendar() {
    const container =
      document.getElementById(
        "matchingCalendar"
      );

    if (!container) {
      return;
    }

    const state =
      getCalendarState();

    const selectedDates =
      getSelectedDates();

    const days =
      buildCalendarDays(
        state.year,
        state.month
      );

    container.innerHTML = `
      <div class="matching-calendar-toolbar">
        <button
          type="button"
          class="matching-calendar-nav"
          onclick="changeMatchingMonth(-1)"
          aria-label="上一個月"
        >
          ‹
        </button>

        <strong class="matching-calendar-title">
          ${formatMonthTitle(
            state.year,
            state.month
          )}
        </strong>

        <button
          type="button"
          class="matching-calendar-nav"
          onclick="changeMatchingMonth(1)"
          aria-label="下一個月"
        >
          ›
        </button>
      </div>

      <div class="matching-calendar-weekdays">
        <span>日</span>
        <span>一</span>
        <span>二</span>
        <span>三</span>
        <span>四</span>
        <span>五</span>
        <span>六</span>
      </div>

      <div class="matching-calendar-grid">
        ${
          days
            .map(function (
              item
            ) {
              const dateKey =
                toDateKey(
                  item.date
                );

              const isSelected =
                selectedDates.has(
                  dateKey
                );

              return `
                <button
                  type="button"
                  class="
                    matching-calendar-day
                    ${
                      item
                        .isCurrentMonth
                        ? ""
                        : "is-other-month"
                    }
                    ${
                      isSelected
                        ? "is-selected"
                        : ""
                    }
                  "
                  onclick="toggleMatchingDate('${dateKey}')"
                >
                  ${item.date.getDate()}
                </button>
              `;
            })
            .join("")
        }
      </div>
    `;
  }

  function toggleDate(
    dateKey
  ) {
    const selected =
      getSelectedDates();

    if (
      selected.has(dateKey)
    ) {
      selected.delete(dateKey);
    } else {
      selected.add(dateKey);
    }

    setSelectedDates(
      Array.from(selected)
    );

    renderCalendar();

    if (
      window
        .JLYMatchingActions &&
      typeof window
        .JLYMatchingActions
        .refreshCandidatePreview ===
        "function"
    ) {
      window
        .JLYMatchingActions
        .refreshCandidatePreview();
    }
  }

  function changeMonth(
    amount
  ) {
    const state =
      getCalendarState();

    const nextDate =
      new Date(
        state.year,
        state.month + amount,
        1
      );

    state.year =
      nextDate.getFullYear();

    state.month =
      nextDate.getMonth();

    renderCalendar();
  }

  function initializeFromDates(
    dateKeys
  ) {
    const validDates =
      Array.isArray(dateKeys)
        ? dateKeys
            .map(parseDateKey)
            .filter(Boolean)
        : [];

    if (
      validDates.length === 0
    ) {
      return;
    }

    const first =
      validDates[0];

    window
      .JLYMatchingCalendarState = {
        year:
          first.getFullYear(),

        month:
          first.getMonth()
      };
  }

  window.toggleMatchingDate =
    toggleDate;

  window.changeMatchingMonth =
    changeMonth;

  window.JLYMatchingCalendar = {
    renderCalendar,
    initializeFromDates,
    toDateKey,
    parseDateKey
  };

  console.log(
    "✅ Matching Calendar V1 已載入"
  );
})();