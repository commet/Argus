```javascript
function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
```

Uses local-time getters, so it matches the date as the user's system sees it (swap in `getUTCFullYear`/`getUTCMonth`/`getUTCDate` if you need UTC instead). Example: `formatDate(new Date(2026, 7, 10))` → `"2026-08-10"`.
