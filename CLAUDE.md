# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build Commands
- `pnpm run dev` - Start development server
- `pnpm run build` - Build project and generate TS declaration files
- `pnpm run prepare` - Run build during package installation
- `pnpm test` - Run vitest tests

## Code Style Guidelines
- **TypeScript**: Use strict mode with explicit types for parameters and returns
- **Imports**: ES modules, group related imports, use `import type` for type imports
- **Naming**: camelCase for variables/functions, PascalCase for classes/interfaces
- **Functions**: Arrow functions preferred, parameter destructuring when appropriate
- **Error Handling**: Type-based result objects (`RunCodeResult`) with `type: "ok" | "error"`
- **Code Organization**: Modular structure, clear separation of concerns
- **Module System**: Use `defineCageModule` and `defineSandboxFn` for extending functionality
- **ESM Support**: Use ES modules throughout with explicit types
- **Formatting**: 2-space indentation, consistent spacing, trailing commas in multi-line
- **Comments**: Use TODOs for future improvements, explain non-obvious code with comments
- **Testing**: Place unit tests in a `__tests` folder with the format `<filename>.test.ts` in the same folder as the file being tested

This is a JavaScript sandboxing library built on QuickJS via WebAssembly, focusing on providing an extensible environment for safely executing JavaScript code with custom modules.