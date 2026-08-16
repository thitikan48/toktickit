# Lab 1 — AI Use and Reflection  (fill this in)

**LLM/agent used:** ChatGPT for step-by-step guidance and debugging support.

## Selected key prompts (6–10)
| # | Prompt (summarised) | What I did with the result |
|---|---------------------|----------------------------|
| 1 | Explain the Lab 1 Git and GitHub workflow and guide me through the correct order of the four Issues. | I used the workflow to create the branches, Project statuses, and Pull Requests in the required order. |
| 2 | Check the Issue 1 requirements and help me verify whether the starter scaffold is ready. | I inspected the project, installed dependencies, ran the frontend and backend, checked PostgreSQL and Prisma, and updated the README. |
| 3 | The Check System button stays on Loading. Help me identify the problem from my current code. | I shared the current source code, corrected the API call and UI state handling, and tested the Online and Offline cases again. |
| 4 | Explain the difference between `git switch -c` and `git checkout -b` because the Lab sheet uses `-b`. | I learned why both commands can create a branch and checked the branch after running the command. |
| 5 | How to make the Prisma category seed safe to run multiple times. | I used `upsert` and ran the seed twice to verify that duplicate categories were not created. |
| 6 | Prisma reports migration drift. What does it mean and what should I check? | I checked the local migration state before continuing and then recreated the development migration for the new project. |
| 7 | Review my category API and test output against the Issue 4 acceptance criteria. | I completed the API and UI tests, ran them locally, and checked that the required success and error cases passed. |

## Reflection

My prompts became better when I focused on one Issue at a time, included the current terminal output, error message, or source code, and asked about commands I did not understand instead of just copying them. For example, I asked about the difference between git switch -c and git checkout -b because the Lab sheet used -b. This helped me understand that both commands can create a new branch, but they use different Git syntax. I then ran the commands myself and checked the result before continuing.
