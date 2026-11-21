// Icons are drawn as nothing in the footer tests: only the text and the links matter there.
module.exports = new Proxy({ __esModule: true }, { get: (t, name) => (name in t ? t[name] : () => null) });
