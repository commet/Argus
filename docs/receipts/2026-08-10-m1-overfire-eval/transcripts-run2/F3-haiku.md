Here's a simple helper:

```javascript
function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
```

Usage:
```javascript
formatDate(new Date()); // e.g. "2026-08-10"
formatDate(new Date('2026-01-05')); // "2026-01-05"
```

The `padStart(2, '0')` handles left-padding single-digit months and days.
