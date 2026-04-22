# TradeInsApi

All URIs are relative to *http://localhost:5140/api/v1*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**tradeInsIdGet**](#tradeinsidget) | **GET** /trade-ins/{id} | 매입 신청 상세 조회|
|[**tradeInsMyGet**](#tradeinsmyget) | **GET** /trade-ins/my | 내 매입 신청 목록 조회|
|[**tradeInsPost**](#tradeinspost) | **POST** /trade-ins | 매입 신청|

# **tradeInsIdGet**
> InternalApiHandlersAPIResponse tradeInsIdGet()


### Example

```typescript
import {
    TradeInsApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new TradeInsApi(configuration);

let id: number; //매입 신청 ID (default to undefined)

const { status, data } = await apiInstance.tradeInsIdGet(
    id
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **id** | [**number**] | 매입 신청 ID | defaults to undefined|


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

# **tradeInsMyGet**
> InternalApiHandlersAPIResponse tradeInsMyGet()


### Example

```typescript
import {
    TradeInsApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new TradeInsApi(configuration);

let page: number; //페이지 (optional) (default to 1)
let limit: number; //페이지당 항목 수 (optional) (default to 10)

const { status, data } = await apiInstance.tradeInsMyGet(
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

# **tradeInsPost**
> InternalApiHandlersAPIResponse tradeInsPost(body)


### Example

```typescript
import {
    TradeInsApi,
    Configuration,
    WGiftServerInternalAppServicesCreateTradeInInput
} from './api';

const configuration = new Configuration();
const apiInstance = new TradeInsApi(configuration);

let body: WGiftServerInternalAppServicesCreateTradeInInput; //매입 신청 정보

const { status, data } = await apiInstance.tradeInsPost(
    body
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **body** | **WGiftServerInternalAppServicesCreateTradeInInput**| 매입 신청 정보 | |


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

