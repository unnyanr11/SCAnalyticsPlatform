## Description

<!-- Clear description of what this PR does -->

## Type of Change

- [ ] Bug fix
- [ ] New feature (analytics / forecasting / UI)
- [ ] Refactor
- [ ] Documentation
- [ ] CI/CD
- [ ] Dependencies

## Analytics Compliance Checklist

> This project is strictly analytics-only. All PRs must confirm compliance.

- [ ] This PR introduces **no** automated game actions (clicks, buys, sells, production triggers)
- [ ] This PR introduces **no** account manipulation or unauthorized API writes
- [ ] Any new API calls are **read-only** data fetches with proper rate limiting
- [ ] Any new overlay/UI elements are **display-only** and non-interactive with the game DOM

## Testing

- [ ] Unit tests added / updated
- [ ] All existing tests pass locally (`bash scripts/test.sh`)
- [ ] Linting passes (`bash scripts/lint.sh`)

## Screenshots / Recordings

<!-- If UI changes, include screenshots in both light and dark mode -->
