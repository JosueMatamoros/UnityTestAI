/**
 * Verifica si una clase y un método específicos existen dentro de un bloque de código fuente.
 * 
 * @param {string} code - Código fuente completo en el que se realizará la búsqueda.
 * @param {string} cls - Nombre de la clase.
 * @param {string} method - Nombre del método.
 * @returns {{ classOk: boolean, methodOk: boolean }} 
 * Objeto con banderas indicando si la clase y el método fueron encontrados.
 */
export function checkSymbols(code: string, cls: string, method: string) {
  const classRegex = new RegExp(`\\bclass\\s+${cls}\\b`, 'i');
  const methodRegex = new RegExp(`\\b${method}\\s*\\(`, 'i');

  return {
    classOk: classRegex.test(code),
    methodOk: methodRegex.test(code),
  };
}
