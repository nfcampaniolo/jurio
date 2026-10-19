import { beforeEach, describe, expect, it, vi } from "vitest";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const mocks = vi.hoisted(() => ({
  client: {
    queuePath: vi.fn(() => "projects/p/locations/l/queues/q"),
    taskPath: vi.fn((_p: string, _l: string, _q: string, id: string) => `task/${id}`),
    createTask: vi.fn(),
  },
  constructor: vi.fn(),
}));

const sourceRequire = createRequire(resolve(process.cwd(), "functions/src/schedules/schedule.logic.ts"));
const tasksPath = resolve(
  sourceRequire.resolve("@google-cloud/tasks").replace("/build/cjs/src/index.cjs", "/build/esm/src/index.js"),
);
vi.doMock(tasksPath, () => ({
  CloudTasksClient: class {
    constructor() {
      mocks.constructor();
      return mocks.client;
    }
  },
}));

const { scheduleDowngradeTask, tryScheduleDowngradeTask } = await import("@functions/schedules/schedule.logic");

describe("schedule downgrade tasks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("PROJECT_ID", "test-project");
    vi.stubEnv("TASK_SERVICE_ACCOUNT", "tasks@test.iam.gserviceaccount.com");
  });

  it("creates a scheduled task with sanitized identity, payload, and OIDC audience", async () => {
    // Arrange
    const args = {
      projectId: "project",
      location: "europe-west1",
      queue: "subscription-expire",
      targetUrl: "https://example.test/downgrade",
      serviceAccountEmail: "worker@example.test",
      uid: "user/a:b",
      expireSec: 1234,
    };
    mocks.client.createTask.mockResolvedValue(undefined);

    // Act
    await scheduleDowngradeTask(args);

    // Assert
    expect(mocks.constructor).toHaveBeenCalledOnce();
    expect(mocks.client.queuePath).toHaveBeenCalledWith("project", "europe-west1", "subscription-expire");
    expect(mocks.client.taskPath).toHaveBeenCalledWith("project", "europe-west1", "subscription-expire", "downgrade-user_a_b-1234");
    const request = mocks.client.createTask.mock.calls[0][0];
    expect(request.parent).toBe("projects/p/locations/l/queues/q");
    expect(request.task).toMatchObject({
      name: "task/downgrade-user_a_b-1234",
      scheduleTime: { seconds: 1234 },
      httpRequest: {
        httpMethod: "POST",
        url: args.targetUrl,
        headers: { "Content-Type": "application/json" },
        oidcToken: { serviceAccountEmail: args.serviceAccountEmail, audience: args.targetUrl },
      },
    });
    expect(Buffer.from(request.task.httpRequest.body, "base64").toString()).toBe(JSON.stringify({ uid: args.uid, expireSec: args.expireSec }));
    expect(mocks.client.createTask).toHaveBeenCalledOnce();
  });

  it.each([
    { code: 6, message: "already exists" },
    { code: 5, message: "ALREADY_EXISTS: duplicate task" },
  ])("ignores already-existing tasks (%o)", async (error) => {
    // Arrange
    mocks.client.createTask.mockRejectedValue(error);

    // Act
    const result = await scheduleDowngradeTask({
      projectId: "p", location: "l", queue: "q", targetUrl: "url",
      serviceAccountEmail: "worker", uid: "u", expireSec: 1,
    });

    // Assert
    expect(result).toBeUndefined();
    expect(mocks.client.createTask).toHaveBeenCalledOnce();
  });

  it("propagates unexpected task creation failures", async () => {
    // Arrange
    const failure = new Error("permission denied");
    mocks.client.createTask.mockRejectedValue(failure);

    // Act
    const result = scheduleDowngradeTask({
      projectId: "p", location: "l", queue: "q", targetUrl: "url",
      serviceAccountEmail: "worker", uid: "u", expireSec: 1,
    });

    // Assert
    await expect(result).rejects.toBe(failure);
  });

  it("uses environment settings or documented defaults to schedule a downgrade", async () => {
    // Arrange
    mocks.client.createTask.mockResolvedValue(undefined);

    // Act
    await tryScheduleDowngradeTask("u-1", 987);

    // Assert
    expect(mocks.client.queuePath).toHaveBeenCalledWith("test-project", "europe-west1", "subscription-expire");
    expect(mocks.client.taskPath).toHaveBeenCalledWith("test-project", "europe-west1", "subscription-expire", "downgrade-u-1-987");
    const task = mocks.client.createTask.mock.calls[0][0].task;
    expect(task.httpRequest.url).toBe("https://europe-west1-test-project.cloudfunctions.net/tasksDowngrade");
    expect(task.httpRequest.oidcToken.serviceAccountEmail).toBe("tasks@test.iam.gserviceaccount.com");

    // Arrange
    vi.stubEnv("PROJECT_ID", "");
    vi.stubEnv("TASK_SERVICE_ACCOUNT", "");

    // Act
    await tryScheduleDowngradeTask("u-2", 654);

    // Assert
    const defaultTask = mocks.client.createTask.mock.calls[1][0].task;
    expect(defaultTask.httpRequest.url).toBe("https://europe-west1-jurio-it.cloudfunctions.net/tasksDowngrade");
    expect(defaultTask.httpRequest.oidcToken.serviceAccountEmail).toBe("130993418358-compute@developer.gserviceaccount.com");
  });
});
