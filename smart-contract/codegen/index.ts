import codegen from '@cosmwasm/ts-codegen'
import * as fs from 'fs'
import * as path from 'path'

type ComplianceSpec = {
  name: string
  dir: string
}

async function getSchemaDir(rootDir: string): Promise<string[][]> {
  const dirs: string[][] = []
  const absolutePath = path.resolve(__dirname, rootDir)
  const dirEntries = fs.readdirSync(absolutePath)
  dirEntries.forEach((entry) => {
    try {
      const schemaDir = path.resolve(__dirname, rootDir, entry, 'schema')
      if (fs.existsSync(schemaDir) && fs.lstatSync(schemaDir).isDirectory()) {
        dirs.push([schemaDir.replaceAll('\\', '/'), entry])
      }
    } catch (e) {
      console.warn(e)
      process.exit(1)
    }
  })

  return dirs
}

async function main() {
  const contractDir = '../contracts'
  const dirs = await getSchemaDir(contractDir)
  const compilanceSpecs: ComplianceSpec[] = dirs.map(([dir, name]) => {
    return {
      dir,
      name,
    }
  })
  codegen({
    contracts: compilanceSpecs,
    outPath: `./artifacts/contracts`,
    options: {
      bundle: {
        bundleFile: 'index.ts',
        scope: 'contracts',
      },
    },
  }).then(() => {
    console.log('✨all done')
  })
}

main().catch((err) => console.log(err))
