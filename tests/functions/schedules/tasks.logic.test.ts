import { beforeEach, describe, expect, it, vi } from "vitest";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const mocks = vi.hoisted(() => ({
  weeklyDb: { collection: vi.fn() },
  db: {
    collection: vi.fn(),
    collectionGroup: vi.fn(),
    batch: vi.fn(),
    runTransaction: vi.fn(),
  },
  getDb: vi.fn(),
  getAdmin: vi.fn(),
  getAdminAuth: vi.fn(),
  sanitize: vi.fn((value: unknown) => value),
  calculateReportData: vi.fn(),
  enqueueMonthlyUsageEmail: vi.fn(),
  enqueueDowngradeEmail: vi.fn(),
  addStats: vi.fn(),
  where: vi.fn(),
  count: vi.fn(),
  countGet: vi.fn(),
  usageWhere: vi.fn(),
  usageGet: vi.fn(),
  usageForEach: vi.fn(),
  registerGet: vi.fn(),
  batchSet: vi.fn(),
  batchCommit: vi.fn(),
  timestampFromDate: vi.fn((date: Date) => ({ date })),
  serverTimestamp: vi.fn(() => "server-time"),
  txGet: vi.fn(),
  txSet: vi.fn(),
  userRef: { path: "users/user-1" },
  registerRef: { path: "register/user-1" },
  usageRef: { path: "register/user-1/usage/2026_09" },
  runTransaction: vi.fn(),
  authGetUser: vi.fn(),
}));

const sourceRequire = createRequire(resolve(process.cwd(), "functions/src/schedules/tasks.logic.ts"));
const firestoreModule = sourceRequire("firebase-admin/firestore");
const firestorePath = resolve(
  sourceRequire.resolve("firebase-admin/firestore").replace("/lib/firestore/index.js", "/lib/esm/firestore/index.js"),
);
vi.doMock(firestorePath, async () => {
  const actual = await vi.importActual<typeof firestoreModule>(firestorePath);
  const fieldValue = Object.create(actual.FieldValue);
  Object.assign(fieldValue, { serverTimestamp: mocks.serverTimestamp });
  return {
    ...actual,
    FieldValue: fieldValue,
    getFirestore: () => mocks.weeklyDb,
  };
});

vi.mock("@functions/_deps", () => ({
  getDb: mocks.getDb,
  getAdmin: mocks.getAdmin,
  getAdminAuth: mocks.getAdminAuth,
  sanitize: mocks.sanitize,
}));
vi.mock("@functions/email/_helper", () => ({ calculateReportData: mocks.calculateReportData }));
vi.mock("@functions/email/plans/logic", () => ({
  enqueueMonthlyUsageEmail: mocks.enqueueMonthlyUsageEmail,
  enqueueDowngradeEmail: mocks.enqueueDowngradeEmail,
}));

mocks.getDb.mockReturnValue(mocks.db);
const {
  computeAndSaveMonthlyUsage,
  computeAndSaveWeeklyStats,
  executeTasksDowngrade,
} = await import("@functions/schedules/tasks.logic");

function response() {
  return {
    status: vi.fn(function (this: unknown) { return this; }),
    json: vi.fn(function (this: unknown) { return this; }),
    send: vi.fn(function (this: unknown) { return this; }),
  };
}

function reportDoc(uid: string, id: string, count: unknown, path = `usage/${uid}/days/${id}`, parentId: string | undefined = uid) {
  return {
    id,
    ref: { path, parent: { parent: parentId ? { id: parentId } : undefined } },
    data: () => ({ count }),
  };
}

