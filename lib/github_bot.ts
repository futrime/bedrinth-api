import assert from 'assert';
import consola from 'consola';
import {Octokit} from 'octokit';
import semver, {SemVer} from 'semver';
import sequelize from 'sequelize';

import {createToothVersionModel} from '../models/tooth_version.js';

import {Metadata} from './metadata.js';
import {RawMetadata} from './rawmetadata.js';

export class GitHubBot {
  private readonly octokit: Octokit;
  private timeout: NodeJS.Timeout|undefined = undefined;

  constructor(
      private readonly toothVersionModel:
          ReturnType<typeof createToothVersionModel>,
      private readonly expire: number,
      private readonly interval: number,
      token: string,
  ) {
    this.octokit = new Octokit({auth: token});
  }

  async start() {
    if (this.timeout !== undefined) {
      throw new Error('bot already started');
    }

    this.timeout = setInterval(() => {
      runJobs(this.octokit, this.toothVersionModel, this.expire);
    }, this.interval * 1000);

    runJobs(this.octokit, this.toothVersionModel, this.expire);
  }

  async stop() {
    if (this.timeout === undefined) {
      throw new Error('bot already stopped');
    }

    clearInterval(this.timeout);
    this.timeout = undefined;
  }
}

async function fetchTeeth(
    octokit: Octokit,
    toothVersionModel: ReturnType<typeof createToothVersionModel>) {
  consola.log('fetching teeth...');

  const teeth = await getTeeth(octokit);

  for (const tooth of teeth) {
    try {
      await fetchTooth(
          octokit,
          toothVersionModel,
          tooth.repoOwner,
          tooth.repoName,
      );

    } catch (err) {
      assert(err instanceof Error);
      consola.error(`failed to fetch tooth ${tooth.repoOwner}/${
          tooth.repoName}: ${err.message}`);
    }
  }

  consola.log('fetched teeth')
}

async function fetchTooth(
    octokit: Octokit,
    toothVersionModel: ReturnType<typeof createToothVersionModel>,
    repoOwner: string, repoName: string) {
  consola.log(`fetching tooth ${repoOwner}/${repoName}...`);

  const releases = await getReleases(octokit, repoOwner, repoName);

  if (releases.length === 0) {
    return;
  }

  const latestVersion =
      findLatestVersion(releases.map(release => release.version));
  const firstVersion =
      findFirstVersion(releases.map(release => release.version));
  const firstVersionReleasedAt =
      releases.find(release => semver.eq(release.version, firstVersion))
          ?.releaseTime;

  assert(firstVersionReleasedAt !== undefined);

  for (const release of releases) {
    try {
      await fetchVersion(
          octokit,
          toothVersionModel,
          repoOwner,
          repoName,
          release.version,
          {
            isLatest: semver.eq(release.version, latestVersion),
            releasedAt: release.releaseTime,
          },
      );

    } catch (err) {
      assert(err instanceof Error);
      consola.error(`failed to fetch version ${repoOwner}/${repoName}@${
          release.version.version}: ${err.message}`);
    }
  }

  consola.log(`fetched tooth ${repoOwner}/${repoName}`);
}

async function fetchVersion(
    octokit: Octokit,
    toothVersionModel: ReturnType<typeof createToothVersionModel>,
    repoOwner: string,
    repoName: string,
    version: SemVer,
    info: {
      isLatest: boolean,
      releasedAt: Date,
    },
) {
  consola.log(
      `fetching version ${repoOwner}/${repoName}@${version.version}...`);

  const metadata =
      await getMetadata(repoOwner, repoName, version).catch(err => {
        assert(err instanceof Error);
        throw new Error(`failed to fetch metadata: ${err.message}`);
      });

  const repoInfo = await getRepository(octokit, repoOwner, repoName);

  await toothVersionModel.upsert({
    repoOwner,
    repoName,
    version: version.version,
    isLatest: info.isLatest,
    releasedAt: info.releasedAt,
    name: metadata.name,
    description: metadata.description,
    author: metadata.author,
    tags: metadata.tags,
    avatarUrl: metadata.avatarUrl,
    repoCreatedAt: repoInfo.createdAt,
    starCount: repoInfo.starCount,
    updatedAt: new Date(),
  });

  consola.log(`fetched version ${repoOwner}/${repoName}@${version.version}`);
}

