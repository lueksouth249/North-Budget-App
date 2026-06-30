import { vi } from "vitest";

Object.defineProperty(globalThis, "crypto", {
  value: {
    ...globalThis.crypto,
    randomUUID: () => "00000000-0000-4000-8000-000000000000",
    subtle: globalThis.crypto?.subtle
  },
  configurable: true
});

vi.stubGlobal("confirm", () => true);
