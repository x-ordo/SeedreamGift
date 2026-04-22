# OrdersApi

All URIs are relative to *http://localhost:5140/api/v1*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**ordersIdCancelPost**](#ordersidcancelpost) | **POST** /orders/{id}/cancel | 주문 취소|
|[**ordersIdGet**](#ordersidget) | **GET** /orders/{id} | 주문 상세 조회|
|[**ordersMyBankSubmissionGet**](#ordersmybanksubmissionget) | **GET** /orders/my/bank-submission | 내 계좌 제출 내역 조회|
|[**ordersMyExportGet**](#ordersmyexportget) | **GET** /orders/my/export | 내 주문 내보내기|
|[**ordersMyGet**](#ordersmyget) | **GET** /orders/my | 내 주문 목록 조회|
|[**ordersPaymentConfirmPost**](#orderspaymentconfirmpost) | **POST** /orders/payment/confirm | 결제 확인 및 주문 처리|
|[**ordersPost**](#orderspost) | **POST** /orders | 주문 생성|

# **ordersIdCancelPost**
> InternalApiHandlersAPIResponse ordersIdCancelPost()


### Example

```typescript
import {
    OrdersApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new OrdersApi(configuration);

let id: number; //주문 ID (default to undefined)

const { status, data } = await apiInstance.ordersIdCancelPost(
    id
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **id** | [**number**] | 주문 ID | defaults to undefined|


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

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **ordersIdGet**
> InternalApiHandlersAPIResponse ordersIdGet()


### Example

```typescript
import {
    OrdersApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new OrdersApi(configuration);

let id: number; //주문 ID (default to undefined)

const { status, data } = await apiInstance.ordersIdGet(
    id
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **id** | [**number**] | 주문 ID | defaults to undefined|


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
|**404** | Not Found |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **ordersMyBankSubmissionGet**
> InternalApiHandlersAPIResponse ordersMyBankSubmissionGet()


### Example

```typescript
import {
    OrdersApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new OrdersApi(configuration);

const { status, data } = await apiInstance.ordersMyBankSubmissionGet();
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

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **ordersMyExportGet**
> InternalApiHandlersAPIResponse ordersMyExportGet()


### Example

```typescript
import {
    OrdersApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new OrdersApi(configuration);

const { status, data } = await apiInstance.ordersMyExportGet();
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

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **ordersMyGet**
> InternalApiHandlersAPIResponse ordersMyGet()


### Example

```typescript
import {
    OrdersApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new OrdersApi(configuration);

let page: number; //페이지 (optional) (default to 1)
let limit: number; //페이지당 항목 수 (optional) (default to 10)

const { status, data } = await apiInstance.ordersMyGet(
    page,
    limit
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **page** | [**number**] | 페이지 | (optional) defaults to 1|
| **limit** | [**number**] | 페이지당 항목 수 | (optional) defaults to 10|


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

# **ordersPaymentConfirmPost**
> InternalApiHandlersAPIResponse ordersPaymentConfirmPost(body)


### Example

```typescript
import {
    OrdersApi,
    Configuration,
    InternalApiHandlersPaymentConfirmRequest
} from './api';

const configuration = new Configuration();
const apiInstance = new OrdersApi(configuration);

let body: InternalApiHandlersPaymentConfirmRequest; //결제 확인 정보

const { status, data } = await apiInstance.ordersPaymentConfirmPost(
    body
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **body** | **InternalApiHandlersPaymentConfirmRequest**| 결제 확인 정보 | |


### Return type

**InternalApiHandlersAPIResponse**

### Authorization

[BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | OK |  -  |
|**400** | Bad Request |  -  |
|**500** | Internal Server Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **ordersPost**
> InternalApiHandlersAPIResponse ordersPost(body)


### Example

```typescript
import {
    OrdersApi,
    Configuration,
    WGiftServerInternalAppServicesCreateOrderInput
} from './api';

const configuration = new Configuration();
const apiInstance = new OrdersApi(configuration);

let body: WGiftServerInternalAppServicesCreateOrderInput; //주문 정보

const { status, data } = await apiInstance.ordersPost(
    body
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **body** | **WGiftServerInternalAppServicesCreateOrderInput**| 주문 정보 | |


### Return type

**InternalApiHandlersAPIResponse**

### Authorization

[BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**201** | Created |  -  |
|**400** | Bad Request |  -  |
|**500** | Internal Server Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

