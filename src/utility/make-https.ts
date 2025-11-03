export function makeHttps(url: string): string {
  return url.replace(/^http:/, 'https:');
}
