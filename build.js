const esbuild = require("esbuild");

esbuild.build({
  entryPoints: ["index.ts"],
  outfile: "dist/index.js",
  bundle: true,
  platform: "node",
  target: "node18",
  minify: true,
  sourcemap: true,
  external: [
    "nodemon",
    "npm",
    "install",
    "esbuild",
    "mongodb",
    "cheerio",
    "he",
  ],
  logLevel: 'info'
}).then(() => {
  console.log('Build completed - these modules will be required from node_modules at runtime:');
  console.log([
    "nodemon",
    "mongodb",
    "cheerio",
    "he",
    "axios",
    "fast-html-parser"
  ].join('\n'));
}).catch((e) => {
  console.error('Build failed:', e);
  process.exit(1);
});