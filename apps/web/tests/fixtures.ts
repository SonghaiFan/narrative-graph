import { readFileSync } from 'node:fs';

// schema/ sits at the repo root, two levels above apps/web.
const schemaDir = new URL('../../../schema/', import.meta.url);

export const loadFixture = <T>(name: string): T =>
  JSON.parse(readFileSync(new URL(`fixtures/${name}`, schemaDir), 'utf8'));

export const loadSchema = (name: 'graph' | 'graph-file' | 'story'): object =>
  JSON.parse(readFileSync(new URL(`${name}.schema.json`, schemaDir), 'utf8'));
