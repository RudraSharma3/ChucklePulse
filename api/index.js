const requestHandler = require('../server');

module.exports = (req, res) => {
  return requestHandler(req, res);
};
