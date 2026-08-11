Here's the updated function with `data` renamed to `payload`:

```js
function send(payload) {
  const body = JSON.stringify(payload);
  return fetch('/api', { method: 'POST', body });
}
```
