# AdminInquiriesApi

All URIs are relative to *http://localhost:5140/api/v1*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**adminInquiriesGet**](#admininquiriesget) | **GET** /admin/inquiries | 문의 목록 조회|
|[**adminInquiriesIdAnswerPatch**](#admininquiriesidanswerpatch) | **PATCH** /admin/inquiries/{id}/answer | 문의 답변 등록|
|[**adminInquiriesIdClosePatch**](#admininquiriesidclosepatch) | **PATCH** /admin/inquiries/{id}/close | 문의 종료 처리|
|[**adminInquiriesIdDelete**](#admininquiriesiddelete) | **DELETE** /admin/inquiries/{id} | 문의 삭제|
|[**adminInquiriesIdGet**](#admininquiriesidget) | **GET** /admin/inquiries/{id} | 문의 상세 조회|

# **adminInquiriesGet**
> InternalApiHandlersAPIResponse adminInquiriesGet()


### Example

```typescript
import {
    AdminInquiriesApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AdminInquiriesApi(configuration);

let page: number; //페이지 번호 (optional) (default to 1)
let limit: number; //페이지 크기 (optional) (default to 20)

const { status, data } = await apiInstance.adminInquiriesGet(
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

# **adminInquiriesIdAnswerPatch**
> InternalApiHandlersAPIResponse adminInquiriesIdAnswerPatch(body)


### Example

```typescript
import {
    AdminInquiriesApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AdminInquiriesApi(configuration);

let id: number; //문의 ID (default to undefined)
let body: object; //답변 내용

const { status, data } = await apiInstance.adminInquiriesIdAnswerPatch(
    id,
    body
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **body** | **object**| 답변 내용 | |
| **id** | [**number**] | 문의 ID | defaults to undefined|


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

# **adminInquiriesIdClosePatch**
> InternalApiHandlersAPIResponse adminInquiriesIdClosePatch()


### Example

```typescript
import {
    AdminInquiriesApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AdminInquiriesApi(configuration);

let id: number; //문의 ID (default to undefined)

const { status, data } = await apiInstance.adminInquiriesIdClosePatch(
    id
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **id** | [**number**] | 문의 ID | defaults to undefined|


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

# **adminInquiriesIdDelete**
> InternalApiHandlersAPIResponse adminInquiriesIdDelete()


### Example

```typescript
import {
    AdminInquiriesApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AdminInquiriesApi(configuration);

let id: number; //문의 ID (default to undefined)

const { status, data } = await apiInstance.adminInquiriesIdDelete(
    id
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **id** | [**number**] | 문의 ID | defaults to undefined|


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

# **adminInquiriesIdGet**
> InternalApiHandlersAPIResponse adminInquiriesIdGet()


### Example

```typescript
import {
    AdminInquiriesApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AdminInquiriesApi(configuration);

let id: number; //문의 ID (default to undefined)

const { status, data } = await apiInstance.adminInquiriesIdGet(
    id
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **id** | [**number**] | 문의 ID | defaults to undefined|


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

