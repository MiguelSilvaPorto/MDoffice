# Engenharia

Especificação para recriar cada função. Formato: **NOME_PT (NOME_EN)** · `sintaxe` · regra · exemplo → resultado.
Marca: ✅ já no mdOffice · ⚠️ diverge · ❌ falta. Veja o [índice](README.md).

**Nenhuma função desta categoria existe no mdOffice ainda.** Prioridade baixa.

---

## Conversão entre bases (binário, octal, decimal, hexadecimal)

Regras: números de **10 caracteres no máximo** (binário: 10 bits; octal: 30 bits; hex: 40 bits); negativos usam **complemento de dois** com 10 caracteres de resultado (`DECABIN(-10)` → `1111110110`). O argumento opcional `casas` completa com zeros à esquerda (ignorado para negativos); `casas` insuficiente → `#NÚM!`. Valor com dígito inválido → `#NÚM!`.

| PT (EN) | Exemplo → resultado |
|---|---|
| **DECABIN (DEC2BIN)** ❌ | `=DECABIN(9)` → `1001` · `=DECABIN(9; 8)` → `00001001` · `=DECABIN(-10)` → `1111110110` |
| **DECAOCT (DEC2OCT)** ❌ | `=DECAOCT(255)` → `377` |
| **DECAHEX (DEC2HEX)** ❌ | `=DECAHEX(255)` → `FF` · `=DECAHEX(255; 4)` → `00FF` · `=DECAHEX(-1)` → `FFFFFFFFFF` |
| **BINADEC (BIN2DEC)** ❌ | `=BINADEC(1010)` → `10` · `=BINADEC(1111111111)` → `-1` |
| **BINAOCT (BIN2OCT)** ❌ | `=BINAOCT(1111)` → `17` |
| **BINAHEX (BIN2HEX)** ❌ | `=BINAHEX(11111111)` → `FF` |
| **OCTADEC (OCT2DEC)** ❌ | `=OCTADEC(17)` → `15` |
| **OCTABIN (OCT2BIN)** ❌ | `=OCTABIN(7)` → `111` |
| **OCTAHEX (OCT2HEX)** ❌ | `=OCTAHEX(377)` → `FF` |
| **HEXADEC (HEX2DEC)** ❌ | `=HEXADEC("FF")` → `255` · `=HEXADEC("FFFFFFFFFF")` → `-1` |
| **HEXABIN (HEX2BIN)** ❌ | `=HEXABIN("F")` → `1111` |
| **HEXAOCT (HEX2OCT)** ❌ | `=HEXAOCT("FF")` → `377` |

(Para bases quaisquer e sem limite de tamanho use `BASE` e `DECIMAL`, em [matemática](matematica.md).)

---

## Bits

Operam sobre inteiros de **0 a 2⁴⁸−1** (negativo ou maior → `#NÚM!`).

**BITAND / E.BIT (BITAND)** ❌ · `=BITAND(5; 3)` → `1`.
**BITOR / OU.BIT (BITOR)** ❌ · `=BITOR(5; 3)` → `7`.
**BITXOR / XOU.BIT (BITXOR)** ❌ · `=BITXOR(5; 3)` → `6`.
**BITLSHIFT / DESLOCESQBIT (BITLSHIFT)** ❌ · `=BITLSHIFT(1; 3)` → `8`.
**BITRSHIFT / DESLOCDIRBIT (BITRSHIFT)** ❌ · `=BITRSHIFT(8; 1)` → `4`.

---

## Comparação

**DELTA (DELTA)** ❌ · `=DELTA(núm1; [núm2])` · 1 se iguais, senão 0 (núm2 padrão 0). `=DELTA(5; 5)` → `1` · `=DELTA(5; 4)` → `0`.
**DEGRAU (GESTEP)** ❌ · `=DEGRAU(núm; [passo])` · 1 se núm ≥ passo (padrão 0). `=DEGRAU(3; 4)` → `0` · `=DEGRAU(5; 4)` → `1`.

---

## Conversão de unidades

