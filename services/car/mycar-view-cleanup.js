"use strict";

function text(value) {
  return String(
    value == null ? "" : value
  ).trim();
}

function removeCarFromView(
  view,
  carId,
  builtAt
) {
  const source =
    view && typeof view === "object"
      ? view
      : null;

  const id = text(carId);

  if (!source || !id) {
    return {
      changed: false,
      view: source
    };
  }

  const cars =
    Array.isArray(source.cars)
      ? source.cars
      : [];

  const nextCars = cars.filter(
    car =>
      text(
        car && (car.id || car.carId)
      ) !== id
  );

  if (nextCars.length === cars.length) {
    return {
      changed: false,
      view: source
    };
  }

  return {
    changed: true,
    view: {
      ...source,
      cars: nextCars,
      counts: {
        all: nextCars.length,
        host: nextCars.filter(
          car => car && car.isHost === true
        ).length,
        player: nextCars.filter(
          car => car && car.isPlayer === true
        ).length
      },
      builtAt:
        builtAt || new Date().toISOString()
    }
  };
}

module.exports = {
  removeCarFromView
};
