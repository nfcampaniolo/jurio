import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach } from "vitest";
import { installOfficeMock, uninstallOfficeMocks } from "./mocks/office";
import { clearMemoryState } from "@word/tools/memoryState";

beforeEach(() => {
  localStorage.clear();
  installOfficeMock();
});

afterEach(() => {
  cleanup();
  clearMemoryState();
  uninstallOfficeMocks();
});
