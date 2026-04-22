# AdminGiftsApi

All URIs are relative to *http://localhost:5140/api/v1*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**adminGiftsGet**](#admingiftsget) | **GET** /admin/gifts | 선물 목록 조회|
|[**adminGiftsIdGet**](#admingiftsidget) | **GET** /admin/gifts/{id} | 선물 상세 조회|
|[**adminGiftsStatsGet**](#admingiftsstatsget) | **GET** /admin/gifts/stats | 선물 통계 조회|

# **adminGiftsGet**
> InternalApiHandlersAPIResponse adminGiftsGet()


### Example

```typescript
import {
    AdminGiftsApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AdminGiftsApi(configuration);

let page: number; //페이지 번호 (optional) (default to 1)
let limit: number; //페이지 크기 (optional) (default to 20)

const { status, data } = await apiInstance.adminGiftsGet(
    page,
    limit
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **page** | [**number**] | 페이지 번호 | (optional) defaults to 1|
| **limit** | [**number**] | 페이지 크기 | (optional) defaults to 20|


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

# **adminGiftsIdGet**
> InternalApiHandlersAPIResponse adminGiftsIdGet()


### Example

```typescript
import {
    AdminGiftsApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AdminGiftsApi(configuration);

let id: number; //선물 ID (default to undefined)

const { status, data } = await apiInstance.adminGiftsIdGet(
    id
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **id** | [**number**] | 선물 ID | defaults to undefined|


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

# **adminGiftsStatsGet**
> InternalApiHandlersAPIResponse adminGiftsStatsGet()


### Example

```typescript
import {
    AdminGiftsApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AdminGiftsApi(configuration);

const { status, data } = await apiInstance.adminGiftsStatsGet();
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

