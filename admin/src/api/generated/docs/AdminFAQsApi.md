# AdminFAQsApi

All URIs are relative to *http://localhost:5140/api/v1*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**adminFaqsGet**](#adminfaqsget) | **GET** /admin/faqs | FAQ 목록 조회|
|[**adminFaqsIdDelete**](#adminfaqsiddelete) | **DELETE** /admin/faqs/{id} | FAQ 삭제|
|[**adminFaqsIdGet**](#adminfaqsidget) | **GET** /admin/faqs/{id} | FAQ 상세 조회|
|[**adminFaqsIdPatch**](#adminfaqsidpatch) | **PATCH** /admin/faqs/{id} | FAQ 수정|
|[**adminFaqsPost**](#adminfaqspost) | **POST** /admin/faqs | FAQ 생성|

# **adminFaqsGet**
> InternalApiHandlersAPIResponse adminFaqsGet()


### Example

```typescript
import {
    AdminFAQsApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AdminFAQsApi(configuration);

let page: number; //페이지 번호 (optional) (default to 1)
let limit: number; //페이지 크기 (optional) (default to 20)

const { status, data } = await apiInstance.adminFaqsGet(
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

# **adminFaqsIdDelete**
> InternalApiHandlersAPIResponse adminFaqsIdDelete()


### Example

```typescript
import {
    AdminFAQsApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AdminFAQsApi(configuration);

let id: number; //FAQ ID (default to undefined)

const { status, data } = await apiInstance.adminFaqsIdDelete(
    id
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **id** | [**number**] | FAQ ID | defaults to undefined|


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

# **adminFaqsIdGet**
> InternalApiHandlersAPIResponse adminFaqsIdGet()


### Example

```typescript
import {
    AdminFAQsApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AdminFAQsApi(configuration);

let id: number; //FAQ ID (default to undefined)

const { status, data } = await apiInstance.adminFaqsIdGet(
    id
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **id** | [**number**] | FAQ ID | defaults to undefined|


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

# **adminFaqsIdPatch**
> InternalApiHandlersAPIResponse adminFaqsIdPatch(body)


### Example

```typescript
import {
    AdminFAQsApi,
    Configuration,
    WGiftServerInternalDomainFaq
} from './api';

const configuration = new Configuration();
const apiInstance = new AdminFAQsApi(configuration);

let id: number; //FAQ ID (default to undefined)
let body: WGiftServerInternalDomainFaq; //FAQ 정보

const { status, data } = await apiInstance.adminFaqsIdPatch(
    id,
    body
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **body** | **WGiftServerInternalDomainFaq**| FAQ 정보 | |
| **id** | [**number**] | FAQ ID | defaults to undefined|


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

# **adminFaqsPost**
> InternalApiHandlersAPIResponse adminFaqsPost(body)


### Example

```typescript
import {
    AdminFAQsApi,
    Configuration,
    WGiftServerInternalDomainFaq
} from './api';

const configuration = new Configuration();
const apiInstance = new AdminFAQsApi(configuration);

let body: WGiftServerInternalDomainFaq; //FAQ 정보

const { status, data } = await apiInstance.adminFaqsPost(
    body
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **body** | **WGiftServerInternalDomainFaq**| FAQ 정보 | |


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

