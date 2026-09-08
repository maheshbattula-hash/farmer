import 'reflect-metadata';

import express, { json, urlencoded } from 'express';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';
import { AppExceptionFilter } from './common/filters/app-exception.filter';
import { ensureRuntimeDirectories, env, validateRazorpayCredentials } from './common/utils/env';

async function bootstrap() {
  ensureRuntimeDirectories();
  validateRazorpayCredentials();

  const app = await NestFactory.create(AppModule);
  app.useGlobalFilters(new AppExceptionFilter());
  app.use(json({ limit: '10mb' }));
  app.use(urlencoded({ extended: true, limit: '10mb' }));
  app.use('/media', express.static(env.mediaRoot));
  app.enableCors({
    origin: (origin: string | undefined, callback: any) => {
      if (
        !origin ||
        env.corsAllowedOrigins.includes('*') ||
        env.corsAllowedOrigins.includes(origin) ||
        /^https?:\/\/localhost(:\d+)?$/.test(origin) ||
        /^https?:\/\/127\.0\.0\.1(:\d+)?$/.test(origin) ||
        /^https?:\/\/192\.168\.\d+\.\d+(:\d+)?$/.test(origin) ||
        /^https?:\/\/10\.\d+\.\d+\.\d+(:\d+)?$/.test(origin) ||
        /\.exp\.direct$/.test(origin) ||
        /\.ngrok(-free)?\.(io|app)$/.test(origin)
      ) {
        callback(null, true);
        return;
      }
      callback(null, false);
    },
    credentials: true,
  });

  await app.listen(env.apiPort, '0.0.0.0');
  console.log(`Smart Farmer API listening on http://0.0.0.0:${env.apiPort}`);
}

bootstrap();
