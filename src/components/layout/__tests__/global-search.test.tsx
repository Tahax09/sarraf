import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Users } from "lucide-react";
import {
  GlobalSearch,
  GlobalSearchTrigger,
} from "@/components/layout/global-search";
import { SearchProvider } from "@/lib/search/provider";
import { ShortcutProvider } from "@/lib/shortcuts";
import type { SearchResult, SearchService } from "@/lib/search/types";
import { renderWithProviders, message } from "@/test/utils";
import { navigation } from "@/test/mock-navigation";

jest.mock("@/i18n/navigation", () =>
  jest.requireActual("@/test/mock-navigation").i18nNavigationMock(),
);

jest.mock("@/lib/use-permission", () => ({
  usePermission: () => ({ ready: true, failed: false, can: () => true }),
}));

function result(over: Partial<SearchResult> & { id: string }): SearchResult {
  return {
    category: "clients",
    title: "Ahmed Ali",
    href: "/core/clients/list",
    icon: Users,
    score: 100,
    matches: [],
    ...over,
  };
}

const HITS = [
  result({ id: "1", title: "Ahmed Ali", subtitle: "0912345678", matches: [0, 1] }),
  result({ id: "2", title: "Ahmed Salem" }),
  result({
    id: "3",
    category: "accounts",
    title: "LY-0001",
    href: "/core/accounts",
    meta: "1,000.000 LYD",
  }),
];

function service(over?: Partial<SearchService>): SearchService {
  return { search: async () => HITS, ...over };
}

function renderPalette(searchService: SearchService = service()) {
  return renderWithProviders(
    <ShortcutProvider>
      <SearchProvider service={searchService}>
        <GlobalSearchTrigger />
        <GlobalSearch />
      </SearchProvider>
    </ShortcutProvider>,
  );
}

beforeEach(() => {
  navigation.reset("/dashboard");
  // Recent terms are session-scoped — they can be a client name.
  window.sessionStorage.clear();
});

/** The palette is closed until something opens it. */
async function open(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: /.*/ }));
  return screen.findByRole("combobox");
}

describe("GlobalSearch", () => {
  it("opens from the header trigger", async () => {
    const user = userEvent.setup();
    renderPalette();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();

    await open(user);
    expect(screen.getByRole("combobox")).toBeInTheDocument();
  });

  it("opens on Ctrl/Cmd+K from anywhere on the page", async () => {
    const user = userEvent.setup();
    renderPalette();

    await user.keyboard("{Meta>}k{/Meta}");
    expect(await screen.findByRole("combobox")).toBeInTheDocument();
  });

  it("asks for more characters before it queries", async () => {
    const user = userEvent.setup();
    const search = jest.fn(async () => HITS);
    renderPalette(service({ search }));

    const input = await open(user);
    await user.type(input, "a");

    expect(
      await screen.findByText(message("search.hint", { min: "2" })),
    ).toBeInTheDocument();
    expect(search).not.toHaveBeenCalled();
  });

  it("groups results by category and highlights the matched characters", async () => {
    const user = userEvent.setup();
    renderPalette();

    const input = await open(user);
    await user.type(input, "ahmed");

    await screen.findByText(message("search.categories.clients"));
    expect(
      screen.getByText(message("search.categories.accounts")),
    ).toBeInTheDocument();

    // `matches: [0, 1]` on the first hit — the run is marked, not the whole row.
    const marked = document.querySelectorAll("mark");
    expect(marked).toHaveLength(1);
    expect(marked[0]).toHaveTextContent("Ah");
  });

  it("walks results with the arrow keys and wraps at the ends", async () => {
    const user = userEvent.setup();
    renderPalette();

    const input = await open(user);
    await user.type(input, "ahmed");
    await screen.findAllByRole("option");

    const options = screen.getAllByRole("option");
    expect(options[0]).toHaveAttribute("aria-selected", "true");

    await user.keyboard("{ArrowDown}");
    expect(screen.getAllByRole("option")[1]).toHaveAttribute(
      "aria-selected",
      "true",
    );

    // Up from the first row lands on the last, not on nothing.
    await user.keyboard("{ArrowUp}{ArrowUp}");
    expect(screen.getAllByRole("option")[2]).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("navigates to the highlighted result on Enter and closes", async () => {
    const user = userEvent.setup();
    renderPalette();

    const input = await open(user);
    await user.type(input, "ahmed");
    await screen.findAllByRole("option");
    await user.keyboard("{Enter}");

    await waitFor(() =>
      expect(navigation.calls).toContain("/core/clients/list"),
    );
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("never puts the term in the URL", async () => {
    const user = userEvent.setup();
    renderPalette();

    const input = await open(user);
    await user.type(input, "ahmed");
    await screen.findAllByRole("option");
    await user.keyboard("{Enter}");

    await waitFor(() => expect(navigation.calls).toHaveLength(1));
    // Client names and account numbers must not reach history or referrers.
    expect(navigation.calls[0]).not.toContain("ahmed");
    expect(navigation.calls[0]).not.toContain("?");
  });

  it("remembers the term and offers it back on the next visit", async () => {
    const user = userEvent.setup();
    renderPalette();

    const input = await open(user);
    await user.type(input, "ahmed");
    await screen.findAllByRole("option");
    await user.keyboard("{Enter}");

    await user.keyboard("{Meta>}k{/Meta}");
    expect(
      await screen.findByText(message("search.recent")),
    ).toBeInTheDocument();
    expect(screen.getByText("ahmed")).toBeInTheDocument();
  });

  it("says so when nothing matched", async () => {
    const user = userEvent.setup();
    renderPalette(service({ search: async () => [] }));

    const input = await open(user);
    await user.type(input, "zzzz");

    expect(
      await screen.findByText(message("search.noResults")),
    ).toBeInTheDocument();
  });

  it("reports a failed search instead of an empty one", async () => {
    const user = userEvent.setup();
    renderPalette(
      service({
        search: async () => {
          throw new Error("network");
        },
      }),
    );

    const input = await open(user);
    await user.type(input, "ahmed");

    expect(
      await screen.findByText(message("search.failed")),
    ).toBeInTheDocument();
  });
});
