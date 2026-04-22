# NoticesApi

All URIs are relative to *http://localhost:5140/api/v1*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**noticesActiveGet**](#noticesactiveget) | **GET** /notices/active | 활성 공지사항 목록 조회|
|[**noticesGet**](#noticesget) | **GET** /notices | 공지사항 목록 조회|
|[**noticesIdGet**](#noticesidget) | **GET** /notices/{id} | 공지사항 단건 조회|
|[**noticesIdViewPatch**](#noticesidviewpatch) | **PATCH** /notices/{id}/view | 공지사항 조회수 증가|

# **noticesActiveGet**
> InternalApiHandlersAPIResponse noticesActiveGet()


### Example

```typescript
import {
    NoticesApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new NoticesApi(configuration);

let limit: number; //조회 개수 (optional) (default to 5)

const { status, data } = await apiInstance.noticesActiveGet(
    limit
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **limit** | [**number**] | 조회 개수 | (optional) defaults to 5|


### Return type

**InternalApiHandlersAPIResponse**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | OK |  -  |
|**500** | Internal Server Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **noticesGet**
> InternalApiHandlersAPIResponse noticesGet()


### Example

```typescript
import {
    NoticesApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new NoticesApi(configuration);

let page: number; //페이지 번호 (optional) (default to 1)
let limit: number; //페이지당 항목 수 (optional) (default to 20)

const { status, data } = await apiInstance.noticesGet(
    page,
    limit
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **page** | [**number**] | 페이지 번호 | (optional) defaults to 1|
| **limit** | [**number**] | 페이지당 항목 수 | (optional) defaults to 20|


### Return type

**InternalApiHandlersAPIResponse**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | OK |  -  |
|**500** | Internal Server Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **noticesIdGet**
> InternalApiHandlersAPIResponse noticesIdGet()


### Example

```typescript
import {
    NoticesApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new NoticesApi(configuration);

let id: number; //공지사항 ID (default to undefined)

const { status, data } = await apiInstance.noticesIdGet(
    id
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **id** | [**number**] | 공지사항 ID | defaults to undefined|


### Return type

**InternalApiHandlersAPIResponse**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | OK |  -  |
|**404** | Not Found |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **noticesIdViewPatch**
> InternalApiHandlersAPIResponse noticesIdViewPatch()


### Example

```typescript
import {
    NoticesApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new NoticesApi(configuration);

let id: number; //공지사항 ID (default to undefined)

const { status, data } = await apiInstance.noticesIdViewPatch(
    id
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **id** | [**number**] | 공지사항 ID | defaults to undefined|


### Return type

**InternalApiHandlersAPIResponse**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | OK |  -  |
|**500** | Internal Server Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

