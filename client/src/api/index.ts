import { AuthApi, ProductsApi, OrdersApi, TradeInsApi, UsersApi, VouchersApi, SiteConfigsApi, PaymentsApi } from './generated';
import { apiConfig, axiosInstance } from '../lib/axios';
import { noticeApi, adminApi, authManualApi, cartApi, eventApi, faqApi, inquiryApi } from './manual';

export const authApi = new AuthApi(apiConfig, undefined, axiosInstance);
export const productsApi = new ProductsApi(apiConfig, undefined, axiosInstance);
export const ordersApi = new OrdersApi(apiConfig, undefined, axiosInstance);
export const tradeInApi = new TradeInsApi(apiConfig, undefined, axiosInstance);
export const usersApi = new UsersApi(apiConfig, undefined, axiosInstance);
export const vouchersApi = new VouchersApi(apiConfig, undefined, axiosInstance);
export const siteConfigApi = new SiteConfigsApi(apiConfig, undefined, axiosInstance);
export const paymentsApi = new PaymentsApi(apiConfig, undefined, axiosInstance);

export { noticeApi, adminApi, authManualApi, cartApi, eventApi, faqApi, inquiryApi };
export { webauthnApi, businessInquiryApi, contentAttachmentApi } from './manual';
