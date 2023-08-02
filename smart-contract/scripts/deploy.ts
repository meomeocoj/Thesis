import { calculateFee, GasPrice } from '@cosmjs/stargate'
import { InstantiateMsg } from '../artifacts/contracts/SocialDkg.types'
import * as fs from 'fs'
import * as path from 'path'
import { setUp } from './setUp'
import config from '../config'
import { config as cosmosConfig } from '../cosmjs.config'

const orainTestnet = cosmosConfig.networks.oraichain_testnet

async function main() {
  // create wallet
  const { cc: client, wallet } = await setUp()
  const accounts = await wallet.getAccounts()
  const owner = accounts[0].address

  // for development only, quickly create the InstantiateMsg
  const initMsg: InstantiateMsg = {
    dealers: config.dealers,
    members: accounts
      .slice(1, config.totalMember + 1)
      .map((account, index) => ({
        address: account.address,
        pub_key: Buffer.from(account.pubkey).toString('base64'),
        end_point: `http://localhost:900${index + 1}/jrpc`,
      })),
    owner,
    deadline_time: config.deadline_time,
    expected_key_num: config.expected_key_num,
  }

  // const initMsg: InstantiateMsg = {
  //   owner: 'orai1yje0jq2tqkjehacht8qdmg25clpgjx8cy7dtkw',
  //   dealers: 3,
  //   members: [
  //     {
  //       address: 'orai1yje0jq2tqkjehacht8qdmg25clpgjx8cy7dtkw',
  //       pub_key: 'A4ipC4LTlqEk+MsY8QI78mnutvDei9w4p54OKQfD4PwE',
  //       end_point: 'https://node-1.social-login.orai.io',
  //     },
  //     {
  //       address: 'orai1yje0jq2tqkjehacht8qdmg25clpgjx8cy7dtkw',
  //       pub_key: 'A3AjmGDD983N5k/qfXtChZK+Ui0EP4TJITHPumkXseJT',
  //       end_point: 'https://node-2.social-login.orai.io',
  //     },
  //     {
  //       address: 'orai1yje0jq2tqkjehacht8qdmg25clpgjx8cy7dtkw',
  //       pub_key: 'A3AjmGDD983N5k/qfXtChZK+Ui0EP4TJITHPumkXseJT',
  //       end_point: 'https://node-3.social-login.orai.io',
  //     },
  //     {
  //       address: 'orai1yje0jq2tqkjehacht8qdmg25clpgjx8cy7dtkw',
  //       pub_key: 'A3AjmGDD983N5k/qfXtChZK+Ui0EP4TJITHPumkXseJT',
  //       end_point: 'https://node-4.social-login.orai.io',
  //     },
  //     {
  //       address: 'orai1yje0jq2tqkjehacht8qdmg25clpgjx8cy7dtkw',
  //       pub_key: 'A3AjmGDD983N5k/qfXtChZK+Ui0EP4TJITHPumkXseJT',
  //       end_point: 'https://node-5.social-login.orai.io',
  //     },
  //   ],
  //   deadline_time: 300,
  //   expected_key_num: '10',
  // }

  const wasmPath = path.resolve(
    __dirname,
    '../artifacts/social_dkg-aarch64.wasm'
  )
  const wasm = fs.readFileSync(wasmPath)
  // upload calculate Fee
  const uploadFee = calculateFee(0, GasPrice.fromString(orainTestnet.gasPrice))
  console.log('=>uploadFee', uploadFee)
  const uploadResult = await client.upload(owner, wasm, 'auto')
  console.log('==>Codeid', uploadResult.codeId)

  const contract = await client.instantiate(
    owner,
    uploadResult.codeId,
    // @ts-ignore
    initMsg,
    'MEME',
    'auto'
  )
  console.log('contract address: ', contract.contractAddress)
}

main().catch((err) => {
  console.log(err)
  process.exit(1)
})
