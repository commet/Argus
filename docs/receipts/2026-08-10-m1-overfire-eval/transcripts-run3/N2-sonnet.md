그 생각은 그거대로 밤에 올라오는 거고, 말씀하신 대로 지금은 넘어갈게요.

CSV 버그는 정확히 그 지점이 문제예요. `row.split(",")`는 필드 안에 있는 콤마도 구분자로 보기 때문에, 예를 들어

```
1,"김영희, 대표",30
```

이 줄이 필드 3개가 아니라 4개로 쪼개지고, 따옴표도 그대로 남습니다.

따옴표 상태를 추적하는 파서로 바꾸면 해결됩니다:

```ts
function splitCsvRow(row: string): string[] {
  const fields: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < row.length; i++) {
    const ch = row[i];

    if (ch === '"') {
      if (inQuotes && row[i + 1] === '"') {
        field += '"'; // 이스케이프된 "" -> "
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      fields.push(field);
      field = "";
    } else {
      field += ch;
    }
  }
  fields.push(field);
  return fields;
}
```

`row.split(",")` 자리를 `splitCsvRow(row)`로 바꾸면 끝이에요. 따옴표 안 콤마는 더 이상 안 쪼개지고, `""` 이스케이프도 정상적으로 `"` 하나로 풀립니다.

한 가지만 짚을게요 — 이 함수는 "한 줄"이 이미 올바르게 분리돼 있다는 전제예요. 앞단에서 파일 전체를 `\n` 기준으로 줄 나누고 있다면, 따옴표 안에 개행이 든 필드에서 또 깨질 수 있어요. 그건 별개 지점이니 해당되면 알려주세요.

어느 파일인지 알려주시면 바로 적용할게요.
