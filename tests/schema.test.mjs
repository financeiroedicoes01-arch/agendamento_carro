import { test } from "node:test";
import assert from "node:assert/strict";
import { database, as, snapshot, ids } from "./db-helper.mjs";
test("migração executa em PostgreSQL e aplica RLS à visão do motorista", async () => {
  const db = await database();
  try {
    await as(db, ids.driver);
    const state = await snapshot(db);
    assert.equal(state.vehicles.length, 2);
    assert.equal(state.profiles.length, 1);
    assert.equal(
      state.reservations.some(
        (t) => t.destination === "Destino privado de outro motorista",
      ),
      false,
    );
    assert.equal(
      state.calendar.some(
        (e) => e.vehicle_id === ids.car2 && e.reservation_id === null,
      ),
      true,
    );
  } finally {
    await db.close();
  }
});
