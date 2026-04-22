# AdminTradeInsApi

All URIs are relative to *http://localhost:5140/api/v1*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**adminTradeInsGet**](#admintradeinsget) | **GET** /admin/trade-ins | 매입 목록 조회|
|[**adminTradeInsIdGet**](#admintradeinsidget) | **GET** /admin/trade-ins/{id} | 매입 상세 조회|
|[**adminTradeInsIdStatusPatch**](#admintradeinsidstatuspatch) | **PATCH** /admin/trade-ins/{id}/status | 매입 상태 변경|

# **adminTradeInsGet**
> InternalApiHandlersAPIResponse adminTradeInsGet()


### Example

```typescript
import {
    AdminTradeInsApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AdminTradeInsApi(configuration);

let page: number; //페이지 번호 (optional) (default to 1)
let limit: number; //페이지 크기 (optional) (default to 20)
let status: string; //상태 필터 (optional) (default to undefined)

const { status, data } = await apiInstance.adminTradeInsGet(
    page,
    limit,
    status
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **page** | [**number**] | 페이지 번호 | (optional) defaults to 1|
| **limit** | [**number**] | 페이지 크기 | (optional) defaults to 20|
| **status** | [**string**] | 상태 필터 | (optional) defaults to undefined|


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

# **adminTradeInsIdGet**
> InternalApiHandlersAPIResponse adminTradeInsIdGet()


### Example

```typescript
import {
    AdminTradeInsApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AdminTradeInsApi(configuration);

let id: number; //매입 ID (default to undefined)

const { status, data } = await apiInstance.adminTradeInsIdGet(
    id
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **id** | [**number**] | 매입 ID | defaults to undefined|


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
|**404** | Not Found |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **adminTradeInsIdStatusPatch**
> InternalApiHandlersAPIResponse adminTradeInsIdStatusPatch(body)


### Example

```typescript
import {
    AdminTradeInsApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AdminTradeInsApi(configuration);

let id: number; //매입 ID (default to undefined)
let body: object; //상태 및 관리자 메모

const { status, data } = await apiInstance.adminTradeInsIdStatusPatch(
    id,
    body
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **body** | **object**| 상태 및 관리자 메모 | |
| **id** | [**number**] | 매입 ID | defaults to undefined|


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

