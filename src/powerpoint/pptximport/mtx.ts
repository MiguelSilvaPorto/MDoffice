// Descompressão MicroType Express (MTX): o formato das fontes EOT comprimidas que o PowerPoint embute.
//
// NÃO IMPLEMENTADA DE PROPÓSITO. O MicroType Express é uma tecnologia patenteada pela Monotype (o W3C o publicou
// só como "Member Submission"), então decodificá-lo dentro do app é uma decisão de licença do projeto, não um
// detalhe técnico. Enquanto isso:
//   - as fontes embutidas NÃO comprimidas (e as só ofuscadas por XOR) são lidas e usadas na tela;
//   - as comprimidas voltam como estavam ao salvar o .pptx (ver `fontsRaw` em schema.ts), sem perda;
//   - na tela vale a família equivalente que o app já traz (Montserrat, Roboto, Open Sans) ou a instalada.
// Se um dia a licença for resolvida, é só implementar esta função (blocos LZCOMP + CTF) e devolver o TrueType.

export function descomprimirMtx(_dados: Uint8Array): Uint8Array | null {
  return null;
}
