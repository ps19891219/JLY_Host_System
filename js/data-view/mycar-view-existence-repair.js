(function (root) {
  "use strict";

  const REPAIR_REVISION = 1;
  const SEAT_PROJECTION_REPAIR_REVISION = 1;
  const QUERY_CHUNK_SIZE = 10;

  function text(value) {
    return String(
      value == null ? "" : value
    ).trim();
  }

  function recalculateView(
    view,
    existingIds,
    repairedAt
  ) {
    const idSet =
      existingIds instanceof Set
        ? existingIds
        : new Set(
            Array.isArray(existingIds)
              ? existingIds.map(text)
              : []
          );

    const cars =
      (
        view &&
        Array.isArray(view.cars)
          ? view.cars
          : []
      ).filter(
        car =>
          idSet.has(
            text(
              car &&
              (car.id || car.carId)
            )
          )
      );

    return {
      ...(view || {}),
      cars,
      counts: {
        all: cars.length,
        host: cars.filter(
          car => car && car.isHost === true
        ).length,
        player: cars.filter(
          car => car && car.isPlayer === true
        ).length
      },
      existenceRepairRevision:
        REPAIR_REVISION,
      existenceRepairedAt:
        repairedAt ||
        new Date().toISOString()
    };
  }

  function getFirestoreSupport(db) {
    const firestore =
      root.firebase &&
      root.firebase.firestore;

    if (
      !db ||
      !firestore ||
      !firestore.FieldPath
    ) {
      throw new Error(
        "mycar_existence_repair_firestore_unavailable"
      );
    }

    return firestore;
  }

  async function fetchCoreCars(
    db,
    carIds
  ) {
    const ids =
      Array.from(
        new Set(
          (Array.isArray(carIds)
            ? carIds
            : [])
            .map(text)
            .filter(Boolean)
        )
      );

    const cars =
      new Map();

    if (ids.length === 0) {
      return cars;
    }

    const firestore =
      getFirestoreSupport(db);

    for (
      let index = 0;
      index < ids.length;
      index += QUERY_CHUNK_SIZE
    ) {
      const chunk =
        ids.slice(
          index,
          index + QUERY_CHUNK_SIZE
        );

      const snapshot =
        await db
          .collection("cars")
          .where(
            firestore.FieldPath.documentId(),
            "in",
            chunk
          )
          .get();

      snapshot.docs.forEach(
        function (doc) {
          cars.set(
            doc.id,
            {
              id: doc.id,
              ...(doc.data() || {})
            }
          );
        }
      );
    }

    return cars;
  }

  async function fetchExistingIds(
    db,
    carIds
  ) {
    const cars =
      await fetchCoreCars(
        db,
        carIds
      );

    return new Set(
      Array.from(cars.keys())
    );
  }

  function seatProjectionSnapshot(car) {
    const source =
      car &&
      typeof car === "object"
        ? car
        : {};

    return {
      totalPeople:
        Number(source.totalPeople || 0),
      maleSlots:
        Number(source.maleSlots || 0),
      femaleSlots:
        Number(source.femaleSlots || 0),
      flexibleSlots:
        Number(source.flexibleSlots || 0),
      seatSummary:
        source.seatSummary &&
        typeof source.seatSummary === "object"
          ? { ...source.seatSummary }
          : null,
      players:
        Array.isArray(source.players)
          ? source.players.map(
              player => ({ ...(player || {}) })
            )
          : []
    };
  }

  function mergeSeatProjection(
    preparedCar,
    compactCoreCar
  ) {
    const current =
      preparedCar &&
      typeof preparedCar === "object"
        ? preparedCar
        : {};

    const fresh =
      compactCoreCar &&
      typeof compactCoreCar === "object"
        ? compactCoreCar
        : {};

    return {
      ...current,
      totalPeople:
        Number(fresh.totalPeople || 0),
      maleSlots:
        Number(fresh.maleSlots || 0),
      femaleSlots:
        Number(fresh.femaleSlots || 0),
      flexibleSlots:
        Number(fresh.flexibleSlots || 0),
      seatSummary:
        fresh.seatSummary &&
        typeof fresh.seatSummary === "object"
          ? { ...fresh.seatSummary }
          : null,
      players:
        Array.isArray(fresh.players)
          ? fresh.players.map(
              player => ({ ...(player || {}) })
            )
          : []
    };
  }

  function repairSeatProjection(
    view,
    coreCars,
    compactCar,
    repairedAt
  ) {
    const sourceView =
      view &&
      typeof view === "object"
        ? view
        : {};

    const identityIds =
      Array.from(
        new Set(
          [
            text(sourceView.viewerId),
            ...(Array.isArray(sourceView.identityIds)
              ? sourceView.identityIds
              : [])
          ]
            .map(text)
            .filter(Boolean)
        )
      );

    let changedCount = 0;
    let removedCount = 0;

    const cars = [];

    (
      Array.isArray(sourceView.cars)
        ? sourceView.cars
        : []
    ).forEach(
      function (preparedCar) {
        const carId =
          text(
            preparedCar &&
            (preparedCar.id || preparedCar.carId)
          );

        const coreCar =
          coreCars instanceof Map
            ? coreCars.get(carId)
            : null;

        if (!coreCar) {
          removedCount += 1;
          return;
        }

        const freshCompact =
          compactCar(
            coreCar,
            identityIds
          );

        const before =
          seatProjectionSnapshot(
            preparedCar
          );

        const merged =
          mergeSeatProjection(
            preparedCar,
            freshCompact
          );

        const after =
          seatProjectionSnapshot(
            merged
          );

        if (
          JSON.stringify(before) !==
          JSON.stringify(after)
        ) {
          changedCount += 1;
        }

        cars.push(merged);
      }
    );

    return {
      ...sourceView,
      cars,
      counts: {
        all: cars.length,
        host: cars.filter(
          car => car && car.isHost === true
        ).length,
        player: cars.filter(
          car => car && car.isPlayer === true
        ).length
      },
      existenceRepairRevision:
        REPAIR_REVISION,
      existenceRepairedAt:
        sourceView.existenceRepairedAt ||
        repairedAt ||
        new Date().toISOString(),
      seatProjectionRepairRevision:
        SEAT_PROJECTION_REPAIR_REVISION,
      seatProjectionRepairedAt:
        repairedAt ||
        new Date().toISOString(),
      seatProjectionRepairChangedCount:
        changedCount,
      seatProjectionRepairRemovedCount:
        removedCount
    };
  }

  async function repairViewOnce(
    module,
    viewerId
  ) {
    if (
      !module ||
      typeof module.read !== "function" ||
      typeof module.write !== "function"
    ) {
      return {
        changed: false,
        skipped: "module_unavailable"
      };
    }

    const view =
      await module.read(viewerId);

    if (!view) {
      return {
        changed: false,
        skipped: "view_missing"
      };
    }

    if (
      Number(
        view.existenceRepairRevision || 0
      ) >= REPAIR_REVISION
    ) {
      return {
        changed: false,
        skipped: "already_repaired"
      };
    }

    const carIds =
      (
        Array.isArray(view.cars)
          ? view.cars
          : []
      )
        .map(
          car =>
            text(
              car &&
              (car.id || car.carId)
            )
        )
        .filter(Boolean);

    const existingIds =
      await fetchExistingIds(
        root.db,
        carIds
      );

    const next =
      recalculateView(
        view,
        existingIds
      );

    await module.write(next);

    return {
      changed:
        next.cars.length !==
        carIds.length,
      removedCount:
        Math.max(
          carIds.length -
          next.cars.length,
          0
        ),
      view: next
    };
  }

  async function repairSeatProjectionOnce(
    module,
    viewerId
  ) {
    if (
      !module ||
      typeof module.read !== "function" ||
      typeof module.write !== "function" ||
      typeof module.compactCar !== "function"
    ) {
      return {
        changed: false,
        skipped: "module_unavailable"
      };
    }

    const view =
      await module.read(viewerId);

    if (!view) {
      return {
        changed: false,
        skipped: "view_missing"
      };
    }

    if (
      Number(
        view.seatProjectionRepairRevision || 0
      ) >= SEAT_PROJECTION_REPAIR_REVISION
    ) {
      return {
        changed: false,
        skipped: "already_repaired"
      };
    }

    const carIds =
      (
        Array.isArray(view.cars)
          ? view.cars
          : []
      )
        .map(
          car =>
            text(
              car &&
              (car.id || car.carId)
            )
        )
        .filter(Boolean);

    const coreCars =
      await fetchCoreCars(
        root.db,
        carIds
      );

    const next =
      repairSeatProjection(
        view,
        coreCars,
        module.compactCar
      );

    await module.write(next);

    return {
      changed:
        Number(
          next.seatProjectionRepairChangedCount || 0
        ) > 0 ||
        Number(
          next.seatProjectionRepairRemovedCount || 0
        ) > 0,
      changedCount:
        Number(
          next.seatProjectionRepairChangedCount || 0
        ),
      removedCount:
        Number(
          next.seatProjectionRepairRemovedCount || 0
        ),
      view: next
    };
  }

  async function runBrowserRepair() {
    try {
      if (
        typeof root.ensureMyCarViewModule !==
          "function"
      ) {
        return;
      }

      const viewerId =
        root.JLYIdentity &&
        typeof root.JLYIdentity
          .getCurrentPlayerId ===
          "function"
          ? root.JLYIdentity
              .getCurrentPlayerId()
          : text(
              root.localStorage &&
              root.localStorage
                .getItem("currentPlayerId")
            );

      if (!viewerId) {
        return;
      }

      const module =
        await root.ensureMyCarViewModule();

      const result =
        await repairSeatProjectionOnce(
          module,
          viewerId
        );

      if (
        result.changed &&
        typeof root.renderMyCars ===
          "function"
      ) {
        if (
          typeof root.resetMyCarPagination ===
            "function"
        ) {
          root.resetMyCarPagination();
        }

        await root.renderMyCars({
          restoreScroll: false
        });
      }
    } catch (error) {
      console.warn(
        "MyCar Seat Prepared View 一次性修復失敗：",
        error
      );
    }
  }

  const api = {
    REPAIR_REVISION,
    SEAT_PROJECTION_REPAIR_REVISION,
    recalculateView,
    fetchExistingIds,
    fetchCoreCars,
    seatProjectionSnapshot,
    mergeSeatProjection,
    repairSeatProjection,
    repairViewOnce,
    repairSeatProjectionOnce
  };

  root.JLYMyCarViewExistenceRepair =
    api;

  if (
    typeof module !== "undefined" &&
    module.exports
  ) {
    module.exports = api;
  }

  if (
    typeof document !== "undefined"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      function () {
        runBrowserRepair();
      }
    );
  }
})(
  typeof window !== "undefined"
    ? window
    : globalThis
);
