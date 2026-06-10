# Pipeline de Generación de Tests Unity

## 8 Agentes en Orden

---

### Agent 0 — Method Slicer

Recibe el archivo fuente completo. Extrae solo el método objetivo y los miembros que este referencia directamente. Reduce el ruido antes de pasarlo al resto del pipeline.

---

### Agent 1 — Dependency Resolver

Recibe el code slice y el árbol del proyecto. Identifica qué otros archivos del proyecto (clases, enums, structs) necesita el método para ser entendido completamente.

---

### Agent 2 — Context Builder

Toma el code slice y los archivos de dependencias y los ensambla en un único bloque de contexto. Filtra solo los fragmentos relevantes de cada dependencia, no los archivos completos.

---

### Agent 2.5 — Context Validator

Guardia de calidad estructural. Verifica que el contexto esté completo y compilable: método no truncado, tipos con sus miembros presentes, `using` correctos. Si algo falta lo repara; si está bien, no toca nada.

---

### Agent 2.7 — Code Analyzer

Extrae metadata para el generador: tabla de decisiones (branches/loops), miembros privados que los tests necesitan via Reflection, campos de `Start()`/`Awake()` que hay que inicializar manualmente, patrón de instanciación (`new` vs `AddComponent`), y branches que nunca pueden ejecutarse en PlayMode.

---

### Agent 3 — Test Generator

Recibe el contexto validado y la metadata del analyzer y genera la clase NUnit completa apuntando a 100% de decision coverage.

---

### Agent 3.5 — Test Validator

Revisa el test generado. Si tiene problemas los corrige y sobreescribe el archivo. Fallo suave: si no puede corregir, conserva el test original.

---

### Chat Fixer *(fuera del pipeline)*

Se activa cuando el usuario manda un mensaje post-generación. Con contexto completo del código y el test, corrige errores reportados (`FIXED`) o responde preguntas (`INFO`).
