(function (root) {
  "use strict";

  const REPAIR_REVISION = 1;
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

  async function fetchExistingIds(
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

    const existing =
      new Set();

    if (ids.length === 0) {
      return existing;
    }

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
        doc => existing.add(doc.id)
      );
    }

    return existing;
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
        await repairViewOnce(
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
        "MyCar 舊幽靈卡修復失敗：",
        error
      );
    }
  }

  const api = {
    REPAIR_REVISION,
    recalculateView,
    fetchExistingIds,
    repairViewOnce
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
