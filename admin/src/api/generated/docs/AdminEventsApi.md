# AdminEventsApi

All URIs are relative to *http://localhost:5140/api/v1*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**adminEventsGet**](#admineventsget) | **GET** /admin/events | 이벤트 목록 조회|
|[**adminEventsIdDelete**](#admineventsiddelete) | **DELETE** /admin/events/{id} | 이벤트 삭제|
|[**adminEventsIdGet**](#admineventsidget) | **GET** /admin/events/{id} | 이벤트 상세 조회|
|[**adminEventsIdPatch**](#admineventsidpatch) | **PATCH** /admin/events/{id} | 이벤트 수정|
|[**adminEventsPost**](#admineventspost) | **POST** /admin/events | 이벤트 생성|

# **adminEventsGet**
> InternalApiHandlersAPIResponse adminEventsGet()


### Example

```typescript
import {
    AdminEventsApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AdminEventsApi(configuration);

let page: number; //페이지 번호 (optional) (default to 1)
let limit: number; //페이지 크기 (optional) (default to 20)

const { status, data } = await apiInstance.adminEventsGet(
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

# **adminEventsIdDelete**
> InternalApiHandlersAPIResponse adminEventsIdDelete()


### Example

```typescript
import {
    AdminEventsApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AdminEventsApi(configuration);

let id: number; //이벤트 ID (default to undefined)

const { status, data } = await apiInstance.adminEventsIdDelete(
    id
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **id** | [**number**] | 이벤트 ID | defaults to undefined|


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

# **adminEventsIdGet**
> InternalApiHandlersAPIResponse adminEventsIdGet()


### Example

```typescript
import {
    AdminEventsApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AdminEventsApi(configuration);

let id: number; //이벤트 ID (default to undefined)

const { status, data } = await apiInstance.adminEventsIdGet(
    id
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **id** | [**number**] | 이벤트 ID | defaults to undefined|


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

# **adminEventsIdPatch**
> InternalApiHandlersAPIResponse adminEventsIdPatch(body)


### Example

```typescript
import {
    AdminEventsApi,
    Configuration,
    WGiftServerInternalDomainEvent
} from './api';

const configuration = new Configuration();
const apiInstance = new AdminEventsApi(configuration);

let id: number; //이벤트 ID (default to undefined)
let body: WGiftServerInternalDomainEvent; //이벤트 정보

const { status, data } = await apiInstance.adminEventsIdPatch(
    id,
    body
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **body** | **WGiftServerInternalDomainEvent**| 이벤트 정보 | |
| **id** | [**number**] | 이벤트 ID | defaults to undefined|


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

# **adminEventsPost**
> InternalApiHandlersAPIResponse adminEventsPost(body)


### Example

```typescript
import {
    AdminEventsApi,
    Configuration,
    WGiftServerInternalDomainEvent
} from './api';

const configuration = new Configuration();
const apiInstance = new AdminEventsApi(configuration);

let body: WGiftServerInternalDomainEvent; //이벤트 정보

const { status, data } = await apiInstance.adminEventsPost(
    body
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **body** | **WGiftServerInternalDomainEvent**| 이벤트 정보 | |


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

