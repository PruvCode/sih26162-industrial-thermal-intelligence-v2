/**
 * Public surface of the data layer.
 *
 * `@/lib/api` is the only import path the rest of the app should need:
 *
 *   import { ApiError, demoProvider, getActiveProvider } from '@/lib/api';
 */

export * from './errors';
export * from './http';
export * from './dto';
export * from './mappers';
export * from './provider';

export { demoProvider } from './providers/demo';
export { apiProvider } from './providers/api';
