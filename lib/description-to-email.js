const DEFAULT_DOMAIN = 'aehr.org';

const domainOverride = {
  'aaron': 'mssc.org'
};

module.exports = function (desc) {
  const match = /from: (\w*)/i.exec(desc);

  if (!match || !match[1]) {
    return;
  }

  const name = match[1].toLowerCase();

  return `${name}@${domainOverride[name] || DEFAULT_DOMAIN}`;
};
