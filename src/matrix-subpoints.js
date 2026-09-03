function cleanSubpoint(line) {
  return String(line ?? '')
    .trim()
    .replace(/^(?:[-*•·]|\d+[.)])\s+/, '')
    .trim()
}

export function splitSubpoints(value) {
  return String(value ?? '')
    .split(/\r?\n/)
    .map(cleanSubpoint)
    .filter(Boolean)
}

export function normalizeSubpoints(value) {
  return splitSubpoints(value).join('\n')
}
