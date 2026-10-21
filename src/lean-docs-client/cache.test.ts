import { describe, expect, it } from "vitest";
import { createRecordCache } from "./cache";

describe("document cache", () => {
  it("loads existing browser records without modifying them", () => {
    const original = JSON.stringify([{ id: "existing", photo: "original-photo" }]);
    const cache = createRecordCache(() => ({
      getItem: () => original,
      setItem: () => { throw new Error("No writes expected"); },
    }));
    const records = cache.get("sofDocuments");
    records[0].photo = "changed externally";
    expect(cache.get("sofDocuments")).toEqual([{ id: "existing", photo: "original-photo" }]);
  });

  it("retains confirmed server records when session storage is unavailable", () => {
    const cache = createRecordCache(() => { throw new Error("Storage denied"); });
    cache.set("sofDocuments", [{ id: "one" }, { id: "two" }]);
    expect(cache.get("sofDocuments")).toEqual([{ id: "one" }, { id: "two" }]);
  });
});
