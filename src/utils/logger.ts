type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

const COLOR_RESET = '\u001b[0m';
const COLORS: Record<LogLevel, string> = {
  DEBUG: '\u001b[36m',
  INFO: '\u001b[32m',
  WARN: '\u001b[33m',
  ERROR: '\u001b[31m',
};

class Logger {
  private getTimestamp(): string {
    return new Date().toISOString();
  }

  private formatMessage(level: LogLevel, context: string, message: string): string {
    const color = COLORS[level];
    return `[${this.getTimestamp()}] [${color}${level}${COLOR_RESET}] [${context}] ${message}`;
  }

  public debug(context: string, message: string, ...meta: any[]) {
    if (process.env.NODE_ENV !== 'production' || process.env.DEBUG === 'true') {
      console.log(this.formatMessage('DEBUG', context, message), ...meta);
    }
  }

  public info(context: string, message: string, ...meta: any[]) {
    console.log(this.formatMessage('INFO', context, message), ...meta);
  }

  public warn(context: string, message: string, ...meta: any[]) {
    console.warn(this.formatMessage('WARN', context, message), ...meta);
  }

  public error(context: string, message: string, error?: any, ...meta: any[]) {
    console.error(this.formatMessage('ERROR', context, message), ...meta);
    if (error instanceof Error && error.stack) {
      console.error(`\u001b[31m${error.stack}${COLOR_RESET}`);
    } else if (error) {
      console.error(error);
    }
  }
}

export const logger = new Logger();
