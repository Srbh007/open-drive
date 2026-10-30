import 'server-only';

export const log = {
  info: (message: string, meta?: unknown) => {
    console.log(JSON.stringify({ level: 'info', message, meta, time: new Date().toISOString() }));
  },
  warn: (message: string, meta?: unknown) => {
    console.warn(JSON.stringify({ level: 'warn', message, meta, time: new Date().toISOString() }));
  },
  error: (message: string, meta?: unknown) => {
    console.error(JSON.stringify({ level: 'error', message, meta, time: new Date().toISOString() }));
  },
};
