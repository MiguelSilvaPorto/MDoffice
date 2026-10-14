// As duas formas são a MESMA palavra, mudando só número (e gênero)? — "toda" × "todos",
// "citação" × "citações", "segura" × "seguras", "esquema" × "esquemas".
//
// É o teste que autoriza a promoção por concordância: só troca-se a forma DENTRO da mesma
// palavra (nunca uma palavra por outra). O conjunto de variantes é gerado por regras simples
// (o "s" do plural, "m" ↔ "ns", "ão" ↔ "ões/ãos/ães", "l" ↔ "is"/"eis", a troca a/o do gênero)
// e qualquer forma que o português não use simplesmente não casa.
export function parDeNumero(a: string, b: string): boolean {
  const x = a.toLowerCase();
  const y = b.toLowerCase();
  const variantes = (w: string): Set<string> => {
    const out = new Set<string>([w]);
    const semS = w.replace(/s$/u, "");
    out.add(semS).add(`${semS}s`);
    for (const [de, para] of [
      [/ns$/u, "m"],
      [/m$/u, "ns"],
      [/ões$/u, "ão"],
      [/ãos$/u, "ão"],
      [/ães$/u, "ão"],
      [/ão$/u, "ões"],
      [/is$/u, "il"],
      [/eis$/u, "el"],
      [/il$/u, "is"],
      [/el$/u, "eis"],
    ] as [RegExp, string][]) {
      if (de.test(w)) out.add(w.replace(de, para));
    }
    // gênero: a ↔ o (e as ↔ os), com o "s" já coberto acima
    if (/a$/u.test(w)) out.add(`${w.slice(0, -1)}o`);
    if (/o$/u.test(w)) out.add(`${w.slice(0, -1)}a`);
    if (/as$/u.test(w)) out.add(`${w.slice(0, -2)}os`);
    if (/os$/u.test(w)) out.add(`${w.slice(0, -2)}as`);
    return out;
  };
  const va = variantes(x);
  const vb = variantes(y);
  for (const v of va) if (v !== x && vb.has(v)) return true;
  for (const v of vb) if (v !== y && va.has(v)) return true;
  return false;
}
