const Joi = require('joi');
const pick = require('../utils/pick');

const validate = (schema, params) => {
  const validSchema = pick(schema, ['params']);
  const object = pick({ params }, Object.keys(validSchema));
  const { value, error } = Joi.compile(validSchema)
    .prefs({ errors: { label: 'key' }, abortEarly: false })
    .validate(object);

  if (error) {
    const errorMessage = error.details.map((details) => details.message).join(', ');
    return { error: errorMessage };
  }
  return { value };
};

module.exports = validate;
