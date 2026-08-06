"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";

/** The platform never changes mid-session, so there is nothing to subscribe to. */
const subscribeNever = () => () => {};

/**
 * Central keyboard shortcut registry.
 *
 * One document-level listener, one place that knows what a chord means. The
 * alternative — a `keydown` handler per feature — makes conflicts invisible and
 * gives the help dialog nothing to read. Registering here is what puts a
 * shortcut in the help dialog, so an undocumented shortcut cannot exist.
 */

export type ShortcutGroup = "global" | "navigation" | "forms";

export type Shortcut = {
  /** Unique; re-registering the same id replaces the previous handler. */
  id: string;
  /** Chord: `mod+k`, `alt+ArrowLeft`, `?`, `/`. `mod` is Cmd or Ctrl. */
  keys: string;
  /** Key in the `shortcuts` message namespace describing what it does. */
  descriptionKey: string;
  group: ShortcutGroup;
  handler: (event: KeyboardEvent) => void;
  /**
   * Fire even while a text field has focus. Off by default: an operator typing
   * an account number must not trigger navigation.
   */
  whileTyping?: boolean;
  /** Registered for the help dialog but not currently actionable. */
  disabled?: boolean;
};

type Registry = Map<string, Shortcut>;

type ShortcutState = {
  /** Every registered shortcut, for the help dialog. */
  shortcuts: Shortcut[];
  helpOpen: boolean;
  setHelpOpen: (open: boolean) => void;
  register: (shortcut: Shortcut) => () => void;
};

const ShortcutContext = createContext<ShortcutState | null>(null);

/** Fields where a bare letter is text, not a command. */
function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

/** Normalised description of a keyboard event, comparable to a chord string. */
function eventChord(event: KeyboardEvent): string {
  const parts: string[] = [];
  if (event.metaKey || event.ctrlKey) parts.push("mod");
  if (event.altKey) parts.push("alt");
  if (event.shiftKey) parts.push("shift");
  // Single letters compare lowercase; named keys (ArrowLeft, Escape) as-is.
  parts.push(event.key.length === 1 ? event.key.toLowerCase() : event.key);
  return parts.join("+");
}

/**
 * The same event described by its physical digit key rather than the character
 * it produced. macOS resolves Option+1 to "¡" (and Option+2 to "™", …), so a
 * digit chord would never match on the character alone.
 */
function digitChord(event: KeyboardEvent): string | null {
  const digit = /^Digit(\d)$/.exec(event.code);
  if (!digit) return null;
  const parts: string[] = [];
  if (event.metaKey || event.ctrlKey) parts.push("mod");
  if (event.altKey) parts.push("alt");
  if (event.shiftKey) parts.push("shift");
  parts.push(digit[1]);
  return parts.join("+");
}

/**
 * `?` needs Shift on most layouts, and `/` does not. Comparing the produced
 * character rather than the physical key keeps both working without a table of
 * keyboard layouts.
 */
function chordMatches(chord: string, event: KeyboardEvent): boolean {
  const normalised = chord.toLowerCase();
  const actual = eventChord(event).toLowerCase();
  if (actual === normalised) return true;
  if (digitChord(event) === normalised) return true;
  // Retry ignoring Shift for printable characters that require it.
  return (
    event.key.length === 1 &&
    actual.replace("shift+", "") === normalised.replace("shift+", "")
  );
}

