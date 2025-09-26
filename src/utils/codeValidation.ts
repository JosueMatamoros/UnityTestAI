export function checkSymbols(code: string, cls: string, method: string) {
  const classRegex = new RegExp(`\\bclass\\s+${cls}\\b`, 'i');
  const methodRegex = new RegExp(`\\b${method}\\s*\\(`, 'i');

  return {
    classOk: classRegex.test(code),
    methodOk: methodRegex.test(code),
  };
}
