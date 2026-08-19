"use strict";

(function (root, factory) {
  const api = factory();

  if (
    typeof module !== "undefined" &&
    module.exports
  ) {
    module.exports = api;
  }

  if (root) {
    root.JLYPendingActions = api;
  }
})(
  typeof window !== "undefined"
    ? window
    : globalThis,
  function () {
    function array(value) {
      return Array.isArray(value)
        ? value
        : [];
    }

    function isPending(value) {
      const status =
        String(
          value == null ? "" : value
        )
          .trim()
          .toLowerCase();

      return (
        !status ||
        status === "pending" ||
        status === "待審核" ||
        status === "待確認"
      );
    }

    function getPendingPlayerApplications(
      car
    ) {
      return array(
        car && car.applications
      ).filter(
        function (app) {
          return (
            app &&
            isPending(
              app.status
            )
          );
        }
      );
    }

    function getPendingDmApplications(
      car
    ) {
      return array(
        car && car.dmApplications
      ).filter(
        function (app) {
          return (
            app &&
            isPending(
              app.status
            )
          );
        }
      );
    }

    function buildRegistrationSummary(
      cars
    ) {
      const result = {
        total: 0,
        playerCount: 0,
        dmCount: 0,
        cars: []
      };

      array(cars).forEach(
        function (car) {
          if (!car) {
            return;
          }

          const players =
            getPendingPlayerApplications(
              car
            );

          const dms =
            getPendingDmApplications(
              car
            );

          if (
            players.length === 0 &&
            dms.length === 0
          ) {
            return;
          }

          result.playerCount +=
            players.length;

          result.dmCount +=
            dms.length;

          result.cars.push({
            car,
            playerApplications:
              players,
            dmApplications:
              dms
          });
        }
      );

      result.total =
        result.playerCount +
        result.dmCount;

      return result;
    }

    return {
      isPending,
      getPendingPlayerApplications,
      getPendingDmApplications,
      buildRegistrationSummary
    };
  }
);
