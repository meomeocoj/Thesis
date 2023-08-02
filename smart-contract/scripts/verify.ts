import { setUp } from './setUp'
import { SocialDkgClient } from '../artifacts/contracts/SocialDkg.client'
import config from '../config'

async function main() {
  // create wallet
  const { cc: client, wallet } = await setUp()
  const accounts = await wallet.getAccounts()
  const owner = accounts[0].address

  const social_client = new SocialDkgClient(client, owner, config.contract)

  const response = await social_client.verifyMember({
    msg: 'LCpHMeXq5R4gywm5wQsV5eiJWftfc/lbjfmNz6Q2IV8=',
    pubKeys: [
      'Aigxd8OTFLp9oKvcAG7o4k8wTzAdEG+HAJF0XD5B/3Hx',
      'A74c0x1O5tqA8JCWNkMK4/vRLGwOFK0X2hLIYPD3WkMj',
      'A6Ne4YACBkgCt9E6k9gdbdAzOnagxbKz+XOLv23sNS8o',
      'ArbJ+kk9mwzMXYB5+Qc0WB3eGpScs5gElBv/PX+xKmL+',
      'Aq2Epp4uc0gjGxS1t4XHdrf1hzcgAFDI5GWPOW4tj2TR',
    ],
    sigs: [
      'uWLfyK/q7GnQvVJqNyZUXChOtTJmKotzD2UMXoTirR5ampicUfPR2dlVbYLVyImONgHA2ea8YztE+93KxAxkZQ==',
      '2AG9dfjpw8J/AMeyFpH7VCSsZJDPiW/FUfQ1i5mTQMs5TYoe4qT+TyD9EOFWTbB35PfMO6vFmaL4hsJDX+BOVQ==',
      'WZlT4etkgAzqJoqXTmD+sN3rp6GlktohPr0GlaK2SdIzzRIOwUdMBp/CKZlaMzbtPqVIXxi6MnK5GRR7XUPWag==',
      'sTWL/yMpUvLn93E8IY0YCo6CFRqbD8wDfUx6mqNzUxAUyXuSd2n7c5um5h+o/0g+eiwgRicOH5WhXdoXVx3PEQ==',
      '9lEP0AQzE61JfkjYE0I7yBLjkuu6oCEoqtu46KXLfuNdCj+770gssLA7EqEXNxlm79ftQ/KUfUVK7I/ImWNaRQ==',
    ],
  })
  console.log(response)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
