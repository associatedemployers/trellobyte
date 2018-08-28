const moment = require('moment');

module.exports = (date, format) =>
  date ? moment(date).format(typeof format !== 'string' ? 'M/D/YY' : format) : 'N/A';
