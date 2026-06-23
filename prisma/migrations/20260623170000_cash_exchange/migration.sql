-- AlterEnum
ALTER TYPE "CashTxnType" ADD VALUE 'EXCHANGE';

-- AlterTable
ALTER TABLE "CashTransaction" ADD COLUMN     "toAmount" DECIMAL(18,2),
ADD COLUMN     "toCurrency" TEXT;
