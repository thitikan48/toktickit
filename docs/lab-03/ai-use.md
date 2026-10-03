# Lab 3 — AI Use and Reflection

**LLM used:** Claude, to help draft the documents, step-by-step guidance, and check the work against the Lab 3 sheet.

## Selected key prompts

| # | Prompt (summarised) | What I did with the result |
|---|---------------------|----------------------------|
| 1 | Follow the Lab 3 sheet and don't do more than it asks. Start with the first Issue: the specification, UI, API, and test documents. | I read the drafts and used them as the plan for the rest of the lab. |
| 2 | Keep the documents simple and don't add requirements the sheet doesn't ask for. | The first drafts were too long, so I asked for shorter ones and checked that nothing extra was in them. |
| 3 | Decide the things the sheet leaves open, and keep them simple. | I looked at each choice before accepting it, for example a session cookie instead of JWT. |
| 4 | Do one step at a time and explain what and why before moving on. | I went through each step before the next one, so I understood the login and the permission rules. |
| 5 | The instructor said tests shouldn't create data just to pass. The seed creates the data, not the tests. | I had the tests changed to use the seeded accounts and to put back anything they changed. |
| 6 | Check everything again. Is anything left to fix? | I asked this many times. It found real problems, like IT Staff being able to use Requester endpoints. |

## My Reflection

My prompts got better when I gave the agent the requirements first (follow the lab sheet, add nothing extra) and asked it to work one small step at a time and explain why. I had to reject its first tests because they created their own users just to pass. I corrected this by specifying that the seed should create the data and the tests should not create users themselves.

