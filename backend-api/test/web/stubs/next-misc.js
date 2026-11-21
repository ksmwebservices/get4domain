module.exports = new Proxy({ __esModule: true }, { get: (t, name) => (name in t ? t[name] : () => ({ push() {}, replace() {}, get: () => null, toString: () => '' })) });
