Here's a simple formatDate helper:

```javascript
function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Usage:
// formatDate(new Date()); // "2026-08-10"
```

The `padStart(2, '0')` ensures single-digit months and days get a leading zero. `getMonth()` returns 0–11, so add 1 to get the calendar month.
