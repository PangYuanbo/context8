# Contributing to ErrorSolver

Thank you for your interest in contributing to ErrorSolver! This document provides guidelines for contributing to the project.

## Getting Started

1. **Fork the repository**
2. **Clone your fork**
   ```bash
   git clone https://github.com/yourusername/context8.git
   cd context8
   ```
3. **Install dependencies**
   ```bash
   npm install
   ```
4. **Create a branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

## Development Setup

### Prerequisites

- Node.js 18 or higher
- npm or yarn
- TypeScript knowledge
- Basic understanding of MCP (Model Context Protocol)

### Build and Test

```bash
# Build the project
npm run build

# Run linting
npm run lint

# Format code
npm run format
```

## Code Style

- Use TypeScript strict mode
- Follow ESLint and Prettier configurations
- Write clear, self-documenting code
- Add comments for complex logic
- Use meaningful variable and function names

## Making Changes

### For Bug Fixes

1. Create an issue describing the bug
2. Reference the issue in your PR
3. Add tests if applicable
4. Update documentation if needed

### For New Features

1. Open an issue to discuss the feature first
2. Get feedback from maintainers
3. Implement with tests
4. Update README and relevant docs
5. Add entry to CHANGELOG.md

### For Documentation

1. Ensure accuracy and clarity
2. Check for typos and grammar
3. Update examples if code changes
4. Keep documentation in sync with code

## Commit Messages

Follow conventional commits:

```
type(scope): description

[optional body]

[optional footer]
```

Types:

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting)
- `refactor`: Code refactoring
- `test`: Adding/updating tests
- `chore`: Maintenance tasks

Examples:

```
feat(search): add fuzzy search support
fix(database): resolve embedding serialization issue
docs(readme): update installation instructions
```

## Pull Request Process

1. **Update documentation** for any changes
2. **Add tests** for new functionality
3. **Run linting and formatting**
   ```bash
   npm run lint
   npm run format
   ```
4. **Update CHANGELOG.md** with your changes
5. **Create the PR** with a clear description
6. **Link related issues** in the PR description
7. **Respond to review feedback**

## Testing Guidelines

- Write unit tests for utility functions
- Test error handling paths
- Verify database operations
- Test embedding generation and search
- Ensure privacy guidelines are enforced

## Areas for Contribution

### High Priority

- [ ] Performance optimization for large databases
- [ ] Better error messages and user feedback
- [ ] Export/import functionality for solutions
- [ ] Solution editing and deletion tools
- [ ] Web UI for browsing solutions

### Medium Priority

- [ ] Support for additional embedding models
- [ ] Solution versioning system
- [ ] Statistics and analytics features
- [ ] Automatic tag suggestions
- [ ] Solution rating system

### Low Priority

- [ ] Multi-language support for UI
- [ ] Cloud sync options (opt-in)
- [ ] Browser extension integration
- [ ] VS Code extension

## Code Review Criteria

Your PR will be reviewed for:

- **Functionality**: Does it work as intended?
- **Code Quality**: Is it clean, readable, maintainable?
- **Tests**: Are there appropriate tests?
- **Documentation**: Is it well-documented?
- **Privacy**: Does it maintain privacy-first principles?
- **Performance**: Is it efficient?

## Privacy Guidelines

When contributing, always remember:

- ❌ No telemetry or tracking
- ❌ No external API calls (except documentation)
- ✅ All data stays local
- ✅ User privacy is paramount
- ✅ Data abstraction is enforced

## Questions?

- Open an issue for questions
- Start a discussion for feature proposals
- Tag maintainers for urgent matters

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

## Recognition

Contributors will be recognized in:

- README.md contributors section
- CHANGELOG.md for specific contributions
- GitHub contributors page

Thank you for making ErrorSolver better! 🎉
