/** 같은 이름이 이미 있으면 "이름 2", "이름 3" 처럼 번호를 붙인다 */
export function uniqueName(base: string, existingNames: readonly string[]): string {
  let name = base;
  for (let number = 2; existingNames.includes(name); number += 1) {
    name = `${base} ${number}`;
  }
  return name;
}
