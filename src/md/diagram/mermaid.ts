// Renderiza o Mermaid na tela (carregado só quando precisa) e os temas claro/escuro.

// ==========================================================================
// Pré-visualização (Mermaid)
// ==========================================================================

export let mermaidPromise: Promise<unknown> | null = null;

export async function getMermaid(): Promise<{
  initialize: (opts: Record<string, unknown>) => void;
  render: (id: string, code: string) => Promise<{ svg: string }>;
}> {
  if (!mermaidPromise) {
    mermaidPromise = import("mermaid").then((mod) => (mod as { default: unknown }).default);
  }
  return (await mermaidPromise) as never;
}

export async function renderMermaidInto(
  host: HTMLElement,
  code: string,
  dark: boolean
): Promise<string | null> {
  try {
    const mermaid = await getMermaid();
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: "loose",
      theme: "base",
      ...(dark ? darkThemeVars() : lightThemeVars()),
      flowchart: { curve: "basis", htmlLabels: true, padding: 14, nodeSpacing: 46, rankSpacing: 52, useMaxWidth: true },
      sequence: { useMaxWidth: true, mirrorActors: false, actorMargin: 46, messageMargin: 32, boxMargin: 8 },
    });
    const { svg } = await mermaid.render(`dg-${Math.random().toString(36).slice(2, 10)}`, code);
    host.innerHTML = svg;
    return null;
  } catch (err) {
    host.innerHTML = "";
    return String((err as Error)?.message ?? err);
  }
}

export function lightThemeVars(): Record<string, unknown> {
  return {
    themeVariables: {
      fontFamily: 'Inter, "Segoe UI", system-ui, sans-serif',
      fontSize: "15px",
      background: "transparent",
      primaryColor: "#eef2ff",
      primaryTextColor: "#1f2937",
      primaryBorderColor: "#6366f1",
      lineColor: "#64748b",
      secondaryColor: "#f1f5f9",
      tertiaryColor: "#f8fafc",
      noteBkgColor: "#fef9c3",
      noteTextColor: "#422006",
      noteBorderColor: "#facc15",
      actorBkg: "#eef2ff",
      actorBorder: "#6366f1",
      actorTextColor: "#1f2937",
      signalColor: "#334155",
      signalTextColor: "#1f2937",
      labelBoxBkgColor: "#e0e7ff",
      labelBoxBorderColor: "#6366f1",
      labelTextColor: "#1f2937",
      loopTextColor: "#1f2937",
      stateBkg: "#eef2ff",
      stateBorder: "#6366f1",
      transitionColor: "#64748b",
      transitionLabelColor: "#334155",
      clusterBkg: "#f8fafc",
      clusterBorder: "#cbd5e1",
    },
  };
}

export function darkThemeVars(): Record<string, unknown> {
  return {
    themeVariables: {
      fontFamily: 'Inter, "Segoe UI", system-ui, sans-serif',
      fontSize: "15px",
      background: "transparent",
      primaryColor: "#232842",
      primaryTextColor: "#e6e8ee",
      primaryBorderColor: "#818cf8",
      lineColor: "#94a3b8",
      secondaryColor: "#1b1f2e",
      tertiaryColor: "#1b1f2e",
      noteBkgColor: "#3f3a1c",
      noteTextColor: "#fde68a",
      noteBorderColor: "#a16207",
      actorBkg: "#232842",
      actorBorder: "#818cf8",
      actorTextColor: "#e6e8ee",
      signalColor: "#cbd5e1",
      signalTextColor: "#e6e8ee",
      labelBoxBkgColor: "#312e57",
      labelBoxBorderColor: "#818cf8",
      labelTextColor: "#e6e8ee",
      loopTextColor: "#e6e8ee",
      stateBkg: "#232842",
      stateBorder: "#818cf8",
      transitionColor: "#94a3b8",
      transitionLabelColor: "#cbd5e1",
      clusterBkg: "#1b1f2e",
      clusterBorder: "#3b4252",
    },
  };
}

// ==========================================================================
// Construtor (modal)
// ==========================================================================
