변수명을 `payload`로 바꿨습니다.

```javascript
function send(payload) {
  const body = JSON.stringify(payload);
  return fetch('/api', { method: 'POST', body });
}
```
