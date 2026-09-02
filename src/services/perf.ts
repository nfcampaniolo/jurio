type Attrs = Record<
  string,
  string | number | boolean | undefined | null
>;

export async function withTrace<T>(
  name: string,
  attrs: Attrs,
  fn: () => Promise<T>
): Promise<T> {
  const {
    getPerf,
  } = await import("@/services/optionalService");

  const perf = getPerf();

  if (!perf) {
    return fn();
  }

  const { trace } = await import(
    "firebase/performance"
  );

  const t = trace(perf, name);

  // Firebase Performance:
  // massimo 5 attributi per trace
  // valori stringa
  let count = 0;

  for (const [key, value] of Object.entries(attrs)) {
    if (
      value === undefined ||
      value === null
    ) {
      continue;
    }

    if (count >= 5) {
      break;
    }

    const safeKey =
      key.length > 40
        ? key.substring(0, 40)
        : key;

    let safeValue = String(value);

    if (safeValue.length > 100) {
      safeValue =
        safeValue.substring(0, 97) + "...";
    }

    t.putAttribute(
      safeKey,
      safeValue
    );

    count++;
  }

  t.start();

  try {
    return await fn();
  } finally {
    t.stop();
  }
}