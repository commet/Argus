가격 인상 건은 그대로 두고 — 말씀하신 CSV 버그부터 보겠습니다.

`row.split(",")`는 필드 안에 콤마가 있으면 무조건 잘못 쪼개져요. 예를 들어 `a,"b,c",d`를 split하면 3개가 아니라 `a`, `"b`, `c"`, `d` 4개로 깨집니다.

정규식으로 대충 막을 수도 있는데(`row.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/)`), 이스케이프된 따옴표(`""`)가 필드 안에 있으면 이것도 깨지고 디버깅하기 힘들어서 추천 안 해요. 상태 기계로 직접 파싱하는 게 안전합니다:

```ts
function splitCsvRow(row: string): string[] {
  const fields: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < row.length; i++) {
    const char = row[i];

    if (inQuotes) {
      if (char === '"' && row[i + 1] === '"') {
        field += '"';
        i++; // 이스케이프된 따옴표("") 건너뛰기
      } else if (char === '"') {
        inQuotes = false; // 닫는 따옴표
      } else {
        field += char; // 따옴표 안의 콤마 포함 그대로
      }
    } else if (char === '"') {
      inQuotes = true; // 여는 따옴표
    } else if (char === ",") {
      fields.push(field);
      field = "";
    } else {
      field += char;
    }
  }
  fields.push(field);
  return fields;
}

// 기존: row.split(",")
// 교체: splitCsvRow(row)
```

`a,"b,c",d` → `['a', 'b,c', 'd']`, `"a""b",c` → `['a"b', 'c']` 둘 다 정상 동작 확인했어요.

단 따옴표 안에 개행이 들어간 멀티라인 셀은 이 함수로도 못 잡습니다 — 그건 애초에 줄 단위로 나누는 시점에서 깨졌을 거라, 원본 CSV가 그 정도로 지저분하면 직접 파싱보다 `csv-parse` 같은 라이브러리로 바꾸는 게 나을 수 있어요. 파일 경로 알려주시면 바로 적용할게요.
