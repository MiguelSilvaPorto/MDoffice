// Monta o código Mermaid (fluxo, sequência e estados) a partir dos campos simples.

export type DiagramKind = "flow" | "sequence" | "state";

export interface FlowStep {
  shape: "start" | "process" | "decision" | "end";
  label: string;
  /** índice do próximo passo (na própria lista) ou null */
  next: number | null;
  edgeLabel: string;
}

export interface SeqMessage {
  from: string;
  to: string;
  text: string;
  dashed: boolean;
}

export interface StateTransition {
  from: string;
  to: string;
  label: string;
}

/** Id de nó seguro para o Mermaid (A, B, C… Z, A1, B1…). */
export function nodeId(index: number): string {
  const letter = String.fromCharCode(65 + (index % 26));
  const round = Math.floor(index / 26);
  return round === 0 ? letter : `${letter}${round}`;
}

export function quoteIfNeeded(label: string): string {
  const clean = label.replace(/\s+/g, " ").trim() || "…";
  return /[\[\]{}()|"#;]/.test(clean) ? `"${clean.replace(/"/g, "'")}"` : clean;
}

export function flowShape(shape: FlowStep["shape"], id: string, label: string): string {
  const text = quoteIfNeeded(label);
  switch (shape) {
    case "start":
      return `${id}([${text}])`;
    case "end":
      return `${id}([${text}])`;
    case "decision":
      return `${id}{${text}}`;
    default:
      return `${id}[${text}]`;
  }
}

/** Monta o código de um fluxograma. */
export function buildFlowchart(title: string, steps: FlowStep[]): string {
  const lines: string[] = [];
  if (title.trim()) lines.push("---", `title: ${title.trim()}`, "---");
  lines.push("flowchart TD");
  steps.forEach((step, i) => {
    lines.push(`  ${flowShape(step.shape, nodeId(i), step.label)}`);
  });
  steps.forEach((step, i) => {
    if (step.next === null || step.next === undefined || step.next < 0 || step.next >= steps.length) return;
    const label = step.edgeLabel.trim() ? `|${quoteIfNeeded(step.edgeLabel)}|` : "";
    lines.push(`  ${nodeId(i)} -->${label} ${nodeId(step.next)}`);
  });
  return lines.join("\n");
}

/** Monta o código de um diagrama de sequência. */
export function buildSequence(title: string, participants: string[], messages: SeqMessage[]): string {
  const list = participants.map((p) => p.trim()).filter(Boolean);
  const alias = new Map<string, string>();
  list.forEach((name, i) => {
    alias.set(name, /^[A-Za-z_]\w*$/.test(name) ? name : `p${i + 1}`);
  });
  const lines: string[] = [];
  if (title.trim()) lines.push("---", `title: ${title.trim()}`, "---");
  lines.push("sequenceDiagram");
  for (const name of list) {
    const id = alias.get(name)!;
    lines.push(id === name ? `  participant ${name}` : `  participant ${id} as ${quoteIfNeeded(name)}`);
  }
  for (const msg of messages) {
    const from = alias.get(msg.from.trim()) ?? msg.from.trim();
    const to = alias.get(msg.to.trim()) ?? msg.to.trim();
    if (!from || !to || !msg.text.trim()) continue;
    const arrow = msg.dashed ? "-->>" : "->>";
    lines.push(`  ${from}${arrow}${to}: ${msg.text.replace(/\s+/g, " ").trim()}`);
  }
  return lines.join("\n");
}

/** Monta o código de um diagrama de estados. */
export function buildState(title: string, states: string[], transitions: StateTransition[]): string {
  const list = states.map((s) => s.trim()).filter(Boolean);
  const lines: string[] = [];
  if (title.trim()) lines.push("---", `title: ${title.trim()}`, "---");
  lines.push("stateDiagram-v2");
  const aliases = new Map<string, string>();
  list.forEach((name, i) => {
    if (/^[\w-]+$/.test(name)) aliases.set(name, name);
    else {
      const alias = `s${i + 1}`;
      aliases.set(name, alias);
      lines.push(`  state ${quoteIfNeeded(name)} as ${alias}`);
    }
  });
  const ref = (name: string) => (name === "[*]" ? "[*]" : aliases.get(name) ?? quoteIfNeeded(name));
  for (const t of transitions) {
    if (!t.from.trim() || !t.to.trim()) continue;
    const label = t.label.trim() ? `: ${t.label.trim()}` : "";
    lines.push(`  ${ref(t.from.trim())} --> ${ref(t.to.trim())}${label}`);
  }
  return lines.join("\n");
}

/** Tenta descobrir o tipo do diagrama pelo código. */
export function detectKind(code: string): DiagramKind {
  if (/^\s*(stateDiagram|stateDiagram-v2)/m.test(code)) return "state";
  if (/^\s*sequenceDiagram/m.test(code)) return "sequence";
  return "flow";
}
