export type CashCloseSummary = {
  totalSales: number;
  openingAmount: number;
  cashSalesAmount: number;
  totalCashInDrawer: number;
  totalTransferSales: number;
};

export type CashSession = {
  id: string;
  openedAt: string;
  closedAt?: string;
  openingAmount: number;
  closeSummary?: CashCloseSummary;
};

export type CashCloseReceipt = {
  sessionId: string;
  openedAt: string;
  closedAt: string;
  summary: CashCloseSummary;
};
