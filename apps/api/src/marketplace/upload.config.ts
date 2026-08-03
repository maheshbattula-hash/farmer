import path from 'node:path';
import { randomUUID } from 'node:crypto';

import { diskStorage } from 'multer';

import { env } from '../common/utils/env';

function safeStem(filename: string): string {
  return path.basename(filename, path.extname(filename)).replace(/[^a-zA-Z0-9_-]+/g, '-').slice(0, 60) || 'file';
}

export const cropUploadOptions = {
  storage: diskStorage({
    destination: (_request: any, _file: any, callback: any) => {
      callback(null, env.uploadsRoot);
    },
    filename: (_request: any, file: any, callback: any) => {
      const extension = path.extname(file.originalname || '').slice(0, 10) || '.bin';
      callback(null, `${Date.now()}-${safeStem(file.originalname)}-${randomUUID()}${extension}`);
    },
  }),
};
