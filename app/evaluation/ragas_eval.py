from datasets import Dataset

from app.data.evaluation_dataset import evaluation_data

from app.rag_pipeline import ask


questions = []
answers = []
contexts = []
ground_truths = []


for item in evaluation_data:

    query = item["question"]

    result = ask(query)

    questions.append(query)

    answers.append(result["answer"])

    contexts.append([
        doc["text"] for doc in result["sources"]
    ])

    ground_truths.append(
        item["ground_truth"]
    )


dataset = Dataset.from_dict({
    "question": questions,
    "answer": answers,
    "contexts": contexts,
    "ground_truth": ground_truths
})


print("\nDATASET CREATED SUCCESSFULLY\n")

for i in range(len(questions)):

    print("=" * 80)

    print(f"\nQUESTION:\n{questions[i]}")

    print(f"\nGROUND TRUTH:\n{ground_truths[i]}")

    print(f"\nGENERATED ANSWER:\n{answers[i]}")

    print("\nRETRIEVED CONTEXTS:\n")

    for context in contexts[i]:

        print(context[:300])

        print("\n" + "-" * 50)


print("\nFINAL DATASET:\n")

print(dataset)