**CONVERTER (CONVERT)** ❌ · `=CONVERTER(núm; de_unidade; para_unidade)` · unidades por **código de texto** (diferencia maiúsculas); grupos diferentes → `#N/D`. Aceita prefixos do SI (`k`, `m`, `c`, `M`, `G`, `u`…) e prefixos binários (`ki`, `Mi`…) onde se aplica.
`=CONVERTER(1; "mi"; "km")` → `1,609344` · `=CONVERTER(100; "C"; "F")` → `212` · `=CONVERTER(1; "h"; "min")` → `60` · `=CONVERTER(1; "lbm"; "kg")` → `0,45359237`.
Grupos e códigos principais:
- **Peso/massa:** `g`, `sg` (slug), `lbm`, `u`, `ozm`, `grain`, `cwt`, `stone`, `ton`.
- **Distância:** `m`, `mi`, `Nmi`, `in`, `ft`, `yd`, `ang`, `ell`, `ly`, `parsec`, `pica`, `Pica`, `survey_mi`.
- **Tempo:** `yr`, `day`, `hr`, `mn`, `sec`.
- **Pressão:** `Pa`, `atm`, `mmHg`, `psi`, `Torr`.
- **Força:** `N`, `dyn`, `lbf`, `pond`.
- **Energia:** `J`, `e`, `c` (caloria termodinâmica), `cal`, `eV`, `HPh`, `Wh`, `flb`, `BTU`.
- **Potência:** `W`, `HP`, `PS`.
- **Magnetismo:** `T`, `ga`.
- **Temperatura:** `C`, `F`, `K`, `Rank`, `Reau`.
- **Volume:** `l`, `tsp`, `tbs`, `oz`, `cup`, `pt`, `qt`, `gal`, `m3`, `ang3`, `barrel`, `bushel`, `regton`, `Nmi3`, `uk_pt`, `uk_gal`…
- **Área:** `m2`, `ha`, `ar`, `ft2`, `in2`, `mi2`, `uk_acre`, `us_acre`…
- **Informação:** `bit`, `byte`.
- **Velocidade:** `m/s`, `m/h`, `mph`, `kn`, `admkn`.

---

## Números complexos

Formato texto: `"a+bi"` ou `"a+bj"` (sufixo `i` ou `j`; `i` padrão). Argumento inválido → `#NÚM!`.

**COMPLEXO (COMPLEX)** ❌ · `=COMPLEXO(real; imag; [sufixo])` · `=COMPLEXO(3; 4)` → `3+4i`.
**IMREAL (IMREAL)** ❌ `=IMREAL("3+4i")` → `3` · **IMAGINÁRIO (IMAGINARY)** ❌ → `4`.
**IMABS (IMABS)** ❌ módulo: `=IMABS("3+4i")` → `5`.
**IMARG (IMARGUMENT)** ❌ ângulo em radianos: → `0,927295218001612`.
**IMCONJ (IMCONJUGATE)** ❌ → `3-4i`.
**IMSOMA (IMSUM)** ❌ `=IMSOMA("3+4i"; "1-2i")` → `4+2i` · **IMSUBTR (IMSUB)** ❌ → `2+6i`.
**IMPROD (IMPRODUCT)** ❌ `=IMPROD("3+4i"; "1-2i")` → `11-2i` · **IMDIV (IMDIV)** ❌ `=IMDIV("3+4i"; "1-2i")` → `-1+2i`.
**IMRAIZ (IMSQRT)** ❌ `=IMRAIZ("3+4i")` → `2+i`.
**IMPOT (IMPOWER)** ❌ · **IMEXP (IMEXP)** ❌ · **IMLN (IMLN)** ❌ · **IMLOG10 (IMLOG10)** ❌ · **IMLOG2 (IMLOG2)** ❌.
**IMSENO (IMSIN)**, **IMCOS (IMCOS)**, **IMTAN (IMTAN)**, **IMSEC**, **IMCSC**, **IMCOT**, **IMSENH (IMSINH)**, **IMCOSH (IMCOSH)**, **IMSECH**, **IMCSCH** ❌ · trigonometria complexa.

---

## Funções de erro e Bessel

**FUNERRO (ERF)** ❌ · `=FUNERRO(limite_inferior; [limite_superior])` · `=FUNERRO(1)` → `0,842700792949715`.
**FUNERRO.PRECISO (ERF.PRECISE)** ❌ · uma só variável. **FUNERROCOMPL (ERFC)** ❌ · `=FUNERROCOMPL(1)` → `0,157299207050285`. **FUNERROCOMPL.PRECISO (ERFC.PRECISE)** ❌.
**BESSELI (BESSELI)**, **BESSELJ (BESSELJ)**, **BESSELK (BESSELK)**, **BESSELY (BESSELY)** ❌ · `=BESSELJ(1; 0)` → `0,765197686557967`.

---

## Resumo de status

0 implementadas. Ordem sugerida: `DECABIN`, `BINADEC`, `DECAHEX`, `HEXADEC`, `CONVERTER` → bits → complexos → erro e Bessel.