describe("scheduled aggregation and downgrade tasks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.setSystemTime(new Date(2026, 9, 15, 12));
    mocks.getDb.mockReturnValue(mocks.db);
    mocks.weeklyDb.collection.mockImplementation((name: string) => name === "sentences"
      ? { count: mocks.count, where: mocks.where }
      : { add: mocks.addStats });
    mocks.count.mockReturnValue({ get: mocks.countGet });
    mocks.where.mockReturnValue({ where: mocks.where, count: mocks.count });
    mocks.countGet.mockResolvedValue({ data: () => ({ count: 7 }) });
    mocks.addStats.mockResolvedValue({ id: "stats-1" });

    mocks.usageWhere.mockReturnValue({ where: mocks.usageWhere, get: mocks.usageGet });
    mocks.usageGet.mockResolvedValue({ forEach: mocks.usageForEach });
    mocks.usageForEach.mockImplementation((callback: (doc: unknown) => void) => {
      [
        reportDoc("user-1", "2026_legal_agent", 3),
        reportDoc("user-1", "2026_legal_agent", 2),
        reportDoc("user-1", "plain-id", "invalid"),
        reportDoc("not-usage", "2026_research", 99, "other/collection"),
        reportDoc("no-parent", "2026_misc", 1, "usage/no-parent/days/doc", undefined),
        reportDoc("unregistered", "2026_prompting", 4),
      ].forEach(callback);
    });
    mocks.db.collection.mockImplementation((name: string) => {
      if (name === "register") {
        return {
          doc: vi.fn((uid: string) => ({
            get: vi.fn(async () => ({ exists: uid === "user-1" })),
            collection: vi.fn(() => ({ doc: vi.fn(() => mocks.usageRef) })),
          })),
        };
      }
      if (name === "users") return { doc: vi.fn(() => mocks.userRef) };
      return { add: mocks.addStats };
    });
    mocks.db.collectionGroup.mockReturnValue({ where: mocks.usageWhere });
    mocks.db.batch.mockReturnValue({ set: mocks.batchSet, commit: mocks.batchCommit });
    mocks.batchCommit.mockResolvedValue(undefined);
    mocks.getAdmin.mockReturnValue({
      firestore: {
        Timestamp: { fromDate: mocks.timestampFromDate },
        FieldValue: { serverTimestamp: mocks.serverTimestamp },
      },
    });
    mocks.getAdminAuth.mockReturnValue({ getUser: mocks.authGetUser });
    mocks.authGetUser.mockResolvedValue({ email: "user@example.test" });
    mocks.calculateReportData.mockReturnValue({
      totalTimeSavedMinutes: 10, haFattoPrompting: false, interazioniCount: 2, title: "report",
    });
    mocks.enqueueMonthlyUsageEmail.mockResolvedValue(undefined);
    mocks.enqueueDowngradeEmail.mockResolvedValue(undefined);
    mocks.txGet.mockResolvedValue({ exists: true, data: () => ({ status: "prova" }) });
    mocks.txSet.mockReturnValue(undefined);
    mocks.runTransaction.mockImplementation(async (callback: (tx: unknown) => unknown) =>
      callback({ get: mocks.txGet, set: mocks.txSet }));
    mocks.db.runTransaction.mockImplementation(mocks.runTransaction);
  });

  it("counts and persists all weekly statistics, including years and court sections", async () => {
    // Arrange
    // Act
    const result = await computeAndSaveWeeklyStats();

    // Assert
    expect(mocks.weeklyDb.collection).toHaveBeenCalledWith("sentences");
    expect(mocks.addStats).toHaveBeenCalledOnce();
    expect(mocks.addStats).toHaveBeenCalledWith(expect.objectContaining({
      type: "weekly_sentences_stats",
      totale_documenti: 7,
      totale_completi: 7,
      per_tipo: { sentenza: 7, ordinanza: 7, decreto: 7 },
      per_organo: { consiglio_di_stato: 7, corte_di_cassazione: 7, corte_costituzionale: 7 },
      per_materia: { penale: 7, civile: 7 },
    }));
    expect(Object.keys(result.per_anno)).toHaveLength(11);
    expect(Object.values(result.per_anno)).toEqual(Array(11).fill(7));
    expect(Object.values(result.per_sezione_cassazione.civili)).toEqual(expect.arrayContaining([7]));
    expect(result.createdAt).toBeInstanceOf(Date);
  });

  it("aggregates registered monthly usage, commits it before sending email, and ignores unrelated usage documents", async () => {
    // Arrange
    mocks.registerGet.mockResolvedValue({ exists: true });
    const eventOrder: string[] = [];
    mocks.batchSet.mockImplementation(() => eventOrder.push("set"));
    mocks.batchCommit.mockImplementation(async () => { eventOrder.push("commit"); });
    mocks.enqueueMonthlyUsageEmail.mockImplementation(async () => { eventOrder.push("email"); });
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    // Act
    const result = await computeAndSaveMonthlyUsage();

    // Assert
    expect(mocks.db.collectionGroup).toHaveBeenCalledWith("days");
    expect(mocks.usageWhere).toHaveBeenNthCalledWith(1, "updatedAt", ">=", { date: new Date(2026, 8, 1) });
    expect(mocks.usageWhere).toHaveBeenNthCalledWith(2, "updatedAt", "<", { date: new Date(2026, 9, 1) });
    expect(mocks.batchSet).toHaveBeenCalledWith(mocks.usageRef, {
      legal_agent: 5, unknown_service: 0, _updatedAt: "server-time",
    }, { merge: true });
    expect(mocks.calculateReportData).toHaveBeenCalledWith(
      { legal_agent: 5, unknown_service: 0 },
      expect.stringContaining("2026"),
    );
    expect(mocks.authGetUser).toHaveBeenCalledWith("user-1");
    expect(mocks.enqueueMonthlyUsageEmail).toHaveBeenCalledWith({
      email: "user@example.test",
      reportData: { totalTimeSavedMinutes: 10, haFattoPrompting: false, interazioniCount: 2, title: "report" },
    });
    expect(eventOrder).toEqual(["set", "commit", "email"]);
    expect(result).toEqual({ utenti_processati: 1, email_accodate: 1 });
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });

  it("does not create an email for an empty report and tolerates auth lookup failures", async () => {
    // Arrange
    mocks.usageForEach.mockImplementation((callback: (doc: unknown) => void) => {
      [reportDoc("user-1", "2026_empty", 0), reportDoc("user-2", "2026_research", 1)].forEach(callback);
    });
    mocks.db.collection.mockImplementation((name: string) => name === "register"
      ? { doc: vi.fn((uid: string) => ({
          get: vi.fn(async () => ({ exists: true })),
          collection: vi.fn(() => ({ doc: vi.fn(() => ({ uid })) })),
        })) }
      : { add: mocks.addStats });
    mocks.calculateReportData.mockReturnValue({
      totalTimeSavedMinutes: 0, haFattoPrompting: false, interazioniCount: 0,
    });
    mocks.authGetUser.mockRejectedValue(new Error("auth lookup failed"));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    // Act
    const result = await computeAndSaveMonthlyUsage();

    // Assert
    expect(result).toEqual({ utenti_processati: 2, email_accodate: 0 });
    expect(mocks.enqueueMonthlyUsageEmail).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it("validates downgrade method and required body values", async () => {
    // Arrange
    const method = response();

    // Act
    await executeTasksDowngrade({ method: "GET" } as never, method as never);

    // Assert
    expect(method.status).toHaveBeenCalledWith(405);
    expect(method.send).toHaveBeenCalledWith("Method Not Allowed");

    // Arrange
    const noUid = response();

    // Act
    await executeTasksDowngrade({ method: "POST", body: { uid: " " } } as never, noUid as never);

    // Assert
    expect(noUid.status).toHaveBeenCalledWith(400);
    expect(noUid.json).toHaveBeenCalledWith({ error: "Missing uid" });

    // Arrange
    const noExpiry = response();

    // Act
    await executeTasksDowngrade({ method: "POST", body: { uid: "user-1", expireSec: 0 } } as never, noExpiry as never);

    // Assert
    expect(noExpiry.status).toHaveBeenCalledWith(400);
    expect(noExpiry.json).toHaveBeenCalledWith({ error: "Missing expireSec" });
  });

  it.each([
    ["missing register", { exists: false }, "register_not_found"],
    ["missing expiry", { exists: true, data: () => ({ expire: null }) }, "no_current_expire"],
    ["outdated expiry", { exists: true, data: () => ({ expire: firestoreModule.Timestamp.fromMillis(1000) }) }, "outdated_task"],
  ])("skips downgrade if guard finds %s", async (_case, registerSnapshot, skipped) => {
    // Arrange
    mocks.db.collection.mockImplementation((name: string) => ({
      doc: vi.fn(() => name === "register"
        ? { get: vi.fn(async () => registerSnapshot) }
        : mocks.userRef),
    }));
    const res = response();

    // Act
    await executeTasksDowngrade({ method: "POST", body: { uid: "user-1", expireSec: 2 } } as never, res as never);

    // Assert
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ ok: true, skipped });
    expect(mocks.db.runTransaction).not.toHaveBeenCalled();
  });

  it("returns 404 when transaction cannot find the user", async () => {
    // Arrange
    mocks.db.collection.mockImplementation((name: string) => ({
      doc: vi.fn(() => name === "register"
        ? { get: vi.fn(async () => ({ exists: true, data: () => ({ expire: firestoreModule.Timestamp.fromMillis(2000) }) })) }
        : mocks.userRef),
    }));
    mocks.txGet.mockResolvedValueOnce({ exists: false });
    const res = response();

    // Act
    await executeTasksDowngrade({ method: "POST", body: { uid: "user-1", expireSec: 2 } } as never, res as never);

    // Assert
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: "User not found" });
    expect(mocks.enqueueDowngradeEmail).not.toHaveBeenCalled();
  });

  it("downgrades an expired user transactionally and sends one notification", async () => {
    // Arrange
    mocks.db.collection.mockImplementation((name: string) => ({
      doc: vi.fn((uid: string) => {
        expect(uid).toBe("user-1");
        return name === "register"
          ? { get: vi.fn(async () => ({ exists: true, data: () => ({ expire: firestoreModule.Timestamp.fromMillis(2000) }) })) }
          : mocks.userRef;
      }),
    }));
    const res = response();

    // Act
    await executeTasksDowngrade({ method: "POST", body: { uid: " user-1 ", expireSec: 2 } } as never, res as never);

    // Assert
    expect(mocks.txSet).toHaveBeenCalledTimes(3);
    expect(mocks.txSet).toHaveBeenNthCalledWith(1, mocks.userRef, {
      status: "nessuno", downgradedAt: "server-time",
    }, { merge: true });
    expect(mocks.txSet).toHaveBeenNthCalledWith(2, expect.objectContaining({ get: expect.any(Function) }), {
      planId: "nessuno", downgradedAt: "server-time",
    }, { merge: true });
    expect(mocks.enqueueDowngradeEmail).toHaveBeenCalledWith({ uid: "user-1" });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      ok: true, skipped: null, alreadyDowngraded: false, alreadyEmailed: false,
    });
  });

  it("does not repeat status updates or email once both downgrade flags are set", async () => {
    // Arrange
    mocks.db.collection.mockImplementation((name: string) => ({
      doc: vi.fn(() => name === "register"
        ? { get: vi.fn(async () => ({ exists: true, data: () => ({ expire: firestoreModule.Timestamp.fromMillis(2000) }) })) }
        : mocks.userRef),
    }));
    mocks.txGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({ status: "nessuno", downgradeEmailSentAt: new Date() }),
    });
    const res = response();

    // Act
    await executeTasksDowngrade({ method: "POST", body: { uid: "user-1", expireSec: 2 } } as never, res as never);

    // Assert
    expect(mocks.txSet).not.toHaveBeenCalled();
    expect(mocks.enqueueDowngradeEmail).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({
      ok: true, skipped: null, alreadyDowngraded: true, alreadyEmailed: true,
    });
  });

  it("returns a server error when the downgrade email enqueue fails", async () => {
    // Arrange
    mocks.db.collection.mockImplementation((name: string) => ({
      doc: vi.fn(() => name === "register"
        ? { get: vi.fn(async () => ({ exists: true, data: () => ({ expire: firestoreModule.Timestamp.fromMillis(2000) }) })) }
        : mocks.userRef),
    }));
    const failure = new Error("queue failed");
    mocks.enqueueDowngradeEmail.mockRejectedValue(failure);
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = response();

    // Act
    await executeTasksDowngrade({ method: "POST", body: { uid: "user-1", expireSec: 2 } } as never, res as never);

    // Assert
    expect(error).toHaveBeenCalledWith("[TASKS_DOWNGRADE] error", failure);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Internal error" });
    error.mockRestore();
  });
});
