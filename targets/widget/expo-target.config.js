/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = (config) => ({
  type: 'widget',
  name: 'SporttagWidgets',
  icon: '../../assets/branding/app-icon/app-icon.png',
  deploymentTarget: '16.4',
  entitlements: {},
});
