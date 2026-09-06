import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import {
  render,
  screen,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AttachmentSection from "../../src/AttachmentSection.js";
import * as api from "../../src/api.js";

beforeEach(() => {
  vi.restoreAllMocks();

  vi.spyOn(
    api,
    "getAttachments"
  ).mockResolvedValue([]);
});

describe(
  "Attachment Section",
  () => {
    it(
      "rejects an unsupported file before upload",
      async () => {
        const user =
          userEvent.setup({
            applyAccept: false,
          });

        const uploadSpy =
          vi.spyOn(
            api,
            "uploadAttachment"
          );

        render(
          <AttachmentSection
            ticketId={1}
            requesterId={1}
          />
        );

        await screen.findByText(
          /no attachments uploaded/i
        );

        const file =
          new File(
            ["bad"],
            "malware.exe",
            {
              type:
                "application/octet-stream",
            }
          );

        await user.upload(
          screen.getByLabelText(
            /add attachment/i
          ),
          file
        );

        expect(
          await screen.findByRole(
            "alert"
          )
        ).toHaveTextContent(
          "Only JPG, PNG, WEBP, and PDF files are allowed."
        );

        expect(
          uploadSpy
        ).not.toHaveBeenCalled();
      }
    );

    it(
      "uploads a valid file to the selected ticket",
      async () => {
        const uploadSpy =
          vi.spyOn(
            api,
            "uploadAttachment"
          ).mockResolvedValue({
            id: 11,
            ticketId: 1,
            originalName:
              "diagnostic.pdf",
            mimeType:
              "application/pdf",
            sizeBytes: 1200,
            isRemoved: false,
            removalReason: null,
            removedAt: null,
            createdAt:
              "2026-09-06T03:00:00.000Z",
          });

        render(
          <AttachmentSection
            ticketId={1}
            requesterId={1}
          />
        );

        await screen.findByText(
          /no attachments uploaded/i
        );

        const file =
          new File(
            ["pdf"],
            "diagnostic.pdf",
            {
              type:
                "application/pdf",
            }
          );

        await userEvent.upload(
          screen.getByLabelText(
            /add attachment/i
          ),
          file
        );

        expect(
          await screen.findByText(
            "diagnostic.pdf"
          )
        ).toBeInTheDocument();

        expect(
          uploadSpy
        ).toHaveBeenCalledWith(
          1,
          1,
          file
        );
      }
    );

    it(
      "soft-removes an attachment with a reason",
      async () => {
        vi.spyOn(
          api,
          "getAttachments"
        ).mockResolvedValue([
          {
            id: 5,
            ticketId: 1,
            originalName:
              "old-photo.png",
            mimeType:
              "image/png",
            sizeBytes: 2048,
            isRemoved: false,
            removalReason: null,
            removedAt: null,
            createdAt:
              "2026-09-06T03:00:00.000Z",
          },
        ]);

        const removeSpy =
          vi.spyOn(
            api,
            "removeAttachment"
          ).mockResolvedValue({
            id: 5,
            ticketId: 1,
            originalName:
              "old-photo.png",
            mimeType:
              "image/png",
            sizeBytes: 2048,
            isRemoved: true,
            removalReason:
              "Wrong file",
            removedAt:
              "2026-09-06T03:05:00.000Z",
            createdAt:
              "2026-09-06T03:00:00.000Z",
          });

        render(
          <AttachmentSection
            ticketId={1}
            requesterId={1}
          />
        );

        await userEvent.click(
          await screen.findByRole(
            "button",
            {
              name: /^remove$/i,
            }
          )
        );

        await userEvent.type(
          screen.getByLabelText(
            /removal reason/i
          ),
          "Wrong file"
        );

        await userEvent.click(
          screen.getByRole(
            "button",
            {
              name:
                /confirm removal/i,
            }
          )
        );

        expect(
          removeSpy
        ).toHaveBeenCalledWith(
          5,
          1,
          "Wrong file"
        );

        expect(
          await screen.findByText(
            "Removed"
          )
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            /Reason:\s*Wrong file/i
          )
        ).toBeInTheDocument();

        expect(
          screen.queryByRole(
            "link",
            {
              name:
                /download/i,
            }
          )
        ).not.toBeInTheDocument();
      }
    );

    it(
      "requires a non-empty removal reason",
      async () => {
        vi.spyOn(
          api,
          "getAttachments"
        ).mockResolvedValue([
          {
            id: 5,
            ticketId: 1,
            originalName:
              "old-photo.png",
            mimeType:
              "image/png",
            sizeBytes: 2048,
            isRemoved: false,
            removalReason: null,
            removedAt: null,
            createdAt:
              "2026-09-06T03:00:00.000Z",
          },
        ]);

        const removeSpy =
          vi.spyOn(
            api,
            "removeAttachment"
          );

        render(
          <AttachmentSection
            ticketId={1}
            requesterId={1}
          />
        );

        await userEvent.click(
          await screen.findByRole(
            "button",
            {
              name: /^remove$/i,
            }
          )
        );

        await userEvent.click(
          screen.getByRole(
            "button",
            {
              name:
                /confirm removal/i,
            }
          )
        );

        expect(
          screen.getByText(
            "Removal reason is required."
          )
        ).toBeInTheDocument();

        expect(
          removeSpy
        ).not.toHaveBeenCalled();
      }
    );

    it(
      "allows a short non-empty removal reason",
      async () => {
        vi.spyOn(
          api,
          "getAttachments"
        ).mockResolvedValue([
          {
            id: 5,
            ticketId: 1,
            originalName:
              "old-photo.png",
            mimeType:
              "image/png",
            sizeBytes: 2048,
            isRemoved: false,
            removalReason: null,
            removedAt: null,
            createdAt:
              "2026-09-06T03:00:00.000Z",
          },
        ]);

        const removeSpy =
          vi.spyOn(
            api,
            "removeAttachment"
          ).mockResolvedValue({
            id: 5,
            ticketId: 1,
            originalName:
              "old-photo.png",
            mimeType:
              "image/png",
            sizeBytes: 2048,
            isRemoved: true,
            removalReason: "bad",
            removedAt:
              "2026-09-06T03:05:00.000Z",
            createdAt:
              "2026-09-06T03:00:00.000Z",
          });

        render(
          <AttachmentSection
            ticketId={1}
            requesterId={1}
          />
        );

        await userEvent.click(
          await screen.findByRole(
            "button",
            {
              name: /^remove$/i,
            }
          )
        );

        await userEvent.type(
          screen.getByLabelText(
            /removal reason/i
          ),
          "bad"
        );

        await userEvent.click(
          screen.getByRole(
            "button",
            {
              name:
                /confirm removal/i,
            }
          )
        );

        expect(
          removeSpy
        ).toHaveBeenCalledWith(
          5,
          1,
          "bad"
        );
      }
    );
  }
);