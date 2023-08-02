import * as Joi from 'joi'
import * as dotenv from 'dotenv'

dotenv.config()

const envVarsSchema = Joi.object()
  .keys({
    TOTAL_MEMBER: Joi.number().default(5),
    DEALERS: Joi.number().default(3),
    DEADLINE_TIME: Joi.number().default(300),
    KEY_NUM: Joi.string().default('50'),
    CONTRACT: Joi.string(),
  })
  .unknown()

const { value: envVars, error } = envVarsSchema
  .prefs({ errors: { label: 'key' } })
  .validate(process.env)

if (error) {
  throw new Error(`Config validation error: ${error.message}`)
}

export default {
  totalMember: envVars.TOTAL_MEMBER,
  dealers: envVars.DEALERS,
  deadline_time: envVars.DEADLINE_TIME,
  expected_key_num: envVars.KEY_NUM,
  contract: envVars.CONTRACT,
}
