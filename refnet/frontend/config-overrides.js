const path = require('path');

module.exports = function override(config, env) {
  // Add webpack alias to fix Cedar-OS TipTap import issue
  config.resolve = config.resolve || {};
  config.resolve.alias = config.resolve.alias || {};
  
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
