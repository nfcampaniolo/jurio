import { beforeEach, describe, expect, expectTypeOf, it, vi } from "vitest";
import type { CloudFileDownloadRequestBody, CloudFilesListRequestBody } from "@functions/cloud/_interfaces";

describe("cloud interface contracts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("models provider listing and file download request bodies", () => {
    // Arrange
    const listRequest: CloudFilesListRequestBody = { provider: "google", providerToken: "token" };
    const emptyListRequest: CloudFilesListRequestBody = {};
    const downloadRequest: CloudFileDownloadRequestBody = {
      provider: "google",
      providerToken: "token",
      fileId: "file-1",
    };

    // Act
    const results = [listRequest.provider, emptyListRequest.provider, downloadRequest.fileId];

    // Assert
    expectTypeOf(listRequest).toMatchTypeOf<CloudFilesListRequestBody>();
    expectTypeOf(downloadRequest).toMatchTypeOf<CloudFileDownloadRequestBody>();
    expect(results).toEqual(["google", undefined, "file-1"]);
  });
});
