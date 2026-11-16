// Registers the resolve hook so that node --test can run the TypeScript of src/lib/v3-public without a build step or a new dependency.
import { register } from 'node:module';

register('./hooks.mjs', import.meta.url);
