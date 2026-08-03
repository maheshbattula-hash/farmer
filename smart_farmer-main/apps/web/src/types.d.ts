declare const Buffer: {
  from(value: string, encoding?: string): { toString(encoding?: string): string };
};

declare const process: {
  env: Record<string, string | undefined>;
  cwd(): string;
};

declare module "next";
declare module "next/image-types/global";

declare module "next/server" {
  export class NextRequest {
    url: string;
    method: string;
    headers: {
      get(name: string): string | null;
    };
    cookies: {
      get(name: string): { value: string } | undefined;
    };
    nextUrl: {
      pathname: string;
      search: string;
      searchParams: URLSearchParams;
    };
    formData(): Promise<FormData>;
  }

  export class NextResponse extends Response {
    cookies: {
      set(name: string, value: string, options?: Record<string, unknown>): void;
      delete(name: string): void;
    };
    static json(body: unknown, init?: ResponseInit): NextResponse;
    static redirect(url: URL | string, status?: number): NextResponse;
  }
}

declare module "nunjucks" {
  export class Environment {
    constructor(loader: unknown, options?: Record<string, unknown>);
    render(templateName: string, context?: Record<string, unknown>): string;
    addFilter(name: string, filter: (...args: any[]) => any): void;
    addGlobal(name: string, value: unknown): void;
  }

  export class FileSystemLoader {
    constructor(searchPaths: string, opts?: Record<string, unknown>);
  }

  export const runtime: {
    SafeString: new (value: string) => unknown;
  };

  export function installJinjaCompat(): void;
}

declare module "node:path" {
  const path: {
    join: (...parts: string[]) => string;
  };
  export default path;
}
