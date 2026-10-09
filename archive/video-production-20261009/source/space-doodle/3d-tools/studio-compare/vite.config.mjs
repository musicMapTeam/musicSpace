const R='/Users/alakazan/workplace/tme/musicSpace';
export default {
  root: '/tmp/space-doodle/3d-tools/studio-compare',
  logLevel: 'warn',
  resolve: { alias: [
    { find: /^three$/, replacement: R + '/node_modules/three/build/three.module.js' },
    { find: /^three\/addons\/(.*)$/, replacement: R + '/node_modules/three/examples/jsm/$1' },
  ] },
  optimizeDeps: { noDiscovery: true, include: [] },
  server: { host: '127.0.0.1', port: 5297, strictPort: true, fs: { allow: [R, '/tmp/space-doodle/3d-tools/studio-compare'] } },
};
