그 가격 인상 얘기는 한두 달 지난 결정이라 지금 새로 뭘 예측할 게 아니네요 — 가만히 두겠습니다.

CSV 버그를 봅시다. `row.split(",")`는 따옴표를 무시하고 나눠서, `"hello, world",name` 같은 줄이 깨집니다. 따옴표 안의 콤마는 살리려면:

```javascript
// 간단한 방법: 정규식으로 따옴표 경계를 존중
const fields = row.match(/("([^"]|\\")*"|[^,]*)/g)?.map(f => f.replace(/^"|"$/g, ''));

// 또는 순수 파서 (더 튼튼함)
function parseCsv(row) {
  const fields = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < row.length; i++) {
    const char = row[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      fields.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  fields.push(current);
  return fields;
}
```

어느 쪽이 나을까요, 아니면 이미 CSV 라이브러리(papaparse, csv-parse)를 쓰고 있습니까?
