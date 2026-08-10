```javascript
function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
```

Uses the local timezone fields (`getFullYear`/`getMonth`/`getDate`), so it matches what a calendar on the user's machine would show. If you need UTC-based formatting instead (e.g. for consistency across timezones), swap in `getUTCFullYear()`, `getUTCMonth()`, and `getUTCDate()`.
