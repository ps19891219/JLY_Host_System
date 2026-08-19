/*
JLY Host System

Module:
LINE Message Builder V1

Responsibilities:

1. Build LINE reminder message text
2. Read Activity data at render/send time
3. Do not persist duplicated Activity fields
4. Keep templates extensible
*/

(function () {
  "use strict";


  const DEFAULT_CUSTOM_MESSAGE =
    "大家明天見唷～～～請準時到場❤️\n" +
    "有問題請提前回報，感謝🙏";


  function text(value) {
    return String(
      value == null
        ? ""
        : value
    ).trim();
  }


  function getScriptName(car) {
    return text(
      car &&
      (
        car.scriptName ||
        car.title ||
        car.name
      )
    );
  }


  function getDate(car) {
    return text(
      car &&
      (
        car.gameDate ||
        car.date ||
        car.startDate
      )
    );
  }


  function getTime(car) {
    return text(
      car &&
      (
        car.gameTime ||
        car.time ||
        car.startTime
      )
    );
  }


  function getLocation(car) {
    return text(
      car &&
      (
        car.location ||
        car.address
      )
    );
  }


  function getStudio(car) {
    return text(
      car &&
      (
        car.studioName ||
        car.studio ||
        car.storeName
      )
    );
  }


  function buildPreTripDefault(
    car,
    config
  ) {
    const lines = [];

    const scriptName =
      getScriptName(car);

    const date =
      getDate(car);

    const time =
      getTime(car);

    const studio =
      getStudio(car);

    const location =
      getLocation(car);

    const customMessage =
      text(
        config &&
        config.customMessage
      ) ||
      DEFAULT_CUSTOM_MESSAGE;


    lines.push(
      "🐻 JLY 行前提醒"
    );

    lines.push("");

    if (scriptName) {
      lines.push(
        `明天就是《${scriptName}》囉！`
      );
    } else {
      lines.push(
        "明天就是我們的活動囉！"
      );
    }

    lines.push("");

    if (date) {
      lines.push(
        `📅 日期：${date}`
      );
    }

    if (time) {
      lines.push(
        `⏰ 時間：${time}`
      );
    }

    if (studio) {
      lines.push(
        `🏠 工作室：${studio}`
      );
    }

    if (location) {
      lines.push(
        `📍 地點：${location}`
      );
    }

    if (customMessage) {
      lines.push("");
      lines.push(
        customMessage
      );
    }

    return lines.join("\n");
  }


  function buildReminderMessage(
    car,
    config
  ) {
    const templateId =
      text(
        config &&
        config.templateId
      ) ||
      "pre_trip_default_v1";

    switch (templateId) {
      case "pre_trip_default_v1":
      default:
        return buildPreTripDefault(
          car,
          config
        );
    }
  }


  window.JLYLineMessage = {
    buildReminderMessage,
    buildPreTripDefault
  };
})();
