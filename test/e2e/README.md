# Desktop E2E (Playwright)

Scenarios for **Tasks** (requires **CalendarWebclient** + licensed Tasks module).

```bash
# from install root
npm run test:e2e-desktop -- --setup "Tasks Chrome"
```

Shared helpers: `modules/CoreWebclient/test/e2e/helpers/` (`AURORA_E2E_ROOT`).

| File | What it covers |
|------|----------------|
| `tasks.spec.js` | Create task → mark complete → delete |

## Stand gates

- **Tasks tab** (`nav-tasks`) — skipped when the module is disabled or Calendar is unavailable.
