// Contexto de uma importação: estilos, numeração, relações e imagens do arquivo.

import JSZip from "jszip";
import { type RunProps, type ParaProps } from "./props";

export interface StyleDef {
  id: string;
  name: string;
  basedOn?: string;
  type: string;
  run: RunProps;
  para: ParaProps;
  /** nível de título (1–6) quando é um estilo de título */
  heading?: number;
}

export interface Ctx {
  zip: JSZip;
  /** propriedades de texto do documento comum (padrões + estilo Normal) */
  base: RunProps;
  styles: Map<string, StyleDef>;
  defaults: RunProps;
  defaultPara: ParaProps;
  /** numId → formato por nível */
  numbering: Map<string, { fmt: string; start: number }[]>;
  rels: Map<string, { target: string; external: boolean }>;
  media: Map<string, string>;
}
