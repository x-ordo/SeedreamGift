# AdminNoticesApi

All URIs are relative to *http://localhost:5140/api/v1*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**adminNoticesGet**](#adminnoticesget) | **GET** /admin/notices | 공지사항 목록 조회|
|[**adminNoticesIdDelete**](#adminnoticesiddelete) | **DELETE** /admin/notices/{id} | 공지사항 삭제|
|[**adminNoticesIdGet**](#adminnoticesidget) | **GET** /admin/notices/{id} | 공지사항 상세 조회|
|[**adminNoticesIdPatch**](#adminnoticesidpatch) | **PATCH** /admin/notices/{id} | 공지사항 수정|
|[**adminNoticesPost**](#adminnoticespost) | **POST** /admin/notices | 공지사항 생성|

# **adminNoticesGet**
> InternalApiHandlersAPIResponse adminNoticesGet()


### Example

```typescript
import {
    AdminNoticesApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AdminNoticesApi(configuration);

let page: number; //페이지 번호 (optional) (default to 1)
let limit: number; //페이지 크기 (optional) (default to 20)

const { status, data } = await apiInstance.adminNoticesGet(
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
|**500** | Internal Server Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **adminNoticesIdDelete**
> InternalApiHandlersAPIResponse adminNoticesIdDelete()


### Example

```typescript
import {
    AdminNoticesApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AdminNoticesApi(configuration);

let id: number; //공지사항 ID (default to undefined)

const { status, data } = await apiInstance.adminNoticesIdDelete(
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

# **adminNoticesIdGet**
> InternalApiHandlersAPIResponse adminNoticesIdGet()


### Example

```typescript
import {
    AdminNoticesApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AdminNoticesApi(configuration);

let id: number; //공지사항 ID (default to undefined)

const { status, data } = await apiInstance.adminNoticesIdGet(
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

# **adminNoticesIdPatch**
> InternalApiHandlersAPIResponse adminNoticesIdPatch(body)


### Example

```typescript
import {
    AdminNoticesApi,
    Configuration,
    WGiftServerInternalDomainNotice
} from './api';

const configuration = new Configuration();
const apiInstance = new AdminNoticesApi(configuration);

let id: number; //공지사항 ID (default to undefined)
let body: WGiftServerInternalDomainNotice; //공지사항 정보

const { status, data } = await apiInstance.adminNoticesIdPatch(
    id,
    body
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **body** | **WGiftServerInternalDomainNotice**| 공지사항 정보 | |
| **id** | [**number**] | 공지사항 ID | defaults to undefined|


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

# **adminNoticesPost**
> InternalApiHandlersAPIResponse adminNoticesPost(body)


### Example

```typescript
import {
    AdminNoticesApi,
    Configuration,
    WGiftServerInternalDomainNotice
} from './api';

const configuration = new Configuration();
const apiInstance = new AdminNoticesApi(configuration);

let body: WGiftServerInternalDomainNotice; //공지사항 정보

const { status, data } = await apiInstance.adminNoticesPost(
    body
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **body** | **WGiftServerInternalDomainNotice**| 공지사항 정보 | |


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

