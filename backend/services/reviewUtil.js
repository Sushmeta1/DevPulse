/**
 * Review semantics, shared by the real GitHub client and the demo generator so both mean the same thing.
 *
 * A "review" is a submitted pull request review (approval, change request or review comment) by someone
 * other than the author. Plain issue comments are not reviews. Bots (dependabot, copilot, CI) never count
 * as the first human review and never count towards reviewer load.
 */

/** Keeps only reviews that mean something: submitted, by a different person. */
function cleanReviews(reviews, authorLogin) {
  return (reviews || [])
    .filter((r) => r && r.reviewer_login && r.submitted_at && r.state !== 'PENDING' && r.reviewer_login !== authorLogin)
    .sort((a, b) => new Date(a.submitted_at) - new Date(b.submitted_at));
}

/** First human review time/author and the review count for one pull request. */
function deriveReviewFields(pr) {
  const reviews = cleanReviews(pr.reviews, pr.author_login);
  const first = reviews.find((r) => !r.is_bot && new Date(r.submitted_at) >= new Date(pr.created_at));
  return {
    reviews,
    first_review_at: first ? first.submitted_at : null,
    first_reviewer: first ? first.reviewer_login : null,
    review_count: reviews.filter((r) => !r.is_bot).length,
  };
}

module.exports = { cleanReviews, deriveReviewFields };
