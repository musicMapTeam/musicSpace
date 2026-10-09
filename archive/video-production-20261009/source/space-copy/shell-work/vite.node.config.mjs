// Throwaway QA server for the Node (server-profile) event room: the repo's event config with another port, API target and a private dep cache.
import base from '/Users/alakazan/workplace/tme/musicSpace/vite.event.config.js';
export default {...base, cacheDir: '/tmp/space-copy/shell-work/vite-cache', server: {host: '127.0.0.1', port: 5899, strictPort: true, proxy: {'/api': 'http://127.0.0.1:8899'}}};
