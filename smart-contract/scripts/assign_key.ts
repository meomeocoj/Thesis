import { setUp } from './setUp'
import { SocialDkgClient } from '../artifacts/contracts/SocialDkg.client'
import config from '../config'

async function main() {
  // create wallet
  const { cc: client, wallet } = await setUp()
  const accounts = await wallet.getAccounts()
  const owner = accounts[0].address

  const social_client = new SocialDkgClient(client, owner, config.contract)

  let response = await social_client.assignKey({
    pubKeys: [
      'Aigxd8OTFLp9oKvcAG7o4k8wTzAdEG+HAJF0XD5B/3Hx',
      'A74c0x1O5tqA8JCWNkMK4/vRLGwOFK0X2hLIYPD3WkMj',
      'A6Ne4YACBkgCt9E6k9gdbdAzOnagxbKz+XOLv23sNS8o',
      'ArbJ+kk9mwzMXYB5+Qc0WB3eGpScs5gElBv/PX+xKmL+',
      'Aq2Epp4uc0gjGxS1t4XHdrf1hzcgAFDI5GWPOW4tj2TR',
    ],
    sigs: [
      'BF5LJh3pl5eUofIPUKU6bsKs76/yuvY7yOOiC1pJ8Ap+UrIRQolviIcB7sVubiMZOGuI/ZuaNQtu9fZV7llphg==',
      'UtnirMgT2Yty2wKzVjnvYbIuDU1YcVceCItUZQVGGdN6SKPMAR3TWSBtHzvl6PHeHo7u0hXD7E5U+fmuj87xgw==',
      'JH/UhrwAq4pFH+jKC07dwItzcPQYVqeaMJp8mqpVYIAtZ5+eBjuCwTWnoRTJvm8frZDR0k79cayHGgQC5hwI8A==',
      'J9k6hP8CA7JFDGYmigj0kFgrY08tr7wmEgzKCZdFUyZKakJ0yFR2PDQnbPOp8gUMDu0eBWLO1sXWLIhTeKUXqQ==',
      'Z9J1eyz+5T0WdPU6XOL79QDszGiWT+0uNxeu6n8ia+tGRP2Lqll48Ke2eVLVg0GfiECE5aO7JCXJG/29nkyyiw==',
    ],
    verifier: 'tkey-google',
    verifierId: 'tminh1103@gmail.com',
  })

  console.log({ response })
  let verifier_info = await social_client.verifierIdInfo({
    verifier: 'tkey-google',
    verifierId: 'tminh1103@gmail.com',
  })
  console.log({ verifier_info })
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
