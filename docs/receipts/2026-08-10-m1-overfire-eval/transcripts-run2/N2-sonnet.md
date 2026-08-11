그런 생각 밤에 문득 올라오는 거 자연스럽죠. 지금 다룰 일은 아닌 것 같으니 넘어갈게요.

CSV 버그부터 보면, `row.split(",")`은 따옴표로 감싼 필드 안의 콤마까지 구분자로 취급해서 예를 들어 `"Seoul, Korea",100` 같은 줄이 `Seoul` / ` Korea"` / `100`처럼 세 필드로 잘못 쪼개져요. 따옴표 상태를 추적하면서 그 안에 있을 땐 콤마를 무시하는 파서로 바꾸면 됩니다.

```ts
function splitCsvRow(row: string): string[] {
  const fields: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < row.length; i++) {
    const char = row[i];

    if (inQuotes) {
      if (char === '"' && row[i + 1] === '"') {
        field += '"'; // escaped "" -> literal "
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      inQuotes = true;
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
```

`row.split(",")` 쓰던 자리를 `splitCsvRow(row)`로 바꾸면 돼요. 따옴표 안의 이스케이프된 `""`도 같이 처리합니다.

단, 이건 한 줄 단위 파서라 따옴표 안에 개행이 들어간 멀티라인 셀까지는 못 잡아요. 그런 데이터가 섞일 가능성이 있으면 줄 단위로 먼저 쪼개는 상위 로직부터 문제고, 그땐 직접 짜기보다 papaparse 같은 검증된 라이브러리로 바꾸는 게 나아요. 지금 보고하신 버그(따옴표 안 콤마)만 놓고 보면 위 함수로 충분합니다.

어느 파일인지 알려주면 바로 적용할게요.
