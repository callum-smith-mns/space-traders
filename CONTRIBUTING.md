# Contributing to SpaceTraders UI

Thanks for your interest in contributing! Here's how to get started.

## Getting Started

1. Fork the repository
2. Clone your fork:
   ```bash
   git clone https://github.com/<your-username>/spacetraders-ui.git
   cd spacetraders-ui
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Create a branch for your change:
   ```bash
   git checkout -b my-feature
   ```

## Development

```bash
npm run dev        # Start the dev server
npm run build      # Type-check and build for production
npm run lint       # Run ESLint
```

## Testing

Please ensure all tests pass before submitting a pull request.

```bash
npx vitest run          # Unit tests
npx playwright test     # End-to-end tests
```

## Submitting Changes

1. Commit your changes with a clear, descriptive message
2. Push to your fork
3. Open a pull request against `main`
4. Describe what you changed and why

## Code Style

- Follow the existing code style and ESLint configuration
- Write tests for new features and bug fixes
- Keep pull requests focused — one feature or fix per PR

## Reporting Issues

Open an issue on GitHub with:
- A clear title and description
- Steps to reproduce (if applicable)
- Expected vs actual behaviour

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
