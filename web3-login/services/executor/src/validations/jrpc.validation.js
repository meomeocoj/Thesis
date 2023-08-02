const Joi = require("joi");
const { TypeOfLogin } = require("../services/handlers");

const JoiUrl = (value, helpers) => {
  try {
    new URL(value);
  } catch (err) {
    return helpers.error("any.invalid");
  }
  return value;
};

const AuthorizeOptions = Joi.object().keys({
  authorizeUrl: Joi.string().custom(JoiUrl).allow("").optional(),
  iss: Joi.string().custom(JoiUrl).allow("").optional(),
});

const assignKeyCommitmentRequest = {
  params: Joi.object().keys({
    tokencommitment: Joi.string().required(),
    verifier_id: Joi.string().required(),
    verifier: Joi.string().required(),
  }),
};

const assignKeyRequestSignatures = Joi.object().keys({
  data: Joi.string().required(),
  nodepubx: Joi.string().required(),
  nodepuby: Joi.string().required(),
  signature: Joi.string().required(),
  verifierIdSignature: Joi.string().required(),
});

const assignKeyRequest = {
  params: Joi.object().keys({
    typeOfLogin: Joi.valid(...Object.values(TypeOfLogin)),
    idtoken: Joi.string().required(),
    nodesignatures: Joi.array().items(assignKeyRequestSignatures).required(),
    verifier_id: Joi.string().required(),
    verifier: Joi.string().required(),
    authorizeOptions: AuthorizeOptions.allow({}).optional(),
  }),
};

const commitmentRequestValidation = {
  params: Joi.object().keys({
    temppubx: Joi.string().required(),
    temppuby: Joi.string().required(),
    tokencommitment: Joi.string().required(),
  }),
};

const shareRequestSignatures = Joi.object().keys({
  data: Joi.string().required(),
  nodepubx: Joi.string().required(),
  nodepuby: Joi.string().required(),
  signature: Joi.string().required(),
});

const shareRequestValidation = {
  params: Joi.object().keys({
    typeOfLogin: Joi.valid(...Object.values(TypeOfLogin)),
    idtoken: Joi.string().required(),
    nodesignatures: Joi.array().items(shareRequestSignatures).required(),
    verifier: Joi.string().required(),
    verifier_id: Joi.string().required(),
    authorizeOptions: AuthorizeOptions.allow({}).optional(),
  }),
};

module.exports = {
  assignKeyCommitmentRequest,
  assignKeyRequest,
  commitmentRequestValidation,
  shareRequestValidation,
};
