-- CreateEnum
CREATE TYPE "ActionStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN     "resolvedAt" TIMESTAMP(3),
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "ActionTaken" (
    "id" SERIAL NOT NULL,
    "ticketId" INTEGER NOT NULL,
    "actionAt" TIMESTAMP(3) NOT NULL,
    "description" VARCHAR(1000) NOT NULL,
    "result" VARCHAR(1000),
    "status" "ActionStatus" NOT NULL DEFAULT 'PLANNED',
    "assignedToId" INTEGER NOT NULL,
    "performedById" INTEGER,
    "followUpRequired" BOOLEAN NOT NULL DEFAULT false,
    "followUpNote" VARCHAR(1000),
    "attachmentNotes" VARCHAR(500),
    "createdById" INTEGER NOT NULL,
    "updatedById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActionTaken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketStatusHistory" (
    "id" SERIAL NOT NULL,
    "ticketId" INTEGER NOT NULL,
    "fromStatus" "TicketStatus" NOT NULL,
    "toStatus" "TicketStatus" NOT NULL,
    "changedById" INTEGER NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ActionTaken_ticketId_actionAt_idx" ON "ActionTaken"("ticketId", "actionAt");

-- CreateIndex
CREATE INDEX "ActionTaken_assignedToId_status_idx" ON "ActionTaken"("assignedToId", "status");

-- CreateIndex
CREATE INDEX "TicketStatusHistory_ticketId_changedAt_idx" ON "TicketStatusHistory"("ticketId", "changedAt");

-- CreateIndex
CREATE INDEX "Ticket_resolvedAt_idx" ON "Ticket"("resolvedAt");

-- AddForeignKey
ALTER TABLE "ActionTaken" ADD CONSTRAINT "ActionTaken_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionTaken" ADD CONSTRAINT "ActionTaken_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionTaken" ADD CONSTRAINT "ActionTaken_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionTaken" ADD CONSTRAINT "ActionTaken_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionTaken" ADD CONSTRAINT "ActionTaken_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketStatusHistory" ADD CONSTRAINT "TicketStatusHistory_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketStatusHistory" ADD CONSTRAINT "TicketStatusHistory_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

