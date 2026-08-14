import { defineConfig } from 'tsdown'

const CLIENT_ID = '@zenmux/dsh-plugins'

export default defineConfig({
  clean: false,
  dts: false,
  entry: { client: 'src/client.ts' },
  external: ['react'],
  format: 'cjs',
  noExternal: id => id !== 'react',
  outDir: 'lib',
  outputOptions: {
    banner: `window.__ModuleLoader__.load({ id: ${JSON.stringify(CLIENT_ID)}, factory: (require) => {`,
    entryFileNames: 'client.js',
    footer: 'return module.exports; } });',
    intro: 'var module = { exports: {} }; var exports = module.exports;',
  },
  platform: 'browser',
  sourcemap: true,
  target: 'es2022',
})
