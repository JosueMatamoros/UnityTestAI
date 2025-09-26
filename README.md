# UnityTestIA - VSCode Extension for Unit Test Generation

> [!NOTE]
> This project is part of a special assistance program at **Tecnológico de Costa Rica (TEC)**, PROTEC area.
> Its purpose is to analyze the automation and efficiency of different LLMs for generating unit tests in Unity.

## Overview
UnityTestIA is a Visual Studio Code extension designed to evaluate and compare several Large Language Models (LLMs) for the automatic creation of **unit tests** in Unity projects.
The tool helps to determine which LLM provides the best results in terms of coverage and code quality.

> [!TIP]
> With UnityTestIA you only need to specify the **class name** and **method name** you want to test.
> The extension automatically generates the necessary NUnit tests to achieve maximum decision coverage.

## Key Features
- Integration with multiple LLM providers:
  - Google Gemini
  - OpenRouter (with submodels such as DeepSeek, LLaMA, etc.)
  - Easy to add more providers.
- Friendly interface inside VSCode.
- Automatic prompt building for optimal results.
- Validation of class and method before requesting tests.
- Code highlighting and copy-to-clipboard.


## Deployment of the Extension
1. Clone the repository to your local machine:
   ```bash
   git clone https://github.com/your-user/unitytestia.git
   ```
2. Open the folder in Visual Studio Code.
3. Run:
   ```bash
   # install dependencies and build/watch to generate dist/ (bundle.js & bundle.css)   
   npm install && npm run watch 
   ```
4. Press `F5` to launch the extension in a new VSCode window.

> [!NOTE]
> Deployment to the **VS Code Marketplace** is planned for future releases.

## Environment Variables
Create a `.env` file in the project root:
```ini
GEMINI_API_KEY=your_gemini_key
OPENROUTER_API_KEY=your_openrouter_key
```
> [!IMPORTANT]
> It is **essential** to define the keys exactly as shown in the example above so that the extension can recognize them correctly.


## Extension Usage
1. Open your Unity project in Visual Studio Code **from the `Assets/` folder** so the extension can access the source code correctly.
2. Open any C# script inside VSCode.
3. Launch the **UnityTestIA** command:
   - Open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`).
   - Search for `UnityTestIA: Generate Test`.
4. Enter:
   - Class name
   - Method name
5. Choose an LLM provider and, if applicable, a submodel.
6. Click the generation button to obtain the unit test cases.

> [!TIP]
> The generated tests will appear in a dedicated panel with syntax highlighting and a copy button.

## Project Structure
```
├── prompts/
│   └── basePrompt.txt            # Prompt base usado por los LLMs
├── src/
│   ├── extension.ts              # Punto de entrada, activa la extensión en VSCode
│   ├── webview/
│   │   ├── webviewManager.ts     # Configuración y lógica del panel webview
│   │   └── collectInputs.ts      # Maneja la sincronización de inputs entre el webview y backend
│   ├── llm/
│   │   ├── gemini.ts             # Implementación de la llamada a Google Gemini
│   │   ├── openrouter.ts         # Implementación de la llamada a OpenRouter
│   │   └── index.ts              # Re-exporta de forma unificada las funciones LLM
│   ├── prompts/
│   │   └── promptBuilder.ts      # Construye el prompt final con clase, método y código
│   ├── utils/
│   │   ├── codeValidation.ts     # Verifica que la clase y el método existan en el código
│   │   └── modelLoader.ts        # Carga y valida modelos de OpenRouter desde JSON
│   └── test/
│       └── extension.test.ts     # Tests iniciales de la extensión
├── ui/
│   ├── index.html                # HTML de la interfaz webview
│   ├── scripts/
│   │   ├── main.js               # Entrada principal del frontend
│   │   ├── domUtils.js           # Utilidades genéricas de manipulación del DOM
│   │   ├── modelMenu.js          # Lógica para selección de modelos y submodelos
│   │   ├── resultRenderer.js     # Renderiza resultados devueltos por el backend
│   │   └── stepper.js            # Manejo del stepper (flujo de inputs)
│   └── styles/
│       ├── base.css              # Estilos base y globales
│       ├── main.css              # Estilos principales del layout
│       ├── components.css        # Estilos para tarjetas, botones y elementos UI
│       ├── actions.css           # Estilos específicos del contenedor de acciones
│       ├── stepper.css           # Estilos del stepper y estados
│       └── animations.css        # Animaciones y microinteracciones
├── assets/
│   └── logo.png                  # Logo mostrado en la interfaz
├── openrouter.models.json        # Configuración de submodelos de OpenRouter
└── webpack.config.js             # Configuración para generar el bundle (JS y CSS)

```
---
## Prompt Specification

The extension relies on a **base prompt** that defines how LLMs should generate Unity unit tests.  
Only an excerpt is shown here for clarity:

> [!IMPORTANT]
> ```
> You are an expert Software Engineer specialized in testing and quality assurance.
> Your task is to generate unit tests using White Box methods.
> Objective:
> Generate the absolute minimum number of Unity Test Framework (NUnit 3.x) 
> test methods required to achieve 100% decision coverage...
> ```
> *(excerpt)*

---

### Prompt location
The complete specification is stored in:

```bash
   /prompts/basePrompt.txt

```

### Customization
If you want to:
- Adjust coverage strategy (e.g., black-box instead of white-box),
- Change test framework conventions,
- Or simplify the constraints,

you can directly **edit** the `basePrompt.txt` file.  
The extension will automatically pick up the new instructions on the next run.

## Contributing
> [!NOTE]
> Contributions are welcome!  
> Please fork the repository and submit pull requests with clear descriptions.

## License

This project is distributed under the MIT License. See the `LICENSE` file for more information.



