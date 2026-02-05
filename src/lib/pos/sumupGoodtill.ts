import 'server-only';

export type SumupGoodtillConfig = {
  clientId: string;
  clientSecret: string;
  merchantId: string;
};

export const getSumupGoodtillConfig = (): SumupGoodtillConfig => {
  const clientId = process.env.SUMUP_CLIENT_ID;
  const clientSecret = process.env.SUMUP_CLIENT_SECRET;
  const merchantId = process.env.SUMUP_MERCHANT_ID;

  if (!clientId || !clientSecret || !merchantId) {
    throw new Error('SumUp configuration missing.');
  }

  return { clientId, clientSecret, merchantId };
};

export const fetchSumupGoodtillSales = async () => {
  throw new Error('TODO: Implement SumUp Goodtill sales fetch.');
};
