네, CSV 파싱 버그부터 보겠습니다. 간단한 `split(",")`은 따옴표 안의 쉼표를 구분하지 못하니까요.

몇 가지 옵션이 있습니다:

1. **정규식** — 좀 까다롭지만 순수 JS로:
```javascript
const fields = row.match(/("([^"]|"")*"|[^,]*)/g).map(f => f.trim().replace(/^"|"$/g, ''));
```

2. **라이브러리** — 가장 안전합니다. `papaparse` 같은 CSV 파서:
```javascript
const Papa = require('papaparse');
const fields = Papa.parse(row).data[0];
```

3. **간단한 상태 머신** — 직관적이고 버그 추적이 쉬움:
```javascript
function parseCSV(row) {
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

지난달 가격 인상은 이미 벌어진 일이라 지금 예측을 남길 건 아니고요 — 그건 그거고, 어느 옵션으로 진행할까요?
