const dotenv = require('dotenv');
const Joi = require('joi');

dotenv.config();

const envVarsSchema = Joi.object()
  .keys({
    CACHE_TTL: Joi.number().default(60),
    MNEMONIC: Joi.string().required(),
    MAX_KEYS: Joi.number().default(50),
    PORT: Joi.number().default(3000),
    RPC: Joi.string().required(),
    LCD: Joi.string().required(),

    CHAIN_ID: Joi.string().required(),
    DENOM: Joi.string().required(),
    CONTRACT: Joi.string().required(),
    INTERVAL: Joi.number().required(),
    GAS_MULTIPLIER: Joi.number().required(),
    GAS_PRICE: Joi.number().required(),
  })
  .unknown();

const { value: envVars, error } = envVarsSchema.prefs({ errors: { label: 'key' } }).validate(process.env);

if (error) {
  throw new Error(`Config validation error: ${error.message}`);
}

module.exports = {
  cacheTTL: envVars.CACHE_TTL,
  mnemonic: envVars.MNEMONIC,
  maxKeys: envVars.MAX_KEYS,
  domainSeparator: {
    contract: envVars.CONTRACT,
    chainId: envVars.CHAIN_ID,
  },
  port: envVars.PORT,
  rpc: envVars.RPC,
  lcd: envVars.LCD,

  chainId: envVars.CHAIN_ID,
  denom: envVars.DENOM,
  contract: envVars.CONTRACT,
  interval: envVars.INTERVAL,
  gasMultiplier: envVars.GAS_MULTIPLIER,
  gasPrice: envVars.GAS_PRICE,
};
