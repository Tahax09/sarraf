import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  ShortcutProvider,
  useShortcut,
  useShortcutRegistry,
} from "@/lib/shortcuts";

function Probe({
  onFire,
  keys = "mod+k",
  whileTyping = false,
}: {
  onFire: () => void;
  keys?: string;
  whileTyping?: boolean;
}) {
  useShortcut(
    { id: "probe", keys, descriptionKey: "openSearch", group: "global", whileTyping },
    onFire,
  );
  return <input aria-label="field" />;
}

function Registry() {
  const { shortcuts } = useShortcutRegistry();
  return <p data-testid="count">{shortcuts.length}</p>;
}

function renderProbe(props: Parameters<typeof Probe>[0]) {
  return render(
    <ShortcutProvider>
      <Probe {...props} />
      <Registry />
    </ShortcutProvider>,
  );
}

describe("shortcuts", () => {
  it("fires on the registered chord", async () => {
    const user = userEvent.setup();
    const onFire = jest.fn();
    renderProbe({ onFire });

    await user.keyboard("{Meta>}k{/Meta}");
    expect(onFire).toHaveBeenCalledTimes(1);
  });

  it("treats Ctrl and Cmd as the same modifier", async () => {
    const user = userEvent.setup();
    const onFire = jest.fn();
    renderProbe({ onFire });

    await user.keyboard("{Control>}k{/Control}");
    expect(onFire).toHaveBeenCalledTimes(1);
  });

  it("ignores the chord without its modifier", async () => {
    const user = userEvent.setup();
    const onFire = jest.fn();
    renderProbe({ onFire });

    await user.keyboard("k");
    expect(onFire).not.toHaveBeenCalled();
  });

  it("does not fire a bare-letter shortcut while a field has focus", async () => {
    const user = userEvent.setup();
    const onFire = jest.fn();
    renderProbe({ onFire, keys: "/" });

    await user.click(screen.getByLabelText("field"));
    await user.keyboard("/");

    // An operator typing an account number must not trigger navigation.
    expect(onFire).not.toHaveBeenCalled();
    expect(screen.getByLabelText("field")).toHaveValue("/");
  });

  it("fires inside a field when the shortcut opts in", async () => {
    const user = userEvent.setup();
    const onFire = jest.fn();
    renderProbe({ onFire, whileTyping: true });

    await user.click(screen.getByLabelText("field"));
    await user.keyboard("{Meta>}k{/Meta}");
    expect(onFire).toHaveBeenCalledTimes(1);
  });

  it("matches a chord that needs Shift to type, like ?", async () => {
    const user = userEvent.setup();
    const onFire = jest.fn();
    renderProbe({ onFire, keys: "?" });

    await user.keyboard("{Shift>}?{/Shift}");
    expect(onFire).toHaveBeenCalledTimes(1);
  });

  it("publishes registrations so the help dialog can list them", () => {
    renderProbe({ onFire: () => {} });
    expect(screen.getByTestId("count")).toHaveTextContent("1");
  });

  it("unregisters when the owning component unmounts", async () => {
    const user = userEvent.setup();
    const onFire = jest.fn();
    const { rerender } = render(
      <ShortcutProvider>
        <Probe onFire={onFire} />
        <Registry />
      </ShortcutProvider>,
    );

    rerender(
      <ShortcutProvider>
        <Registry />
      </ShortcutProvider>,
    );

    await user.keyboard("{Meta>}k{/Meta}");
    expect(onFire).not.toHaveBeenCalled();
    expect(screen.getByTestId("count")).toHaveTextContent("0");
  });
});
