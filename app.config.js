// Opt in only for native builds used with a local HTTP development server.
module.exports = ({ config }) => {
  const allowLocalHttp = process.env.REFIT_ALLOW_HTTP === '1';
  const plugins = (config.plugins ?? []).filter(plugin => plugin !== 'expo-build-properties');
  return {
    ...config,
    ios: {
      ...config.ios,
      infoPlist: {
        ...config.ios?.infoPlist,
        ...(allowLocalHttp ? { NSAppTransportSecurity: { NSAllowsArbitraryLoads: true } } : {}),
      },
    },
    plugins: allowLocalHttp
      ? [...plugins, ['expo-build-properties', { android: { usesCleartextTraffic: true } }]]
      : plugins,
  };
};
