import { inspect } from "util";
import * as core from "@actions/core";
import { stripIndents } from "common-tags";
import * as github from "@actions/github";


async function run(): Promise<void> {
  try {
    const inputs = {
      token: core.getInput("token"),
      title: core.getInput("title", { required: true }),
      body: core.getInput("body", { required: true }),
    };
    core.debug(`Inputs: ${inspect(inputs)}`);
    
    const octokit = github.getOctokit(inputs.token).rest;
    const context = github.context;

    const buildCommentBody = ({
      title,
      body,
    }: {
      title: string;
      body: string;
    }) => {
      return stripIndents`
          ${title}
          ${body}
        `;
    };

    const findPreviousComment = async (title: string) => {
      if (!octokit) {
        return null;
      }
      const { data: comments } = await octokit.issues.listComments({
        ...context.repo,
        issue_number: context.issue.number,
      });
      core.info(`Comments found: ${inspect(comments)}`);

      const upsertActionComment = comments.find((comment) =>
        comment.body?.startsWith(title)
      );
      if (upsertActionComment) {
        core.info("previous comment found");
        return upsertActionComment.id;
      }
      core.info("previous comment not found");
      return null;
    };

    const createCommentOnPullRequest = async (data: {
      title: string;
      body: string;
    }) => {
      const commentId = await findPreviousComment(data.title);
      const commentBody = buildCommentBody(data);

      if (commentId) {
        await octokit.issues.updateComment({
          ...context.repo,
          comment_id: commentId,
          body: commentBody,
        });
      } else {
        await octokit.issues.createComment({
          ...context.repo,
          issue_number: context.issue.number,
          body: commentBody,
        });
      }
    };

    createCommentOnPullRequest(inputs);
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
