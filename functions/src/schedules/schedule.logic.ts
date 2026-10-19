export async function scheduleDowngradeTask(args: {
  projectId: string;
  location: string;
  queue: string;
  targetUrl: string;
  serviceAccountEmail: string;
  uid: string;
  expireSec: number;
}) {
  const { CloudTasksClient } = await import("@google-cloud/tasks");
  const tasks = new CloudTasksClient();
  const parent = tasks.queuePath(args.projectId, args.location, args.queue);
  const taskId = `downgrade-${args.uid}-${args.expireSec}`.replaceAll(/[^a-zA-Z0-9-_]/g, "_");
  const payload = { uid: args.uid, expireSec: args.expireSec };
  const task = {
    name: tasks.taskPath(args.projectId, args.location, args.queue, taskId),
    scheduleTime: { seconds: args.expireSec },
    httpRequest: {
      httpMethod: "POST" as const,
      url: args.targetUrl,
      headers: { "Content-Type": "application/json" },
      body: Buffer.from(JSON.stringify(payload)).toString("base64"),
      oidcToken: {
        serviceAccountEmail: args.serviceAccountEmail,
        audience: args.targetUrl,
      },
    },
  };
  try {
    await tasks.createTask({ parent, task });
  } catch (e: any) {
    const msg = String(e?.message ?? "");
    if (e?.code === 6 || msg.includes("ALREADY_EXISTS")) return;
    throw e;
  }
}

export async function tryScheduleDowngradeTask(uid: string, expireSec: number) {
  const currentProjectId = process.env.PROJECT_ID || "jurio-it";
  const taskServiceAccount = process.env.TASK_SERVICE_ACCOUNT || "130993418358-compute@developer.gserviceaccount.com";
  const dynamicTargetUrl = `https://europe-west1-${currentProjectId}.cloudfunctions.net/tasksDowngrade`;

  await scheduleDowngradeTask({
    projectId: currentProjectId,
    location: "europe-west1",
    queue: "subscription-expire",
    targetUrl: dynamicTargetUrl,
    serviceAccountEmail: taskServiceAccount,
    uid,
    expireSec,
  });
}
