import ts from 'typescript';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { extractBlocks } from './mdx-code.ts';
const files = readdirSync('article-sets', { recursive: true }).filter(
  (file): file is string => typeof file === 'string' && file.endsWith('.mdx'),
);
const virtual = new Map<string, string>();
for (const file of files)
  for (const block of extractBlocks(
    readFileSync(`article-sets/${file}`, 'utf8'),
  ).blocks)
    virtual.set(resolve(`article-sets/${file}.${block.id}.ts`), block.source);
const config = ts.readConfigFile('tsconfig.json', ts.sys.readFile);
const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, '.');
const host = ts.createCompilerHost(parsed.options),
  readFile = host.readFile.bind(host),
  fileExists = host.fileExists.bind(host);
host.readFile = (name) => virtual.get(resolve(name)) ?? readFile(name);
host.fileExists = (name) => virtual.has(resolve(name)) || fileExists(name);
const program = ts.createProgram(
  [...virtual.keys(), resolve('scene/env.d.ts')],
  { ...parsed.options, erasableSyntaxOnly: false },
  host,
);
const errors = ts.getPreEmitDiagnostics(program);
if (errors.length) {
  console.error(
    ts.formatDiagnosticsWithColorAndContext(errors, {
      getCanonicalFileName: (n) => n,
      getCurrentDirectory: () => process.cwd(),
      getNewLine: () => '\n',
    }),
  );
  process.exitCode = 1;
} else console.log(`Checked ${virtual.size} executable MDX blocks`);
