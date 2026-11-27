import { test, before, after, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { database, as, command, snapshot, ids, future } from "./db-helper.mjs";

let db;
const photo = `${ids.manager}/vehicles/test.png`;
const payload = {
  name: "Carro do responsável",
  model: "Modelo de teste",
  plate: "abc1d23",
  unit_id: ids.unit,
  manager_id: ids.manager,
  photo_path: photo,
  active: true,
};
before(async () => {
  db = await database();
});
after(async () => {
  await db.close();
});
beforeEach(async () => {
  await db.exec("reset role; begin");
  await as(db, ids.manager);
  await db.query(
    "insert into storage.objects(bucket_id,name) values('vehicle-photos',$1)",
    [photo],
  );
});
afterEach(async () => {
  await db.exec("reset role; rollback");
});
async function rejects(action, data, pattern) {
  await db.exec("savepoint denied_command");
  await assert.rejects(command(db, action, data), pattern);
  await db.exec("rollback to savepoint denied_command");
}
async function create() {
  return (await command(db, "save_vehicle", payload)).id;
}

test("responsável cadastra, visualiza e edita carro próprio com autoria no histórico", async () => {
  const id = await create();
  const car = (await snapshot(db)).vehicles.find((v) => v.id === id);
  assert.equal(car.manager_id, ids.manager);
  assert.equal(car.plate, "ABC1D23");
  await command(db, "save_vehicle", {
    ...payload,
    id,
    name: "Carro atualizado",
  });
  assert.equal(
    (await snapshot(db)).vehicles.find((v) => v.id === id).name,
    "Carro atualizado",
  );
  await db.exec("reset role");
  const audit = (
    await db.query(
      "select * from audit_log where entity_id=$1 order by created_at",
      [id],
    )
  ).rows;
  assert.equal(audit.length, 2);
  assert.equal(audit[1].actor_id, ids.manager);
  assert.equal(audit[1].before_data.name, payload.name);
  assert.equal(audit[1].after_data.name, "Carro atualizado");
});

test("responsável não edita, exclui ou transfere carros alheios nem atribui novos carros a terceiros", async () => {
  await rejects(
    "save_vehicle",
    { ...payload, id: ids.car2 },
    /responsável principal/,
  );
  await rejects("delete_vehicle", { id: ids.car2 }, /responsável principal/);
  await rejects(
    "save_vehicle",
    { ...payload, id: ids.car1, manager_id: ids.other },
    /próprio responsável/,
  );
  await rejects(
    "save_vehicle",
    { ...payload, manager_id: ids.other },
    /próprio responsável/,
  );
  await rejects(
    "save_vehicle",
    { ...payload, id: "30000000-0000-4000-8000-000000000099" },
    /não encontrado/,
  );
});

test("motorista e temporário não recebem gestão cadastral e não podem enviar fotos de carros", async () => {
  await db.exec("reset role");
  await db.query(
    "insert into assignments(vehicle_id,user_id,starts_at,ends_at,created_by) values($1,$2,now()-interval '1 hour',now()+interval '1 day',$3)",
    [ids.car1, ids.driver, ids.manager],
  );
  await as(db, ids.driver);
  await rejects(
    "save_vehicle",
    { ...payload, manager_id: ids.driver },
    /responsável principal/,
  );
  await rejects(
    "save_vehicle",
    { ...payload, id: ids.car1, manager_id: ids.driver },
    /responsável principal/,
  );
  await rejects("delete_vehicle", { id: ids.car1 }, /responsável principal/);
  await db.exec("savepoint denied_upload");
  await assert.rejects(
    db.query(
      "insert into storage.objects(bucket_id,name) values('vehicle-photos',$1)",
      [`${ids.driver}/vehicles/unauthorized.png`],
    ),
    /row-level security/,
  );
  await db.exec("rollback to savepoint denied_upload");
});

test("foto nova exige arquivo do próprio usuário e usuário inativo não salva nem exclui", async () => {
  await db.exec("reset role");
  await db.query(
    "insert into storage.objects(bucket_id,name) values('vehicle-photos',$1)",
    [`${ids.other}/vehicles/photo.png`],
  );
  await as(db, ids.manager);
  await rejects(
    "save_vehicle",
    { ...payload, photo_path: `${ids.other}/vehicles/photo.png` },
    /foto do carro/,
  );
  await rejects(
    "save_vehicle",
    { ...payload, photo_path: `${ids.manager}/vehicles/missing.png` },
    /foto do carro/,
  );
  await db.exec("reset role");
  await db.query("update profiles set active=false where id=$1", [ids.manager]);
  await as(db, ids.manager);
  await rejects("save_vehicle", payload, /inativo/);
  await rejects("delete_vehicle", { id: ids.car1 }, /inativo/);
});

test("exclusão preserva viagens concluídas e permite cadastrar depois de excluir o último carro", async () => {
  const id = await create();
  await db.exec("reset role");
  await db.query(
    "insert into reservations(vehicle_id,driver_id,destination,starts_at,ends_at,status) values($1,$2,'Histórico preservado',now()-interval '2 days',now()-interval '1 day','completed')",
    [id, ids.driver],
  );
  await as(db, ids.manager);
  await command(db, "delete_vehicle", { id });
  assert.equal(
    (await snapshot(db)).vehicles.find((v) => v.id === id).active,
    false,
  );
  await db.exec("reset role");
  assert.equal(
    (
      await db.query(
        "select count(*)::int n from reservations where vehicle_id=$1",
        [id],
      )
    ).rows[0].n,
    1,
  );
  assert.equal(
    (
      await db.query(
        "select action from audit_log where entity_id=$1 and action='delete_vehicle'",
        [id],
      )
    ).rows.length,
    1,
  );
  await db.query("update vehicles set manager_id=$1 where id=$2", [
    ids.other,
    ids.car1,
  ]);
  await as(db, ids.manager);
  assert.ok(
    (await command(db, "save_vehicle", { ...payload, plate: "NEW1A23" })).id,
  );
});

test("reservas abertas impedem exclusão e inativação pelo formulário", async () => {
  const id = await create();
  await db.exec("reset role");
  await db.query(
    "insert into reservations(vehicle_id,driver_id,destination,starts_at,ends_at) values($1,$2,'Viagem futura',$3,$4)",
    [id, ids.driver, future(20), future(20, 12)],
  );
  await as(db, ids.manager);
  await rejects("delete_vehicle", { id }, /viagens abertas/);
  await rejects(
    "save_vehicle",
    { ...payload, id, active: false },
    /viagens abertas/,
  );
  assert.equal(
    (await snapshot(db)).vehicles.find((v) => v.id === id).active,
    true,
  );
});

test("solicitações pendentes e recorrências ativas impedem exclusão", async () => {
  await rejects("delete_vehicle", { id: ids.car1 }, /solicitações pendentes/);
  const id = await create();
  await command(db, "create_series", {
    vehicle_id: id,
    destination: "Recorrência",
    start_date: future(25).slice(0, 10),
    end_date: future(26).slice(0, 10),
    start_time: "10:00",
    end_time: "11:00",
    day_span: 0,
    frequency: "daily",
    weekdays: [],
  });
  await rejects("delete_vehicle", { id }, /recorrências/);
});

test("administrador mantém cadastro e transferência, e novo responsável mantém a foto anterior", async () => {
  const id = await create();
  await as(db, ids.admin);
  await command(db, "save_vehicle", { ...payload, id, manager_id: ids.other });
  await as(db, ids.other);
  await command(db, "save_vehicle", {
    ...payload,
    id,
    manager_id: ids.other,
    name: "Outro responsável",
  });
  await command(db, "delete_vehicle", { id });
  assert.equal(
    (await snapshot(db)).vehicles.find((v) => v.id === id).active,
    false,
  );
});
