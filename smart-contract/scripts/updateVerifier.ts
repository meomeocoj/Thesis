import { setUp } from './setUp'
import { SocialDkgClient } from '../artifacts/contracts/SocialDkg.client'
import config from '../config'

async function main() {
  // create wallet
  const { cc: client, wallet } = await setUp()
  const accounts = await wallet.getAccounts()
  const owner = accounts[0].address

  const social_client = new SocialDkgClient(client, owner, config.contract)

  const response = await social_client.updateVerifier({
    clientId: 'http://localhost:3000/',
    verifier: 'local-jwt',
  })
  console.log({ response })
  const clientId = await social_client.clientId({ verifier: 'local-jwt' })
  console.log({ clientId })
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
