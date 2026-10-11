import { Readable } from "node:stream";

/** A request as the platform hands it to a function when the body is not parsed: a stream of bytes plus headers. */
export function mockRequest(options: { method?: string; headers?: Record<string, string>; body?: string; query?: Record<string, string> }) {
  const request = Readable.from(options.body === undefined ? [] : [Buffer.from(options.body, "utf8")]) as Readable & Record<string, unknown>;
  request.method = options.method ?? "POST";
  request.headers = Object.fromEntries(Object.entries(options.headers ?? {}).map(([name, value]) => [name.toLowerCase(), value]));
  request.query = options.query ?? {};
  request.socket = { remoteAddress: "127.0.0.1" };
  return request as never;
}

export function mockResponse() {
  const state = { status: 0, body: undefined as unknown, headers: {} as Record<string, string> };
  const response = {
    setHeader(name: string, value: string) {
      state.headers[name.toLowerCase()] = String(value);
      return response;
    },
    status(code: number) {
      state.status = code;
      return response;
    },
    json(body: unknown) {
      state.body = body;
      return response;
    },
    end() {
      return response;
    },
  };
  return { response: response as never, state };
}
