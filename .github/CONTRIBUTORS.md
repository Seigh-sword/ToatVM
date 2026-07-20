# Contributors

Thank you for your interest in contributing to ToatCloud Terminal. This document
provides guidelines and information for contributors.

## How to Contribute

### Reporting Bugs

Before creating a bug report, please check the
[existing issues](https://github.com/Seigh-sword/ToatVM/issues) to avoid
duplicates. When filing a bug report, use the
[bug report template](https://github.com/Seigh-sword/ToatVM/issues/new?template=bug_report.md)
and include:

- A clear, descriptive title
- Steps to reproduce the issue
- Expected and actual behavior
- Environment details (OS, Node.js version, CLI version)
- Relevant logs or error output

### Suggesting Features

Feature requests are welcome. Please use the
[feature request template](https://github.com/Seigh-sword/ToatVM/issues/new?template=feature_request.md)
and describe:

- The problem your feature solves
- A proposed solution or implementation
- Any alternatives you have considered
- Possible side effects or trade-offs

### Code Contributions

1. Fork the repository and create your branch from `main`
2. Make your changes with clear, atomic commits
3. Ensure all linting and tests pass
4. Update documentation if your change affects user-facing behavior
5. Submit a pull request using the provided template

## Code of Conduct

By participating in this project, you agree to abide by the
[Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md).
Please report unacceptable behavior to seighsword@gmail.com.

## Pull Request Process

1. Ensure your PR addresses an open issue or has been discussed first
2. Update the `CHANGELOG.md` under the `[Unreleased]` section
3. Add or update tests for any changed functionality
4. Run the full lint and test suite locally
5. Keep your PR focused on a single concern
6. Respond to review feedback promptly

### PR Requirements

- All CI checks must pass
- No new linter warnings or errors
- Documentation updated for new or changed features
- Commit messages follow conventional commits format (`feat:`, `fix:`, etc.)

## Development Setup

### Prerequisites

- Node.js 18 or higher
- npm or compatible package manager
- Git

### CLI

```bash
cd cli
npm install
npm run build
npm run start
```

### Lite CLI

```bash
cd cli-lite
npm install
npm run build
npm run start
```

### Web Client

```bash
cd site
npm install
npm run dev
```

### Running Tests

```bash
# CLI
cd cli
npm run build

# Lite CLI
cd cli-lite
npm run build

# Web client
cd site
npm run build
```

## Linting and Testing

- Run `npm run build` in each package to verify TypeScript compilation
- The CI workflow (`ci.yml`) runs a build check on every push and PR
- Ensure there are no TypeScript errors before submitting a PR
- Follow the existing code style and patterns in each package
- Do not introduce new dependencies without prior discussion

## Authors and Contributors

See [AUTHORS.md](AUTHORS.md) for the list of authors and contributors.

## Community

Join the conversation and connect with other contributors through the
project's GitHub Discussions and issue tracker.
