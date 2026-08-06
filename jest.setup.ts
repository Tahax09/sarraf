import "@testing-library/jest-dom";
import { configure } from "@testing-library/react";
import { TextDecoder, TextEncoder } from "node:util";

/*
 * jsdom ships no `TextEncoder`/`TextDecoder`, although every browser has had
 * both for years. The workbook writer encodes its XML parts with them, so
 * without this the export suite fails on the environment rather than on the
 * code. Node's implementations are the same WHATWG ones.
 */
Object.assign(globalThis, {
  TextEncoder: globalThis.TextEncoder ?? TextEncoder,
  TextDecoder: globalThis.TextDecoder ?? TextDecoder,
});

/*
 * Testing Library's 1s default for `findBy`/`waitFor` is a wall-clock budget,
 * not a work budget. The heavy integration suites — the two register forms, the
 * approval queue, the countries admin — render a full page of providers, so on
 * a machine running several Jest workers at once they lose the race and fail
 * with "Unable to find role=table" while the render is still in flight. That
 * reads as a logic regression and is not one: the same suites pass alone.
 *
 * The budget is raised rather than the worker count pinned, so the suite stays
 * honest under whatever parallelism the runner picks. A real hang still fails,
 * it just fails on Jest's own per-test timeout instead.
 */
configure({ asyncUtilTimeout: 15_000 });

// jsdom implements neither of these, and the dialog-based modal/sheet and the
// virtualized tables both reach for them.
if (typeof HTMLDialogElement !== "undefined") {
  HTMLDialogElement.prototype.showModal ??= function showModal(this: HTMLDialogElement) {
    this.open = true;
  };
  HTMLDialogElement.prototype.show ??= function show(this: HTMLDialogElement) {
    this.open = true;
  };
  HTMLDialogElement.prototype.close ??= function close(this: HTMLDialogElement) {
    this.open = false;
    this.dispatchEvent(new Event("close"));
  };
}

// jsdom has no layout, so scrolling is a no-op rather than a missing method.
// The command palette keeps its highlighted row in view through it.
Element.prototype.scrollIntoView ??= function scrollIntoView() {};

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }),
});
