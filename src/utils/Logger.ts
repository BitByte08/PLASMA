export const enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

const LEVEL_LABELS: Record<number, string> = {
  [LogLevel.DEBUG]: 'DEBUG',
  [LogLevel.INFO]: ' INFO',
  [LogLevel.WARN]: ' WARN',
  [LogLevel.ERROR]: 'ERROR',
};

export class Logger {
  private readonly prefix: string;

  constructor(
    context: string,
    private readonly minLevel: LogLevel = LogLevel.INFO
  ) {
    this.prefix = `[Plasma:${context}]`;
  }

  debug(msg: string, data?: unknown): void {
    this.log(LogLevel.DEBUG, msg, data);
  }

  info(msg: string, data?: unknown): void {
    this.log(LogLevel.INFO, msg, data);
  }

  warn(msg: string, data?: unknown): void {
    this.log(LogLevel.WARN, msg, data);
  }

  error(msg: string, data?: unknown): void {
    this.log(LogLevel.ERROR, msg, data);
  }

  private log(level: LogLevel, msg: string, data?: unknown): void {
    if (level < this.minLevel) return;
    const ts = new Date().toISOString();
    const label = LEVEL_LABELS[level] ?? '?????';
    const line = `${ts} ${label} ${this.prefix} ${msg}`;
    if (data !== undefined) {
      console.log(line, data);
    } else {
      console.log(line);
    }
  }
}
