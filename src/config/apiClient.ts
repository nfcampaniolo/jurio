import { firebaseApp } from '@/infrastructure/firebase';

type JsonRecord = Record<string, unknown>;

async function getAuthToken(): Promise<string> {
  const { getAuth } = await import('firebase/auth');

  const auth = getAuth(firebaseApp);
  const user = auth.currentUser;

  if (!user) {
    throw new Error('Utente non autenticato');
  }

  return user.getIdToken();
}

async function getAppCheckToken(): Promise<string> {
  try {
    const { initializeFirebaseAppCheck } =
      await import('@/infrastructure/appCheck');

    const appCheck = initializeFirebaseAppCheck();

    if (!appCheck) {
      return '';
    }

    const { getToken } = await import('firebase/app-check');

    const response = await getToken(appCheck, false);

    return response.token;
  } catch (err) {
    console.warn(
      'App Check fallito. La richiesta potrebbe essere rifiutata dal server.',
      err
    );

    return '';
  }
}

export async function fetchWithSecurity<T = JsonRecord>(
  url: string,
  body: T
): Promise<Response> {
  const [idToken, appCheckToken] = await Promise.all([
    getAuthToken(),
    getAppCheckToken(),
  ]);

  return fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
      'X-Firebase-AppCheck': appCheckToken,
    },
    body: JSON.stringify(body),
  });
}

export async function fetchWithoutContent(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const [idToken, appCheckToken] = await Promise.all([
    getAuthToken(),
    getAppCheckToken(),
  ]);

  const headers = new Headers(options.headers);

  headers.set('Authorization', `Bearer ${idToken}`);
  headers.set('X-Firebase-AppCheck', appCheckToken);

  const body = options.body;

  if (body instanceof FormData) {
    headers.delete('Content-Type');

    return fetch(url, {
      ...options,
      method: options.method ?? 'POST',
      headers,
      body,
    });
  }

  if (
    body !== undefined &&
    body !== null &&
    typeof body !== 'string'
  ) {
    headers.set('Content-Type', 'application/json');

    return fetch(url, {
      ...options,
      method: options.method ?? 'POST',
      headers,
      body: JSON.stringify(body),
    });
  }

  return fetch(url, {
    ...options,
    method: options.method ?? 'POST',
    headers,
  });
}

export async function fetchWithAppCheckOnly<T = JsonRecord>(
  url: string,
  body: T
): Promise<Response> {
  const appCheckToken = await getAppCheckToken();

  return fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Firebase-AppCheck': appCheckToken,
    },
    body: JSON.stringify(body),
  });
}