from collections import defaultdict


def reciprocal_rank_fusion(results_lists, k=60):

    fused_scores = defaultdict(float)
    documents = {}

    for results in results_lists:

        for rank, result in enumerate(results):

            text = result["text"]

            documents[text] = result

            fused_scores[text] += 1 / (k + rank + 1)

    reranked = sorted(
        fused_scores.items(),
        key=lambda x: x[1],
        reverse=True
    )

    final_results = []

    for text, score in reranked:

        result = documents[text]

        result["rrf_score"] = score

        final_results.append(result)

    return final_results