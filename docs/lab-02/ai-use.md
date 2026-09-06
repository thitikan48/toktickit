# Lab 2 — AI Use and Reflection

**LLM used:** ChatGPT for step-by-step guidance and debugging support.

## Selected key prompts (6–10)

| # | Prompt (summarised) | What I did with the result |
|---|---------------------|----------------------------|
| 1 | Can you guide me through Lab 2 and explain what needs to be done and how each part connects? | I used the explanation to understand the overall Lab 2 workflow before working through each feature step by step. |
| 2 | About how many Issues should Lab 2 be divided into, and what should each Issue cover? | I used the suggested breakdown to organize the Lab 2 work into separate feature branches and Pull Requests for specification, Requester context, Create Ticket, My Tickets, Ticket Detail, and Attachments. |
| 3 | My Tickets overflows on mobile. How can I fix it without affecting the desktop layout? | I changed the mobile layout to Ticket cards while keeping the table layout on larger screens. |
| 4 | How should I adjust the UI for Desktop, Tablet, and Mobile sizes to match the Lab 2 requirements? | I used the responsive breakpoints to check and adjust the layout for Desktop, Tablet, and Mobile without horizontal overflow. |
| 5 | My Playwright test fails because responsive elements cause duplicate text matches. How can I fix it? | I adjusted the locator and reran the E2E test until the Requester workflow passed. |
| 6 | Why does the test data remain in the database after every test run, and how should I fix it? | I checked which API test files created database records, added cleanup for the test-created data, and reran the tests to confirm the records were removed automatically. |

## My Reflection

My prompts improved a lot when I started giving the agent a specific role and asking for step-by-step guidance instead of asking for direct code. For example, asking the agent to act as a Senior Software Engineer helped me understand the Lab 2 workflow and check each step more clearly while I worked through the Issues myself. I still had to correct some suggestions when they did not match the behavior I wanted in my implementation.