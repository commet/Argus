```javascript
function send(payload) {
  const body = JSON.stringify(payload);
  return fetch('/api', { method: 'POST', body });
}
```
