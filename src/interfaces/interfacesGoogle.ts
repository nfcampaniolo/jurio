export interface GooglePickerDocument {
  id: string;
  name: string;
  mimeType: string;
}

export interface GooglePickerResponse {
  action: string;
  docs?: GooglePickerDocument[];
}

export interface GooglePickerView {
  setMimeTypes(mimeTypes: string): GooglePickerView;
}

export interface GooglePickerBuilder {
  addView(view: GooglePickerView): GooglePickerBuilder;
  setOAuthToken(token: string): GooglePickerBuilder;
  setDeveloperKey(key: string): GooglePickerBuilder;
  setAppId(appId: string): GooglePickerBuilder;
  setCallback(
    callback: (data: GooglePickerResponse) => void
  ): GooglePickerBuilder;
  build(): {
    setVisible(visible: boolean): void;
  };
}

export interface GooglePickerNamespace {
  DocsView: new (viewId: string) => GooglePickerView;
  PickerBuilder: new () => GooglePickerBuilder;
  ViewId: { DOCS: string };
  Action: { PICKED: string; CANCEL: string };
}

export interface GoogleIdentityTokenResponse {
  access_token?: string;
  error?: string;
  error_description?: string;
}

export interface GoogleIdentityTokenClient {
  requestAccessToken(options?: { prompt?: string }): void;
}

export interface GoogleIdentityOAuth2 {
  initTokenClient(options: {
    client_id: string;
    scope: string;
    callback: (response: GoogleIdentityTokenResponse) => void;
  }): GoogleIdentityTokenClient;
}

export interface GoogleAccounts {
  oauth2: GoogleIdentityOAuth2;
}

export interface GapiAPI {
  load(apiName: string, callback: () => void): void;
}