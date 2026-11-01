/** Número de palabras de un texto (secuencias de letras o números; cuenta palabras con acento). */
export function countWords(text: string): number {
  return text.match(/[\p{L}\p{N}][\p{L}\p{N}'’_-]*/gu)?.length ?? 0;
}
