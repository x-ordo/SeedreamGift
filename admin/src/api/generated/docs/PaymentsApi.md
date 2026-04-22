# PaymentsApi

All URIs are relative to *http://localhost:5140/api/v1*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**paymentsInitiatePost**](#paymentsinitiatepost) | **POST** /payments/initiate | 결제 시작|
|[**paymentsVerifyGet**](#paymentsverifyget) | **GET** /payments/verify | 결제 검증|

# **paymentsInitiatePost**
> InternalApiHandlersAPIResponse paymentsInitiatePost(body)


### Example

```typescript
import {
    PaymentsApi,
    Configuration,
    WGiftServerInternalAppServicesPaymentInitiateRequest
} from './api';

const configuration = new Configuration();
const apiInstance = new PaymentsApi(configuration);

let body: WGiftServerInternalAppServicesPaymentInitiateRequest; //결제 요청 정보

const { status, data } = await apiInstance.paymentsInitiatePost(
    body
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **body** | **WGiftServerInternalAppServicesPaymentInitiateRequest**| 결제 요청 정보 | |


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

# **paymentsVerifyGet**
> InternalApiHandlersAPIResponse paymentsVerifyGet()


### Example

```typescript
import {
    PaymentsApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new PaymentsApi(configuration);

let paymentKey: string; //결제 키 (default to undefined)
let orderId: number; //주문 ID (default to undefined)

const { status, data } = await apiInstance.paymentsVerifyGet(
    paymentKey,
    orderId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **paymentKey** | [**string**] | 결제 키 | defaults to undefined|
| **orderId** | [**number**] | 주문 ID | defaults to undefined|


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

