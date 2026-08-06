/**
 * JsonSanitizer — helper de saneo del JSON producido por los LLM.
 *
 * Los modelos suelen devolver JSON con errores de formato que rompen
 * `JSON.parse`, principalmente:
 *   - Caracteres de control CRUDOS dentro de strings (TAB, salto de línea,
 *     retorno de carro…), ilegales según la spec de JSON. Es el caso típico
 *     cuando un agente reenvía código C# con su indentación de tabs.
 *   - Comas colgantes antes de `}` o `]`.
 *
 * Esta clase NO parsea ni valida: solo devuelve el MISMO JSON ya saneado,
 * para que el resto del flujo (extracción de `{...}` + `JSON.parse` + Zod)
 * siga funcionando igual que hoy.
 */
export class JsonSanitizer {
  /**
   * Devuelve el texto JSON saneado y listo para `JSON.parse`.
   *
   * Recorre el texto en una sola pasada llevando la cuenta de si está dentro
   * de un string (respetando los escapes `\`), de modo que:
   *   - Solo escapa los caracteres de control que estén DENTRO de un string
   *     (los tabs/saltos entre tokens son whitespace legal y se respetan).
   *   - Solo elimina comas colgantes que estén FUERA de un string (una coma
   *     dentro del código C# no se toca).
   * Es idempotente: lo que ya venía bien escapado no se modifica.
   *
   * @param jsonText Texto del objeto JSON (p. ej. el resultado de extraer `{...}`).
   * @returns El mismo JSON con los errores de formato corregidos.
   */
  static sanitize(jsonText: string): string {
    let out = "";
    let inString = false;
    let escaped = false;

    for (let i = 0; i < jsonText.length; i++) {
      const ch = jsonText[i];

      // ── Dentro de un string ────────────────────────────────────────────────
      if (inString) {
        if (escaped) {
          // Carácter que sigue a una barra invertida (\" \\ \n \t…) → tal cual.
          out += ch;
          escaped = false;
          continue;
        }
        if (ch === "\\") {
          out += ch;
          escaped = true;
          continue;
        }
        if (ch === '"') {
          out += ch;
          inString = false;
          continue;
        }

        const code = ch.charCodeAt(0);
        if (code < 0x20) {
          // Carácter de control CRUDO dentro de un string → escapar (ilegal en JSON).
          switch (ch) {
            case "\t": out += "\\t"; break;
            case "\n": out += "\\n"; break;
            case "\r": out += "\\r"; break;
            case "\b": out += "\\b"; break;
            case "\f": out += "\\f"; break;
            default:   out += "\\u" + code.toString(16).padStart(4, "0");
          }
          continue;
        }

        out += ch;
        continue;
      }

      // ── Fuera de un string ─────────────────────────────────────────────────
      if (ch === '"') {
        out += ch;
        inString = true;
        continue;
      }

      if (ch === ",") {
        // Coma colgante: si tras los espacios en blanco viene `}` o `]`, se omite.
        let j = i + 1;
        while (j < jsonText.length && /\s/.test(jsonText[j])) j++;
        if (jsonText[j] === "}" || jsonText[j] === "]") {
          continue;
        }
      }

      out += ch;
    }

    return out;
  }
}
