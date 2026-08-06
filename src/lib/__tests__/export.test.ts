import { downloadWorkbook, loadLogo } from "@/lib/export";

const INPUT = {
  sheetName: "Sheet",
  title: "Report",
  columns: [{ header: "Branch" }],
  rows: [["Tripoli"]],
};

describe("downloadWorkbook", () => {
  let created: string[];
  let revoked: string[];

  beforeEach(() => {
    created = [];
    revoked = [];
    // jsdom implements neither half of the object-URL API.
    URL.createObjectURL = jest.fn(() => {
      const url = `blob:test/${created.length}`;
      created.push(url);
      return url;
    });
    URL.revokeObjectURL = jest.fn((url: string) => {
      revoked.push(url);
    });
  });

  it("saves under the given name with an .xlsx extension", () => {
    const click = jest
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(function (this: HTMLAnchorElement) {
        expect(this.download).toBe("report-2026-08-05.xlsx");
      });

    downloadWorkbook("report-2026-08-05", INPUT);

    expect(click).toHaveBeenCalledTimes(1);
    click.mockRestore();
  });

  it("does not double the extension when the caller supplied one", () => {
    const click = jest
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(function (this: HTMLAnchorElement) {
        expect(this.download).toBe("report.xlsx");
      });

    downloadWorkbook("report.xlsx", INPUT);
    click.mockRestore();
  });

  it("releases the object URL and leaves no anchor behind", () => {
    const click = jest
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});

    downloadWorkbook("report", INPUT);

    // A leaked blob URL pins the whole workbook in memory for the life of the
    // document, and a register export is not small.
    expect(revoked).toEqual(created);
    expect(document.querySelectorAll("a")).toHaveLength(0);
    click.mockRestore();
  });
});

describe("loadLogo", () => {
  const image = { src: "/_next/static/media/logo.png", width: 464, height: 128 };

  afterEach(() => {
    // @ts-expect-error -- restoring jsdom's absence of fetch
    delete globalThis.fetch;
  });

  it("returns the bytes and the natural size", async () => {
    globalThis.fetch = jest.fn(async () => ({
      ok: true,
      arrayBuffer: async () => new Uint8Array([0x89, 0x50]).buffer,
    })) as unknown as typeof fetch;

    await expect(loadLogo(image)).resolves.toEqual({
      bytes: new Uint8Array([0x89, 0x50]),
      width: 464,
      height: 128,
    });
  });

  /*
   * A missing letterhead is a cosmetic loss; refusing to export the figures
   * because of it is not. Both failure shapes degrade to "no logo" rather than
   * rejecting, and the two tests below are what stop that being quietly undone.
   */
  it("degrades to no logo on a non-OK response", async () => {
    globalThis.fetch = jest.fn(async () => ({ ok: false })) as unknown as typeof fetch;
    await expect(loadLogo(image)).resolves.toBeUndefined();
  });

  it("degrades to no logo when the fetch throws", async () => {
    globalThis.fetch = jest.fn(async () => {
      throw new TypeError("Failed to fetch");
    }) as unknown as typeof fetch;
    await expect(loadLogo(image)).resolves.toBeUndefined();
  });
});
