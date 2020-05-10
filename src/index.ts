/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable no-console */
import parseDuration from 'parse-duration'
import * as core from '@actions/core'
import * as github from '@actions/github'
import {deleteOldPackageVersions} from './deleteOldPackageVersions'

const DEFAULT_MIN_AGE = '1w'

async function run(): Promise<void> {
  const minAge = core.getInput('minAge') || DEFAULT_MIN_AGE
  const minAgeMs = parseDuration(minAge)

  if (minAgeMs === null) {
    throw new Error(
      `Invalid minimum age. See https://www.npmjs.com/package/parse-duration for format`
    )
  }

  const deleted = await deleteOldPackageVersions({
    githubToken: core.getInput('token')!,
    owner: core.getInput('owner') || github.context.actor,
    repo: core.getInput('repo') || github.context.repo.repo,
    packageName: core.getInput('packageName')!,
    minAgeMs
  })

  core.setOutput('deleted', deleted.join(','))
}

run().catch(error => {
  console.error(error.stack)
  core.setFailed(error.message)
})
