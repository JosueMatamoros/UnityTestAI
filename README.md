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


## Installation
1. Clone the repository to your local machine:
   ```bash
   git clone https://github.com/your-user/unitytestia.git
   ```
2. Open the folder in Visual Studio Code.
3. Run:
   ```bash
   npm install
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


## Usage
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
├── src/
│   ├── extension.ts       # VSCode backend
│   ├── llm.ts             # API calls for Gemini & OpenRouter
│   ├── promptBuilder.ts   # Builds the prompt for LLMs
│   └── collectInputs.ts   # Handles user input validation
├── ui/
│   ├── index.html         # Webview UI
│   ├── script.js          # Webview logic
│   └── style.css          # Styling
├── openrouter.models.json # Submodels available in OpenRouter
└── README.md
```
---
## Prompt Specification

The extension uses the following prompt as its core instruction for LLMs:

> [!IMPORTANT]
> ```
> You are an expert Software Engineer specialized in testing and quality assurance.
> Your task is to generate unit tests using White Box methods.
> Objective:
> Generate the absolute minimum number of Unity Test Framework (NUnit 3.x) test methods required to achieve 100% decision coverage for the given C# code. Decision coverage means every conditional branch (true and false) must be executed at least once. Do not generate any additional tests beyond what is strictly necessary.
> Scope:
> • Only generate tests for the <method-name> method of the class <class-name>.
> • Do not test other methods, functions, or behaviors outside this method.
> • Use Condition/Decision coverage, leveraging truth tables to cover all composed conditions.
> • Achieve 100% line, condition, and condition/decision coverage.
> Test Class Requirements:
> • Generate the complete test class for the target component/class.
> • Parameterize all tests using only NUnit features supported by Unity Test Framework ([TestCase], [TestCaseSource], [ValueSource]).
> • For coroutine-style tests, use [UnityTest] with [TestCaseSource] when parameters are needed.
> • Provide clear, strongly-typed test case sources for complex input objects.
> • Include all necessary using statements and namespaces.
> • Use only the dependencies listed in the project’s manifest.json file. This includes:
>     o Unity Test Framework (com.unity.test-framework)
>     o Any NuGet packages installed (e.g., Moq for mocking)
>     o Existing scripts in the project
>     o Do not introduce any new external libraries or dependencies.
>     o Ensure the correct folder path is used (e.g., Assets/test/) with proper package/import statements.
> Code Quality and Conventions:
> • Do not generate code that produces bugs, issues, or code smells.
> • All objects must be fully and correctly initialized.
> • For numeric inputs, include both positive and negative values.
> • Code must pass static analysis (e.g., SonarCloud/SonarQube) without errors.
> • Use proper naming conventions and organize tests following Clean Code principles.
> • Repeated code must be factored using [SetUp] and [TearDown] as needed.
> • Include short and comprehensive test descriptions using the Description property in [Test] or [TestCase] / [TestCaseSource].
> • Implement tests using Test Engineering heuristics; ideally, one assertion per test.
> Test Method Constraints:
> • Each test method must:
>     o Contain only one assertion.
>     o Be annotated with [Timeout(1000)].
>     o Have cyclomatic complexity = 1 (no branching in the test body).
>     o Have a descriptive and realistic name.
>     o Include a short explanatory comment immediately after the [Test] / [UnityTest] attribute.
> Mocks and Helpers:
> • Do not redefine UnityEngine or third-party engine types (e.g., DG.Tweening).
> • Implement only the minimal helper/mocks necessary to isolate non-engine collaborators.
> • Use Moq (NuGet) for mocking.
> • Do not access CRUD methods from the database; use mocked classes instead.
> • Instantiate GameObjects at runtime in tests; do not use prefabs.
> • Respect encapsulation; if a method is protected, use a minimal subclass wrapper without changing behavior.
> Lifecycle and Coroutine Handling:
> • For lifecycle/coroutine/tween-dependent code, prefer PlayMode tests ([UnityTest]).
> • Wait just enough time or pass zero tween duration to observe effects.
> Exception Handling:
> • Use try/catch or assertThrows as appropriate.
> • Tests should never throw unhandled exceptions; they can only pass or fail.
> Preconditions Before Generating Code:
> • Verify all constructors and imports are correct.
> • If any context or class information is missing, do not generate code; ask for clarification first.
> • Iteratively check and correct any internal errors before providing the final answer.
> Final Requirements:
> • All tests must be in one C# class file.
> • Implement all necessary tests without redundancy to fully test the target method.
> • Do not include any TODOs.
> • Ensure the code compiles and fulfills all requirements.
> Input Code:
> {code}
> Instruction:
> YOU MUST IMPLEMENT ALL TESTS! I WILL NOT CODE ANYTHING! DO ALL ASSERTIONS! DO NOT ADD ANY TODO LINE. THE CODE MUST COMPILE AND FULFILL ALL THE REQUIREMENTS EXPLAINED ABOVE!
> ```

---

## Contributing
> [!NOTE]
> Contributions are welcome!  
> Please fork the repository and submit pull requests with clear descriptions.

## License

This project is distributed under the MIT License. See the `LICENSE` file for more information.



