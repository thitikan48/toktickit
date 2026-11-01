# Lab 4 AI Use and Reflection

**LLM/agent used:** Claude was used throughout the lab to plan the Issues, guide the development process, create and check the documentation, and write and review the code.

## Selected key prompts (6–10)
| # | Prompt (summarised) | What I did with the result |
|---|---------------------|----------------------------|
| 1 | Guide me through Lab 4 step by step. What do I need to build, and what should I do first? | I followed the steps one Issue at a time and checked each part against the lab sheet myself. I used the lab sheet as the main reference whenever there were additional details or Issues beyond its requirements. |
| 2 | Check the four docs against the lab sheet one requirement at a time. List what is missing or extra. Do not change any file. | I added the missing items. It called the Dashboard as first page and the Refresh button extras, but they are in the mockups on pages 5 and 6, so I kept them. |
| 3 | Issue2: write the tests first, then add the migration, seed, and Actions Taken API. Use the test database. Do not edit Lab 1 to 3 tests. | I ran npm test myself and it timed out in beforeAll, so I sent the error back and the hook timeout was raised. Then I ran the tests again until they all passed. |
| 4 | Check the Actions Taken screen against the UI spec. Which fields should be read-only? Fix only what does not match and add a test for each fix. | It found two places that did not match. I read the fixes and checked the new tests passed before committing. |
| 5 | Check Issue 4 against the docs (gate, status history, stale update, migration, test IDs). Only report, do not change anything yet. | It said a new migration was missing, but the Issue #2 migration already had those columns and the spec says one migration, so I kept it and only asked for two small test fixes. |
| 6 | Isn't there a dashboard for managing users? | The AI said the lab sheet only asks for a Requester dashboard and an IT Staff dashboard. I checked the lab sheet again myself and it was right, so I did not add a user dashboard. Admin still manages users from the User Management page from Lab 3. |
| 7 | Check all of Lab 4 against every acceptance criterion and test ID. Run all tests and list missing tests, failing tests, and why any Lab 1 to 3 test fails. Do not change anything yet. | I reviewed the report and checked the results myself to make sure everything was correct. |

## Reflection
My prompts got better when they were short, tied to one Issue, pointed to exact parts of the spec, and asked the agent to report before fixing. One place I had to reject the agent's suggestion was when it called the Dashboard as first page an extra requirement; I checked the mockups in the lab sheet and kept it.