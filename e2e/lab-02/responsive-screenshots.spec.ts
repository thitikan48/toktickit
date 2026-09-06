import {
    expect,
    test,
} from "@playwright/test";

import {
    mkdir,
} from "fs/promises";

import path from "path";

import {
    getPrisma,
} from "../../server/src/prisma.js";

const prisma = getPrisma();

const viewports = [
    {
        name: "desktop",
        width: 1440,
        height: 900,
    },
    {
        name: "tablet",
        width: 768,
        height: 1024,
    },
    {
        name: "mobile",
        width: 375,
        height: 812,
    },
];

for (const viewport of viewports) {
    test(
        `captures Lab 2 screens at ${viewport.name} viewport`,
        async ({ page }) => {
            let createdTicketNumber:
                | string
                | null = null;

            try {
                await page.setViewportSize({
                    width: viewport.width,
                    height: viewport.height,
                });

                await mkdir(
                    path.resolve(
                        process.cwd(),
                        "artifacts",
                        "lab-02",
                        "screenshots",
                        "create-ticket"
                    ),
                    {
                        recursive: true,
                    }
                );

                await mkdir(
                    path.resolve(
                        process.cwd(),
                        "artifacts",
                        "lab-02",
                        "screenshots",
                        "my-tickets"
                    ),
                    {
                        recursive: true,
                    }
                );

                await mkdir(
                    path.resolve(
                        process.cwd(),
                        "artifacts",
                        "lab-02",
                        "screenshots",
                        "ticket-detail"
                    ),
                    {
                        recursive: true,
                    }
                );

                /*
                 * Select a Development Requester.
                 */
                await page.goto("/");

                const requesterSelect =
                    page.getByLabel(
                        /development requester/i
                    );

                await expect(
                    requesterSelect
                ).toBeVisible();

                const options =
                    await requesterSelect
                        .locator("option")
                        .all();

                expect(
                    options.length
                ).toBeGreaterThan(1);

                const requesterValue =
                    await options[1].getAttribute(
                        "value"
                    );

                expect(
                    requesterValue
                ).not.toBeNull();

                await requesterSelect.selectOption(
                    requesterValue!
                );

                await page
                    .getByRole(
                        "button",
                        {
                            name: /continue/i,
                        }
                    )
                    .click();

                /*
                 * --------------------------------
                 * 1. CREATE TICKET
                 * --------------------------------
                 */
                await page
                    .getByRole(
                        "button",
                        {
                            name: /create ticket/i,
                        }
                    )
                    .click();

                await expect(
                    page.getByRole(
                        "heading",
                        {
                            name: /create ticket/i,
                        }
                    )
                ).toBeVisible();

                await page.screenshot({
                    path: path.resolve(
                        process.cwd(),
                        "artifacts",
                        "lab-02",
                        "screenshots",
                        "create-ticket",
                        `${viewport.name}-playwright.png`
                    ),
                    fullPage: true,
                });

                /*
                 * Create a temporary Ticket.
                 */
                await page
                    .getByLabel(
                        /category/i
                    )
                    .selectOption({
                        index: 1,
                    });

                await page
                    .getByLabel(
                        /related system/i
                    )
                    .selectOption({
                        index: 1,
                    });

                await page
                    .getByLabel(
                        /requested priority/i
                    )
                    .selectOption(
                        "MEDIUM"
                    );

                const uniqueSummary =
                    `Responsive screenshot ${viewport.name} ${Date.now()}`;

                await page
                    .getByLabel(
                        /ticket summary/i
                    )
                    .fill(
                        uniqueSummary
                    );

                await page
                    .getByLabel(
                        /description/i
                    )
                    .fill(
                        "This Ticket is created temporarily for responsive Playwright screenshot evidence."
                    );

                await page
                    .getByRole(
                        "button",
                        {
                            name: /submit ticket/i,
                        }
                    )
                    .click();

                const successMessage =
                    page.getByRole("status");

                await expect(
                    successMessage
                ).toContainText(
                    /ticket created successfully/i
                );

                const successText =
                    await successMessage.innerText();

                const ticketNumberMatch =
                    successText.match(
                        /TKT-\d{4}-\d{6}/
                    );

                expect(
                    ticketNumberMatch
                ).not.toBeNull();

                createdTicketNumber =
                    ticketNumberMatch![0];

                /*
                 * --------------------------------
                 * 2. MY TICKETS
                 * --------------------------------
                 */
                await page
                    .getByRole(
                        "button",
                        {
                            name: /my tickets/i,
                        }
                    )
                    .click();

                await expect(
                    page.getByRole(
                        "heading",
                        {
                            name: /my tickets/i,
                        }
                    )
                ).toBeVisible();

                /*
                 * Desktop/Tablet display the table.
                 * Mobile displays Ticket cards.
                 */
                if (
                    viewport.width >= 768
                ) {
                    const ticketRow =
                        page
                            .getByRole("row")
                            .filter({
                                hasText:
                                    createdTicketNumber,
                            });

                    await expect(
                        ticketRow
                    ).toBeVisible();
                } else {
                    const ticketCard =
                        page
                            .locator(
                                ".d-md-none .card"
                            )
                            .filter({
                                hasText:
                                    createdTicketNumber,
                            });

                    await expect(
                        ticketCard
                    ).toBeVisible();
                }

                await page.screenshot({
                    path: path.resolve(
                        process.cwd(),
                        "artifacts",
                        "lab-02",
                        "screenshots",
                        "my-tickets",
                        `${viewport.name}-playwright.png`
                    ),
                    fullPage: true,
                });

                /*
                 * --------------------------------
                 * 3. TICKET DETAIL
                 * --------------------------------
                 */
                if (
                    viewport.width >= 768
                ) {
                    const ticketRow =
                        page
                            .getByRole("row")
                            .filter({
                                hasText:
                                    createdTicketNumber,
                            });

                    await ticketRow
                        .getByRole(
                            "button",
                            {
                                name: /^open$/i,
                            }
                        )
                        .click();
                } else {
                    const ticketCard =
                        page
                            .locator(
                                ".d-md-none .card"
                            )
                            .filter({
                                hasText:
                                    createdTicketNumber,
                            });

                    await ticketCard
                        .getByRole(
                            "button",
                            {
                                name: /^open$/i,
                            }
                        )
                        .click();
                }

                /*
                 * Ticket Number can also exist
                 * in hidden responsive elements,
                 * so locate visible Ticket Detail
                 * content instead of using first().
                 */
                await expect(
                    page.getByRole(
                        "heading",
                        {
                            name:
                                createdTicketNumber,
                        }
                    )
                ).toBeVisible();

                await expect(
                    page.getByRole(
                        "heading",
                        {
                            name: /attachments/i,
                        }
                    )
                ).toBeVisible();

                await page.screenshot({
                    path: path.resolve(
                        process.cwd(),
                        "artifacts",
                        "lab-02",
                        "screenshots",
                        "ticket-detail",
                        `${viewport.name}-playwright.png`
                    ),
                    fullPage: true,
                });
            } finally {
                /*
                 * Remove only the temporary
                 * Ticket created by this test.
                 */
                if (
                    createdTicketNumber
                ) {
                    await prisma.ticket.deleteMany({
                        where: {
                            ticketNumber:
                                createdTicketNumber,
                        },
                    });
                }
            }
        }
    );
}