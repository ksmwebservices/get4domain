const React = require('react');
function Link({ href, children, ...rest }) { return React.createElement('a', { href: typeof href === 'string' ? href : String(href?.pathname ?? ''), ...rest }, children); }
module.exports = { __esModule: true, default: Link };
