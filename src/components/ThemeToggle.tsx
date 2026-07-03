import { useState } from "react";
import { getThemePref, setThemePref, type ThemePref } from "../theme";

const ORDER: ThemePref[] = ["system", "light", "dark"];
const LABEL: Record<ThemePref, string> = {
  system: "Sistem",
  light: "Luminos",
  dark: "Întunecat"
};

function Icon({ pref }: { pref: ThemePref }) {
  const common = {
    width: 18,
    height: 18,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true
  };
  if (pref === "light") {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </svg>
    );
  }
  if (pref === "dark") {
    return (
      <svg {...common}>
        <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <rect x="2" y="4" width="20" height="13" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </svg>
  );
}

export default function ThemeToggle({ variant = "compact" }: { variant?: "compact" | "full" }) {
  const [pref, setPref] = useState<ThemePref>(getThemePref);

  function cycle() {
    const next = ORDER[(ORDER.indexOf(pref) + 1) % ORDER.length];
    setPref(next);
    setThemePref(next);
  }

  if (variant === "full") {
    return (
      <div className="theme-seg" role="group" aria-label="Temă">
        {ORDER.map((p) => (
          <button
            key={p}
            className={`theme-seg__btn ${pref === p ? "is-active" : ""}`}
            aria-pressed={pref === p}
            onClick={() => {
              setPref(p);
              setThemePref(p);
            }}
          >
            <Icon pref={p} />
            <span>{LABEL[p]}</span>
          </button>
        ))}
      </div>
    );
  }

  return (
    <button className="theme-toggle" onClick={cycle} aria-label={`Temă: ${LABEL[pref]}`} title={`Temă: ${LABEL[pref]}`}>
      <Icon pref={pref} />
    </button>
  );
}
