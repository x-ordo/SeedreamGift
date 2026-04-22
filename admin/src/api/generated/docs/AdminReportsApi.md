# AdminReportsApi

All URIs are relative to *http://localhost:5140/api/v1*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**adminReportsBankTransactionsGet**](#adminreportsbanktransactionsget) | **GET** /admin/reports/bank-transactions | 은행 거래 내역 리포트 조회|
|[**adminReportsTradeInPayoutsGet**](#adminreportstradeinpayoutsget) | **GET** /admin/reports/trade-in-payouts | 매입 지급 리포트 조회|
|[**adminReportsUserTransactionsUserIdGet**](#adminreportsusertransactionsuseridget) | **GET** /admin/reports/user-transactions/{userId} | 회원 거래 내역 내보내기|

# **adminReportsBankTransactionsGet**
> InternalApiHandlersAPIResponse adminReportsBankTransactionsGet()


### Example

```typescript
import {
    AdminReportsApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AdminReportsApi(configuration);

const { status, data } = await apiInstance.adminReportsBankTransactionsGet();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**InternalApiHandlersAPIResponse**

### Authorization

[BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | OK |  -  |
|**500** | Internal Server Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **adminReportsTradeInPayoutsGet**
> InternalApiHandlersAPIResponse adminReportsTradeInPayoutsGet()


### Example

```typescript
import {
    AdminReportsApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AdminReportsApi(configuration);

const { status, data } = await apiInstance.adminReportsTradeInPayoutsGet();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**InternalApiHandlersAPIResponse**

### Authorization

[BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | OK |  -  |
|**500** | Internal Server Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **adminReportsUserTransactionsUserIdGet**
> InternalApiHandlersAPIResponse adminReportsUserTransactionsUserIdGet()


### Example

```typescript
import {
    AdminReportsApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AdminReportsApi(configuration);

let userId: number; //회원 ID (default to undefined)

const { status, data } = await apiInstance.adminReportsUserTransactionsUserIdGet(
    userId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **userId** | [**number**] | 회원 ID | defaults to undefined|


### Return type

**InternalApiHandlersAPIResponse**

### Authorization

[BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | OK |  -  |
|**400** | Bad Request |  -  |
|**500** | Internal Server Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

