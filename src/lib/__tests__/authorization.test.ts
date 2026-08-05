import { readdirSync } from "node:fs";
import { join } from "node:path";
import {
  ROUTE_PERMISSIONS,
  resolveRoutePermission,
} from "@/lib/authorization";
import { navGroups } from "@/lib/nav";
import { MODULE_ACTIONS } from "@/lib/permissions";

const APP_DIR = join(process.cwd(), "src/app/[locale]/(app)");

/** Every `page.tsx` under the authenticated segment, as the URL it serves. */
function routeFiles(dir: string, prefix = ""): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory()) {
      // Route groups `(name)` do not appear in the URL.
      const segment = entry.name.startsWith("(") ? "" : `/${entry.name}`;
      return routeFiles(join(dir, entry.name), `${prefix}${segment}`);
    }
    return entry.name === "page.tsx" ? [prefix || "/"] : [];
  });
}

const ROUTES = routeFiles(APP_DIR);

describe("route permission coverage", () => {
  it("finds the application routes", () => {
    expect(ROUTES.length).toBeGreaterThan(20);
  });

  /**
   * `resolveRoutePermission` returns `null` for an unmapped route, which means
   * "any authenticated user". That is the right default for `/profile`, but a
   * silent default for a new module page would ship an unguarded screen — this
   * is the test that makes the omission loud.
   */
  it.each(ROUTES)("guards %s", (route) => {
    const permission = resolveRoutePermission(route);
    const deliberatelyOpen = ["/profile"];
    if (deliberatelyOpen.includes(route)) {
      expect(permission).toBeNull();
      return;
    }
    expect(permission).not.toBeNull();
  });

  it("maps every route to an action the module actually defines", () => {
    for (const entry of ROUTE_PERMISSIONS) {
      expect(MODULE_ACTIONS[entry.module]).toContain(entry.action);
    }
  });

  it("prefers the longest matching prefix", () => {
    // `/register` creates records, so it must not fall through to the
    // `/list` view rule that shares its module.
    expect(resolveRoutePermission("/core/withdrawal/register")).toMatchObject({
      module: "withdrawal",
      action: "create",
    });
    expect(resolveRoutePermission("/core/withdrawal/list")).toMatchObject({
      module: "withdrawal",
      action: "view",
    });
  });

  it("ignores a trailing slash", () => {
    expect(resolveRoutePermission("/core/users/")).toMatchObject({
      module: "users",
    });
  });

  it("labels every guarded route with a navigation key", () => {
    const navKeys = new Set(
      navGroups.flatMap((group) => group.items.map((item) => item.labelKey)),
    );
    for (const entry of ROUTE_PERMISSIONS) {
      expect(navKeys).toContain(entry.labelKey);
    }
  });
});