export function ShortcutProvider({ children }: { children: ReactNode }) {
  const registry = useRef<Registry>(new Map());
  const [shortcuts, setShortcuts] = useState<Shortcut[]>([]);
  const [helpOpen, setHelpOpen] = useState(false);

  const publish = useCallback(() => {
    setShortcuts([...registry.current.values()]);
  }, []);

  const register = useCallback(
    (shortcut: Shortcut) => {
      registry.current.set(shortcut.id, shortcut);
      publish();
      return () => {
        registry.current.delete(shortcut.id);
        publish();
      };
    },
    [publish],
  );

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented) return;
      const typing = isTypingTarget(event.target);

      for (const shortcut of registry.current.values()) {
        if (shortcut.disabled) continue;
        if (typing && !shortcut.whileTyping) continue;
        if (!chordMatches(shortcut.keys, event)) continue;

        event.preventDefault();
        shortcut.handler(event);
        return;
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const value = useMemo(
    () => ({ shortcuts, helpOpen, setHelpOpen, register }),
    [shortcuts, helpOpen, register],
  );

  return (
    <ShortcutContext.Provider value={value}>
      {children}
    </ShortcutContext.Provider>
  );
}

export function useShortcutRegistry(): ShortcutState {
  const context = useContext(ShortcutContext);
  if (!context) {
    throw new Error(
      "useShortcutRegistry must be used inside a <ShortcutProvider>",
    );
  }
  return context;
}

/**
 * The registry when there is one, `null` when there is not.
 *
 * The signed-out pages live outside the shell and register no shortcuts, so a
 * component that offers the shortcut sheet has to be able to ask whether one
 * exists. Throwing is right for a component that needs the registry to work;
 * this is for the one that only mentions it.
 */
export function useOptionalShortcutRegistry(): ShortcutState | null {
  return useContext(ShortcutContext);
}

/**
 * Registers one shortcut for the lifetime of the calling component.
 *
 * The handler is read through a ref, so a shortcut stays bound to fresh state
 * without re-registering on every render.
 */
export function useShortcut(
  shortcut: Omit<Shortcut, "handler">,
  handler: (event: KeyboardEvent) => void,
) {
  const { register } = useShortcutRegistry();
  const handlerRef = useRef(handler);

  // Synced in an effect rather than during render: the registry reads the ref
  // from a document listener, which only ever runs after commit.
  useEffect(() => {
    handlerRef.current = handler;
  });

  const { id, keys, descriptionKey, group, whileTyping, disabled } = shortcut;

  useEffect(
    () =>
      register({
        id,
        keys,
        descriptionKey,
        group,
        whileTyping,
        disabled,
        handler: (event) => handlerRef.current(event),
      }),
    [register, id, keys, descriptionKey, group, whileTyping, disabled],
  );
}

/**
 * Ctrl/Cmd+S for the form on screen.
 *
 * `whileTyping` is on because the point of the chord is to save without leaving
 * the field being edited. Pass `disabled` while a submit is already in flight so
 * a held key cannot fire the same mutation twice.
 */
export function useSaveShortcut(
  onSave: () => void,
  options?: { disabled?: boolean },
) {
  useShortcut(
    {
      id: "form.save",
      keys: "mod+s",
      descriptionKey: "save",
      group: "forms",
      whileTyping: true,
      disabled: options?.disabled,
    },
    onSave,
  );
}

/**
 * Renders a chord for display: `mod` becomes ⌘ on Apple platforms and Ctrl
 * everywhere else, because showing the wrong one is worse than showing none.
 */
export function useChordLabel() {
  // The platform is an external, unchanging fact — subscribing to it with a
  // no-op means the server renders "Ctrl" and the client corrects to "⌘"
  // during hydration, with no effect-driven second paint.
  const apple = useSyncExternalStore(
    subscribeNever,
    () => /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent),
    () => false,
  );

  return useCallback(
    (chord: string) =>
      chord
        .split("+")
        .map((part) => {
          if (part === "mod") return apple ? "⌘" : "Ctrl";
          if (part === "alt") return apple ? "⌥" : "Alt";
          if (part === "shift") return apple ? "⇧" : "Shift";
          if (part === "ArrowLeft") return "←";
          if (part === "ArrowRight") return "→";
          if (part === "Escape") return "Esc";
          return part.length === 1 ? part.toUpperCase() : part;
        })
        .join(" + "),
    [apple],
  );
}
