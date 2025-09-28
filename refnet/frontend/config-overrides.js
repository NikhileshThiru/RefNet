const path = require('path');
const webpack = require('webpack');

module.exports = function override(config, env) {
  // Add webpack alias to fix Cedar-OS TipTap import issue
  config.resolve = config.resolve || {};
  config.resolve.alias = config.resolve.alias || {};
  
  // Add process polyfill for browser compatibility
  config.plugins = config.plugins || [];
  config.plugins.push(
    new webpack.ProvidePlugin({
      process: 'process/browser',
    })
  );
  
  // Add fallback for Node.js modules
  config.resolve.fallback = {
    ...config.resolve.fallback,
    "process": require.resolve("process/browser"),
    "util": require.resolve("util/"),
    "stream": require.resolve("stream-browserify"),
    "buffer": require.resolve("buffer"),
  };
  
  // Add babel-loader rule for cedar-os modules
  config.module.rules.push({
    test: /\.(js|mjs|jsx)$/,
    include: [
      path.resolve(__dirname, 'node_modules/cedar-os'),
      path.resolve(__dirname, 'node_modules/cedar-os-components')
    ],
    use: {
      loader: 'babel-loader',
      options: {
        presets: [
          ['@babel/preset-env', {
            targets: {
              browsers: ['> 1%', 'last 2 versions']
            }
          }]
        ],
        plugins: [
          '@babel/plugin-proposal-optional-chaining',
          '@babel/plugin-proposal-nullish-coalescing-operator'
        ]
      }
    }
  });

  return config;
};
