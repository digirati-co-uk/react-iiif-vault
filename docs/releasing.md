# Releasing react-iiif-vault

## Setup

Merge the workflows into the default branch. In GitHub **Settings → Actions →
General → Workflow permissions**, enable **Allow GitHub Actions to create and
approve pull requests**. The release PR workflow uses the built-in GitHub token;
no personal access token is needed.

The npm trusted publisher must authorize `digirati-co-uk/react-iiif-vault`,
workflow `release.yml`, no environment, with **Allow npm publish** enabled.

## Draft, review, release

1. Run **Actions → Create Release PR → Run workflow** on the default branch,
   choosing `patch`, `minor`, or `major`.
2. Review the draft PR from `release/next`. It changes only the package version
   and includes generated release notes. Re-running the workflow updates that
   same branch rather than opening another release PR.
3. Approve workflow runs if GitHub requests it on the bot-created PR. Mark the
   PR ready, wait for checks, and merge when ready to publish.
4. `release.yml` checks out the merge commit, builds and checks it, publishes
   through npm trusted publishing, then creates the matching `v<version>` tag
   and GitHub release with generated notes.

Only merged `release/next` PRs from this repository into its default branch
trigger automatic publishing. Closing without merging does not publish.

For an auth prerelease, edit the draft PR's package version to an unused version
such as `4.1.0-auth.0` before merging. Prereleases publish under `next` and GitHub
marks their releases as prereleases. Stable versions publish under `latest`.

You can also push a `v<version>` tag manually, provided it matches package.json.
The workflow runs the same checks and publishing steps. Do not manually push
another tag while a release is running.

Publishing and automatic tagging happen in the same workflow: tags created with
`GITHUB_TOKEN` do not trigger another tag-push workflow, and no additional npm
trusted publisher is needed for `create-release-pr.yml`.

## Failed releases

If checks or publishing fail, no automatic tag or GitHub release is created.
Fix the failure before retrying. If npm publishing succeeds but GitHub release
creation fails, create the missing GitHub release/tag at the workflow's exact
commit; do not republish the same npm version. A version already published to
npm cannot be overwritten.
