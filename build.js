import * as esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';

const outDir = 'dist-build';

// 读取 WASM 文件并转为 base64
const wasmPath = path.join('node_modules', 'sql.js', 'dist', 'sql-wasm.wasm');
const wasmBase64 = fs.readFileSync(wasmPath).toString('base64');

// 读取 schema.sql
const schemaPath = path.join('api', 'db', 'schema.sql');
const schemaContent = fs.readFileSync(schemaPath, 'utf-8');

// ─── 处理 database.ts ───
const dbTsPath = path.join('api', 'db', 'database.ts');
let dbTsContent = fs.readFileSync(dbTsPath, 'utf-8');

// 替换 getWasmBuffer 函数
const newWasmLoader = `// 内嵌 WASM（base64）
function getWasmBuffer(): Buffer {
  return Buffer.from('${wasmBase64}', 'base64');
}`;

// 替换 initializeSchema 中的 schema 读取
const newSchemaLoader = `function initializeSchema() {
  const db = getDb();
  const schema = ${JSON.stringify(schemaContent)};
  const sqlJsDb = (db as any).sqlJsDb as SqlJsDb;
  sqlJsDb.exec(schema);
}`;

dbTsContent = dbTsContent.replace(
  /function getWasmBuffer[\s\S]*?return fs\.readFileSync\(wasmPath\);\n\}/,
  newWasmLoader
);

dbTsContent = dbTsContent.replace(
  /function initializeSchema[\s\S]*?sqlJsDb\.exec\(schema\);\n\}/,
  newSchemaLoader
);

// 移除 ESM 专用的 __filename/__dirname 声明
// 在 CJS SEA 中，`__dirname` 就是当前文件所在目录（也就是 dist-build）
// 直接从这里计算相对路径到 data 目录，永远正确
dbTsContent = dbTsContent.replace(
  /const __filename = fileURLToPath\(import\.meta\.url\);\nconst __dirname = path\.dirname\(__filename\);\n/,
  `// In CJS SEA, __dirname is already the directory containing the executable bundle
const DB_PATH = (() => {
  // dist-build/data/app.db - dist-build is where we are
  const dbPath = path.join(__dirname, 'data', 'app.db');
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dbPath;
})();
`
);

// 移除 ESM 专用的 import { fileURLToPath } from 'url'
dbTsContent = dbTsContent.replace(
  /import \{ fileURLToPath \} from 'url';\n/,
  ''
);

// 移除原来的 DB_PATH 声明（已在上面的替换中重新定义）
dbTsContent = dbTsContent.replace(
  /const DB_PATH = path\.join\(__dirname, '\.\.', '\.\.', 'data', 'app\.db'\);\n/,
  ''
);

// 确保 path 和 fs 仍在 import 中（它们应该还在）
// 写入临时文件
const tmpDbPath = path.join(outDir, 'database-tmp.ts');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(tmpDbPath, dbTsContent, 'utf-8');

// ─── 处理 app.ts（移除 ESM 的 import.meta.url 用法） ───
const appTsPath = path.join('api', 'app.ts');
let appTsContent = fs.readFileSync(appTsPath, 'utf-8');

// 移除 import { fileURLToPath } from 'url'
appTsContent = appTsContent.replace(
  /import \{ fileURLToPath \} from 'url'\n/,
  ''
);

// 替换 __filename/__dirname 声明（CJS 中这些是全局变量）
appTsContent = appTsContent.replace(
  /\/\/ for esm mode\nconst __filename = fileURLToPath\(import\.meta\.url\)\nconst __dirname = path\.dirname\(__filename\)/,
  '// CJS: __dirname and __filename are global'
);

// 修正 distPath：CJS 中 __dirname 就是 dist-build，直接用 dist 子目录
appTsContent = appTsContent.replace(
  /const regularPath = path\.join\(__dirname, '\.\.', 'dist'\)/,
  "const regularPath = path.join(__dirname, 'dist')"
);

// 写入临时文件到 api/ 目录保证相对导入正确
const tmpAppPath = path.join('api', 'app-tmp.ts');
fs.writeFileSync(tmpAppPath, appTsContent, 'utf-8');

// ─── 用 esbuild 打包后端为 CJS ───
const result = await esbuild.build({
  entryPoints: ['api/server.ts'],
  bundle: true,
  platform: 'node',
  target: 'node18',
  format: 'cjs',
  outfile: path.join(outDir, 'server-bundle.cjs'),
  external: [],
  loader: { '.ts': 'ts', '.node': 'file' },
  define: {
    'process.env.NODE_ENV': '"production"',
  },
  // 替换 database.ts 和 app.ts 为内嵌/兼容版本
  plugins: [{
    name: 'cjs-compat',
    setup(build) {
      // database.ts → temp
      build.onResolve({ filter: /\.\/db\/database\.js$/ }, () => {
        return { path: path.resolve(tmpDbPath) };
      });
      build.onResolve({ filter: /\.\/db\/database$/ }, () => {
        return { path: path.resolve(tmpDbPath) };
      });
      // app.ts → temp
      build.onResolve({ filter: /\.\/app\.js$/ }, () => {
        return { path: path.resolve(tmpAppPath) };
      });
      build.onResolve({ filter: /\.\/app$/ }, () => {
        return { path: path.resolve(tmpAppPath) };
      });
    },
  }],
});

if (result.errors.length > 0) {
  console.error('Build errors:', result.errors);
  process.exit(1);
}

console.log('Backend bundled successfully!');
console.log('Output:', path.join(outDir, 'server-bundle.cjs'));

// 创建启动脚本
const startBat = `@echo off
cd /d "%~dp0"
start "" "自律达人.exe"
`;
fs.writeFileSync(path.join(outDir, '启动.bat'), startBat, 'utf-8');

// 复制前端 dist
const frontendDist = 'dist';
const frontendDst = path.join(outDir, 'dist');
if (fs.existsSync(frontendDist)) {
  copyDir(frontendDist, frontendDst);
  console.log('Frontend dist copied');
}

// 复制 .env
fs.copyFileSync('.env', path.join(outDir, '.env'));

function copyDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const dstPath = path.join(dst, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, dstPath);
    } else {
      fs.copyFileSync(srcPath, dstPath);
    }
  }
}

console.log('\nBuild complete!');
console.log('Run: node dist-build/server-bundle.cjs');

// 创建 SEA 配置文件（入口是 CJS bundle）
const seaConfig = {
  main: 'server-bundle.cjs',
  output: 'sea-prep.blob',
  disableExperimentalSEAWarning: true,
};
fs.writeFileSync(path.join(outDir, 'sea-config.json'), JSON.stringify(seaConfig, null, 2));
console.log('SEA config created');