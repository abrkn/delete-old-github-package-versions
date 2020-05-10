/* eslint-disable no-console */
import {chain} from 'lodash'
import {graphql} from '@octokit/graphql'

interface PackagesQueryResult {
  repository: {
    packages: {
      edges: {
        node: {
          id: string
          name: string
          versions: {
            nodes: {
              id: string
              version: string
              files: {
                nodes: {
                  id: string
                  updatedAt: string
                }[]
              }
            }[]
          }
        }
      }[]
    }
  }
}

export const deleteOldPackageVersions = async ({
  githubToken,
  owner,
  repo,
  packageName,
  minAgeMs
}: {
  githubToken: string
  owner: string
  repo: string
  packageName: string
  minAgeMs: number
}): Promise<string[]> => {
  const graphqlWithAuth = graphql.defaults({
    headers: {
      authorization: `Bearer ${githubToken}`,
      accept:
        'application/vnd.github.packages-preview+json, application/vnd.github.package-deletes-preview+json'
    }
  })

  const fetchPackages = async ({
    max = 25
  }: {
    max?: number
  } = {}): Promise<PackagesQueryResult | null> => {
    const result = await graphqlWithAuth(`
      {
        repository(owner: "${owner}", name: "${repo}") {
          packages(last: ${max}, names: ["${packageName}"]) {
            edges {
              node {
                id
                name
                versions(last: ${max}) {
                  nodes {
                    id
                    version
                    files(last: ${max}) {
                      nodes {
                        id
                        updatedAt
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    `)

    return result === null ? null : (result as PackagesQueryResult)
  }

  const deletePackageVersion = async ({
    versionId
  }: {
    versionId: string
  }): Promise<unknown | null> => {
    const result = await graphqlWithAuth(`
      mutation {
        deletePackageVersion(input: {
          packageVersionId: "${versionId}"
        }) {
          success
        }
      }
    `)

    if (result === null) {
      throw new Error(`Package version not found`)
    }

    return (result as {deletePackageVersion: {success: boolean}})
      .deletePackageVersion.success
  }

  console.debug(`Mininmum age: ${minAgeMs} ms`)

  const queryResult = await fetchPackages()

  if (queryResult === null) {
    throw new Error(`Repository ${owner} not found`)
  }

  const [githubPackage] = queryResult.repository.packages.edges

  if (githubPackage === undefined) {
    throw new Error(`Package ${packageName} not found`)
  }

  const versions = githubPackage.node.versions.nodes.map(version => {
    const latestFile = chain(version.files.nodes)
      .sortBy(file => file.updatedAt)
      .last()
      .value()

    return {
      id: version.id,
      version: version.version,
      latestFile
    }
  })

  const result: string[] = []

  for (const version of versions) {
    const versionName = version.version ?? '<null>'
    const versionNameQualified = `${owner}/${repo}/${packageName}:${versionName}`

    let versionFormatted: string

    if (version.latestFile) {
      versionFormatted = `${versionName} updated at ${version.latestFile
        .updatedAt ?? '<no files found>'}`
    } else {
      versionFormatted = `${versionName} with no files (cannot establish age)`
    }

    console.debug(
      `Found latest for ${owner}/${repo}/${packageName}, ${versionFormatted}`
    )

    if (!version.latestFile) {
      console.debug(`Package has no latest version. Will not consider`)
      continue
    }

    const ageMs =
      new Date().getTime() - new Date(version.latestFile.updatedAt).getTime()

    console.debug(`Package age: ${ageMs} ms`)

    if (ageMs < minAgeMs) {
      console.debug(`Package verison is not old. Will not delete package`)
      continue
    }

    console.debug(`Package version is old. Will delete`)

    console.info(`Deleting ${versionNameQualified}...`)

    const success = await deletePackageVersion({
      versionId: version.id
    })

    if (!success) {
      throw new Error(`Failed to delete ${versionNameQualified}`)
    }

    console.info(`Deleted ${versionNameQualified}`)

    result.push(versionNameQualified)
  }

  return result
}
