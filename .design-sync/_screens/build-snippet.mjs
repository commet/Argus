// Builds _ws_snippet.js — an IIFE that adds window.ArgusDS.WorkspaceHome using
// the page's already-loaded window.React (same contract as the toolchain bundle).
// React/ReactDOM/jsx-runtime are aliased to window globals so WorkspaceHome shares
// the page's single React instance (so it composes under DesignRouterProvider).
import esbuild from 'esbuild';

const reactGlobal = {
  name: 'react-global',
  setup(build) {
    build.onResolve({ filter: /^react($|\/jsx-runtime$|\/jsx-dev-runtime$)/ }, (a) => ({ path: a.path, namespace: 'rg' }));
    build.onResolve({ filter: /^react-dom($|\/.*)/ }, (a) => ({ path: a.path, namespace: 'rg' }));
    build.onLoad({ filter: /.*/, namespace: 'rg' }, (a) => {
      if (a.path.startsWith('react-dom')) {
        return { contents: 'module.exports = window.ReactDOM;', loader: 'js' };
      }
      // react, react/jsx-runtime, react/jsx-dev-runtime — all backed by window.React
      return {
        contents: `
          var R = window.React;
          function jsx(t, p, k) { return R.createElement(t, k === undefined ? p : Object.assign({ key: k }, p)); }
          module.exports = R;
          module.exports.jsx = jsx;
          module.exports.jsxs = jsx;
          module.exports.jsxDEV = jsx;
          module.exports.Fragment = R.Fragment;
        `,
        loader: 'js',
      };
    });
  },
};

await esbuild.build({
  entryPoints: ['.design-sync/_screens/_snippet-entry.tsx'],
  bundle: true,
  format: 'iife',
  jsx: 'automatic',
  minify: true,
  plugins: [reactGlobal],
  outfile: 'ds-bundle/_ws_snippet.js',
  logLevel: 'info',
});
console.log('built ds-bundle/_ws_snippet.js');
