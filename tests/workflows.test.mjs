import {
  describe,
  test,
  before,
  after,
  beforeEach,
  afterEach,
} from "node:test";
import assert from "node:assert/strict";
import { database, as, command, snapshot, ids, future } from "./db-helper.mjs";
let db;
const payload = (extra = {}) => ({
  destination: "Viagem de teste",
  starts_at: future(),
  ends_at: future(10, 12),
  vehicle_id: ids.car1,
  ...extra,
});
async function expectFailure(fn, pattern) {
  await db.exec("savepoint expected_failure");
  let error;
  try {
    await fn();
  } catch (e) {
    error = e;
  }
  await db.exec(
    "rollback to savepoint expected_failure;release savepoint expected_failure",
  );
  assert.ok(error, "A operação deveria ser recusada");
  if (pattern) assert.match(error.message, pattern);
  return error;
}
async function request(user = ids.driver, extra = {}) {
  await as(db, user);
  return (await command(db, "create_request", payload(extra))).id;
}
async function approve(id, vehicle = ids.car1, manager = ids.manager) {
  await as(db, manager);
  return (
    await command(db, "decide_request", {
      id,
      vehicle_id: vehicle,
      approve: true,
    })
  ).reservation_id;
}
async function raw(sql, args = []) {
  await db.exec("reset role");
  return db.query(sql, args);
}
async function activeTrip() {
  const q = await request(ids.driver, {
    starts_at: new Date(Date.now() + 3600000).toISOString(),
    ends_at: new Date(Date.now() + 7200000).toISOString(),
  });
  const id = await approve(q);
  await as(db, ids.driver);
  await command(db, "checkout", { id, km: 100 });
  return id;
}
describe("Regras operacionais e permissões em PostgreSQL", () => {
  before(async () => {
    db = await database();
  });
  after(async () => {
    await db?.close();
  });
  beforeEach(async () => {
    await db.exec("reset role;begin");
  });
  afterEach(async () => {
    await db.exec("rollback;reset role");
  });
  test("cadastro livre não aceita elevação de perfil por metadados", async () => {
    const id = "20000000-0000-4000-8000-000000000099";
    await raw(
      'insert into auth.users(id,email,raw_user_meta_data) values($1,\'novo@exemplo.org\',\'{"full_name":"Novo Usuário","is_admin":true}\')',
      [id],
    );
    await as(db, id);
    await command(db, "save_profile", {
      full_name: "Novo Usuário",
      phone: "85999990099",
      unit_id: ids.unit,
      is_admin: true,
    });
    const q = await command(db, "create_request", payload());
    assert.ok(q.id);
    assert.equal((await snapshot(db)).profiles[0].is_admin, false);
  });
  test("pedidos pendentes coexistem e só uma confirmação incompatível é aceita", async () => {
    const a = await request();
    const b = await request(ids.other);
    await approve(a);
    await as(db, ids.manager);
    await expectFailure(
      () =>
        command(db, "decide_request", {
          id: b,
          vehicle_id: ids.car1,
          approve: true,
        }),
      /decidida/,
    );
    const rows = await raw(
      "select * from public.reservations where vehicle_id=$1 and starts_at=$2",
      [ids.car1, future()],
    );
    assert.equal(rows.rows.length, 1);
  });
  test("recusa parcial preserva outros candidatos e não notifica o motorista", async () => {
    const id = await request(ids.driver, { vehicle_id: null });
    await as(db, ids.manager);
    await command(db, "decide_request", {
      id,
      vehicle_id: ids.car1,
      approve: false,
    });
    await as(db, ids.driver);
    let state = await snapshot(db);
    assert.equal(state.requests.find((r) => r.id === id).status, "pending");
    assert.equal(
      state.notifications.some((n) => n.entity_id === id),
      false,
    );
    await as(db, ids.other);
    await command(db, "decide_request", {
      id,
      vehicle_id: ids.car2,
      approve: false,
    });
    await as(db, ids.driver);
    state = await snapshot(db);
    assert.equal(state.requests.find((r) => r.id === id).status, "rejected");
    assert.equal(
      state.notifications.filter((n) => n.entity_id === id).length,
      1,
    );
  });
  test("aceite de qualquer carro cria uma reserva e preserva pedidos de outros carros", async () => {
    const generic = await request(ids.driver, { vehicle_id: null });
    const other = await request(ids.manager, { vehicle_id: ids.car2 });
    await approve(generic);
    await as(db, ids.other);
    const s = await snapshot(db);
    assert.equal(s.requests.find((r) => r.id === other).status, "pending");
    const rows = await raw("select * from reservations where request_id=$1", [
      generic,
    ]);
    assert.equal(rows.rows.length, 1);
  });
  test("primeira decisão válida vale também para o responsável temporário", async () => {
    await as(db, ids.manager);
    await command(db, "save_assignment", {
      vehicle_id: ids.car1,
      user_id: ids.other,
      starts_at: new Date(Date.now() - 3600000).toISOString(),
      ends_at: future(30),
    });
    const q = await request();
    await approve(q, ids.car1, ids.other);
    await as(db, ids.manager);
    await expectFailure(
      () =>
        command(db, "decide_request", {
          id: q,
          vehicle_id: ids.car1,
          approve: false,
        }),
      /decidida/,
    );
  });
  test("responsável confirma seu carro e solicita normalmente o carro de outro responsável", async () => {
    const own = await request(ids.manager);
    let s = await snapshot(db);
    assert.equal(s.requests.find((r) => r.id === own).status, "approved");
    const foreign = await request(ids.manager, {
      vehicle_id: ids.car2,
      starts_at: future(12),
      ends_at: future(12, 12),
    });
    s = await snapshot(db);
    assert.equal(s.requests.find((r) => r.id === foreign).status, "pending");
  });
  test("motorista não confirma dois veículos no mesmo horário", async () => {
    const a = await request();
    const b = await request(ids.driver, { vehicle_id: ids.car2 });
    await approve(a);
    await as(db, ids.other);
    await expectFailure(
      () =>
        command(db, "decide_request", {
          id: b,
          vehicle_id: ids.car2,
          approve: true,
        }),
      /motorista/,
    );
  });
  test("fim às 10h e início às 10h são permitidos", async () => {
    const a = await request(ids.driver, {
      starts_at: future(10, 8),
      ends_at: future(10, 10),
    });
    await approve(a);
    const b = await request(ids.other, {
      starts_at: future(10, 10),
      ends_at: future(10, 12),
    });
    assert.ok(await approve(b));
  });
  test("expiração automática é idempotente e não encerra reservas confirmadas", async () => {
    const q = await request();
    const id = await approve(q);
    const exp = await request(ids.other, {
      starts_at: future(14),
      ends_at: future(14, 12),
    });
    await raw(
      "update requests set starts_at=now()-interval '1 hour' where id=$1",
      [exp],
    );
    await db.exec("set role service_role");
    await db.query("select run_maintenance()");
    await db.query("select run_maintenance()");
    await as(db, ids.driver);
    assert.equal(
      (await snapshot(db)).reservations.find((t) => t.id === id).status,
      "approved",
    );
    await as(db, ids.other);
    const s = await snapshot(db);
    assert.equal(s.requests.find((r) => r.id === exp).status, "expired");
    assert.equal(
      s.notifications.filter((n) => n.dedupe_key === `expired:${exp}`).length,
      1,
    );
  });
  test("alteração pendente ou recusada preserva o período confirmado", async () => {
    const q = await request();
    const id = await approve(q);
    await as(db, ids.driver);
    await command(db, "propose_change", {
      id,
      destination: "Destino alterado",
      starts_at: future(11),
      ends_at: future(11, 12),
    });
    let s = await snapshot(db);
    assert.equal(
      new Date(s.reservations.find((t) => t.id === id).starts_at).toISOString(),
      future(),
    );
    const ch = s.changes.find((c) => c.reservation_id === id);
    await as(db, ids.manager);
    await command(db, "decide_change", { id: ch.id, approve: false });
    s = await snapshot(db);
    assert.equal(
      s.reservations.find((t) => t.id === id).destination,
      "Viagem de teste",
    );
  });
  test("aprovação de alteração com conflito reverte integralmente", async () => {
    const q = await request();
    const id = await approve(q);
    const q2 = await request(ids.other, {
      starts_at: future(11),
      ends_at: future(11, 12),
    });
    await approve(q2);
    await as(db, ids.driver);
    await command(db, "propose_change", {
      id,
      destination: "Mudança",
      starts_at: future(11),
      ends_at: future(11, 12),
    });
    const ch = (await snapshot(db)).changes.find(
      (c) => c.reservation_id === id,
    );
    await as(db, ids.manager);
    await expectFailure(
      () => command(db, "decide_change", { id: ch.id, approve: true }),
      /Conflito/,
    );
    const s = await snapshot(db);
    assert.equal(
      s.reservations.find((t) => t.id === id).destination,
      "Viagem de teste",
    );
    assert.equal(s.changes.find((c) => c.id === ch.id).status, "pending");
  });
  test("aprovação de alteração livre troca horários atomicamente", async () => {
    const id = await approve(await request());
    await as(db, ids.driver);
    await command(db, "propose_change", {
      id,
      destination: "Novo destino",
      starts_at: future(11),
      ends_at: future(11, 12),
    });
    const ch = (await snapshot(db)).changes.find(
      (c) => c.reservation_id === id,
    );
    await as(db, ids.manager);
    await command(db, "decide_change", { id: ch.id, approve: true });
    const s = await snapshot(db);
    assert.equal(
      s.reservations.find((t) => t.id === id).destination,
      "Novo destino",
    );
    assert.equal(
      new Date(s.reservations.find((t) => t.id === id).starts_at).toISOString(),
      future(11),
    );
  });
  test("cancelamento próprio não exige aprovação e viagem retirada não cancela", async () => {
    const id = await approve(await request());
    await as(db, ids.driver);
    await command(db, "cancel_trip", { id });
    assert.equal(
      (await snapshot(db)).reservations.find((t) => t.id === id).status,
      "cancelled",
    );
    const active = await activeTrip();
    await expectFailure(
      () => command(db, "cancel_trip", { id: active }),
      /retirada/,
    );
  });
  test("retirada antecipada verifica conflitos do carro e do motorista", async () => {
    const q = await request(ids.other, {
      starts_at: new Date(Date.now() + 60000).toISOString(),
      ends_at: new Date(Date.now() + 1800000).toISOString(),
    });
    await approve(q);
    const q2 = await request(ids.driver, {
      starts_at: new Date(Date.now() + 3600000).toISOString(),
      ends_at: new Date(Date.now() + 7200000).toISOString(),
    });
    const id = await approve(q2);
    await as(db, ids.driver);
    await expectFailure(
      () => command(db, "checkout", { id, km: 100 }),
      /Conflito/,
    );
  });
  test("prorrogação pendente não muda retorno e não confirma sobre reserva seguinte", async () => {
    const id = await activeTrip();
    const end = (await snapshot(db)).reservations.find(
      (t) => t.id === id,
    ).ends_at;
    const q2 = await request(ids.other, {
      starts_at: new Date(Date.now() + 8000000).toISOString(),
      ends_at: new Date(Date.now() + 12000000).toISOString(),
    });
    await approve(q2);
    await as(db, ids.driver);
    const trip = (await snapshot(db)).reservations.find((t) => t.id === id);
    await command(db, "propose_change", {
      id,
      destination: trip.destination,
      starts_at: trip.starts_at,
      ends_at: new Date(Date.now() + 10000000).toISOString(),
    });
    const s = await snapshot(db);
    assert.equal(s.reservations.find((t) => t.id === id).ends_at, end);
    const ch = s.changes.find((c) => c.reservation_id === id);
    await as(db, ids.manager);
    await expectFailure(
      () => command(db, "decide_change", { id: ch.id, approve: true }),
      /Conflito/,
    );
  });
  test("viagem atrasada permanece aberta e avisa responsável e próximo motorista uma vez", async () => {
    const id = await activeTrip();
    await raw(
      "update reservations set starts_at=now()-interval '2 hours',ends_at=now()-interval '1 hour',actual_start=now()-interval '2 hours' where id=$1",
      [id],
    );
    const q = await request(ids.other, {
      starts_at: new Date(Date.now() + 3600000).toISOString(),
      ends_at: new Date(Date.now() + 7200000).toISOString(),
    });
    await approve(q);
    await raw("select private.maintenance()");
    await raw("select private.maintenance()");
    await as(db, ids.manager);
    let s = await snapshot(db);
    assert.equal(s.reservations.find((t) => t.id === id).status, "in_progress");
    assert.equal(
      s.notifications.filter((n) => n.title === "Devolução atrasada").length,
      1,
    );
    await as(db, ids.other);
    s = await snapshot(db);
    assert.equal(
      s.notifications.filter((n) => n.title.includes("próxima viagem")).length,
      1,
    );
  });
  test("responsável registra esquecimento com autoria e justificativa e corrige km", async () => {
    const id = await approve(
      await request(ids.driver, {
        starts_at: new Date(Date.now() + 3600000).toISOString(),
        ends_at: new Date(Date.now() + 7200000).toISOString(),
      }),
    );
    await as(db, ids.manager);
    await expectFailure(
      () =>
        command(db, "checkout", {
          id,
          km: 100,
          actual_at: new Date().toISOString(),
        }),
      /Justifique/,
    );
    await command(db, "checkout", {
      id,
      km: 100,
      actual_at: new Date().toISOString(),
      justification: "Motorista esqueceu",
    });
    await command(db, "correct_km", {
      id,
      km_out: 110,
      justification: "Conferência do painel",
    });
    const s = await snapshot(db);
    const t = s.reservations.find((t) => t.id === id);
    assert.equal(t.driver_id, ids.driver);
    assert.equal(t.departure_by, ids.manager);
    assert.equal(Number(t.km_out), 110);
    assert.equal(
      s.audit_log.some(
        (a) => a.action === "correct_km" && a.actor_id === ids.manager,
      ),
      true,
    );
  });
  test("devolução exige declaração e quilometragem válida", async () => {
    const id = await activeTrip();
    await expectFailure(
      () => command(db, "checkin", { id, km: 110 }),
      /Declare/,
    );
    await expectFailure(
      () => command(db, "checkin", { id, km: 90, no_incidents: true }),
      /anterior/,
    );
    await expectFailure(
      () =>
        command(db, "checkin", {
          id,
          km: 110,
          no_incidents: false,
          incidents: [],
        }),
      /ocorrência/,
    );
    await command(db, "checkin", { id, km: 110, no_incidents: true });
    assert.equal(
      (await snapshot(db)).reservations.find((t) => t.id === id).status,
      "completed",
    );
  });
  test("vários abastecimentos exigem comprovantes existentes vinculados à viagem", async () => {
    const id = await activeTrip();
    await expectFailure(
      () =>
        command(db, "checkin", {
          id,
          km: 110,
          no_incidents: true,
          fuels: [{ amount: 50, receipt_path: "nao-existe" }],
        }),
      /Envie/,
    );
    const path1 = `${ids.driver}/${id}/receipt1.jpg`,
      path2 = `${ids.driver}/${id}/receipt2.jpg`;
    await db.query(
      "insert into storage.objects(bucket_id,name) values('trip-files',$1),('trip-files',$2)",
      [path1, path2],
    );
    await command(db, "checkin", {
      id,
      km: 110,
      no_incidents: true,
      fuels: [
        { amount: 50, receipt_path: path1 },
        { amount: 70, receipt_path: path2 },
      ],
    });
    assert.equal(
      (await snapshot(db)).fuels.filter((f) => f.reservation_id === id).length,
      2,
    );
  });
  test("ocorrência com fotos avisa sem bloquear e pode ser tratada pelo responsável", async () => {
    const id = await activeTrip();
    const path = `${ids.driver}/${id}/problem.jpg`;
    await db.query(
      "insert into storage.objects(bucket_id,name) values('trip-files',$1)",
      [path],
    );
    const i = {
      kind: "problem",
      description: "Pneu com avaria",
      location: "Estacionamento",
      occurred_at: (await snapshot(db)).reservations.find((t) => t.id === id)
        .actual_start,
      photos: [path],
    };
    await command(db, "checkin", {
      id,
      km: 110,
      no_incidents: false,
      incidents: [i],
    });
    await as(db, ids.manager);
    let s = await snapshot(db);
    const inc = s.incidents.find((i) => i.reservation_id === id);
    assert.ok(inc);
    assert.equal(s.blocks.length, 0);
    assert.equal(
      s.notifications.filter((n) => n.entity_id === inc.id).length,
      1,
    );
    await command(db, "update_incident", {
      id: inc.id,
      status: "resolved",
      measures: "Pneu trocado",
    });
    assert.equal(
      (await snapshot(db)).incidents.find((i) => i.id === inc.id).status,
      "resolved",
    );
  });
  test("manutenção aberta cancela confirmadas, preserva andamento e impede novas aprovações", async () => {
    const active = await activeTrip();
    const futureId = await approve(await request());
    await as(db, ids.manager);
    const block = await command(db, "create_block", {
      vehicle_id: ids.car1,
      starts_at: new Date().toISOString(),
      reason: "Revisão",
    });
    let s = await snapshot(db);
    assert.equal(
      s.reservations.find((t) => t.id === futureId).status,
      "cancelled",
    );
    assert.equal(
      s.reservations.find((t) => t.id === active).status,
      "in_progress",
    );
    await as(db, ids.driver);
    await expectFailure(
      () => command(db, "create_request", payload()),
      /Nenhum carro/,
    );
    await as(db, ids.manager);
    await command(db, "release_block", { id: block.id });
    assert.ok(await request());
  });
  test("administrador isolado não recebe detalhes nem poderes operacionais", async () => {
    const id = await approve(await request());
    await as(db, ids.admin);
    const s = await snapshot(db);
    assert.equal(s.reservations.length, 0);
    assert.equal(s.requests.length, 0);
    assert.equal(s.profiles.length, 4);
    await expectFailure(() => command(db, "cancel_trip", { id }), /permissão/);
    await expectFailure(
      () =>
        command(db, "create_block", {
          vehicle_id: ids.car1,
          reason: "Indevido",
        }),
      /responsável/,
    );
    await expectFailure(
      () =>
        command(db, "decide_request", {
          id: "40000000-0000-4000-8000-000000000001",
          vehicle_id: ids.car1,
          approve: true,
        }),
      /responsável/,
    );
    await command(db, "save_unit", { name: "Outra casa", kind: "house" });
  });
  test("escrita direta, acesso anônimo e funções internas são recusados", async () => {
    await as(db, ids.driver);
    await expectFailure(
      () =>
        db.query("update profiles set is_admin=true where id=$1", [ids.driver]),
      /permission denied/,
    );
    await expectFailure(
      () =>
        db.query("select private.notify($1,$2,$3,null,$4,$5)", [
          ids.driver,
          "x",
          "x",
          "trip",
          "spoof",
        ]),
      /permission denied/,
    );
    await expectFailure(
      () => db.query("select run_maintenance()"),
      /permission denied/,
    );
    await db.exec("reset role;set role anon");
    await expectFailure(
      () => db.query("select app_snapshot()"),
      /permission denied/,
    );
  });
  test("arquivos privados não são acessíveis por outro motorista nem por administrador", async () => {
    const id = await activeTrip();
    const path = `${ids.driver}/${id}/private.jpg`;
    await db.query(
      "insert into storage.objects(bucket_id,name,data_url) values('trip-files',$1,'data:image/jpeg;base64,AA==')",
      [path],
    );
    await as(db, ids.other);
    assert.equal(
      (await db.query("select * from storage.objects")).rows.length,
      0,
    );
    await as(db, ids.admin);
    assert.equal(
      (await db.query("select * from storage.objects")).rows.length,
      0,
    );
    await as(db, ids.manager);
    assert.equal(
      (await db.query("select * from storage.objects")).rows.length,
      1,
    );
  });
  test("recorrência quinzenal usa 15 dias e não duplica reprocessamentos", async () => {
    await as(db, ids.manager);
    const date = future(20).slice(0, 10);
    const result = await command(db, "create_series", {
      vehicle_id: ids.car1,
      destination: "Recorrência",
      start_date: date,
      end_date: future(52).slice(0, 10),
      start_time: "09:00",
      end_time: "10:00",
      frequency: "fortnightly",
    });
    const s = await snapshot(db);
    const rows = s.reservations
      .filter((r) => r.series_id === result.id)
      .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
    assert.equal(rows.length, 3);
    assert.equal(
      (+new Date(rows[1].starts_at) - +new Date(rows[0].starts_at)) / 86400000,
      15,
    );
    await raw("select private.generate_series_trips($1)", [result.id]);
    await as(db, ids.manager);
    assert.equal(
      (await snapshot(db)).reservations.filter((r) => r.series_id === result.id)
        .length,
      3,
    );
  });
  test("recorrência pula conflitos e temporário não gera fora da vigência", async () => {
    const conflict = await approve(
      await request(ids.driver, {
        starts_at: future(20, 12),
        ends_at: future(20, 16),
      }),
    );
    await as(db, ids.manager);
    await command(db, "save_assignment", {
      vehicle_id: ids.car1,
      user_id: ids.other,
      starts_at: new Date(Date.now() - 60000).toISOString(),
      ends_at: future(22, 23),
    });
    await as(db, ids.other);
    const result = await command(db, "create_series", {
      vehicle_id: ids.car1,
      destination: "Temporário",
      start_date: future(20).slice(0, 10),
      end_date: future(25).slice(0, 10),
      start_time: "09:30",
      end_time: "10:30",
      frequency: "daily",
    });
    const s = await snapshot(db);
    assert.equal(result.skipped.length, 1);
    assert.equal(
      s.reservations.filter((r) => r.series_id === result.id).length,
      2,
    );
    assert.ok(s.reservations.find((r) => r.id === conflict));
  });
  test("alterar série preserva reservas conflitantes e encerrar não apaga o passado", async () => {
    await as(db, ids.manager);
    const result = await command(db, "create_series", {
      vehicle_id: ids.car1,
      destination: "Série",
      start_date: future(20).slice(0, 10),
      end_date: future(21).slice(0, 10),
      start_time: "08:00",
      end_time: "09:00",
      frequency: "daily",
    });
    await approve(
      await request(ids.driver, {
        starts_at: future(20, 14),
        ends_at: future(20, 15),
      }),
    );
    await as(db, ids.manager);
    const edit = await command(db, "edit_series", {
      id: result.id,
      destination: "Série atualizada",
      start_time: "11:00",
      end_time: "12:00",
      day_span: 0,
    });
    assert.equal(edit.skipped.length, 1);
    assert.equal(edit.updated, 1);
    await command(db, "stop_series", { id: result.id });
    const s = await snapshot(db);
    assert.equal(
      s.reservations.filter(
        (t) => t.series_id === result.id && t.status === "cancelled",
      ).length,
      2,
    );
    assert.equal(
      s.reservations.some((t) => t.status === "completed"),
      true,
    );
  });
  test("temporário vencido não decide e usuário desativado não usa comandos", async () => {
    await raw(
      "insert into assignments(vehicle_id,user_id,starts_at,ends_at,created_by) values($1,$2,now()-interval '2 days',now()-interval '1 day',$3)",
      [ids.car1, ids.other, ids.manager],
    );
    const q = await request();
    await as(db, ids.other);
    await expectFailure(
      () =>
        command(db, "decide_request", {
          id: q,
          vehicle_id: ids.car1,
          approve: true,
        }),
      /responsável/,
    );
    await raw("update profiles set active=false where id=$1", [ids.driver]);
    await as(db, ids.driver);
    await expectFailure(
      () => command(db, "create_request", payload()),
      /inativo/,
    );
  });
  test("avisos são deduplicados, lidos individualmente e fila de push é exclusiva", async () => {
    const q = await request(ids.driver, { vehicle_id: null });
    await as(db, ids.driver);
    const n = (await snapshot(db)).notifications[0];
    await command(db, "mark_read", { id: n.id });
    assert.ok(
      (await snapshot(db)).notifications.find((x) => x.id === n.id).read_at,
    );
    await raw("select 1");
    await db.exec("set role service_role");
    const batch = (await db.query("select claim_push() as b")).rows[0].b;
    const second = (await db.query("select claim_push() as b")).rows[0].b;
    assert.ok(batch.length > 0);
    assert.equal(second.length, 0);
  });
  test("retirada antecipada ocupa também o intervalo antecipado", async () => {
    const id = await activeTrip();
    await as(db, ids.other);
    await expectFailure(
      () =>
        command(
          db,
          "create_request",
          payload({
            starts_at: new Date(Date.now() + 600000).toISOString(),
            ends_at: new Date(Date.now() + 1800000).toISOString(),
          }),
        ),
      /Nenhum carro/,
    );
    await raw("select 1");
    await expectFailure(
      () =>
        db.query(
          "insert into reservations(driver_id,vehicle_id,destination,starts_at,ends_at) values($1,$2,'Conflito direto',now()+interval '10 minutes',now()+interval '20 minutes')",
          [ids.other, ids.car1],
        ),
      /exclusion constraint/,
    );
  });
  test("histórico de terceiros só retorna detalhes para o responsável", async () => {
    await as(db, ids.manager);
    let s = await snapshot(db);
    const historic = s.calendar.find((e) => e.kind === "history");
    assert.ok(historic?.reservation_id);
    assert.equal(
      s.reservations.find((t) => t.id === historic.reservation_id).destination,
      "Distribuição de livros",
    );
    await as(db, ids.other);
    s = await snapshot(db);
    assert.equal(
      s.calendar.find((e) => e.id === historic.id).reservation_id,
      null,
    );
  });
  test("mensal no dia 31 pula meses sem esse dia", async () => {
    await raw("update settings set recurrence_horizon=366");
    const year = new Date().getUTCFullYear() + 1;
    await as(db, ids.manager);
    const r = await command(db, "create_series", {
      vehicle_id: ids.car1,
      destination: "Mensal",
      start_date: `${year}-01-31`,
      end_date: `${year}-04-30`,
      start_time: "09:00",
      end_time: "10:00",
      frequency: "monthly",
    });
    const trips = (await snapshot(db)).reservations
      .filter((t) => t.series_id === r.id)
      .map((t) => t.occurrence_date)
      .sort();
    assert.deepEqual(trips, [`${year}-01-31`, `${year}-03-31`]);
  });
  test("fila de push não reenvia aos aparelhos que já receberam", async () => {
    await as(db, ids.driver);
    await command(db, "subscribe_push", {
      subscription: {
        endpoint: "https://fcm.googleapis.com/a",
        keys: { p256dh: "abc", auth: "def" },
      },
    });
    await command(db, "subscribe_push", {
      subscription: {
        endpoint: "https://fcm.googleapis.com/b",
        keys: { p256dh: "abc", auth: "def" },
      },
    });
    await raw("select 1");
    await db.exec("set role service_role");
    let batch = (await db.query("select claim_push() as b")).rows[0].b;
    const own = batch.find((b) => b.subscriptions.length === 2);
    assert.ok(own);
    await db.query(
      "insert into push_deliveries(notification_id,subscription_id) values($1,$2)",
      [own.notification.id, own.subscriptions[0].id],
    );
    await db.query(
      "update notifications set push_claimed_at=null where id=$1",
      [own.notification.id],
    );
    batch = (await db.query("select claim_push() as b")).rows[0].b;
    assert.equal(
      batch.find((b) => b.notification.id === own.notification.id).subscriptions
        .length,
      1,
    );
  });
});
