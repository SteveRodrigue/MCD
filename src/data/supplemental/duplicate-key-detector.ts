/**
 * JSON Duplicate Key Detector
 * 
 * Standard ECMAScript JSON.parse silently overwrites earlier duplicate keys in objects.
 * This parser parses JSON text character-by-character tracking object scopes to detect
 * duplicate keys at any depth and report their exact line numbers.
 */

export interface DuplicateKeyError {
  key: string;
  line: number;
  firstSeenLine: number;
}

export function detectDuplicateJsonKeys(jsonContent: string): DuplicateKeyError[] {
  const duplicates: DuplicateKeyError[] = [];
  const chars = jsonContent;
  let inString = false;
  let isEscaped = false;
  let strBuf = '';
  const stack: Map<string, number>[] = [];
  let lineNum = 1;

  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    if (ch === '\n') {
      lineNum++;
    }

    if (inString) {
      if (isEscaped) {
        isEscaped = false;
      } else if (ch === '\\') {
        isEscaped = true;
      } else if (ch === '"') {
        inString = false;
        // Check if next non-whitespace character is ':' (identifying an object key)
        let j = i + 1;
        while (j < chars.length && /\s/.test(chars[j])) {
          j++;
        }
        if (j < chars.length && chars[j] === ':') {
          const currentScope = stack[stack.length - 1];
          if (currentScope) {
            if (currentScope.has(strBuf)) {
              duplicates.push({
                key: strBuf,
                line: lineNum,
                firstSeenLine: currentScope.get(strBuf)!,
              });
            } else {
              currentScope.set(strBuf, lineNum);
            }
          }
        }
      } else {
        strBuf += ch;
      }
    } else {
      if (ch === '"') {
        inString = true;
        strBuf = '';
      } else if (ch === '{') {
        stack.push(new Map());
      } else if (ch === '}') {
        stack.pop();
      }
    }
  }

  return duplicates;
}
