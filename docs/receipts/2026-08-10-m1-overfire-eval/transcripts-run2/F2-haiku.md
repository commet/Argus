여기 변수를 `payload`로 바꾼 함수입니다:

```javascript
function send(payload) {
  const body = JSON.stringify(payload);
  return fetch('/api', { method: 'POST', body });
}
```

변수 `data`가 함수 파라미터와 `JSON.stringify()` 안에서 모두 `payload`로 바뀌었습니다.
