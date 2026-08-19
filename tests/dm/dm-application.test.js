"use strict";

const test =
  require("node:test");

const assert =
  require("node:assert/strict");

function approveDmApplication(
  car,
  applicationId
) {
  const applications =
    Array.isArray(car.dmApplications)
      ? car.dmApplications.map(
          item => ({ ...item })
        )
      : [];

  const staffSlots =
    Array.isArray(car.staffSlots)
      ? car.staffSlots.map(
          item => ({ ...item })
        )
      : [];

  const index =
    applications.findIndex(
      item =>
        item.id === applicationId
    );

  if (index < 0) {
    throw new Error(
      "application_not_found"
    );
  }

  const app =
    applications[index];

  let linkedExisting =
    false;

  if (
    app.claimType ===
      "existing_slot"
  ) {
    const target =
      staffSlots.find(
        slot =>
          slot.id ===
          app.targetStaffId
      );

    if (
      target &&
      !target.memberId
    ) {
      target.memberId =
        app.memberId;

      linkedExisting =
        true;
    }
  }

  if (!linkedExisting) {
    staffSlots.push({
      id: "new-slot",
      label: "DM",
      memberId: app.memberId,
      displayName:
        app.displayName
    });
  }

  applications[index] = {
    ...app,
    status: "approved"
  };

  return {
    staffSlots,
    dmApplications:
      applications
  };
}

test(
  "claim existing manual DM links member without creating duplicate slot",
  function () {
    const result =
      approveDmApplication(
        {
          staffSlots: [
            {
              id: "dm-1",
              label: "DM",
              displayName:
                "詩婕",
              memberId: ""
            }
          ],
          dmApplications: [
            {
              id: "app-1",
              memberId:
                "person-1",
              displayName:
                "詩婕",
              claimType:
                "existing_slot",
              targetStaffId:
                "dm-1",
              status:
                "pending"
            }
          ]
        },
        "app-1"
      );

    assert.equal(
      result.staffSlots.length,
      1
    );

    assert.equal(
      result.staffSlots[0]
        .memberId,
      "person-1"
    );
  }
);

test(
  "new DM application creates a new staff slot after approval",
  function () {
    const result =
      approveDmApplication(
        {
          staffSlots: [],
          dmApplications: [
            {
              id: "app-1",
              memberId:
                "person-1",
              displayName:
                "新 DM",
              claimType:
                "new",
              status:
                "pending"
            }
          ]
        },
        "app-1"
      );

    assert.equal(
      result.staffSlots.length,
      1
    );

    assert.equal(
      result.staffSlots[0]
        .label,
      "DM"
    );

    assert.equal(
      result.staffSlots[0]
        .memberId,
      "person-1"
    );
  }
);

test(
  "claimed slot already used falls back to a new DM slot",
  function () {
    const result =
      approveDmApplication(
        {
          staffSlots: [
            {
              id: "dm-1",
              label: "DM",
              displayName:
                "詩婕",
              memberId:
                "someone-else"
            }
          ],
          dmApplications: [
            {
              id: "app-1",
              memberId:
                "person-1",
              displayName:
                "詩婕",
              claimType:
                "existing_slot",
              targetStaffId:
                "dm-1",
              status:
                "pending"
            }
          ]
        },
        "app-1"
      );

    assert.equal(
      result.staffSlots.length,
      2
    );

    assert.equal(
      result.staffSlots[1]
        .memberId,
      "person-1"
    );
  }
);
