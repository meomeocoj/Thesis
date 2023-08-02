import { setUp } from './setUp'
import { SocialDkgClient } from '../artifacts/contracts/SocialDkg.client'
import config from '../config'
import { keccak256 } from 'ethers/lib/utils'

async function main() {
  // create wallet
  const { cc: client, wallet } = await setUp()
  const accounts = await wallet.getAccounts()
  const owner = accounts[0].address

  const social_client = new SocialDkgClient(client, owner, config.contract)

  const chainId = await client.getChainId()
  const address = config.contract
  const hashBase64 = Buffer.from(
    keccak256(Buffer.from(chainId + address)).replace('0x', ''),
    'hex'
  ).toString('base64')
  console.log({ hashBase64 })
  // const domainSeparator = await social_client.domainSeparator()
  // console.log({
  //   domainSeparator,
  // })

  const response = await social_client.config()
  console.log({ response })
  // await Promise.all([
  // let res = await social_client.updateConfig({
  //   config: {
  //     expected_key_num: '30',
  //   },
  // })

  //   social_client.updateConfig({
  //     config: {
  //       expected_key_num: '20',
  //     },
  //   }),
  // ]).catch((error) => console.error(error))
  // console.log(response.members.map((u) => u.pub_key))
  // console.log(response.members.map((mem) => mem.address))
}

main().catch((err: any) => {
  console.error(err)
  process.exit(1)
})
