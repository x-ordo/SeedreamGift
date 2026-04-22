# EventsApi

All URIs are relative to *http://localhost:5140/api/v1*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**eventsActiveGet**](#eventsactiveget) | **GET** /events/active | 활성 이벤트 목록 조회|
|[**eventsFeaturedGet**](#eventsfeaturedget) | **GET** /events/featured | 추천 이벤트 목록 조회|
|[**eventsGet**](#eventsget) | **GET** /events | 이벤트 목록 조회|
|[**eventsIdGet**](#eventsidget) | **GET** /events/{id} | 이벤트 단건 조회|
|[**eventsIdViewPatch**](#eventsidviewpatch) | **PATCH** /events/{id}/view | 이벤트 조회수 증가|

# **eventsActiveGet**
> InternalApiHandlersAPIResponse eventsActiveGet()


### Example

```typescript
import {
    EventsApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new EventsApi(configuration);

let status: string; //이벤트 상태 필터 (optional) (default to undefined)

const { status, data } = await apiInstance.eventsActiveGet(
    status
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **status** | [**string**] | 이벤트 상태 필터 | (optional) defaults to undefined|


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

# **eventsFeaturedGet**
> InternalApiHandlersAPIResponse eventsFeaturedGet()


### Example

```typescript
import {
    EventsApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new EventsApi(configuration);

const { status, data } = await apiInstance.eventsFeaturedGet();
```

### Parameters
This endpoint does not have any parameters.


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

# **eventsGet**
> InternalApiHandlersAPIResponse eventsGet()


### Example

```typescript
import {
    EventsApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new EventsApi(configuration);

let page: number; //페이지 번호 (optional) (default to 1)
let limit: number; //페이지당 항목 수 (optional) (default to 20)

const { status, data } = await apiInstance.eventsGet(
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

# **eventsIdGet**
> InternalApiHandlersAPIResponse eventsIdGet()


### Example

```typescript
import {
    EventsApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new EventsApi(configuration);

let id: number; //이벤트 ID (default to undefined)

const { status, data } = await apiInstance.eventsIdGet(
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

# **eventsIdViewPatch**
> InternalApiHandlersAPIResponse eventsIdViewPatch()


### Example

```typescript
import {
    EventsApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new EventsApi(configuration);

let id: number; //이벤트 ID (default to undefined)

const { status, data } = await apiInstance.eventsIdViewPatch(
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

