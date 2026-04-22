# AdminOrdersApi

All URIs are relative to *http://localhost:5140/api/v1*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**adminOrdersGet**](#adminordersget) | **GET** /admin/orders | 주문 목록 조회|
|[**adminOrdersIdGet**](#adminordersidget) | **GET** /admin/orders/{id} | 주문 상세 조회|
|[**adminOrdersIdStatusPatch**](#adminordersidstatuspatch) | **PATCH** /admin/orders/{id}/status | 주문 상태 변경|

# **adminOrdersGet**
> InternalApiHandlersAPIResponse adminOrdersGet()


### Example

```typescript
import {
    AdminOrdersApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AdminOrdersApi(configuration);

let page: number; //페이지 번호 (optional) (default to 1)
let limit: number; //페이지 크기 (optional) (default to 20)
let status: string; //상태 필터 (optional) (default to undefined)

const { status, data } = await apiInstance.adminOrdersGet(
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

# **adminOrdersIdGet**
> InternalApiHandlersAPIResponse adminOrdersIdGet()


### Example

```typescript
import {
    AdminOrdersApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AdminOrdersApi(configuration);

let id: number; //주문 ID (default to undefined)

const { status, data } = await apiInstance.adminOrdersIdGet(
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
|**404** | Not Found |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **adminOrdersIdStatusPatch**
> InternalApiHandlersAPIResponse adminOrdersIdStatusPatch(body)


### Example

```typescript
import {
    AdminOrdersApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AdminOrdersApi(configuration);

let id: number; //주문 ID (default to undefined)
let body: object; //주문 상태

const { status, data } = await apiInstance.adminOrdersIdStatusPatch(
    id,
    body
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **body** | **object**| 주문 상태 | |
| **id** | [**number**] | 주문 ID | defaults to undefined|


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