function findFirstVersion(versions: SemVer[]): SemVer {
  if (versions.length === 0) {
    throw new Error('no versions');
  }

  const sortedVersions = semver.rsort(versions);

  return sortedVersions[0];
}

function findLatestVersion(versions: SemVer[]): SemVer {
  if (versions.length === 0) {
    throw new Error('no versions');
  }

  const sortedVersions = semver.rsort(versions);

  // First try to find a stable version.
  const stableVersions = sortedVersions.filter(
      version => {return version.prerelease.length === 0});
  if (stableVersions.length > 0) {
    return stableVersions[0];
  }

  // Otherwise, return the latest prerelease version.
  return sortedVersions[0];
}

async function getMetadata(
    repoOwner: string, repoName: string, version: SemVer): Promise<Metadata> {
  const response = await fetch(`https://raw.githubusercontent.com/${
      repoOwner}/${repoName}/v${version.version}/tooth.json`);

  if (response.status !== 200) {
    throw new Error(`failed to fetch tooth.json: ${response.statusText}`);
  }

  const json = await response.json();

  return new Metadata(json as RawMetadata);
}

async function getTeeth(octokit: Octokit):
    Promise<Array<{repoOwner: string, repoName: string}>> {
  // Search GitHub for teeth.
  const teeth: Array<{repoOwner: string, repoName: string}> = [];
  let isLastPage = false;
  let page = 1;
  while (isLastPage === false) {
    const response = await octokit.rest.search.code({
      q: 'path:tooth.json+"format_version"+2+"tooth"+"version"+"info"+"name"+"description"+"author"+"tags"',
      per_page: 100,
      page,
    });

    isLastPage = !response.data.incomplete_results;

    for (const item of response.data.items) {
      teeth.push({
        repoOwner: item.repository.owner.login,
        repoName: item.repository.name,
      });
    }

    page++;
  }

  return teeth;
}

async function getReleases(
    octokit: Octokit, repoOwner: string, repoName: string): Promise<Array<{
  version: SemVer,
  releaseTime: Date,
}>> {
  const releases: Array<{
    version: SemVer,
    releaseTime: Date,
  }> = [];
  let isLastPage = false;
  let page = 1;
  while (isLastPage === false) {
    const response = await octokit.rest.repos.listReleases({
      owner: repoOwner,
      repo: repoName,
      per_page: 100,
      page,
    });

    if (response.data.length === 0) {
      isLastPage = true;
    }

    for (const item of response.data) {
      try {
        const version = makeVersionFromTag(item.tag_name);
        releases.push(
            {version: version, releaseTime: new Date(item.created_at)});

      } catch (err) {
        assert(err instanceof Error);
        consola.error(`failed to parse version ${repoOwner}/${repoName}@${
            item.tag_name}: ${err.message}`);
      }
    }

    page++;
  }

  return releases;
}

async function getRepository(
    octokit: Octokit, repoOwner: string, repoName: string): Promise<{
  starCount: number,
  createdAt: Date,
}> {
  const response = await octokit.rest.repos.get({
    owner: repoOwner,
    repo: repoName,
  });

  return {
    starCount: response.data.stargazers_count,
    createdAt: new Date(response.data.created_at),
  };
}

export function makeVersionFromTag(tag: string): SemVer {
  // Tag must has a leading 'v'.
  if (!tag.startsWith('v')) {
    throw new Error(`invalid tag: ${tag}`);
  }

  return new SemVer(tag.replace(/^v/, ''));
}

async function removeStaleEntries(
    toothVersionModel: ReturnType<typeof createToothVersionModel>,
    expire: number) {
  consola.log('removing stale entries...');

  await toothVersionModel.destroy({
    where: {
      updatedAt: {
        [sequelize.Op.lt]: new Date(Date.now() - expire * 1000),
      },
    },
  });

  consola.log('removed stale entries');
}

async function runJobs(
    octokit: Octokit,
    toothVersionModel: ReturnType<typeof createToothVersionModel>,
    expire: number) {
  try {
    await fetchTeeth(octokit, toothVersionModel);

  } catch (err) {
    assert(err instanceof Error);
    consola.error(`failed to fetch teeth: ${err.message}`)
  }

  try {
    await removeStaleEntries(toothVersionModel, expire);

  } catch (err) {
    assert(err instanceof Error);
    consola.error(`failed to remove stale entries: ${err.message}`)
  }
}
