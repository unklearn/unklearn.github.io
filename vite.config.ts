import { defineConfig } from 'vite';
import mdx from '@mdx-js/rollup';
import { lessonCode } from './authoring/mdx-code.ts';
export default defineConfig({ base: './', plugins: [lessonCode(), mdx()] });
