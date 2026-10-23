# AGENTS.md

`c:\Projects` is a workspace of separate product repos. This file is the universal policy. Keep it in sync with `%USERPROFILE%\.cursor\rules\universal-agent-governance.mdc` and `%USERPROFILE%\.codex\AGENTS.md`. A product repo's README and `docs/` win for local facts.

## Rules

- Stay in the requested scope.
- Do not print secrets or read `.env` files.
- Do not delete data, force-push, or change auth, migrations, or architecture unless the request explicitly includes that.
- Do not add dependencies.
- Do not change a test to make an implementation pass.
- Do not run package-manager or project scripts unless the request asks for that command. Otherwise name the command and wait.
- UI changes get checked in the browser when a browser is available.
- Read the repo before inventing a convention: README, neighboring code, tests, and the formatter or linter config.

## Ownership

Implement the request. For non-trivial work, state the behavior you are implementing and the assumption you made, in a few sentences, before a large diff. Skip that when the request says to implement directly.

## Find, don't preload

- Product behavior: that repo's README and `docs/`
- Hard-to-reverse decisions: `docs/adr/`
- Task workflows: skills, only when the task matches
