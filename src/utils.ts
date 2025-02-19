export function appendPath(base: string, path: string = "/"): URL {
  const url = new URL(base);

  url.pathname = [url.pathname, path]
    .join("/")
    .replaceAll(/\//g, "/");

  return url;
}
