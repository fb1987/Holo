import { useEffect, useRef, useState, type ReactNode } from "react";
import { Check, ChevronDown, X } from "lucide-react";
export function QuickSwitcher<T extends string>({
  value,
  options,
  onChange,
  closeSignal,
}: {
  value: T;
  options: { value: T; label: string; icon: ReactNode; working?: boolean }[];
  onChange: (value: T) => void;
  closeSignal: unknown;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const active = options.find((option) => option.value === value)!;
  useEffect(() => setOpen(false), [closeSignal]);
  useEffect(() => {
    if (!open) return;
    root.current
      ?.querySelector<HTMLButtonElement>('[aria-checked="true"]')
      ?.focus();
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside, true);
    return () => document.removeEventListener("pointerdown", outside, true);
  }, [open]);
  const close = () => {
    setOpen(false);
    trigger.current?.focus();
  };
  return (
    <div
      className="perspective-switcher"
      ref={root}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node))
          setOpen(false);
      }}
    >
      <button
        ref={trigger}
        className="dock-controls"
        aria-label={`Change perspective — ${active.label}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls="perspective-menu"
        title="Change perspective"
        onClick={() => setOpen((value) => !value)}
        onKeyDown={(event) => {
          if (["ArrowDown", "ArrowUp"].includes(event.key)) {
            event.preventDefault();
            setOpen(true);
          }
        }}
      >
        {active.icon}
        <span>{active.label}</span>
        <ChevronDown size={12} />
      </button>
      {open && (
        <div
          id="perspective-menu"
          className="perspective-menu"
          role="menu"
          aria-label="Perspectives around your idea"
          onKeyDown={(event) => {
            const buttons = Array.from(
              event.currentTarget.querySelectorAll<HTMLButtonElement>("button"),
            );
            const index = buttons.indexOf(
              document.activeElement as HTMLButtonElement,
            );
            if (
              [
                "ArrowDown",
                "ArrowRight",
                "ArrowUp",
                "ArrowLeft",
                "Home",
                "End",
              ].includes(event.key)
            ) {
              event.preventDefault();
              event.stopPropagation();
              const next =
                event.key === "Home"
                  ? 0
                  : event.key === "End"
                    ? buttons.length - 1
                    : (index +
                        (["ArrowDown", "ArrowRight"].includes(event.key)
                          ? 1
                          : buttons.length - 1)) %
                      buttons.length;
              buttons[next]?.focus();
            } else if (event.key === "Escape") {
              event.preventDefault();
              event.stopPropagation();
              close();
            } else if (event.key === "Tab") {
              close();
            }
          }}
        >
          {options.map((option, index) => (
            <button
              key={option.value}
              role="menuitemradio"
              aria-checked={value === option.value}
              tabIndex={-1}
              className={value === option.value ? "selected" : ""}
              onClick={() => {
                onChange(option.value);
                close();
              }}
            >
              {option.icon}
              <span>{option.label}</span>
              {option.working && (
                <span className="working-indicator" aria-label="Working" />
              )}
              {value === option.value ? (
                <Check size={14} />
              ) : (
                <kbd>{index + 1}</kbd>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function ActivityAside({
  children,
  status,
  busy,
  onClose,
}: {
  children: ReactNode;
  status?: string;
  busy: boolean;
  onClose: () => void;
}) {
  return (
    <aside
      id="studio-activity"
      className="activity-aside"
      aria-labelledby="activity-title"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          onClose();
        }
      }}
    >
      <header className="activity-heading">
        <h2 id="activity-title">Activity</h2>
        <button
          className="icon-button"
          onClick={onClose}
          aria-label="Close activity"
        >
          <X size={18} />
        </button>
      </header>
      {busy && status && (
        <div className="activity-status" role="status">
          <span className="status-dot online pulse" />
          {status}
        </div>
      )}
      {children}
    </aside>
  );
}
export function HoloMark({ size = 26 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M20 3 35 12v16l-15 9L5 28V12L20 3Z"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <path
        d="m5 12 15 9 15-9M20 21v16M20 3v11M12 16l8-5 8 5M12 24l8 5 8-5"
        stroke="currentColor"
        strokeWidth="1.4"
      />
    </svg>
  );
}
export function Tray({
  title,
  kicker,
  children,
  onClose,
  wide = false,
  footer,
}: {
  title: string;
  kicker?: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
  footer?: ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    const el = ref.current;
    el?.focus();
    const trap = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
      if (e.key === "Tab" && el) {
        const controls = Array.from(
          el.querySelectorAll<HTMLElement>(
            'button:not([disabled]),a[href],input,select,textarea,[tabindex="0"]',
          ),
        );
        const first = controls[0],
          last = controls.at(-1);
        if (
          e.shiftKey &&
          (document.activeElement === first || document.activeElement === el)
        ) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    el?.addEventListener("keydown", trap);
    return () => {
      el?.removeEventListener("keydown", trap);
      previous?.focus();
    };
  }, [onClose]);
  useEffect(() => {
    ref.current?.focus();
  }, [title]);
  return (
    <div
      className="tray-shade"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        id="studio-panel"
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`tray ${wide ? "tray-wide" : ""}`}
      >
        <header className="tray-heading">
          <div>
            {kicker && <div className="eyebrow">{kicker}</div>}
            <h2>{title}</h2>
          </div>
          <button
            className="icon-button"
            onClick={onClose}
            aria-label="Close panel"
          >
            <X size={19} />
          </button>
        </header>
        <div className="tray-content">{children}</div>
        {footer && <footer className="tray-footer">{footer}</footer>}
      </section>
    </div>
  );
}
export function Empty({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="empty-state">
      <div className="empty-orbit" />
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}
export function Pill({ children }: { children: ReactNode }) {
  return <span className="pill">{children}</span>;
}
