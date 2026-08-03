declare module 'node:fs';
declare module 'node:fs/promises';
declare module 'node:path';
declare module 'node:crypto';

declare module 'express' {
  const express: any;
  export default express;
  export const json: any;
  export const urlencoded: any;
}

declare module 'multer' {
  export const diskStorage: any;
}

declare module 'nodemailer' {
  const nodemailer: any;
  export default nodemailer;
}

declare var process: any;
declare var console: any;
