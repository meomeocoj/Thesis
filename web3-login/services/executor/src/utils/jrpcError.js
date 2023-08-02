const jayson = require('jayson');

const invalidParams = (message) => ({
  code: jayson.Server.errors.INVALID_PARAMS,
  message: 'Input error',
  data: message,
});

const internalError = (message) => ({
  code: jayson.Server.errors.INTERNAL_ERROR,
  message: 'Internal error',
  data: message,
});

module.exports = { invalidParams, internalError };
