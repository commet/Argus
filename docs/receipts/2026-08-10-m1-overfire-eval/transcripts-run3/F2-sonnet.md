```js
function send(payload) {
  const body = JSON.stringify(payload);
  return fetch('/api', { method: 'POST', body });
}
```

`data` → `payload`로 변경했습니다.
